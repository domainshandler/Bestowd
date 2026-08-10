import { apiFetch } from './client.js';
export function listContacts() {
    return apiFetch('/contacts');
}
export function getContact(id) {
    return apiFetch(`/contacts/${id}`);
}
export function createContact(body) {
    return apiFetch('/contacts', { method: 'POST', body: JSON.stringify(body) });
}
export function updateContact(id, body) {
    return apiFetch(`/contacts/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}
export function deleteContact(id) {
    return apiFetch(`/contacts/${id}`, { method: 'DELETE' });
}
export function claimContact(id) {
    return apiFetch(`/contacts/${id}/claim`, { method: 'POST' });
}
//# sourceMappingURL=contacts.js.map