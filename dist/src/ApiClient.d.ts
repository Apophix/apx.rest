export declare enum HeaderType {
    Transient = 0,
    Persistent = 1
}
export type TApiClientResult<TData> = [TData | null, Response];
export declare abstract class ApiClient {
    private _baseUrl;
    private _defaultToUseBearerToken;
    private _bearerTokenProvider?;
    constructor(baseUrl: string);
    get baseUrl(): string;
    buildUrl(path: string): string;
    protected basicHeaders: Record<string, string>;
    protected transientHeaders: Record<string, string>;
    protected persistentHeaders: Record<string, string>;
    useBearerTokenProvider(provider: () => Promise<string>): void;
    useBearerTokenByDefault(value: boolean): void;
    setHeader(key: string, value: string, headerType?: HeaderType): void;
    protected buildHeaders(options?: TApiRequestOptions): Promise<Record<string, string>>;
    protected buildRequestOptions(options?: TApiRequestOptions): TApiRequestOptions;
    get<T>(path: string, options?: TApiRequestOptions): Promise<TApiResponse<T>>;
    post<T>(path: string, body: unknown, options?: TApiRequestOptions): Promise<TApiResponse<T>>;
    postFormData<T>(path: string, formData: FormData, options?: TApiRequestOptions): Promise<TApiResponse<T>>;
    put<T>(path: string, body: unknown, options?: TApiRequestOptions): Promise<TApiResponse<T>>;
    patch<T>(path: string, body: unknown, options?: TApiRequestOptions): Promise<TApiResponse<T>>;
    delete<T>(path: string, body?: unknown, options?: TApiRequestOptions): Promise<TApiResponse<T>>;
    getRawIterable(path: string, options?: TApiRequestOptions): AsyncGenerator<Uint8Array<ArrayBufferLike>, {
        data: undefined;
        response: Response;
    } | undefined, unknown>;
    postRawIterable(path: string, body: unknown, options?: TApiRequestOptions): AsyncGenerator<Uint8Array<ArrayBufferLike>, {
        data: undefined;
        response: Response;
    } | undefined, unknown>;
    putRawIterable(path: string, body: unknown, options?: TApiRequestOptions): AsyncGenerator<Uint8Array<ArrayBufferLike>, {
        data: undefined;
        response: Response;
    } | undefined, unknown>;
    patchRawIterable(path: string, body: unknown, options?: TApiRequestOptions): AsyncGenerator<Uint8Array<ArrayBufferLike>, {
        data: undefined;
        response: Response;
    } | undefined, unknown>;
    deleteRawIterable(path: string, options?: TApiRequestOptions): AsyncGenerator<Uint8Array<ArrayBufferLike>, {
        data: undefined;
        response: Response;
    } | undefined, unknown>;
    protected handleResponseChunk<T>(chunk: Uint8Array<ArrayBufferLike>): T;
    getIterable<T>(path: string, options?: TApiRequestOptions): AsyncGenerator<T>;
    postIterable<T>(path: string, body: unknown, options?: TApiRequestOptions): AsyncGenerator<T>;
    putIterable<T>(path: string, body: unknown, options?: TApiRequestOptions): AsyncGenerator<T>;
    patchIterable<T>(path: string, body: unknown, options?: TApiRequestOptions): AsyncGenerator<T>;
    deleteIterable<T>(path: string, options?: TApiRequestOptions): AsyncGenerator<T>;
}
export declare enum EExpectedDataResponseType {
    Json = "json",
    Text = "text",
    Blob = "blob"
}
export type TApiRequestOptions = {
    requestHeaders?: Record<string, string>;
    useBearerToken?: boolean;
    expectedDataResponseType?: EExpectedDataResponseType;
    skipJsonParsing?: boolean;
};
export type TApiResponse<T> = {
    data?: T;
    response: Response;
};
//# sourceMappingURL=ApiClient.d.ts.map