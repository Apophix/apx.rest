export abstract class ApiClient {
	private _baseUrl: string;
	private _defaultToUseBearerToken = false;
	private _bearerTokenProvider?: () => string;

	public constructor(baseUrl: string) {
		// Add a trailing slash to the baseUrl if there isn't one
		if (baseUrl && !baseUrl.endsWith('/')) {
			baseUrl = baseUrl + '/';
		}
		this._baseUrl = baseUrl;
	}

	public get baseUrl(): string {
		return this._baseUrl;
	}

	public buildUrl(path: string): string {
		if (path.startsWith('/')) {
			path = path.substring(1);
		}
		return `${this.baseUrl}${path}`;
	}

	protected basicHeaders: Record<string, string> = {
		'Content-Type': 'application/json',
	};

	public withBearerTokenProvider(provider: () => string): void {
		this._bearerTokenProvider = provider;
	}

	private buildHeaders(options?: TApiRequestOptions): Record<string, string> {
		const headers = options?.requestHeaders || {};
		for (const [key, value] of Object.entries(this.basicHeaders)) {
			headers[key] = value
		}
		if (options?.useBearerToken || this._defaultToUseBearerToken) {
			const token = this._bearerTokenProvider?.();
			if (!token) {
				throw new Error('Bearer token is not provided');
			}
			headers['Authorization'] = `Bearer ${token}`;
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
			method: 'GET',
			headers: this.buildHeaders(options),
		});

		const data = await response.json();

		return { data, response };
	}

	public async post<T>(path: string, body: unknown, options?: TApiRequestOptions): Promise<TApiResponse<T>> {
		const url = this.buildUrl(path);
		const headers = this.buildHeaders(options);
		const bodyJson = JSON.stringify(body);
		options = this.buildRequestOptions(options);
		const response = await fetch(url, {
			method: 'POST',
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
			method: 'PUT',
			headers: this.buildHeaders(options),
			body: JSON.stringify(body),
		});

		const data = await response.json();

		return { data, response };
	}

	public async patch<T>(path: string, body: unknown, options?: TApiRequestOptions): Promise<TApiResponse<T>> {
		const url = this.buildUrl(path);
		options = this.buildRequestOptions(options);
		const response = await fetch(url, {
			method: 'PATCH',
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
			method: 'DELETE',
			headers: this.buildHeaders(options),
		});

		const data = await response.json();

		return { data, response };
	}

}

export enum EExpectedDataResponseType {
	Json = 'json',
	Text = 'text',
	Blob = 'blob',
}

export type TApiRequestOptions = {
	requestHeaders?: Record<string, string>;
	useBearerToken?: boolean;
	// not implemented yet 
	expectedDataResponseType?: EExpectedDataResponseType;
}

export type TApiResponse<T> = {
	data?: T;
	response: Response;
}

const DEFAULT_REQUEST_OPTIONS: TApiRequestOptions = {
	requestHeaders: { 'Content-Type': 'application/json' },
	useBearerToken: false,
	expectedDataResponseType: EExpectedDataResponseType.Json,
} as const; 
