export abstract class ApiClient {
	private _baseUrl: string;
	private _defaultToUseBearerToken = false;
	private _bearerTokenProvider?: () => string;

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

	protected basicHeaders: Record<string, string> = {
		"Content-Type": "application/json",
	};

	public withBearerTokenProvider(provider: () => string): void {
		this._bearerTokenProvider = provider;
	}

	private buildHeaders(options?: TApiRequestOptions): Record<string, string> {
		const headers = options?.requestHeaders || {};
		for (const [key, value] of Object.entries(this.basicHeaders)) {
			headers[key] = value;
		}
		if (options?.useBearerToken || this._defaultToUseBearerToken) {
			const token = this._bearerTokenProvider?.();
			if (!token) {
				throw new Error("Bearer token is not provided");
			}
			headers["Authorization"] = `Bearer ${token}`;
		}

		return headers;
	}

	private buildRequestOptions(options?: TApiRequestOptions): TApiRequestOptions {
		return { ...DEFAULT_REQUEST_OPTIONS, ...options };
	}

	public async get<T>(path: string, options?: TApiRequestOptions): Promise<TApiResponse<T>> {
		const url = this.buildUrl(path);
		options = this.buildRequestOptions(options);
		const response = await fetch(url, {
			method: "GET",
			headers: this.buildHeaders(options),
		});

		const data = await response.json();

		return { data, response };
	}

	public async post<T>(
		path: string,
		body: unknown,
		options?: TApiRequestOptions
	): Promise<TApiResponse<T>> {
		const url = this.buildUrl(path);
		const headers = this.buildHeaders(options);
		const bodyJson = JSON.stringify(body);
		options = this.buildRequestOptions(options);
		const response = await fetch(url, {
			method: "POST",
			headers: headers,
			body: bodyJson,
		});

		const data = await response.json();

		return { data, response };
	}

	public async put<T>(path: string, body: unknown, options?: TApiRequestOptions): Promise<TApiResponse<T>> {
		const url = this.buildUrl(path);
		options = this.buildRequestOptions(options);
		const response = await fetch(url, {
			method: "PUT",
			headers: this.buildHeaders(options),
			body: JSON.stringify(body),
		});

		const data = await response.json();

		return { data, response };
	}

	public async patch<T>(
		path: string,
		body: unknown,
		options?: TApiRequestOptions
	): Promise<TApiResponse<T>> {
		const url = this.buildUrl(path);
		options = this.buildRequestOptions(options);
		const response = await fetch(url, {
			method: "PATCH",
			headers: this.buildHeaders(options),
			body: JSON.stringify(body),
		});

		const data = await response.json();

		return { data, response };
	}

	public async delete<T>(path: string, options?: TApiRequestOptions): Promise<TApiResponse<T>> {
		const url = this.buildUrl(path);
		options = this.buildRequestOptions(options);
		const response = await fetch(url, {
			method: "DELETE",
			headers: this.buildHeaders(options),
		});

		const data = await response.json();

		return { data, response };
	}

	public async *getRawIterable(path: string, options?: TApiRequestOptions) { 
		const url = this.buildUrl(path);
		options = this.buildRequestOptions(options);
		const response = await fetch(url, {
			method: "GET",
			headers: this.buildHeaders(options),
		});

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
		const response = await fetch(url, {
			method: "POST",
			body: bodyJson,
			headers: this.buildHeaders(options),
		});

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

	public async *putRawIterable(path: string, body: unknown, options?: TApiRequestOptions) {
		const url = this.buildUrl(path);
		options = this.buildRequestOptions(options);
		const bodyJson = JSON.stringify(body);
		const response = await fetch(url, {
			method: "PUT",
			body: bodyJson,
			headers: this.buildHeaders(options),
		});

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
		const response = await fetch(url, {
			method: "PATCH",
			body: bodyJson,
			headers: this.buildHeaders(options),
		});

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
		const response = await fetch(url, {
			method: "DELETE",
			headers: this.buildHeaders(options),
		});

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

	public async *getIterable<T>(path: string, options?: TApiRequestOptions) : AsyncGenerator<T> { 
		for await (const chunk of this.getRawIterable(path, options)) {
			yield this.handleResponseChunk<T>(chunk);
		}
	}

	public async *postIterable<T>(path: string, body: unknown, options?: TApiRequestOptions): AsyncGenerator<T> {
		for await (const chunk of this.postRawIterable(path, body, options)) {
			yield this.handleResponseChunk<T>(chunk);
		}
	}

	public async *putIterable<T>(path: string, body: unknown, options?: TApiRequestOptions): AsyncGenerator<T> {
		for await (const chunk of this.putRawIterable(path, body, options)) {
			yield this.handleResponseChunk<T>(chunk);
		}
	}

	public async *patchIterable<T>(path: string, body: unknown, options?: TApiRequestOptions): AsyncGenerator<T> {
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
};

export type TApiResponse<T> = {
	data?: T;
	response: Response;
};

const DEFAULT_REQUEST_OPTIONS: TApiRequestOptions = {
	requestHeaders: { "Content-Type": "application/json" },
	useBearerToken: false,
	expectedDataResponseType: EExpectedDataResponseType.Json,
} as const;
