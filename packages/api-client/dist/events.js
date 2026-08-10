import { apiFetch } from './client.js';
export function listEvents() {
    return apiFetch('/events');
}
export function getEvent(id) {
    return apiFetch(`/events/${id}`);
}
export function createEvent(body) {
    return apiFetch('/events', { method: 'POST', body: JSON.stringify(body) });
}
export function updateEvent(id, body) {
    return apiFetch(`/events/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}
export function deleteEvent(id) {
    return apiFetch(`/events/${id}`, { method: 'DELETE' });
}
//# sourceMappingURL=events.js.map