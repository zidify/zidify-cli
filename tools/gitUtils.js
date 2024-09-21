// gitUtils.js

const {execSync} = require('child_process');
const enquirer = require('enquirer');
const axios = require('axios');
const path = require('path');

const isGitUserLoggedIn = () => {
    try {
        const result = execSync('git config --get-regexp user.*', {encoding: 'utf-8'});
        return result.trim().length > 0;
    } catch (error) {
        return false;
    }
};

const promptLogin = async () => {
    const response = await enquirer.prompt({
        type: 'confirm',
        name: 'login',
        message: 'You are not logged into your Git account. Do you want to log in now?',
    });

    return response.login;
};

const performGitLogin = async () => {
    try {
        // const credentials = await enquirer.prompt([
        //     { type: 'input', name: 'username', message: 'GitHub username:' },
        //     { type: 'password', name: 'password', message: 'GitHub password:' },
        // ]);

        // Set Git credentials in the credential cache
        execSync(`git config --global credential.helper cache`);
        execSync(`git config --global credential.helper 'cache --timeout=3600'`);

        // Use Git to perform an operation that requires authentication
        execSync(`git ls-remote https://github.com/SallaApp/theme-raed`, {
            stdio: 'inherit',
            // input: `${credentials.username}\n${credentials.password}\n`,
        });

        console.log('Login successful!');
    } catch (error) {
        console.error('Error during login:', error);
    }
};

const createGitHubRepoFromTemplate = async (accessToken, repoName, templateRepoOwner, templateRepoName, description) => {
    try {
        const response = await axios.post('https://api.github.com/repos/' + templateRepoOwner + '/' + templateRepoName + '/generate', {
            name: repoName,
            description: description,
            include_all_branches: false,
            private: false, // Adjust as needed
        }, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        })
        // console.log("resss" , response?.data)

        return {
            owner: response?.data?.owner,
            clone_url: response.data.clone_url
        }
        // return response.data.clone_url;
    } catch (error) {
        if (error?.message === 'Request failed with status code 422') {
            throw new Error('Error creating GitHub repository. This repo exists in your repos list.');
        }
        throw new Error('Error creating GitHub repository from template: ' + error.message);
    }
};

async function isRepositoryNotEmpty(owner, repo, token) {
    try {
        const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/commits`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        // If there are commits, the repository is not empty
        return response.data.length > 0;
    } catch (error) {
        // Handle errors (e.g., repository not found, network issues)
        console.error('Error:', error.response ? error.response.status : error.message);
        return false;
    }
}


const cloneRepo = async (sourceUrl, destPath) => {
    await execSync(`git clone ${sourceUrl} ${destPath}`, {stdio: 'inherit'});
};

const pullRepoChanges = async (repoFolder) => {
    await execSync(`cd ${repoFolder} && git pull`, {stdio: 'inherit'});
};



module.exports = {
    isGitUserLoggedIn,
    promptLogin,
    performGitLogin,
    cloneRepo,
    createGitHubRepoFromTemplate,
    isRepositoryNotEmpty,
    pullRepoChanges,
};
