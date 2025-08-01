import chalk from "chalk";
import path from "path";
import fs from "fs/promises";
import defaultConfig from "./default-config.js";

const log = console.log;

export class ConfigProvider {
	public apiIndex: number = 0;

	private userApiConfigs: Record<string, any>[] | null = null;
	private userConfig?: Record<string, any> | null;
	private defaultConfig?: Record<string, any>;

	public async preload(): Promise<void> {
		await this.getUserApiConfigs();
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

	public async getUserApiConfigs(): Promise<Record<string, any>[] | null> {
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
			const configDto = JSON.parse(
				await fs.readFile(configFilePath, { encoding: "utf-8" })
			) as { apis: Record<string, any>[] }; 
			const userConfigArray = configDto.apis || [];
			if (userConfigArray.length === 0) {
				log(chalk.red(`${configFileName} is empty.`));
				return null;
			}
			this.userApiConfigs = userConfigArray;

			return this.userApiConfigs;
		} catch (error) {
			log(chalk.red(`${configFileName} not found in the current working directory.`));
			return null;
		}
	}

	public async getNumberOfUserConfigs(): Promise<number> {
		const userConfigArray = await this.getUserApiConfigs();
		return userConfigArray?.length ?? 0; 
	}

	private async getUserConfig(): Promise<Record<string, any> | null> {
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
