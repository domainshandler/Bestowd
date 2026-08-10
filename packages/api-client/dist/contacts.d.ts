import type { Contact, CreateContactBody, UpdateContactBody } from '@bestowd/types';
export declare function listContacts(): Promise<Contact[]>;
export declare function getContact(id: string): Promise<Contact>;
export declare function createContact(body: CreateContactBody): Promise<Contact>;
export declare function updateContact(id: string, body: UpdateContactBody): Promise<Contact>;
export declare function deleteContact(id: string): Promise<void>;
export declare function claimContact(id: string): Promise<Contact>;
//# sourceMappingURL=contacts.d.ts.map