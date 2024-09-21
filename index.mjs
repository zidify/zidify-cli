#!/usr/bin/env node

import chalk from 'chalk';
import { Command } from "commander";
import chokidar from "chokidar"
import enquirer from 'enquirer';  // Import default module
import { exec } from "child_process"
const { Select } = enquirer;  // Destructure Select from the default export
const program = new Command();
import { fileURLToPath } from 'url';

import { cloneRepo, createGitHubRepoFromTemplate, pullRepoChanges } from "./tools/gitUtils.js";
import pkg from './tools/helper.js';
import ora from "ora";
import axios from 'axios';
import puppeteer from "puppeteer"
import fs from "fs"
const { readPackageJson, readGlobalJson, printCenteredText, printLeftedText, generateAsciiArt } = pkg;
import path from "path"
import FormData from 'form-data';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const folderToWatch = __dirname;  // Replace with your folder path

// Function to trigger the build
async function zidThemeBuild(xsrfToken, Cookies, theme) {
  const spinner = ora('Running zid-theme build...').start();
  // console.log('Running zid-theme build...');
  exec('zid-theme build', { cwd: path.resolve(folderToWatch) }, async (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`Stderr: ${stderr}`);
      return;
    }
    console.log(`Build output:\n${stdout}`);

    // Path to your .zip file
    const filePath = path.resolve(__dirname, __dirname + '.zip');
    // Create a FormData object to hold the file
    const formData = new FormData();
    // Append the file to the form data (first arg is the form field name)
    formData.append('file', fs.createReadStream(filePath));
    formData.append("name", theme?.name)
    formData.append("code", theme?.code)
    const response = await axios.post("https://web.zid.sa/api/v1/themes/" + theme?.id, formData, {
      headers: {
        'X-XSRF-TOKEN': decodeURIComponent(xsrfToken), // Send XSRF-TOKEN
        'Cookie': cookieString,      // Send the cookies
        ...formData.getHeaders()
      }
    }).then(response => {
      spinner.succeed("File uploaded successfully!")
    })
      .catch(error => {
        spinner.fail("Error uploading file!")
      });

  });
}

function getCookieValue(cookieString, name) {
  const cookies = cookieString.split(';');
  for (let cookie of cookies) {
    const [key, value] = cookie.split('=');
    if (key.trim() === name) {
      return value;
    }
  }
  return null;
}


async function login() {
  // Launch the browser in non-headless mode with disabled web security and a custom user-agent
  const browser = await puppeteer.launch({
    headless: false, // Set to false to open the browser visibly
    args: ['--disable-web-security', '--disable-features=IsolateOrigins,site-per-process'], // Disable web security in case of cross-origin issues
  });

  const page = await browser.newPage();

  // Set a custom user-agent to mimic a regular browser
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36'
  );

  // Enable JavaScript explicitly (enabled by default, but ensuring it here)
  await page.setJavaScriptEnabled(true);

  // Log the console messages from the page
  page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));

  try {
    // Go to the login page with an increased timeout and wait for a specific element
    await page.goto('https://web.zid.sa/login', {
      waitUntil: 'networkidle0', // Wait for network to be idle (no requests)
      timeout: 0, // No timeout, wait indefinitely
    });

    // Wait for the login form or a specific element to ensure the page is fully loaded
    await page.waitForSelector('input[name="email"]'); // Adjust selector if necessary

    // Get the cookies for the current page
    const cookies = await page.cookies();

    // Format the cookies into a string as key=value; key=value
    const cookieString = cookies
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join('; ');

    // Extract the XSRF-TOKEN separately
    const xsrfToken = cookies.find(cookie => cookie.name === 'XSRF-TOKEN')?.value || 'XSRF-TOKEN not found';

    // Log the formatted cookies string and the XSRF-TOKEN
    // console.log('Cookies String:', cookieString);
    // console.log('XSRF-TOKEN:', decodeURIComponent(xsrfToken));

    // Save the cookies and XSRF-TOKEN to a file
    const cookieData = {
      cookies: cookieString,
      xsrfToken: decodeURIComponent(xsrfToken)
    };

    fs.writeFileSync('cookies.json', JSON.stringify(cookieData, null, 2));
    console.log('Cookies and XSRF-TOKEN saved to cookies.json');

    // Close the browser
    await browser.close();

    const answer = await enquirer.prompt([
      {
        type: 'input',
        name: 'email',
        message: 'Enter your email:',
        validate: value => value.length > 0 ? true : 'Please enter your email'
      },
      {
        type: 'password',
        name: 'password',
        message: 'Enter your password:',
        mask: '*',
        validate: value => value.length > 0 ? true : 'Please enter your password'
      }
    ]);

    const { email, password } = answer;

    // Start spinner
    const spinner = ora('Logging in...').start();

    const response = await axios.post("https://web.zid.sa/auth/v1/validate_login", {
      email,
      password
    }, {
      headers: {
        'X-XSRF-TOKEN': decodeURIComponent(xsrfToken), // Send XSRF-TOKEN
        'Cookie': cookieString      // Send the cookies
      }
    });

    spinner.succeed('Logged In!');

  } catch (error) {
    console.error('Error occurred, try again later:', error.message);
  } finally {
    // Close the browser if it is still open
    if (browser.isConnected()) {
      await browser.close();
    }
  }
}



// Print ASCII art message when the CLI starts
(async () => {
  try {
    const asciiArt = await generateAsciiArt('Zidify CLI');
    const packageJson = await readPackageJson();
    const global = await readGlobalJson();

    printCenteredText(asciiArt, chalk.blue);
    printCenteredText(`Version: ${packageJson.version}`, chalk.green);
    printCenteredText(global?.content?.about, chalk.yellow);
    printCenteredText("", chalk.yellow);
    printLeftedText(chalk.bgWhite(chalk.black(" INFO ")) + '  Read the docs: ' + packageJson?.repository?.url, chalk.white, "info");
    printLeftedText(chalk.bgWhite(chalk.black(" INFO ")) + '  Support and bugs: ' + packageJson?.bugs?.url, chalk.white, "info");
    printCenteredText("", chalk.yellow);


    program
      .name(packageJson?.name)
      .version(packageJson.version);

    let login_command = program.command('login')
      // .description("Your gateway to creating elegant Mahlk Themes.");
      .description(global?.content?.commands?.login?.description).alias("l")
      .action(async () => {
        await login()
      });


    let preview_command = program.command('preview')
      .description(global?.content?.commands?.preview?.description)
      .alias("p")
      .action(async () => {
        const spinner = ora('Checking cookies.json and fetching data...').start();

        try {
          // Check if cookies.json exists
          if (fs.existsSync('cookies.json')) {
            const data = fs.readFileSync('cookies.json', 'utf8');
            const { cookies, xsrfToken } = JSON.parse(data);

            // Ensure cookies and XSRF-TOKEN exist
            if (cookies && xsrfToken) {
              spinner.text = 'Get Themes...';

              // Send a request to the API with the cookies and XSRF-TOKEN
              const response = await axios.get('https://web.zid.sa/api/v1/themes', {
                headers: {
                  'X-XSRF-TOKEN': decodeURIComponent(xsrfToken), // Send XSRF-TOKEN
                  'Cookie': cookies, // Send the cookies
                },
              });

              spinner.succeed('Theme Loaded!');

              // Extract themes from the response data
              const themes = response?.data?.data?.customThemes?.themes;

              if (themes && themes.length > 0) {
                // Create an array of choices for the prompt
                const themeChoices = themes.map(theme => ({
                  name: theme.name,   // Display theme name
                  value: theme.id     // Use theme ID as value
                }));

                const prompt = new Select({
                  name: 'theme',
                  message: 'Select a theme:',
                  choices: themeChoices
                });

                // Await the user's selection of theme ID
                const selectedThemeId = await prompt.run();

                // Find the selected theme by ID
                const selectedTheme = themes.find(theme => theme.name === selectedThemeId);

                if (selectedTheme) {
                  console.log(`Selected Theme Name: ${selectedTheme.id}`);


                  await zidThemeBuild(cookies, xsrfToken, selectedTheme);


                  // Watcher configuration
                  const watcher = chokidar.watch(folderToWatch, {
                    ignored: /(^|[\/\\])\..|\.zip$/,  // Ignore dotfiles and zip files
                    persistent: true,
                    ignoreInitial: true,        // Ignore the initial 'add' events
                    followSymlinks: false,
                    depth: 10,                  // Adjust this as per your folder structure
                    awaitWriteFinish: {         // Ensures file writes are finished before triggering the event
                      stabilityThreshold: 200,
                      pollInterval: 100
                    }
                  });

                  // Watch for 'change', 'unlink' or 'add' events, and debounce to avoid multiple triggers
                  watcher.on('all', (event, path) => {
                    if (event === 'change' || event === 'add' || event === 'unlink') {
                      console.log(`File ${event}: ${path}`);

                      // Clear any existing timeouts to debounce events
                      if (buildTimeout) clearTimeout(buildTimeout);

                      // Set a timeout to trigger the build after no more events are fired for 500ms
                      buildTimeout = setTimeout(async () => {
                        await zidThemeBuild(cookies, xsrfToken, selectedTheme);
                      }, 500);  // Adjust the debounce time as needed
                    }
                  });

                  watcher.on('ready', () => {
                    console.log('Watching for changes in the theme folder...');
                  });


                } else {
                  console.log('Theme not found.');
                }

              } else {
                console.log('No themes available to choose from.');
              }
            } else {
              spinner.fail('Invalid data in cookies.json (missing cookies or XSRF-TOKEN).');
            }
          } else {
            spinner.fail('cookies.json file not found.');
          }
        } catch (error) {
          spinner.fail('Error fetching data: ' + error.message);
        }
      });



    program.parse(process.argv);
  } catch (error) {
    console.error('Error generating ASCII art:', error);
  }
})();