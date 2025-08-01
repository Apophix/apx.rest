export declare class ConfigProvider {
    apiIndex: number;
    private userApiConfigs;
    private userConfig?;
    private defaultConfig?;
    preload(): Promise<void>;
    private getValueFromConfig;
    getUserApiConfigs(): Promise<Record<string, any>[] | null>;
    getNumberOfUserConfigs(): Promise<number>;
    private getUserConfig;
    private getDefaultConfig;
    getValue<T = string>(keyPath: string): Promise<T>;
}
//# sourceMappingURL=ConfigProvider.d.ts.map