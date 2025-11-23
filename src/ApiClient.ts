export enum HeaderType {
	Transient,
	Persistent,
}

export type TApiClientResult<TData> = [TData | null, Response];

export abstract class ApiClient {
	private _baseUrl: string;
	private _defaultToUseBearerToken = false;
	private _bearerTokenProvider?: () => Promise<string>;

	public constructor(baseUrl: string) {
		// Add a trailing slash to the baseUrl if there isn't one
		if (baseUrl && !baseUrl.endsWith("/")) {
			baseUrl = baseUrl + "/";
		}
		this._baseUrl = baseUrl;
	}

	public get baseUrl(): string {
		return this._baseUrl;
	}

	public buildUrl(path: string): string {
		if (path.startsWith("/")) {
			path = path.substring(1);
		}
		return `${this.baseUrl}${path}`;
	}

	protected basicHeaders: Record<string, string> = {};

	protected transientHeaders: Record<string, string> = {};

	protected persistentHeaders: Record<string, string> = {};

	public useBearerTokenProvider(provider: () => Promise<string>): void {
		this._bearerTokenProvider = provider;
	}

	public useBearerTokenByDefault(value: boolean) {
		this._defaultToUseBearerToken = value;
	}

	public setHeader(key: string, value: string, headerType: HeaderType = HeaderType.Transient): void {
		if (headerType === HeaderType.Transient) {
			this.transientHeaders[key] = value;
		} else if (headerType === HeaderType.Persistent) {
			this.persistentHeaders[key] = value;
		} else {
			throw new Error("Invalid header type");
		}
	}

	private async buildHeaders(options?: TApiRequestOptions): Promise<Record<string, string>> {
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

	private buildRequestOptions(options?: TApiRequestOptions): TApiRequestOptions {
		if (!options) options = {};

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

	public async get<T>(path: string, options?: TApiRequestOptions): Promise<TApiResponse<T>> {
		const url = this.buildUrl(path);
		options = this.buildRequestOptions(options);
		const response = await fetch(url, {
			method: "GET",
			headers: await this.buildHeaders(options),
		});

		if (!response.ok) {
			return { data: undefined, response };
		}

		let data: T | undefined;
		if (!options.skipJsonParsing) {
			const text = await response.text();
			if (text) {
				data = JSON.parse(text) as T;
			}
		}

		return { data, response };
	}

	public async post<T>(
		path: string,
		body: unknown,
		options?: TApiRequestOptions
	): Promise<TApiResponse<T>> {
		const url = this.buildUrl(path);
		options = this.buildRequestOptions(options);
		const bodyJson = JSON.stringify(body);
		const headers = await this.buildHeaders(options);
		if (!headers["Content-Type"] && !!body) {
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

		let data: T | undefined;
		if (!options.skipJsonParsing) {
			const text = await response.text();
			if (text) {
				data = JSON.parse(text) as T;
			}
		}

		return { data, response };
	}

	public async postFormData<T>(path: string, formData: FormData, options?: TApiRequestOptions): Promise<TApiResponse<T>> { 
		const url = this.buildUrl(path);
		options = this.buildRequestOptions(options);
		const headers = await this.buildHeaders(options);
		headers["Content-Type"] = "multipart/form-data"; 

		const response = await fetch(url, {
			method: "POST",
			headers,
			body: formData,
		}); 

		if (!response.ok) { 
			return { data: undefined, response }
		}

		let data: T | undefined;
		if (!options.skipJsonParsing) {
			const text = await response.text();
			if (text) {
				data = JSON.parse(text) as T;
			}
		}

		return { data, response };
	}

	public async put<T>(path: string, body: unknown, options?: TApiRequestOptions): Promise<TApiResponse<T>> {
		const url = this.buildUrl(path);
		options = this.buildRequestOptions(options);
		const headers = await this.buildHeaders(options);
		if (!headers["Content-Type"] && !!body) {
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

		let data: T | undefined;
		if (!options.skipJsonParsing) {
			const text = await response.text();
			if (text) {
				data = JSON.parse(text) as T;
			}
		}

		return { data, response };
	}

	public async patch<T>(
		path: string,
		body: unknown,
		options?: TApiRequestOptions
	): Promise<TApiResponse<T>> {
		const url = this.buildUrl(path);
		options = this.buildRequestOptions(options);
		const headers = await this.buildHeaders(options);
		if (!headers["Content-Type"] && !!body) {
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

		let data: T | undefined;
		if (!options.skipJsonParsing) {
			const text = await response.text();
			if (text) {
				data = JSON.parse(text) as T;
			}
		}

		return { data, response };
	}

	public async delete<T>(
		path: string,
		body?: unknown,
		options?: TApiRequestOptions
	): Promise<TApiResponse<T>> {
		const url = this.buildUrl(path);
		options = this.buildRequestOptions(options);
		const headers = await this.buildHeaders(options);
		if (!headers["Content-Type"] && !!body) {
			headers["Content-Type"] = "application/json";
		}
		if (!body) {
			delete headers["Content-Type"];
		}
		const response = await fetch(url, {
			method: "DELETE",
			body: body ? JSON.stringify(body) : undefined,
			headers,
		});

		let data: T | undefined;
		if (!options.skipJsonParsing) {
			const text = await response.text();
			if (text) {
				data = JSON.parse(text) as T;
			}
		}

		return { data, response };
	}

	public async *getRawIterable(path: string, options?: TApiRequestOptions) {
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

	public async *postRawIterable(path: string, body: unknown, options?: TApiRequestOptions) {
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

	public async *putRawIterable(path: string, body: unknown, options?: TApiRequestOptions) {
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

	public async *patchRawIterable(path: string, body: unknown, options?: TApiRequestOptions) {
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

	public async *deleteRawIterable(path: string, options?: TApiRequestOptions) {
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

	protected handleResponseChunk<T>(chunk: Uint8Array<ArrayBufferLike>): T {
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
		const data = JSON.parse(json) as T;
		if (!data) {
			throw new Error("Streamed response chunk is not valid.");
		}

		return data;
	}

	public async *getIterable<T>(path: string, options?: TApiRequestOptions): AsyncGenerator<T> {
		for await (const chunk of this.getRawIterable(path, options)) {
			yield this.handleResponseChunk<T>(chunk);
		}
	}

	public async *postIterable<T>(
		path: string,
		body: unknown,
		options?: TApiRequestOptions
	): AsyncGenerator<T> {
		for await (const chunk of this.postRawIterable(path, body, options)) {
			yield this.handleResponseChunk<T>(chunk);
		}
	}

	public async *putIterable<T>(
		path: string,
		body: unknown,
		options?: TApiRequestOptions
	): AsyncGenerator<T> {
		for await (const chunk of this.putRawIterable(path, body, options)) {
			yield this.handleResponseChunk<T>(chunk);
		}
	}

	public async *patchIterable<T>(
		path: string,
		body: unknown,
		options?: TApiRequestOptions
	): AsyncGenerator<T> {
		for await (const chunk of this.patchRawIterable(path, body, options)) {
			yield this.handleResponseChunk<T>(chunk);
		}
	}

	public async *deleteIterable<T>(path: string, options?: TApiRequestOptions): AsyncGenerator<T> {
		for await (const chunk of this.deleteRawIterable(path, options)) {
			yield this.handleResponseChunk<T>(chunk);
		}
	}
}

export enum EExpectedDataResponseType {
	Json = "json",
	Text = "text",
	Blob = "blob",
}

export type TApiRequestOptions = {
	requestHeaders?: Record<string, string>;
	useBearerToken?: boolean;
	// not implemented yet
	expectedDataResponseType?: EExpectedDataResponseType;
	skipJsonParsing?: boolean;
};

export type TApiResponse<T> = {
	data?: T;
	response: Response;
};

const DEFAULT_REQUEST_OPTIONS: TApiRequestOptions = {
	requestHeaders: { "Content-Type": "application/json" },
	useBearerToken: false,
	expectedDataResponseType: EExpectedDataResponseType.Json,
	skipJsonParsing: false,
} as const;
