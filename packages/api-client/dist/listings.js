import { apiFetch } from './client.js';
export function listListings(giftId) {
    return apiFetch(`/gifts/${giftId}/listings`);
}
export function createListing(giftId, body) {
    return apiFetch(`/gifts/${giftId}/listings`, { method: 'POST', body: JSON.stringify(body) });
}
export function deleteListing(giftId, id) {
    return apiFetch(`/gifts/${giftId}/listings/${id}`, { method: 'DELETE' });
}
//# sourceMappingURL=listings.js.map