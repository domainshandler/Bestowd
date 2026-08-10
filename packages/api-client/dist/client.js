const API_BASE = import.meta.env?.VITE_API_URL ?? 'http://localhost:3000';
const TOKEN_KEY = 'bestowd_token';
export class ApiError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
export async function apiFetch(path, init = {}) {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
    const res = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...init.headers,
        },
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new ApiError(res.status, body.error ?? res.statusText);
    }
    if (res.status === 204)
        return undefined;
    return res.json();
}
//# sourceMappingURL=client.js.map