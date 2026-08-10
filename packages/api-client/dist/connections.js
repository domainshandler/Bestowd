import { apiFetch } from './client.js';
export function listConnections() {
    return apiFetch('/connections');
}
export function createConnection(addresseeEmail) {
    return apiFetch('/connections', { method: 'POST', body: JSON.stringify({ addresseeEmail }) });
}
export function updateConnection(requesterId, status) {
    return apiFetch(`/connections/${requesterId}`, { method: 'PATCH', body: JSON.stringify({ status }) });
}
//# sourceMappingURL=connections.js.map