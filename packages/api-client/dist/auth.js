import { apiFetch } from './client.js';
export function googleLogin(idToken) {
    return apiFetch('/auth/google', { method: 'POST', body: JSON.stringify({ idToken }) });
}
export function getMe() {
    return apiFetch('/auth/me');
}
//# sourceMappingURL=auth.js.map