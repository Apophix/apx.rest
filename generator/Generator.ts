import chalk from "chalk";
import { promises as fs } from "fs";
import path from "path";
import { ConfigProvider } from "./ConfigProvider.js";

function log(...args: string[]) {
	console.log(...args);
}

function iLog(indentLevel: number, ...args: string[]) {
	console.log("\t".repeat(indentLevel), ...args);
}

const enumComponents = new Map<string, EnumComponent>();
const requestComponents = new Map<string, RequestComponent>();
const responseComponents = new Map<string, ResponseComponent>();
const modelComponents = new Map<string, ModelComponent>();
const enumNames = new Set<string>();
const endpointToFormRequestNameMap = new Map<string, string>();

export class Generator {
	public async generate(): Promise<void> {
		log(chalk.blueBright("Looking for apx-rest-config.json..."));

		// look for apx-rest-config.json in the current working directory (where command was executed)
		const configProvider = new ConfigProvider();
		await configProvider.preload();

		const numConfigs = await configProvider.getNumberOfUserConfigs();

		for (let i = 0; i < numConfigs; i++) {
			configProvider.apiIndex = i;
			enumComponents.clear();
			requestComponents.clear();
			responseComponents.clear();
			modelComponents.clear();
			enumNames.clear();
			endpointToFormRequestNameMap.clear();
			log(chalk.blueBright(`Generating client for API ${i + 1} of ${numConfigs}...`));
			await this.generateApi(configProvider);
		}
	}

	private async generateApi(configProvider: ConfigProvider): Promise<void> {
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
						if (!schemaRef) continue;
						const schemaName = schemaRef.split("/").pop();
						iLog(
							1,
							chalk.cyanBright(
								`Parsing response ${schemaName} in endpoint ${method.toUpperCase()} ${endpoint}`
							)
						);
						responseNames.add(schemaName);
					}
				}

				const requestBody = operation["requestBody"];
				if (!requestBody) {
					continue;
				}

				const contents = requestBody["content"];
				for (const [contentType, content] of Object.entries<any>(contents)) {
					const schema = content["schema"];
					if (!schema) {
						continue;
					}

					const schemaRef = content["schema"]["$ref"];
					if (!schemaRef) {
						if (contentType === "multipart/form-data") {
							// process form data here
							const operationName = operation["operationId"];
							const formSchemaName = `${operationName
								.charAt(0)
								.toUpperCase()}${operationName.slice(1)}FormDataRequest`;
							iLog(
								1,
								chalk.cyanBright(
									`Parsing form data ${formSchemaName} in endpoint ${method.toUpperCase()} ${endpoint}`
								)
							);
							requestComponents.set(
								formSchemaName,
								new RequestComponent({
									componentType: EComponentType.Request,
									name: formSchemaName,
									properties: Object.entries<any>(content["schema"]["properties"]).map(
										([propertyName, property]) => {
											return new Property({
												name: propertyName,
												type:
													property["format"] === "binary"
														? "File"
														: property["type"],
												nullable: property["nullable"] || false,
												format: property["format"],
												referenceIsEnum: false,
												isFormField: true,
											});
										}
									),
									requiredProperties: content["schema"]["required"] || [],
								})
							);

							endpointToFormRequestNameMap.set(operationName, formSchemaName);
						}
						continue;
					}
					const schemaName = schemaRef.split("/").pop();
					iLog(
						1,
						chalk.cyanBright(
							`Parsing request ${schemaName} in endpoint ${method.toUpperCase()} ${endpoint}`
						)
					);
					requestNames.add(schemaName);
				}
			}
		}
		log(chalk.greenBright("OpenAPI document parsed successfully."));
		log(chalk.blueBright("Processing components..."));

		const components = openApiDocument["components"]?.["schemas"];
		if (!components) {
			log(chalk.red("No components found in OpenAPI document."));
			// return;
		}

		log(chalk.blue("Scanning for enums..."));
		for (const [schemaName, schema] of Object.entries<any>(components ?? {})) {
			if (schema["enum"]) {
				iLog(
					1,
					chalk.cyanBright(`Found enum ${schemaName} with values: ${schema["enum"].join(", ")}`)
				);
				enumNames.add(schemaName);
			}
		}

		for (const [schemaName, schema] of Object.entries<any>(components ?? {})) {
			iLog(1, chalk.cyanBright(`Processing component schema ${schemaName}...`));

			if (schema["enum"]) {
				iLog(2, chalk.cyanBright.dim("Processing as enum"));
				enumComponents.set(
					schemaName,
					new EnumComponent({
						name: schemaName,
						values: schema["enum"],
						enumNames: schema["x-enumNames"],
						type: schema["type"] || "string",
					})
				);
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
								const referenceIsEnum =
									enumNames.has(property["$ref"]?.split("/").pop()) ||
									enumNames.has(property["items"]?.["$ref"]?.split("/").pop());
								return new Property({
									name: propertyName,
									type: property["type"],
									nullable: nullable,
									format: property["format"],
									["$ref"]: property["$ref"],
									referenceIsEnum,
									items: property["items"],
									additionalProperties: property["additionalProperties"],
									isFormField: false,
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
								let type = property["type"];
								if (!type && property["oneOf"]) {
									const oneOf = property["oneOf"];
									type = oneOf[0]["$ref"]?.split("/").pop() || "unknown";
								}
								const referenceIsEnum =
									enumNames.has(property["$ref"]?.split("/").pop()) ||
									enumNames.has(property["items"]?.["$ref"]?.split("/").pop());
								return new Property({
									name: propertyName,
									type,
									nullable: nullable,
									format: property["format"],
									["$ref"]: property["$ref"],
									referenceIsEnum,
									items: property["items"],
									additionalProperties: property["additionalProperties"],
									isFormField: false,
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
						let type = property["type"];
						if (!type && property["oneOf"]) {
							const oneOf = property["oneOf"];
							type = oneOf[0]["$ref"]?.split("/").pop() || "unknown";
						}
						const referenceIsEnum =
							enumNames.has(property["$ref"]?.split("/").pop()) ||
							enumNames.has(property["items"]?.["$ref"]?.split("/").pop());
						return new Property({
							name: propertyName,
							type,
							nullable: nullable,
							format: property["format"],
							["$ref"]: property["$ref"],
							referenceIsEnum,
							items: property["items"],
							additionalProperties: property["additionalProperties"],
							isFormField: false,
						});
					}),
				})
			);
		}
		log(chalk.greenBright("Components processed successfully."));

		log(chalk.blueBright("Generating client code..."));

		let outputStr = "// This file was generated by apx.rest\n";
		outputStr += "// Do not modify this file directly\n\n";
		outputStr += `// Generated on ${new Date().toISOString()}\n\n`;
		outputStr += `// This file is generated from the OpenAPI document at ${documentUrl}\n\n`;
		outputStr += `// File will be overwritten!!\n\n`;

		outputStr +=
			'import { ApiClient, type TApiRequestOptions, type TApiClientResult } from "apx.rest";\n\n';

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
				const requestBodyContents = operation.requestBody?.content as Record<string, any>;
				const requestInnerContents = requestBodyContents
					? Array.from(Object.values(requestBodyContents))[0]
					: {};
				const responseContents = operation.responses;
				const responseInnerContents = Array.from(Object.values(responseContents))[0] as any;

				const formRequest = endpointToFormRequestNameMap.get(operation.operationId);
				let requestComponentName = requestInnerContents.schema?.$ref?.split("/").pop();
				if (formRequest) {
					requestComponentName = formRequest;
				}

				// TODO: add query parameters here
				paths.push(
					new ApiPath({
						endpoint,
						method,
						parameters: operation.parameters,
						operationId: operation.operationId,
						requestComponentName: requestComponentName,
						responseComponentName: responseInnerContents.content?.[
							"application/json"
						]?.schema?.$ref
							?.split("/")
							.pop(),
						isStreamed: streamedEndpoints.includes(endpoint),
						isFormEndpoint: !!formRequest,
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
	isFormEndpoint: boolean;
	parameters?: TApiParameter[];
};

function stripUrlChars(str: string): string {
	const a = splitAtUrlChars(str);
	const b = a.map((s) => s.charAt(0).toUpperCase() + s.slice(1));
	const c = b.join("");
	return c;
}

function splitAtUrlChars(str: string): string[] {
	return str.split(/[^a-zA-Z0-9]/g);
}

type TApiParameter = {
	in: string;
	name: string;
	required: boolean;
	schema: {
		items: any;
		type: string;
		format?: string;
	};
};

class ApiPath implements TApiPathDto {
	public endpoint: string;
	public method: string;
	public operationId: string;
	public requestComponentName: string;
	public responseComponentName: string;
	public isStreamed: boolean;
	public isFormEndpoint: boolean;
	public parameters: TApiParameter[] = [];

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
		this.isFormEndpoint = dto.isFormEndpoint;

		this.parameters = dto.parameters || [];
	}

	public get hasParameters(): boolean {
		return this.parameters.length > 0;
	}

	public get queryParams(): TApiParameter[] {
		return this.parameters.filter((param) => param.in === "query");
	}

	public get hasQueryParams(): boolean {
		return this.queryParams.length > 0;
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

		// operation id takes priority since that is directly set with an attribute in C#
		if (this.operationId) {
			let lowerCaseOperationId = stripUrlChars(this.operationId);
			lowerCaseOperationId =
				lowerCaseOperationId.charAt(0).toLowerCase() + lowerCaseOperationId.slice(1);

			return prefix + lowerCaseOperationId + suffix;
		}

		const resourceName = stripUrlChars(this.endpoint);

		switch (this.method) {
			case "get":
				if (this.responseComponent) {
					const lowerCaseComponentName =
						this.responseComponent.name.charAt(0).toLowerCase() +
						this.responseComponent.name.slice(1);
					return prefix + lowerCaseComponentName.replace("Response", "") + suffix;
				}
				return `${prefix}get${resourceName}${suffix}`;
			case "post":
				if (this.requestComponent) {
					const lowerCaseComponentName =
						this.requestComponent.name.charAt(0).toLowerCase() +
						this.requestComponent.name.slice(1);
					return prefix + lowerCaseComponentName.replace("Request", "") + suffix;
				}
				return `${prefix}create${resourceName}${suffix}`;
			case "put":
				if (this.requestComponent) {
					const lowerCaseComponentName =
						this.requestComponent.name.charAt(0).toLowerCase() +
						this.requestComponent.name.slice(1);
					return prefix + lowerCaseComponentName.replace("Request", "") + suffix;
				}
				return `${prefix}replace${resourceName}${suffix}`;
			case "delete":
				if (this.requestComponent) {
					const lowerCaseComponentName =
						this.requestComponent.name.charAt(0).toLowerCase() +
						this.requestComponent.name.slice(1);
					return prefix + lowerCaseComponentName.replace("Request", "") + suffix;
				}
				return `${prefix}delete${resourceName}${suffix}`;
			case "patch":
				if (this.requestComponent) {
					const lowerCaseComponentName =
						this.requestComponent.name.charAt(0).toLowerCase() +
						this.requestComponent.name.slice(1);
					return prefix + lowerCaseComponentName.replace("Request", "") + suffix;
				}
				return `${prefix}update${resourceName}${suffix}`;
			default:
				throw new Error(`Unknown method: ${this.method}`);
		}
	}

	public get pathParams(): string[] {
		const pathParams = this.endpoint.match(/{\w+}/g);
		return pathParams ? pathParams.map((param) => param.replaceAll(/[{}]/g, "")) : [];
	}

	public get hasPathParams(): boolean {
		return this.pathParams.length > 0;
	}

	public get builtEndpointUrl(): string {
		let endpoint = this.endpoint;
		for (const param of this.pathParams) {
			endpoint = endpoint.replace(`{${param}}`, `\${request.${param}}`);
		}
		return endpoint;
	}

	public get shouldSkipRequest(): boolean {
		const hasRequest = !!this.requestComponent || this.hasPathParams;

		return !!(
			hasRequest &&
			this.requestComponent &&
			this.requestComponent.properties.every((property) => this.pathParams.includes(property.name))
		);
	}

	public get requestStr(): string {
		if (this.method === "get") return "";

		if (!this.requestComponent) return "";

		if (this.isFormEndpoint) return ", formData";

		return this.shouldSkipRequest ? ", {}" : ", request";
	}

	private renderRequestAndStreamedResponse(
		requestDtoName: string,
		responseDtoName: string,
		finalResponse: string,
		clientFunctionName: string
	): string {
		return `public async ${this.clientMethodName}(request: ${requestDtoName}, options?: TApiRequestOptions): AsyncGenerator<${finalResponse}> {
		for await (const chunkDto of this.${clientFunctionName}Iterable<${responseDtoName}>(\`${this.builtEndpointUrl}\`${this.requestStr}, options)) {
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
		let ret = `public async ${this.clientMethodName}(request: ${requestDtoName}, options?: TApiRequestOptions): Promise<TApiClientResult<${finalResponse}>> {\n`;
		if (this.hasQueryParams) {
			ret += `\tconst queryParams = new URLSearchParams();\n`;
			for (const queryParam of this.queryParams) {
				ret += `\tqueryParams.set("${queryParam.name}", request.${queryParam.name}?.toString() ?? "");\n`;
			}
		}
		if (this.isFormEndpoint) {
			ret += `\tconst formData = new FormData();\n`;
			for (const formField of this.requestComponent?.properties ?? []) {
				ret += `\tformData.append("${formField.name}", request.${formField.lowerCamelName});\n`;
			}
		}
		ret += `\tconst { response, data } = await this.${clientFunctionName}<${responseDtoName}>(\`${this.builtEndpointUrl}${this.hasQueryParams ? "?${queryParams}" : ""}\`${this.requestStr}, options);`
		ret += "\tif (!response.ok || !data) {\n"
		ret += `\t\treturn [null, response];\n`;
		ret += `\t}\n`;

		ret += `\treturn [new ${finalResponse}(data), response];\n`;
		ret += "}"; 
		ret = ret.replaceAll(/^\s*$/gm, ""); // remove empty lines
		return ret; 
	}

	private renderRequestOnly(requestDtoName: string, clientFunctionName: string): string {
		return `public async ${
			this.clientMethodName
		}(request: ${requestDtoName}, options?: TApiRequestOptions): Promise<TApiClientResult<null>> {
		${this.hasQueryParams ? `const queryParams = new URLSearchParams();` : ""}
		${this.queryParams
			.map((param) => {
				return `queryParams.set("${param.name}", request.${param.name}?.toString() ?? "");`;
			})
			.join("\n\t\t")}
						${this.isFormEndpoint ? `const formData = new FormData();` : ""}
			${this.requestComponent?.properties
				?.map((formField) => {
					return `formData.append("${formField.name}", request.${formField.lowerCamelName});`;
				})
				.join("\n\t\t")}
		const { response } = await this.${clientFunctionName}(\`${this.builtEndpointUrl}${
			this.hasQueryParams ? "?${queryParams}" : ""
		}\`${this.requestStr}, options);

		return [null, response];
	}`.replaceAll(/^\s*$/gm, ""); // remove empty lines
	}

	private renderResponseOnly(
		responseDtoName: string,
		clientFunctionName: string,
		finalResponse: string
	): string {
		return `public async ${
			this.clientMethodName
		}(options?: TApiRequestOptions): Promise<TApiClientResult<${finalResponse}>> {
		${this.hasQueryParams ? `const queryParams = new URLSearchParams();` : ""}
		${this.queryParams
			.map((param) => {
				return `queryParams.set("${param.name}", request.${param.name}?.toString() ?? "");`;
			})
			.join("\n\t\t")}
		const { response, data } = await this.${clientFunctionName}<${responseDtoName}>(\`${this.builtEndpointUrl}${
			this.hasQueryParams ? "?${queryParams}" : ""
		}\`, options);

		if (!response.ok || !data) {
			return [null, response];
		}

		return [new ${finalResponse}(data), response]; 
	}`.replaceAll(/^\s*$/gm, ""); // remove empty lines
	}

	private renderNoRequestNoResponse(clientFunctionName: string): string {
		return `public async ${this.clientMethodName}(options?: TApiRequestOptions): Promise<TApiClientResult<null>> {
		const { response } = await this.${clientFunctionName}(\`${this.builtEndpointUrl}\`, options);

		return [null, response];
	}`;
	}

	public render(): string {
		let requestDtoName = this.requestComponent?.dtoName ?? "any";
		const responseDtoName = this.responseComponent?.dtoName ?? "any";
		const finalResponse = this.responseComponent?.capitalizedName ?? "any";
		let clientFunctionName = this.method;

		// uh, don't patch a form yet lol
		if (this.isFormEndpoint) {
			clientFunctionName = `${this.method}FormData`;
		}
		const hasRequest = !!this.requestComponent || this.hasPathParams || this.hasQueryParams;

		if (this.hasPathParams) {
			const pathParamType = `{ ${this.pathParams.map((param) => `${param}: string`).join(", ")} }`;
			if (requestDtoName === "any") {
				requestDtoName = pathParamType;
			} else {
				requestDtoName = `${pathParamType} & ${requestDtoName}`;
			}
		}

		if (this.hasQueryParams) {
			const queryParamsType = `{ ${this.queryParams
				.map((param) => {
					let paramType = param.schema.type;
					if (param.schema.format === "date-time") {
						paramType = "string";
					} else if (param.schema.type === "array") {
						paramType = `${param.schema.items?.type}[]`;
					} else if (param.schema.type === "integer") {
						paramType = "number";
					}
					if (!param.required) return `${param.name}?: ${paramType}`;
					return `${param.name}: ${paramType}`;
				})
				.join(", ")} }`;
			if (requestDtoName === "any") {
				requestDtoName = queryParamsType;
			} else {
				requestDtoName = `${queryParamsType} & ${requestDtoName}`;
			}
		}

		if (hasRequest && !!this.responseComponent) {
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

		if (hasRequest) {
			return this.renderRequestOnly(requestDtoName, clientFunctionName);
		}

		if (!!this.responseComponent) {
			return this.renderResponseOnly(responseDtoName, clientFunctionName, finalResponse);
		}

		return this.renderNoRequestNoResponse(clientFunctionName);
	}
}

type TEnumComponent = {
	name: string;
	values: string[];
	type: string;
	enumNames?: string[];
};

class EnumComponent implements TEnumComponent {
	public name: string;
	public values: string[];
	public enumNames?: string[];
	public type: string;

	public constructor(dto: TEnumComponent) {
		this.name = dto.name;
		this.values = dto.values;
		this.enumNames = dto.enumNames;
		this.type = dto.type;
	}

	public get capitalizedName(): string {
		return this.name.charAt(0).toUpperCase() + this.name.slice(1);
	}

	public getEnumName(index: number): string {
		return this.enumNames?.[index] ?? this.values[index];
	}

	private formatValue(value: string): string {
		if (
			this.type === "integer" ||
			this.type === "number" ||
			this.type === "int32" ||
			this.type === "int64"
		) {
			return value;
		}
		return `"${value}"`;
	}

	public render(): string {
		return `export enum ${this.capitalizedName} {
${this.values.map((value, index) => `\t${this.getEnumName(index)} = ${this.formatValue(value)}`).join(",\n")}
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
			if (property.isArray && !property.referenceIsEnum) {
				if (property.items?.referenceComponentName && !property.items?.referenceIsEnum) {
					if (property.nullable) {
						str += `\n\t\tthis.${property.name} = dto.${property.name}?.map((item) => new ${
							property.items!.referenceComponentName
						}(item));`;
					} else {
						str += `\n\t\tthis.${property.name} = dto.${property.name}.map((item) => new ${
							property.items!.referenceComponentName
						}(item));`;
					}

					continue;
				}
			}

			if (property.isDictionary) {
				if (property.additionalProperties?.isArray) {
					if (
						property.additionalProperties.referenceComponentName &&
						!property.additionalProperties.referenceIsEnum
					) {
						str += `\n\t\tthis.${property.name} = new Map(Object.entries(dto.${
							property.name
						}).map(([key, value]) => [key, value.map((item) => new ${property.additionalProperties?.items?.formattedType?.replace(
							"[]",
							""
						)}(item))]));`;
						continue;
					} else {
						str += `\n\t\tthis.${property.name} = new Map(Object.entries(dto.${property.name}).map(([key, value]) => [key, value.map((item) => item)]));`;
						continue;
					}
				}
				if (!!property.additionalProperties?.formattedType)
					str += `\n\t\tthis.${property.name} = new Map(Object.entries(dto.${property.name}).map(([key, value]) => [key, new ${property.additionalProperties?.formattedType}(value)]));`;
				else
					str += `\n\t\tthis.${property.name} = new Map(Object.entries(dto.${property.name}).map(([key, value]) => [key, value]));`;

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
	isFormField: boolean;
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
	public isFormField: boolean;

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
		this.isFormField = dto.isFormField;
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

	public get isNumberType(): boolean {
		return this.type === "number" || this.type === "integer";
	}

	public get formattedDtoType(): string | undefined {
		if (this.isArray && this.referenceIsEnum) {
			return `${this.items?.referenceComponentName ?? "???"}[]`;
		}

		if (this.referenceIsEnum) {
			return `${this.referenceComponentName}`;
		}

		if (this.referenceComponentName) {
			if (this.referenceIsEnum) {
				return `${this.referenceComponentName}`;
			}
			if (this.isArray) {
				return `T${this.items!.referenceComponentName}Dto[]`;
			}
			return `T${this.referenceComponentName}Dto`;
		}

		if (this.isNumberType) return "number";

		if (this.isArray) {
			const arrayProperty = this.items!;
			if (arrayProperty.referenceComponentName) return `T${arrayProperty.referenceComponentName}Dto[]`;
			return `${arrayProperty.formattedDtoType}[]`;
		}

		if (this.isDictionary) {
			return `Record<string, ${this.additionalProperties?.formattedDtoType ?? "any"}>`;
		}

		return this.type;
	}

	public get formattedType(): string | undefined {
		if (this.isDate) return "Date";

		if (this.isNumberType) return "number";

		if (this.isArray && this.referenceIsEnum) {
			return `${this.items?.referenceComponentName ?? "???"}[]`;
		}

		if (this.referenceIsEnum) {
			return `${this.referenceComponentName}`;
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
			return `${arrayProperty.formattedType}[]`;
		}

		if (this.isDictionary) {
			return `Map<string, ${this.additionalProperties?.formattedType ?? "any"}>`;
		}

		return this.type;
	}

	public get lowerCamelName(): string {
		return this.name.charAt(0).toLowerCase() + this.name.slice(1);
	}

	public get renderName(): string {
		return this.isFormField ? this.lowerCamelName : this.name;
	}

	public render(): string {
		return `${this.renderName}${this.nullable ? "?" : ""}: ${this.formattedType};`;
	}

	public renderAsDto(): string {
		return `${this.renderName}${this.nullable ? "?" : ""}: ${this.formattedDtoType};`;
	}
}
