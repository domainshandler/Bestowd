import { apiFetch } from './client.js';
export function listGifts() {
    return apiFetch('/gifts');
}
export function getGift(id) {
    return apiFetch(`/gifts/${id}`);
}
export function createGift(body) {
    return apiFetch('/gifts', { method: 'POST', body: JSON.stringify(body) });
}
export function updateGift(id, body) {
    return apiFetch(`/gifts/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}
export function deleteGift(id) {
    return apiFetch(`/gifts/${id}`, { method: 'DELETE' });
}
//# sourceMappingURL=gifts.js.map