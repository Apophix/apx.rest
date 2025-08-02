export var HeaderType;
(function (HeaderType) {
    HeaderType[HeaderType["Transient"] = 0] = "Transient";
    HeaderType[HeaderType["Persistent"] = 1] = "Persistent";
})(HeaderType || (HeaderType = {}));
export class ApiClient {
    _baseUrl;
    _defaultToUseBearerToken = false;
    _bearerTokenProvider;
    constructor(baseUrl) {
        // Add a trailing slash to the baseUrl if there isn't one
        if (baseUrl && !baseUrl.endsWith("/")) {
            baseUrl = baseUrl + "/";
        }
        this._baseUrl = baseUrl;
    }
    get baseUrl() {
        return this._baseUrl;
    }
    buildUrl(path) {
        if (path.startsWith("/")) {
            path = path.substring(1);
        }
        return `${this.baseUrl}${path}`;
    }
    basicHeaders = {};
    transientHeaders = {};
    persistentHeaders = {};
    useBearerTokenProvider(provider) {
        this._bearerTokenProvider = provider;
    }
    useBearerTokenByDefault(value) {
        this._defaultToUseBearerToken = value;
    }
    setHeader(key, value, headerType = HeaderType.Transient) {
        if (headerType === HeaderType.Transient) {
            this.transientHeaders[key] = value;
        }
        else if (headerType === HeaderType.Persistent) {
            this.persistentHeaders[key] = value;
        }
        else {
            throw new Error("Invalid header type");
        }
    }
    async buildHeaders(options) {
        const headers = options?.requestHeaders || {};
        for (const [key, value] of Object.entries(this.basicHeaders)) {
            headers[key] = value;
        }
        if (options?.useBearerToken) {
            const token = await this._bearerTokenProvider?.();
            if (!token) {
                throw new Error("Bearer token is not provided");
            }
            headers["Authorization"] = `Bearer ${token}`;
        }
        for (const [key, value] of Object.entries(this.transientHeaders)) {
            if (!headers[key]) {
                headers[key] = value;
            }
        }
        for (const [key, value] of Object.entries(this.persistentHeaders)) {
            if (!headers[key]) {
                headers[key] = value;
            }
        }
        // reset transient headers after building the request
        this.transientHeaders = {};
        return headers;
    }
    buildRequestOptions(options) {
        if (!options)
            options = {};
        if (options.requestHeaders) {
            for (const [key, value] of Object.entries(this.basicHeaders)) {
                if (!options.requestHeaders[key]) {
                    options.requestHeaders[key] = value;
                }
            }
        }
        if (options.useBearerToken === undefined) {
            options.useBearerToken = this._defaultToUseBearerToken;
        }
        if (options.expectedDataResponseType === undefined) {
            options.expectedDataResponseType = EExpectedDataResponseType.Json;
        }
        if (options.expectedDataResponseType !== EExpectedDataResponseType.Json) {
            throw new Error("Only Json response type is supported.");
        }
        return options;
    }
    async get(path, options) {
        const url = this.buildUrl(path);
        options = this.buildRequestOptions(options);
        const response = await fetch(url, {
            method: "GET",
            headers: await this.buildHeaders(options),
        });
        if (!response.ok) {
            return { data: undefined, response };
        }
        const data = await response.json();
        return { data, response };
    }
    async post(path, body, options) {
        const url = this.buildUrl(path);
        options = this.buildRequestOptions(options);
        const bodyJson = JSON.stringify(body);
        const headers = await this.buildHeaders(options);
        if (!headers["Content-Type"]) {
            headers["Content-Type"] = "application/json";
        }
        const response = await fetch(url, {
            method: "POST",
            headers,
            body: bodyJson,
        });
        if (!response.ok) {
            return { data: undefined, response };
        }
        const data = await response.json();
        return { data, response };
    }
    async put(path, body, options) {
        const url = this.buildUrl(path);
        options = this.buildRequestOptions(options);
        const headers = await this.buildHeaders(options);
        if (!headers["Content-Type"]) {
            headers["Content-Type"] = "application/json";
        }
        const response = await fetch(url, {
            method: "PUT",
            headers,
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            return { data: undefined, response };
        }
        const data = await response.json();
        return { data, response };
    }
    async patch(path, body, options) {
        const url = this.buildUrl(path);
        options = this.buildRequestOptions(options);
        const headers = await this.buildHeaders(options);
        if (!headers["Content-Type"]) {
            headers["Content-Type"] = "application/json";
        }
        const response = await fetch(url, {
            method: "PATCH",
            headers,
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            return { data: undefined, response };
        }
        const data = await response.json();
        return { data, response };
    }
    async delete(path, body, options) {
        const url = this.buildUrl(path);
        options = this.buildRequestOptions(options);
        const headers = await this.buildHeaders(options);
        if (!headers["Content-Type"] && body) {
            headers["Content-Type"] = "application/json";
        }
        const response = await fetch(url, {
            method: "DELETE",
            body: body ? JSON.stringify(body) : undefined,
            headers,
        });
        const data = await response.json();
        return { data, response };
    }
    async *getRawIterable(path, options) {
        const url = this.buildUrl(path);
        options = this.buildRequestOptions(options);
        const response = await fetch(url, {
            method: "GET",
            headers: await this.buildHeaders(options),
        });
        if (!response.ok) {
            return { data: undefined, response };
        }
        if (!response.body) {
            throw new Error("Response body is null");
        }
        const reader = response.body.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            yield value;
        }
    }
    async *postRawIterable(path, body, options) {
        const url = this.buildUrl(path);
        options = this.buildRequestOptions(options);
        const bodyJson = JSON.stringify(body);
        const headers = await this.buildHeaders(options);
        if (!headers["Content-Type"]) {
            headers["Content-Type"] = "application/json";
        }
        const response = await fetch(url, {
            method: "POST",
            body: bodyJson,
            headers,
        });
        if (!response.body) {
            throw new Error("Response body is null");
        }
        if (!response.ok) {
            return { data: undefined, response };
        }
        const reader = response.body.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            yield value;
        }
    }
    async *putRawIterable(path, body, options) {
        const url = this.buildUrl(path);
        options = this.buildRequestOptions(options);
        const bodyJson = JSON.stringify(body);
        const headers = await this.buildHeaders(options);
        if (!headers["Content-Type"]) {
            headers["Content-Type"] = "application/json";
        }
        const response = await fetch(url, {
            method: "PUT",
            body: bodyJson,
            headers,
        });
        if (!response.ok) {
            return { data: undefined, response };
        }
        if (!response.body) {
            throw new Error("Response body is null");
        }
        const reader = response.body.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            yield value;
        }
    }
    async *patchRawIterable(path, body, options) {
        const url = this.buildUrl(path);
        options = this.buildRequestOptions(options);
        const bodyJson = JSON.stringify(body);
        const headers = await this.buildHeaders(options);
        if (!headers["Content-Type"]) {
            headers["Content-Type"] = "application/json";
        }
        const response = await fetch(url, {
            method: "PATCH",
            body: bodyJson,
            headers,
        });
        if (!response.ok) {
            return { data: undefined, response };
        }
        if (!response.body) {
            throw new Error("Response body is null");
        }
        const reader = response.body.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            yield value;
        }
    }
    async *deleteRawIterable(path, options) {
        const url = this.buildUrl(path);
        options = this.buildRequestOptions(options);
        const headers = await this.buildHeaders(options);
        if (!headers["Content-Type"]) {
            headers["Content-Type"] = "application/json";
        }
        const response = await fetch(url, {
            method: "DELETE",
            headers,
        });
        if (!response.ok) {
            return { data: undefined, response };
        }
        if (!response.body) {
            throw new Error("Response body is null");
        }
        const reader = response.body.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            yield value;
        }
    }
    handleResponseChunk(chunk) {
        const text = new TextDecoder("utf-8").decode(chunk);
        if (!text) {
            throw new Error("Response body is null");
        }
        // get the 3rd line of the text
        const lines = text.split("\n");
        if (lines.length < 3) {
            throw new Error("Streamed response chunk is not valid.");
        }
        const jsonLine = lines[2];
        if (!jsonLine) {
            throw new Error("Streamed response chunk is not valid.");
        }
        // strip data: from the json line
        const json = jsonLine.substring(jsonLine.indexOf("{"));
        if (!json) {
            throw new Error("Streamed response chunk is not valid.");
        }
        // parse the json line
        const data = JSON.parse(json);
        if (!data) {
            throw new Error("Streamed response chunk is not valid.");
        }
        return data;
    }
    async *getIterable(path, options) {
        for await (const chunk of this.getRawIterable(path, options)) {
            yield this.handleResponseChunk(chunk);
        }
    }
    async *postIterable(path, body, options) {
        for await (const chunk of this.postRawIterable(path, body, options)) {
            yield this.handleResponseChunk(chunk);
        }
    }
    async *putIterable(path, body, options) {
        for await (const chunk of this.putRawIterable(path, body, options)) {
            yield this.handleResponseChunk(chunk);
        }
    }
    async *patchIterable(path, body, options) {
        for await (const chunk of this.patchRawIterable(path, body, options)) {
            yield this.handleResponseChunk(chunk);
        }
    }
    async *deleteIterable(path, options) {
        for await (const chunk of this.deleteRawIterable(path, options)) {
            yield this.handleResponseChunk(chunk);
        }
    }
}
export var EExpectedDataResponseType;
(function (EExpectedDataResponseType) {
    EExpectedDataResponseType["Json"] = "json";
    EExpectedDataResponseType["Text"] = "text";
    EExpectedDataResponseType["Blob"] = "blob";
})(EExpectedDataResponseType || (EExpectedDataResponseType = {}));
const DEFAULT_REQUEST_OPTIONS = {
    requestHeaders: { "Content-Type": "application/json" },
    useBearerToken: false,
    expectedDataResponseType: EExpectedDataResponseType.Json,
};
