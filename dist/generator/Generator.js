import chalk from "chalk";
import { promises as fs } from "fs";
import path from "path";
import { ConfigProvider } from "./ConfigProvider.js";
function log(...args) {
    console.log(...args);
}
function iLog(indentLevel, ...args) {
    console.log("\t".repeat(indentLevel), ...args);
}
const enumComponents = new Map();
const requestComponents = new Map();
const responseComponents = new Map();
const modelComponents = new Map();
const enumNames = new Set();
export class Generator {
    async generate() {
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
            log(chalk.blueBright(`Generating client for API ${i + 1} of ${numConfigs}...`));
            await this.generateApi(configProvider);
        }
    }
    async generateApi(configProvider) {
        log(chalk.blueBright("Fetching OpenAPI document..."));
        // set fetch to ignore self-signed cert
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        const documentUrl = await configProvider.getValue("openApiJsonDocumentUrl");
        const response = await fetch(documentUrl);
        if (!response.ok) {
            log(chalk.red("Failed to fetch OpenAPI document."));
            return;
        }
        const openApiDocument = await response.json();
        log(chalk.greenBright("OpenAPI document fetched successfully."));
        log(chalk.blueBright("Parsing OpenAPI document..."));
        const requestNames = new Set();
        const responseNames = new Set();
        for (const [endpoint, path] of Object.entries(openApiDocument["paths"])) {
            for (const [method, operation] of Object.entries(path)) {
                const responses = operation["responses"];
                for (const [responseCode, response] of Object.entries(responses)) {
                    const contents = response["content"];
                    if (!contents) {
                        continue;
                    }
                    for (const [contentType, content] of Object.entries(contents)) {
                        const schema = content["schema"];
                        if (!schema) {
                            continue;
                        }
                        const schemaRef = content["schema"]["$ref"];
                        if (!schemaRef)
                            continue;
                        const schemaName = schemaRef.split("/").pop();
                        iLog(1, chalk.cyanBright(`Parsing response ${schemaName} in endpoint ${method.toUpperCase()} ${endpoint}`));
                        responseNames.add(schemaName);
                    }
                }
                const requestBody = operation["requestBody"];
                if (!requestBody) {
                    continue;
                }
                const contents = requestBody["content"];
                for (const [contentType, content] of Object.entries(contents)) {
                    const schema = content["schema"];
                    if (!schema) {
                        continue;
                    }
                    const schemaRef = content["schema"]["$ref"];
                    if (!schemaRef) {
                        if (contentType === "multipart/form-data") {
                            // process form data here 
                            const operationName = operation["operationId"];
                            const formSchemaName = `${operationName.charAt(0).toUpperCase()}${operationName.slice(1)}RequestFormData`;
                            iLog(1, chalk.cyanBright(`Parsing form data ${formSchemaName} in endpoint ${method.toUpperCase()} ${endpoint}`));
                            requestComponents.set(formSchemaName, new RequestComponent({
                                componentType: EComponentType.Request,
                                name: formSchemaName,
                                properties: Object.entries(content["schema"]["properties"]).map(([propertyName, property]) => {
                                    return new Property({
                                        name: propertyName,
                                        type: property["type"],
                                        nullable: property["nullable"] || false,
                                        format: property["format"],
                                        referenceIsEnum: false,
                                    });
                                }),
                                requiredProperties: content["schema"]["required"] || [],
                            }));
                        }
                        continue;
                    }
                    const schemaName = schemaRef.split("/").pop();
                    iLog(1, chalk.cyanBright(`Parsing request ${schemaName} in endpoint ${method.toUpperCase()} ${endpoint}`));
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
        for (const [schemaName, schema] of Object.entries(components ?? {})) {
            if (schema["enum"]) {
                iLog(1, chalk.cyanBright(`Found enum ${schemaName} with values: ${schema["enum"].join(", ")}`));
                enumNames.add(schemaName);
            }
        }
        for (const [schemaName, schema] of Object.entries(components ?? {})) {
            iLog(1, chalk.cyanBright(`Processing component schema ${schemaName}...`));
            if (schema["enum"]) {
                iLog(2, chalk.cyanBright.dim("Processing as enum"));
                enumComponents.set(schemaName, new EnumComponent({
                    name: schemaName,
                    values: schema["enum"],
                    enumNames: schema["x-enumNames"],
                    type: schema["type"] || "string",
                }));
                continue;
            }
            if (requestNames.has(schemaName)) {
                iLog(2, chalk.cyanBright.dim("Processing as request"));
                requestComponents.set(schemaName, new RequestComponent({
                    name: schemaName,
                    requiredProperties: schema["required"] || [],
                    componentType: EComponentType.Request,
                    properties: Object.entries(schema["properties"]).map(([propertyName, property]) => {
                        let nullable = property["nullable"] || !!property["$ref"] || false;
                        if (schema["required"]) {
                            if (schema["required"].includes(propertyName)) {
                                nullable = false;
                            }
                        }
                        const referenceIsEnum = enumNames.has(property["$ref"]?.split("/").pop()) ||
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
                        });
                    }),
                }));
                continue;
            }
            if (responseNames.has(schemaName)) {
                iLog(2, chalk.cyanBright.dim("Processing as response"));
                responseComponents.set(schemaName, new ResponseComponent({
                    name: schemaName,
                    requiredProperties: schema["required"] || [],
                    properties: Object.entries(schema["properties"]).map(([propertyName, property]) => {
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
                        const referenceIsEnum = enumNames.has(property["$ref"]?.split("/").pop()) ||
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
                        });
                    }),
                    componentType: EComponentType.Response,
                }));
                continue;
            }
            iLog(2, chalk.cyanBright.dim("Processing as model"));
            modelComponents.set(schemaName, new ModelComponent({
                name: schemaName,
                requiredProperties: schema["required"] || [],
                componentType: EComponentType.Model,
                properties: Object.entries(schema["properties"]).map(([propertyName, property]) => {
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
                    const referenceIsEnum = enumNames.has(property["$ref"]?.split("/").pop()) ||
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
                    });
                }),
            }));
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
        const paths = [];
        const streamedEndpoints = await configProvider.getValue("streamedEndpoints");
        for (const [endpoint, path] of Object.entries(openApiDocument["paths"])) {
            for (const [method, operation] of Object.entries(path)) {
                const requestBodyContents = operation.requestBody?.content;
                const requestInnerContents = requestBodyContents
                    ? Array.from(Object.values(requestBodyContents))[0]
                    : {};
                const responseContents = operation.responses;
                const responseInnerContents = Array.from(Object.values(responseContents))[0];
                // TODO: add query parameters here
                paths.push(new ApiPath({
                    endpoint,
                    method,
                    parameters: operation.parameters,
                    operationId: operation.operationId,
                    requestComponentName: requestInnerContents?.schema?.$ref?.split("/").pop(),
                    responseComponentName: responseInnerContents.content?.["application/json"]?.schema?.$ref
                        ?.split("/")
                        .pop(),
                    isStreamed: streamedEndpoints.includes(endpoint),
                }));
            }
        }
        const clientName = await configProvider.getValue("clientName");
        let baseUrl = await configProvider.getValue("clientBaseUrlValue");
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
        const outputPath = await configProvider.getValue("outputBaseDirectory");
        const outputDir = path.join(process.cwd(), outputPath);
        await fs.mkdir(outputDir, { recursive: true });
        const newFile = path.join(outputDir, `${clientName}.ts`);
        await fs.writeFile(newFile, outputStr);
        log(chalk.greenBright("Client code generated successfully."));
    }
}
function stripUrlChars(str) {
    const a = splitAtUrlChars(str);
    const b = a.map((s) => s.charAt(0).toUpperCase() + s.slice(1));
    const c = b.join("");
    return c;
}
function splitAtUrlChars(str) {
    return str.split(/[^a-zA-Z0-9]/g);
}
class ApiPath {
    endpoint;
    method;
    operationId;
    requestComponentName;
    responseComponentName;
    isStreamed;
    parameters = [];
    constructor(dto) {
        this.endpoint = dto.endpoint;
        if (this.endpoint.startsWith("/")) {
            this.endpoint = this.endpoint.substring(1);
        }
        this.method = dto.method;
        this.operationId = dto.operationId;
        this.requestComponentName = dto.requestComponentName;
        this.responseComponentName = dto.responseComponentName;
        this.isStreamed = dto.isStreamed;
        this.parameters = dto.parameters || [];
    }
    get hasParameters() {
        return this.parameters.length > 0;
    }
    get queryParams() {
        return this.parameters.filter((param) => param.in === "query");
    }
    get hasQueryParams() {
        return this.queryParams.length > 0;
    }
    get requestComponent() {
        return requestComponents.get(this.requestComponentName);
    }
    get responseComponent() {
        return responseComponents.get(this.responseComponentName);
    }
    get clientMethodName() {
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
                    const lowerCaseComponentName = this.responseComponent.name.charAt(0).toLowerCase() +
                        this.responseComponent.name.slice(1);
                    return prefix + lowerCaseComponentName.replace("Response", "") + suffix;
                }
                return `${prefix}get${resourceName}${suffix}`;
            case "post":
                if (this.requestComponent) {
                    const lowerCaseComponentName = this.requestComponent.name.charAt(0).toLowerCase() +
                        this.requestComponent.name.slice(1);
                    return prefix + lowerCaseComponentName.replace("Request", "") + suffix;
                }
                return `${prefix}create${resourceName}${suffix}`;
            case "put":
                if (this.requestComponent) {
                    const lowerCaseComponentName = this.requestComponent.name.charAt(0).toLowerCase() +
                        this.requestComponent.name.slice(1);
                    return prefix + lowerCaseComponentName.replace("Request", "") + suffix;
                }
                return `${prefix}replace${resourceName}${suffix}`;
            case "delete":
                if (this.requestComponent) {
                    const lowerCaseComponentName = this.requestComponent.name.charAt(0).toLowerCase() +
                        this.requestComponent.name.slice(1);
                    return prefix + lowerCaseComponentName.replace("Request", "") + suffix;
                }
                return `${prefix}delete${resourceName}${suffix}`;
            case "patch":
                if (this.requestComponent) {
                    const lowerCaseComponentName = this.requestComponent.name.charAt(0).toLowerCase() +
                        this.requestComponent.name.slice(1);
                    return prefix + lowerCaseComponentName.replace("Request", "") + suffix;
                }
                return `${prefix}update${resourceName}${suffix}`;
            default:
                throw new Error(`Unknown method: ${this.method}`);
        }
    }
    get pathParams() {
        const pathParams = this.endpoint.match(/{\w+}/g);
        return pathParams ? pathParams.map((param) => param.replaceAll(/[{}]/g, "")) : [];
    }
    get hasPathParams() {
        return this.pathParams.length > 0;
    }
    get builtEndpointUrl() {
        let endpoint = this.endpoint;
        for (const param of this.pathParams) {
            endpoint = endpoint.replace(`{${param}}`, `\${request.${param}}`);
        }
        return endpoint;
    }
    get shouldSkipRequest() {
        const hasRequest = !!this.requestComponent || this.hasPathParams;
        return !!(hasRequest &&
            this.requestComponent &&
            this.requestComponent.properties.every((property) => this.pathParams.includes(property.name)));
    }
    get requestStr() {
        if (this.method === "get")
            return "";
        if (!this.requestComponent)
            return "";
        return this.shouldSkipRequest ? ", {}" : ", request";
    }
    renderRequestAndStreamedResponse(requestDtoName, responseDtoName, finalResponse, clientFunctionName) {
        return `public async ${this.clientMethodName}(request: ${requestDtoName}, options?: TApiRequestOptions): AsyncGenerator<${finalResponse}> {
		for await (const chunkDto of this.${clientFunctionName}Iterable<${responseDtoName}>(\`${this.builtEndpointUrl}\`${this.requestStr}, options)) {
			if (chunkDto) {
				yield new ${finalResponse}(chunkDto);
			}
		}
	}`;
    }
    renderRequestAndResponse(requestDtoName, responseDtoName, finalResponse, clientFunctionName) {
        return `public async ${this.clientMethodName}(request: ${requestDtoName}, options?: TApiRequestOptions): Promise<TApiClientResult<${finalResponse}>> {
		${this.hasQueryParams ? `const queryParams = new URLSearchParams();` : ""}
		${this.queryParams
            .map((param) => {
            return `queryParams.set("${param.name}", request.${param.name}?.toString() ?? "");`;
        })
            .join("\n\t\t")}
		const { response, data } = await this.${clientFunctionName}<${responseDtoName}>(\`${this.builtEndpointUrl}${this.hasQueryParams ? "?${queryParams}" : ""}\`${this.requestStr}, options);
		if (!response.ok || !data) {
			return [null, response];
		}

		return [new ${finalResponse}(data), response];
	}`.replaceAll(/^\s*$/gm, ""); // remove empty lines;
    }
    renderRequestOnly(requestDtoName, clientFunctionName) {
        return `public async ${this.clientMethodName}(request: ${requestDtoName}, options?: TApiRequestOptions): Promise<TApiClientResult<null>> {
		${this.hasQueryParams ? `const queryParams = new URLSearchParams();` : ""}
		${this.queryParams
            .map((param) => {
            return `queryParams.set("${param.name}", request.${param.name}?.toString() ?? "");`;
        })
            .join("\n\t\t")}
		const { response } = await this.${clientFunctionName}(\`${this.builtEndpointUrl}${this.hasQueryParams ? "?${queryParams}" : ""}\`${this.requestStr}, options);

		return [null, response];
	}`.replaceAll(/^\s*$/gm, ""); // remove empty lines
    }
    renderResponseOnly(responseDtoName, clientFunctionName, finalResponse) {
        return `public async ${this.clientMethodName}(options?: TApiRequestOptions): Promise<TApiClientResult<${finalResponse}>> {
		${this.hasQueryParams ? `const queryParams = new URLSearchParams();` : ""}
		${this.queryParams
            .map((param) => {
            return `queryParams.set("${param.name}", request.${param.name}?.toString() ?? "");`;
        })
            .join("\n\t\t")}
		const { response, data } = await this.${clientFunctionName}<${responseDtoName}>(\`${this.builtEndpointUrl}${this.hasQueryParams ? "?${queryParams}" : ""}\`, options);

		if (!response.ok || !data) {
			return [null, response];
		}

		return [new ${finalResponse}(data), response]; 
	}`.replaceAll(/^\s*$/gm, ""); // remove empty lines
    }
    renderNoRequestNoResponse(clientFunctionName) {
        return `public async ${this.clientMethodName}(options?: TApiRequestOptions): Promise<TApiClientResult<null>> {
		const { response } = await this.${clientFunctionName}(\`${this.builtEndpointUrl}\`, options);

		return [null, response];
	}`;
    }
    render() {
        let requestDtoName = this.requestComponent?.dtoName ?? "any";
        const responseDtoName = this.responseComponent?.dtoName ?? "any";
        const finalResponse = this.responseComponent?.capitalizedName ?? "any";
        const clientFunctionName = this.method;
        const hasRequest = !!this.requestComponent || this.hasPathParams || this.hasQueryParams;
        if (this.hasPathParams) {
            const pathParamType = `{ ${this.pathParams.map((param) => `${param}: string`).join(", ")} }`;
            if (requestDtoName === "any") {
                requestDtoName = pathParamType;
            }
            else {
                requestDtoName = `${pathParamType} & ${requestDtoName}`;
            }
        }
        if (this.hasQueryParams) {
            const queryParamsType = `{ ${this.queryParams
                .map((param) => {
                let paramType = param.schema.type;
                if (param.schema.format === "date-time") {
                    paramType = "string";
                }
                else if (param.schema.type === "array") {
                    paramType = `${param.schema.items?.type}[]`;
                }
                else if (param.schema.type === "integer") {
                    paramType = "number";
                }
                if (!param.required)
                    return `${param.name}?: ${paramType}`;
                return `${param.name}: ${paramType}`;
            })
                .join(", ")} }`;
            if (requestDtoName === "any") {
                requestDtoName = queryParamsType;
            }
            else {
                requestDtoName = `${queryParamsType} & ${requestDtoName}`;
            }
        }
        if (hasRequest && !!this.responseComponent) {
            if (this.isStreamed) {
                return this.renderRequestAndStreamedResponse(requestDtoName, responseDtoName, finalResponse, clientFunctionName);
            }
            return this.renderRequestAndResponse(requestDtoName, responseDtoName, finalResponse, clientFunctionName);
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
class EnumComponent {
    name;
    values;
    enumNames;
    type;
    constructor(dto) {
        this.name = dto.name;
        this.values = dto.values;
        this.enumNames = dto.enumNames;
        this.type = dto.type;
    }
    get capitalizedName() {
        return this.name.charAt(0).toUpperCase() + this.name.slice(1);
    }
    getEnumName(index) {
        return this.enumNames?.[index] ?? this.values[index];
    }
    formatValue(value) {
        if (this.type === "integer" ||
            this.type === "number" ||
            this.type === "int32" ||
            this.type === "int64") {
            return value;
        }
        return `"${value}"`;
    }
    render() {
        return `export enum ${this.capitalizedName} {
${this.values.map((value, index) => `\t${this.getEnumName(index)} = ${this.formatValue(value)}`).join(",\n")}
}`;
    }
}
var EComponentType;
(function (EComponentType) {
    EComponentType[EComponentType["Request"] = 0] = "Request";
    EComponentType[EComponentType["Response"] = 1] = "Response";
    EComponentType[EComponentType["Model"] = 2] = "Model";
})(EComponentType || (EComponentType = {}));
class Component {
    name;
    requiredProperties;
    properties;
    componentType;
    get capitalizedName() {
        return this.name.charAt(0).toUpperCase() + this.name.slice(1);
    }
    get dtoName() {
        return `T${this.capitalizedName}Dto`;
    }
    constructor(dto) {
        this.name = dto.name;
        this.requiredProperties = dto.requiredProperties;
        this.properties = dto.properties.map((propertyDto) => new Property(propertyDto));
        this.componentType = dto.componentType;
    }
    render() {
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
                }
                else {
                    str += `\n\t\tthis.${property.name} = new Date(dto.${property.name});`;
                }
                continue;
            }
            if (property.referenceComponentName && !property.referenceIsEnum) {
                if (property.nullable) {
                    str += `\n\t\tthis.${property.name} = dto.${property.name} ? new ${property.referenceComponentName}(dto.${property.name}) : undefined;`;
                }
                else {
                    str += `\n\t\tthis.${property.name} = new ${property.referenceComponentName}(dto.${property.name});`;
                }
                continue;
            }
            if (property.isArray && !property.referenceIsEnum) {
                if (property.items?.referenceComponentName && !property.items?.referenceIsEnum) {
                    if (property.nullable) {
                        str += `\n\t\tthis.${property.name} = dto.${property.name}?.map((item) => new ${property.items.referenceComponentName}(item));`;
                    }
                    else {
                        str += `\n\t\tthis.${property.name} = dto.${property.name}.map((item) => new ${property.items.referenceComponentName}(item));`;
                    }
                    continue;
                }
            }
            if (property.isDictionary) {
                if (property.additionalProperties?.isArray) {
                    if (property.additionalProperties.referenceComponentName &&
                        !property.additionalProperties.referenceIsEnum) {
                        str += `\n\t\tthis.${property.name} = new Map(Object.entries(dto.${property.name}).map(([key, value]) => [key, value.map((item) => new ${property.additionalProperties?.items?.formattedType?.replace("[]", "")}(item))]));`;
                        continue;
                    }
                    else {
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
    renderDto() {
        let str = `export type ${this.dtoName} = { \n`;
        for (const property of this.properties) {
            str += `\t${property.renderAsDto()}\n`;
        }
        str += `};\n`;
        return str;
    }
    get renderImplementsDto() {
        if (!this.properties.some((property) => property.isDate)) {
            return this.dtoName;
        }
        return `Omit<${this.dtoName}, "${this.properties
            .filter((property) => property.isDate)
            ?.map((property) => property.name)
            .join(" | ")}">`;
    }
}
class ModelComponent extends Component {
}
class RequestComponent extends Component {
    render() {
        let str = `export type T${this.name} = { \n`;
        for (const property of this.properties) {
            str += `\t${property.render(true)}\n`;
        }
        str += `};`;
        return str;
    }
    get dtoName() {
        return `T${this.capitalizedName}`;
    }
}
class ResponseComponent extends Component {
}
class Property {
    name;
    type;
    nullable;
    format;
    ["$ref"];
    referenceIsEnum;
    items; // for arrays
    additionalProperties; // for dictionaries
    constructor(dto) {
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
    get referenceComponentName() {
        if (this["$ref"]) {
            return this["$ref"].split("/").pop();
        }
    }
    get isArray() {
        return this.type === "array";
    }
    get isDictionary() {
        return this.type === "object" && !!this.additionalProperties;
    }
    get isDate() {
        return this.type === "string" && this.format === "date-time";
    }
    get isNumberType() {
        return this.type === "number" || this.type === "integer";
    }
    get formattedDtoType() {
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
                return `T${this.items.referenceComponentName}Dto[]`;
            }
            return `T${this.referenceComponentName}Dto`;
        }
        if (this.isNumberType)
            return "number";
        if (this.isArray) {
            const arrayProperty = this.items;
            if (arrayProperty.referenceComponentName)
                return `T${arrayProperty.referenceComponentName}Dto[]`;
            return `${arrayProperty.formattedDtoType}[]`;
        }
        if (this.isDictionary) {
            return `Record<string, ${this.additionalProperties?.formattedDtoType ?? "any"}>`;
        }
        return this.type;
    }
    get formattedType() {
        if (this.isDate)
            return "Date";
        if (this.isNumberType)
            return "number";
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
                return `${this.items.referenceComponentName}[]`;
            }
            return `${this.referenceComponentName}`;
        }
        if (this.isArray) {
            const arrayProperty = this.items;
            if (arrayProperty.referenceComponentName)
                return `${arrayProperty.referenceComponentName}[]`;
            return `${arrayProperty.formattedType}[]`;
        }
        if (this.isDictionary) {
            return `Map<string, ${this.additionalProperties?.formattedType ?? "any"}>`;
        }
        return this.type;
    }
    render(isRequest = false) {
        const prefix = isRequest && this.referenceComponentName ? "T" : "";
        return `${this.name}${this.nullable ? "?" : ""}: ${prefix}${this.formattedType};`;
    }
    renderAsDto() {
        return `${this.name}${this.nullable ? "?" : ""}: ${this.formattedDtoType};`;
    }
}
