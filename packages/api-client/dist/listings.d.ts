import type { ProductListing, CreateListingBody } from '@bestowd/types';
export declare function listListings(giftId: string): Promise<ProductListing[]>;
export declare function createListing(giftId: string, body: CreateListingBody): Promise<ProductListing>;
export declare function deleteListing(giftId: string, id: string): Promise<void>;
//# sourceMappingURL=listings.d.ts.map