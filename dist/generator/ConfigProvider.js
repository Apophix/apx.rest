import chalk from "chalk";
import path from "path";
import fs from "fs/promises";
import defaultConfig from "./default-config.js";
const log = console.log;
export class ConfigProvider {
    apiIndex = 0;
    userApiConfigs = null;
    userConfig;
    defaultConfig;
    async preload() {
        await this.getUserApiConfigs();
        await this.getUserConfig();
        await this.getDefaultConfig();
    }
    getValueFromConfig(keyPath, config) {
        const keys = keyPath.split(".");
        let value = config;
        for (const key of keys) {
            value = value[key];
        }
        if (!value) {
            throw new Error(`Config key ${keyPath} not found.`);
        }
        return value; // if you get a type error that's your problem
    }
    async getUserApiConfigs() {
        if (this.userApiConfigs !== null) {
            return this.userApiConfigs;
        }
        log(chalk.blueBright("Looking for apx-rest-configs.json..."));
        const configFileName = "apx-rest-config.json";
        const currentWorkingDirectory = process.cwd();
        const configFilePath = path.join(currentWorkingDirectory, configFileName);
        try {
            await fs.access(configFilePath);
            log(chalk.greenBright(`${configFileName} found at ${configFilePath}`));
            const configDto = JSON.parse(await fs.readFile(configFilePath, { encoding: "utf-8" }));
            const userConfigArray = configDto.apis || [];
            if (userConfigArray.length === 0) {
                log(chalk.red(`${configFileName} is empty.`));
                return null;
            }
            this.userApiConfigs = userConfigArray;
            return this.userApiConfigs;
        }
        catch (error) {
            log(chalk.red(`${configFileName} not found in the current working directory.`));
            return null;
        }
    }
    async getNumberOfUserConfigs() {
        const userConfigArray = await this.getUserApiConfigs();
        return userConfigArray?.length ?? 0;
    }
    async getUserConfig() {
        if (this.userConfig !== undefined) {
            return this.userConfig;
        }
        const userConfigArray = await this.getUserApiConfigs();
        if (!userConfigArray) {
            log(chalk.red("No user config found."));
            return null;
        }
        if (this.apiIndex >= userConfigArray.length) {
            log(chalk.red(`apiIndex ${this.apiIndex} is out of bounds.`));
            throw new Error(`apiIndex ${this.apiIndex} is out of bounds.`);
        }
        this.userConfig = userConfigArray[this.apiIndex];
        return this.userConfig;
    }
    // this is weird and stupid but we may want to change how the default config is loaded later so. this makes it easier. I guess.
    async getDefaultConfig() {
        if (this.defaultConfig) {
            return this.defaultConfig;
        }
        this.defaultConfig = defaultConfig;
        return this.defaultConfig;
    }
    async getValue(keyPath) {
        const userConfig = await this.getUserConfig();
        const defaultConfig = await this.getDefaultConfig();
        const config = { ...defaultConfig, ...userConfig };
        return this.getValueFromConfig(keyPath, config);
    }
}
