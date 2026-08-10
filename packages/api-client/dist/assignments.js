import { apiFetch } from './client.js';
export function listAssignments(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/assignments${qs ? `?${qs}` : ''}`);
}
export function createAssignment(body) {
    return apiFetch('/assignments', { method: 'POST', body: JSON.stringify(body) });
}
export function updateAssignment(id, body) {
    return apiFetch(`/assignments/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}
export function deleteAssignment(id) {
    return apiFetch(`/assignments/${id}`, { method: 'DELETE' });
}
//# sourceMappingURL=assignments.js.map