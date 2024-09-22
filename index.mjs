#!/usr/bin/env node

import chalk from 'chalk';
import {Command} from "commander";
import chokidar from "chokidar"
import enquirer from 'enquirer';  // Import default module
import {exec} from "child_process"

const {Select} = enquirer;  // Destructure Select from the default export
const program = new Command();
import {fileURLToPath} from 'url';

import {cloneRepo, createGitHubRepoFromTemplate, pullRepoChanges} from "./tools/gitUtils.js";
import pkg from './tools/helper.js';
import ora from "ora";
import axios from 'axios';
import puppeteer from "puppeteer"
import fs from "fs"

const {readPackageJson, readGlobalJson, printCenteredText, printLeftedText, generateAsciiArt} = pkg;
import path from "path"
import FormData from 'form-data';

let buildTimeout;

const __filename = fileURLToPath(import.meta.url);
const __dirname = process.cwd();

const folderToWatch = __dirname;  // Replace with your folder path

// Function to trigger the build
async function zidThemeBuild(Cookies, xsrfToken, theme) {
    const spinner = ora('Running zid-theme build...').start();
    // console.log('Running zid-theme build...');
    exec('zid-theme build', {cwd: path.resolve(folderToWatch)}, async (error, stdout, stderr) => {
        if (error) {
            console.error(`Error: ${error.message}`);
            return;
        }
        if (stderr) {
            console.error(`Stderr: ${stderr}`);
            return;
        }
        console.log(`Build output:\n${stdout}`);

        spinner.succeed("Theme built successfully!")

        // Path to your .zip file
        const filePath = path.resolve(process.cwd(), path.basename(process.cwd()) + '.zip');
        // Create a FormData object to hold the file
        const formData = new FormData();
        // Append the file to the form data (first arg is the form field name)
        formData.append('file', fs.createReadStream(filePath));
        formData.append("name", theme?.name)
        formData.append("code", theme?.code)
        // Start the second spinner after build success
        const spinner2 = ora('Uploading theme...').start();
        const response = await axios.post(`https://web.zid.sa/api/v1/themes/${theme?.id}/update`, formData, {
            headers: {
                'X-XSRF-TOKEN': decodeURIComponent(xsrfToken), // Send XSRF-TOKEN
                'Cookie': Cookies, // Send the cookies
            }
        }).then(response => {
            spinner2.succeed("File uploaded successfully!")
        }).catch(error => {
            // console.log("Error uploading file!", error)

            spinner2.fail("Error uploading file!")
        });

    });
}


async function login() {
    // Launch the browser in non-headless mode with disabled web security
    const browser = await puppeteer.launch({
        headless: false, // Visible browser for user interaction
        args: ['--disable-web-security', '--disable-features=IsolateOrigins,site-per-process'], // Disable web security
    });

    const page = await browser.newPage();

    // Set a custom user-agent
    await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36'
    );

    try {
        const spinner = ora('Logging In... , Please, Don\'t close the browser.').start();
        // Navigate to the login page
        await page.goto('https://web.zid.sa/login', {
            waitUntil: 'networkidle0', // Wait for network to be idle
            timeout: 0, // No timeout
        });

        // console.log("Waiting for the user to enter email and submit...");

        // Wait for navigation, which can be to the OTP or password page
        await page.waitForNavigation({
            waitUntil: 'networkidle0',
            timeout: 0, // Wait indefinitely until user submits email and page changes
        });

        // Check if redirected to OTP page or password page
        if (page.url().includes('/otp')) {
            // console.log("User is on the OTP page, waiting for user input...");
            spinner.text = 'Enter the otp sent to your phone.'
        } else if (page.url().includes('/login/password')) {
            // console.log("User is on the password page, waiting for password input...");
            spinner.text = 'Enter the password.'

        }

        // Wait for another navigation to either OTP success or home page
        await page.waitForNavigation({
            waitUntil: 'networkidle0',
            timeout: 0, // Wait until user completes OTP or password login
        });


        if (page.url().includes('/login/password')) {
            spinner.text = 'Enter the password.'

            // console.log("User is on the password page, waiting for password input...");

            // Wait for another navigation to either password success or home page
            await page.waitForNavigation({
                waitUntil: 'networkidle0',
                timeout: 0, // Wait until user completes OTP or password login
            });

            if (page.url().includes('/home')) {
                // console.log("Login successful, redirected to home page.");
                spinner.succeed('You have logged in successfully!')

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

                // Save the cookies to a file
                // fs.writeFileSync('cookies.json', JSON.stringify(cookies, null, 2));
                spinner.succeed('Tokens has been saved!')

                // console.log('Cookies saved to cookies.json', cookies);

                // Close the browser
                await browser.close();
            } else {
                spinner.fail('Login failed!. Please, try again later.')
            }
        } else if (page.url().includes('/home')) {
            spinner.succeed('You have logged in successfully!')

            spinner.succeed('You have logged in successfully!')

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

            // Save the cookies to a file
            // fs.writeFileSync('cookies.json', JSON.stringify(cookies, null, 2));
            spinner.succeed('Tokens has been saved!')

            // Close the browser
            await browser.close();
        } else {
            spinner.fail('Login failed!. Please, try again later.')
        }


        // Check if the login was successful and the user is on the home page

    } catch (error) {
        spinner.fail('Login failed!. Please, try again later.')
    } finally {
        // Close the browser if still open
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
                        const {cookies, xsrfToken} = JSON.parse(data);

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
                                    // console.log(`Selected Theme Name: ${selectedTheme.id}`);


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
