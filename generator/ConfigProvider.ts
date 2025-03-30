import chalk from "chalk";
import path from "path";
import fs from "fs/promises"; 
import defaultConfig from "./default-config.js";

const log = console.log; 



export class ConfigProvider { 

	private userConfig?: Record<string, any> | null;
	private defaultConfig?: Record<string, any>; 

	public async preload(): Promise<void> {
		await this.getUserConfig();
		await this.getDefaultConfig();
	}

	private getValueFromConfig<T>(keyPath: string, config: Record<string, any>): T {
		const keys = keyPath.split(".");
		let value = config;
		for (const key of keys) {
			value = value[key];
		}
		if (!value) { 
			throw new Error(`Config key ${keyPath} not found.`);
		}
		return value as T; // if you get a type error that's your problem 
	}

	private async getUserConfig(): Promise<Record<string, any> | null> {
		if (this.userConfig !== undefined) {
			return this.userConfig;
		}

		log(chalk.blueBright("Looking for apx-rest-config.json..."));

		// look for apx-rest-config.json in the current working directory (where command was executed) 
		const configFileName = "apx-rest-config.json";
		const currentWorkingDirectory = process.cwd();
		const configFilePath = path.join(currentWorkingDirectory, configFileName);

		try {
			await fs.access(configFilePath);
			log(chalk.greenBright(`${configFileName} found at ${configFilePath}`));
			this.userConfig = JSON.parse(await fs.readFile(configFilePath, { encoding: "utf-8" })) as Record<string, any>;
		} catch (error) {
			log(chalk.red(`${configFileName} not found in the current working directory.`));
			return null;
		}

		return this.userConfig;
	}

	// this is weird and stupid but we may want to change how the default config is loaded later so. this makes it easier. I guess. 
	private async getDefaultConfig(): Promise<Record<string, any>> {
		if (this.defaultConfig) {
			return this.defaultConfig;
		}

		this.defaultConfig = defaultConfig;
		return this.defaultConfig;
	}

	public async getValue<T = string>(keyPath: string): Promise<T> {
		const userConfig = await this.getUserConfig();
		const defaultConfig = await this.getDefaultConfig();
		const config = { ...defaultConfig, ...userConfig };
		return this.getValueFromConfig<T>(keyPath, config);
	}
}