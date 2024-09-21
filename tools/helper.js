const readPkg = require("read-package-json");
const figlet = require("figlet");
const fs = require("fs/promises");
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename)
const readPackageJson = () => {
    return new Promise((resolve, reject) => {
        readPkg('./package.json', console.error, false, (error, data) => {
            if (error) {
                reject(error);
            } else {
                resolve(data);
            }
        });
    });
};

// Function to read the global.json file
export async function readGlobalJson() {
    try {
      const globalJsonPath = path.resolve(__dirname, '../globals/global.json');  // Adjust path based on your file structure
      const data = await fs.readFile(globalJsonPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading global.json:', error);
      throw error;
    }
  }

// Function to generate ASCII art from text with limited width
const generateAsciiArt = (text) => {
    return new Promise((resolve, reject) => {
        figlet.text(text, {width: 80}, (error, data) => {
            if (error) {
                reject(error);
            } else {
                resolve(data);
            }
        });
    });
};

// Function to center text in the console
const centerText = (text) => {
    const terminalWidth = process.stdout.columns;
    const lines = text.split('\n');

    const centeredLines = lines.map(line => {
        const padding = Math.floor((60 - line.length) / 2);
        return ' '.repeat(padding) + line;
    });

    return centeredLines.join('\n');
};

// Print centered text in the console
const printCenteredText = (text, color, backgroundColor) => {
    console.log(color(centerText(text)));
};

const printLeftedText = (text, color, backgroundColor) => {
    console.log(color(text));
};

module.exports = { readPackageJson, readGlobalJson, printLeftedText, centerText, printCenteredText, generateAsciiArt };