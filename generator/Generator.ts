import chalk from "chalk";
import { promises as fs } from "fs";
import path from "path";
import { ConfigProvider } from "./ConfigProvider.js";
import { isDate } from "util/types";

function log(...args: string[]) {
	console.log(...args);
}

function iLog(indentLevel: number, ...args: string[]) {
	console.log("\t".repeat(indentLevel), ...args);
}

// NOTE: when implementing multi-api support, we'll put these in each loop and pass it or something. Idk. we can just hack it honestly idrc
const enumComponents = new Map<string, EnumComponent>();
const requestComponents = new Map<string, RequestComponent>();
const responseComponents = new Map<string, ResponseComponent>();
const modelComponents = new Map<string, ModelComponent>();
const enumNames = new Set<string>();

export class Generator {
	public async generate(): Promise<void> {
		log(chalk.blueBright("Looking for apx-rest-config.json..."));

		// look for apx-rest-config.json in the current working directory (where command was executed)
		const configProvider = new ConfigProvider();
		await configProvider.preload();

		log(chalk.blueBright("Fetching OpenAPI document..."));

		// set fetch to ignore self-signed cert
		process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

		const documentUrl = await configProvider.getValue<string>("openApiJsonDocumentUrl");
		const response = await fetch(documentUrl);
		if (!response.ok) {
			log(chalk.red("Failed to fetch OpenAPI document."));
			return;
		}
		const openApiDocument = await response.json();
		log(chalk.greenBright("OpenAPI document fetched successfully."));

		log(chalk.blueBright("Parsing OpenAPI document..."));

		const requestNames = new Set<string>();
		const responseNames = new Set<string>();

		for (const [endpoint, path] of Object.entries<any>(openApiDocument["paths"])) {
			for (const [method, operation] of Object.entries<any>(path)) {
				const responses = operation["responses"];
				for (const [responseCode, response] of Object.entries<any>(responses)) {
					const contents = response["content"];
					if (!contents) {
						continue;
					}

					for (const [contentType, content] of Object.entries<any>(contents)) {
						const schema = content["schema"];
						if (!schema) {
							continue;
						}

						const schemaRef = content["schema"]["$ref"];
						const schemaName = schemaRef.split("/").pop();
						iLog(1, chalk.cyanBright(`Parsing response ${schemaName} in endpoint ${endpoint}`));
						responseNames.add(schemaName);
					}
				}

				const requestBody = operation["requestBody"];
				if (requestBody) {
					const contents = requestBody["content"];
					for (const [contentType, content] of Object.entries<any>(contents)) {
						const schema = content["schema"];
						if (!schema) {
							continue;
						}

						const schemaRef = content["schema"]["$ref"];
						const schemaName = schemaRef.split("/").pop();
						iLog(1, chalk.cyanBright(`Parsing request ${schemaName} in endpoint ${endpoint}`));
						requestNames.add(schemaName);
					}
				}
			}
		}
		log(chalk.greenBright("OpenAPI document parsed successfully."));
		log(chalk.blueBright("Processing components..."));

		const components = openApiDocument["components"]?.["schemas"];
		if (!components) {
			log(chalk.red("No components found in OpenAPI document."));
			return;
		}

		for (const [schemaName, schema] of Object.entries<any>(components)) {
			iLog(1, chalk.cyanBright(`Processing component schema ${schemaName}...`));

			if (schema["enum"]) {
				iLog(2, chalk.cyanBright.dim("Processing as enum"));
				enumComponents.set(
					schemaName,
					new EnumComponent({ name: schemaName, values: schema["enum"] })
				);
				enumNames.add(schemaName);
				continue;
			}

			if (requestNames.has(schemaName)) {
				iLog(2, chalk.cyanBright.dim("Processing as request"));
				requestComponents.set(
					schemaName,
					new RequestComponent({
						name: schemaName,
						requiredProperties: schema["required"] || [],
						componentType: EComponentType.Request,
						properties: Object.entries<any>(schema["properties"]).map(
							([propertyName, property]) => {
								let nullable = property["nullable"] || !!property["$ref"] || false;
								if (schema["required"]) {
									if (schema["required"].includes(propertyName)) {
										nullable = false;
									}
								}
								const referenceIsEnum = enumNames.has(property["$ref"]?.split("/").pop());
								return new Property({
									name: propertyName,
									type: property["type"],
									nullable: nullable,
									format: property["format"],
									["$ref"]: property["$ref"],
									referenceIsEnum,
									items: property["items"],
									additionalProperties: property["additionalProperties"],
								});
							}
						),
					})
				);
				continue;
			}

			if (responseNames.has(schemaName)) {
				iLog(2, chalk.cyanBright.dim("Processing as response"));
				responseComponents.set(
					schemaName,
					new ResponseComponent({
						name: schemaName,
						requiredProperties: schema["required"] || [],
						properties: Object.entries<any>(schema["properties"]).map(
							([propertyName, property]) => {
								let nullable = property["nullable"] || !!property["$ref"] || false;
								if (schema["required"]) {
									if (schema["required"].includes(propertyName)) {
										nullable = false;
									}
								}
								const referenceIsEnum = enumNames.has(property["$ref"]?.split("/").pop());
								return new Property({
									name: propertyName,
									type: property["type"],
									nullable: nullable,
									format: property["format"],
									["$ref"]: property["$ref"],
									referenceIsEnum,
									items: property["items"],
									additionalProperties: property["additionalProperties"],
								});
							}
						),
						componentType: EComponentType.Response,
					})
				);
				continue;
			}

			iLog(2, chalk.cyanBright.dim("Processing as model"));
			modelComponents.set(
				schemaName,
				new ModelComponent({
					name: schemaName,
					requiredProperties: schema["required"] || [],
					componentType: EComponentType.Model,
					properties: Object.entries<any>(schema["properties"]).map(([propertyName, property]) => {
						let nullable = property["nullable"] || !!property["$ref"] || false;
						if (schema["required"]) {
							if (schema["required"].includes(propertyName)) {
								nullable = false;
							}
						}
						const referenceIsEnum = enumNames.has(property["$ref"]?.split("/").pop());
						return new Property({
							name: propertyName,
							type: property["type"],
							nullable: nullable,
							format: property["format"],
							["$ref"]: property["$ref"],
							referenceIsEnum,
							items: property["items"],
							additionalProperties: property["additionalProperties"],
						});
					}),
				})
			);
		}
		log(chalk.greenBright("Components processed successfully."));
		log(chalk.blueBright("Generating client code..."));

		let outputStr = "// This file was generated by apx.rest\n";
		outputStr += "// Do not modify this file directly\n\n";

		outputStr += 'import { ApiClient } from "apx.rest";\n\n';

		for (const requestComponent of requestComponents.values()) {
			outputStr += requestComponent.render();
			outputStr += "\n\n";
		}

		for (const responseComponent of responseComponents.values()) {
			outputStr += responseComponent.render();
			outputStr += "\n\n";
		}

		for (const enumComponent of enumComponents.values()) {
			outputStr += enumComponent.render();
			outputStr += "\n\n";
		}

		for (const modelComponent of modelComponents.values()) {
			outputStr += modelComponent.render();
			outputStr += "\n\n";
		}

		const paths: ApiPath[] = [];

		const streamedEndpoints = await configProvider.getValue<string[]>("streamedEndpoints");

		for (const [endpoint, path] of Object.entries<any>(openApiDocument["paths"])) {
			for (const [method, operation] of Object.entries<any>(path)) {
				paths.push(
					new ApiPath({
						endpoint,
						method,
						operationId: operation.operationId,
						requestComponentName: operation.requestBody?.content?.[
							"application/json"
						]?.schema?.$ref
							?.split("/")
							.pop(),
						responseComponentName: operation.responses["200"]?.content?.[
							"application/json"
						]?.schema?.$ref
							?.split("/")
							.pop(),
						isStreamed: streamedEndpoints.includes(endpoint),
					})
				);
			}
		}

		const clientName = await configProvider.getValue<string>("clientName");
		let baseUrl = await configProvider.getValue<string>("clientBaseUrlValue");

		if (baseUrl.startsWith("http")) {
			baseUrl = `"${baseUrl}"`;
		}

		outputStr += `export class ${clientName} extends ApiClient {\n`;
		outputStr += `\tpublic constructor() {\n`;
		outputStr += `\t\tsuper(${baseUrl});\n`;

		outputStr += `\t}\n`;
		outputStr += `\n`;

		for (const path of paths) {
			outputStr += `\t${path.render()}\n`;
		}

		outputStr += "}";

		const outputPath = await configProvider.getValue<string>("outputBaseDirectory");
		const outputDir = path.join(process.cwd(), outputPath);
		await fs.mkdir(outputDir, { recursive: true });
		const newFile = path.join(outputDir, `${clientName}.ts`);
		await fs.writeFile(newFile, outputStr);

		log(chalk.greenBright("Client code generated successfully."));
	}
}

type TApiPathDto = {
	endpoint: string;
	method: string;
	operationId: string;
	requestComponentName: string;
	responseComponentName: string;
	isStreamed: boolean;
};

class ApiPath implements TApiPathDto {
	public endpoint: string;
	public method: string;
	public operationId: string;
	public requestComponentName: string;
	public responseComponentName: string;
	public isStreamed: boolean;

	public constructor(dto: TApiPathDto) {
		this.endpoint = dto.endpoint;
		if (this.endpoint.startsWith("/")) {
			this.endpoint = this.endpoint.substring(1);
		}
		this.method = dto.method;
		this.operationId = dto.operationId;
		this.requestComponentName = dto.requestComponentName;
		this.responseComponentName = dto.responseComponentName;
		this.isStreamed = dto.isStreamed;
	}

	public get requestComponent(): RequestComponent | undefined {
		return requestComponents.get(this.requestComponentName);
	}

	public get responseComponent(): ResponseComponent | undefined {
		return responseComponents.get(this.responseComponentName);
	}

	public get clientMethodName(): string {
		const suffix = this.isStreamed ? "Stream" : "";
		const prefix = this.isStreamed ? "*" : "";

		if (this.responseComponent) {
			const lowerCaseComponentName =
				this.responseComponent.name.charAt(0).toLowerCase() + this.responseComponent.name.slice(1);
			return prefix + lowerCaseComponentName.replace("Response", "") + suffix;
		}

		if (this.requestComponent) {
			const lowerCaseComponentName =
				this.requestComponent.name.charAt(0).toLowerCase() + this.requestComponent.name.slice(1);
			return prefix + lowerCaseComponentName.replace("Request", "") + suffix;
		}

		return prefix + this.operationId + suffix;
	}

	private renderRequestAndStreamedResponse(
		requestDtoName: string,
		responseDtoName: string,
		finalResponse: string,
		clientFunctionName: string
	): string {
		return `public async ${this.clientMethodName}(request: ${requestDtoName}): AsyncGenerator<${finalResponse}> {
		for await (const chunkDto of this.${clientFunctionName}Iterable<${responseDtoName}>(\`${this.endpoint}\`, request)) {
			if (chunkDto) {
				yield new ${finalResponse}(chunkDto);
			}
		}
	}`;
	}

	private renderRequestAndResponse(
		requestDtoName: string,
		responseDtoName: string,
		finalResponse: string,
		clientFunctionName: string
	): string {
		return `public async ${this.clientMethodName}(request: ${requestDtoName}): Promise<${finalResponse}> {

		const { response, data } = await this.${clientFunctionName}<${responseDtoName}>(\`${this.endpoint}\`, request);
		if (response.status !== 200) {
			throw new Error(response.statusText);
		}

		if (!data) { 
			throw new Error('No data returned from server');
		}

		return new ${finalResponse}(data);
	}`;
	}

	private renderRequestOnly(requestDtoName: string, clientFunctionName: string): string {
		return `public async ${this.clientMethodName}(request: ${requestDtoName}): Promise<boolean> {
		const { response } = await this.${clientFunctionName}(\`${this.endpoint}\`, request);

		return response.ok; 
	}`;
	}

	private renderResponseOnly(responseDtoName: string, clientFunctionName: string): string {
		return `public async ${this.clientMethodName}(): Promise<${responseDtoName}> {
		const { response, data } = await this.${clientFunctionName}<${responseDtoName}>(\`${this.endpoint}\`);

		if (response.status !== 200) {
			throw new Error(response.statusText);
		}

		if (!data) { 
			throw new Error('No data returned from server');
		}

		return new ${responseDtoName}(data);
	}`;
	}

	private renderNoRequestNoResponse(clientFunctionName: string): string {
		return `public async ${this.clientMethodName}(): Promise<boolean> {
		const { response } = await this.${clientFunctionName}(\`${this.endpoint}\`);
		
		return response.ok;
	}`;
	}

	public render(): string {
		const requestDtoName = this.requestComponent?.dtoName ?? "any";
		const responseDtoName = this.responseComponent?.dtoName ?? "any";
		const finalResponse = this.responseComponent?.capitalizedName ?? "any";
		const clientFunctionName = this.method;

		if (!!this.requestComponent && !!this.responseComponent) {
			if (this.isStreamed) {
				return this.renderRequestAndStreamedResponse(
					requestDtoName,
					responseDtoName,
					finalResponse,
					clientFunctionName
				);
			}
			return this.renderRequestAndResponse(
				requestDtoName,
				responseDtoName,
				finalResponse,
				clientFunctionName
			);
		}

		if (!!this.requestComponent) {
			return this.renderRequestOnly(requestDtoName, clientFunctionName);
		}

		if (!!this.responseComponent) {
			return this.renderResponseOnly(responseDtoName, clientFunctionName);
		}

		return this.renderNoRequestNoResponse(clientFunctionName);
	}
}

type TEnumComponent = {
	name: string;
	values: string[];
};

class EnumComponent implements TEnumComponent {
	public name: string;
	public values: string[];

	public constructor(dto: TEnumComponent) {
		this.name = dto.name;
		this.values = dto.values;
	}

	public get capitalizedName(): string {
		return this.name.charAt(0).toUpperCase() + this.name.slice(1);
	}

	public render(): string {
		return `export enum ${this.capitalizedName} {
${this.values.map((value) => `\t${value} = "${value}"`).join(",\n")}
}`;
	}
}

enum EComponentType {
	Request,
	Response,
	Model,
}

type TComponentDto = {
	name: string;
	requiredProperties: string[];
	properties: Property[];
	componentType: EComponentType;
};

class Component implements TComponentDto {
	public name: string;
	public requiredProperties: string[];
	public properties: Property[];
	public componentType: EComponentType;

	public get capitalizedName(): string {
		return this.name.charAt(0).toUpperCase() + this.name.slice(1);
	}

	public get dtoName(): string {
		return `T${this.capitalizedName}Dto`;
	}

	public constructor(dto: TComponentDto) {
		this.name = dto.name;
		this.requiredProperties = dto.requiredProperties;
		this.properties = dto.properties.map((propertyDto) => new Property(propertyDto));
		this.componentType = dto.componentType;
	}

	public render(): string {
		let str = this.renderDto();
		str += "\n";
		str += `export class ${this.capitalizedName} {\n`;

		for (const property of this.properties) {
			str += `\tpublic ${property.render()}\n`;
		}
		str += `
	public constructor(dto: ${this.dtoName}) {`;

		for (const property of this.properties) {
			if (property.isDate) {
				if (property.nullable) {
					str += `\n\t\tthis.${property.name} = dto.${property.name} ? new Date(dto.${property.name}) : undefined;`;
				} else {
					str += `\n\t\tthis.${property.name} = new Date(dto.${property.name});`;
				}
				continue;
			}
			if (property.referenceComponentName && !property.referenceIsEnum) {
				if (property.nullable) {
					str += `\n\t\tthis.${property.name} = dto.${property.name} ? new ${property.referenceComponentName}(dto.${property.name}) : undefined;`;
				} else {
					str += `\n\t\tthis.${property.name} = new ${property.referenceComponentName}(dto.${property.name});`;
				}
				continue;
			}
			if (property.isArray) {
				if (property.items?.referenceComponentName) {
					str += `\n\t\tthis.${property.name} = dto.${property.name}.map((item) => new ${
						property.items!.referenceComponentName
					}(item));`;
					continue;
				}
			}

			if (property.isDictionary) {
				if (property.additionalProperties?.isArray) {
					str += `\n\t\tthis.${property.name} = new Map(Object.entries(dto.${
						property.name
					}).map(([key, value]) => [key, value.map((item) => new ${property.additionalProperties?.items?.formattedType?.replace(
						"[]",
						""
					)}(item))]));`;
					continue;
				}
				str += `\n\t\tthis.${property.name} = new Map(Object.entries(dto.${property.name}).map(([key, value]) => [key, new ${property.additionalProperties?.formattedType}(value)]));`;
				continue;
			}
			str += `\n\t\tthis.${property.name} = dto.${property.name};`;
		}
		str += `
	}
}`;
		return str;
	}

	protected renderDto(): string {
		let str = `export type ${this.dtoName} = { \n`;
		for (const property of this.properties) {
			str += `\t${property.renderAsDto()}\n`;
		}
		str += `};\n`;
		return str;
	}

	public get renderImplementsDto(): string {
		if (!this.properties.some((property) => property.isDate)) {
			return this.dtoName;
		}
		return `Omit<${this.dtoName}, "${this.properties
			.filter((property) => property.isDate)
			?.map((property) => property.name)
			.join(" | ")}">`;
	}
}

class ModelComponent extends Component {}

class RequestComponent extends Component {
	public override render(): string {
		let str = `export type T${this.name} = { \n`;
		for (const property of this.properties) {
			str += `\t${property.render()}\n`;
		}
		str += `};`;
		return str;
	}

	public override get dtoName(): string {
		return `T${this.capitalizedName}`;
	}
}

class ResponseComponent extends Component {}

type TPropertyDto = {
	name: string;
	type?: string;
	nullable: boolean;
	format?: string;
	["$ref"]?: string;
	referenceIsEnum: boolean;
	items?: TPropertyDto; // for arrays
	additionalProperties?: TPropertyDto; // for dictionaries
};

class Property implements TPropertyDto {
	public name: string;
	public type?: string;
	public nullable: boolean;
	public format?: string;
	public ["$ref"]?: string;
	public referenceIsEnum: boolean;
	public items?: Property; // for arrays
	public additionalProperties?: Property; // for dictionaries

	public constructor(dto: TPropertyDto) {
		this.name = dto.name;
		this.type = dto.type;
		this.nullable = dto.nullable;
		this.format = dto.format;
		this["$ref"] = dto["$ref"];
		this.referenceIsEnum = dto.referenceIsEnum;
		this.items = dto.items ? new Property(dto.items) : undefined;
		this.additionalProperties = dto.additionalProperties
			? new Property(dto.additionalProperties)
			: undefined;
	}

	public get referenceComponentName(): string | undefined {
		if (this["$ref"]) {
			return this["$ref"].split("/").pop();
		}
	}

	public get isArray(): boolean {
		return this.type === "array";
	}

	public get isDictionary(): boolean {
		return this.type === "object" && !!this.additionalProperties;
	}

	public get isDate(): boolean {
		return this.type === "string" && this.format === "date-time";
	}

	public get formattedDtoType(): string | undefined {
		if (this.referenceComponentName) {
			if (this.referenceIsEnum) {
				return `${this.referenceComponentName}`;
			}
			if (this.isArray) {
				return `T${this.items!.referenceComponentName}Dto[]`;
			}
			return `T${this.referenceComponentName}Dto`;
		}

		if (this.isArray) {
			const arrayProperty = this.items!;
			if (arrayProperty.referenceComponentName) return `T${arrayProperty.referenceComponentName}Dto[]`;
			return `${arrayProperty.type}[]`;
		}

		if (this.isDictionary) {
			return `Record<string, ${this.additionalProperties?.formattedDtoType}>`;
		}

		return this.type;
	}

	public get formattedType(): string | undefined {
		if (this.isDate) {
			return "Date";
		}
		if (this.referenceComponentName) {
			if (this.referenceIsEnum) {
				return `${this.referenceComponentName}`;
			}
			if (this.isArray) {
				return `${this.items!.referenceComponentName}[]`;
			}
			return `${this.referenceComponentName}`;
		}
		if (this.isArray) {
			const arrayProperty = this.items!;
			if (arrayProperty.referenceComponentName) return `${arrayProperty.referenceComponentName}[]`;
			return `${arrayProperty.type}[]`;
		}

		if (this.isDictionary) {
			return `Map<string, ${this.additionalProperties?.formattedType}>`;
		}

		return this.type;
	}

	public render(): string {
		return `${this.name}${this.nullable ? "?" : ""}: ${this.formattedType};`;
	}

	public renderAsDto(): string {
		return `${this.name}${this.nullable ? "?" : ""}: ${this.formattedDtoType};`;
	}
}
