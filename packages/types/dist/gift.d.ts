export type GiftType = 'product' | 'basket';
export type Vendor = 'amazon' | 'etsy' | 'target' | 'custom';
export interface ProductListing {
    id: string;
    giftId: string;
    vendor: Vendor;
    vendorProductId: string | null;
    vendorUrl: string;
    listedPrice: string | null;
    currency: string;
    createdAt: string;
}
export interface Gift {
    id: string;
    createdById: string;
    type: GiftType;
    title: string;
    description: string | null;
    imageUrl: string | null;
    upc: string | null;
    tags: string[];
    basketItems: Gift[];
    listings: ProductListing[];
    createdAt: string;
    updatedAt: string;
}
export interface CreateGiftBody {
    type?: GiftType;
    title: string;
    description?: string;
    imageUrl?: string;
    upc?: string;
    tags?: string[];
    basketItemIds?: string[];
}
export interface UpdateGiftBody {
    title?: string;
    description?: string;
    imageUrl?: string;
    upc?: string;
    tags?: string[];
    basketItemIds?: string[];
}
export interface CreateListingBody {
    vendor: Vendor;
    vendorProductId?: string;
    vendorUrl: string;
    listedPrice?: string;
    currency?: string;
}
//# sourceMappingURL=gift.d.ts.map