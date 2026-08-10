export declare class ApiError extends Error {
    status: number;
    constructor(status: number, message: string);
}
export declare function apiFetch<T>(path: string, init?: RequestInit): Promise<T>;
//# sourceMappingURL=client.d.ts.map