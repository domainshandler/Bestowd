import type { Gift, CreateGiftBody, UpdateGiftBody } from '@bestowd/types';
export declare function listGifts(): Promise<Gift[]>;
export declare function getGift(id: string): Promise<Gift>;
export declare function createGift(body: CreateGiftBody): Promise<Gift>;
export declare function updateGift(id: string, body: UpdateGiftBody): Promise<Gift>;
export declare function deleteGift(id: string): Promise<void>;
//# sourceMappingURL=gifts.d.ts.map