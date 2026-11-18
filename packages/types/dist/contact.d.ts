export interface ContactAttribute {
    label: string;
    value: string;
    visible: boolean;
}
export interface Contact {
    id: string;
    ownerId: string;
    linkedUserId: string | null;
    name: string;
    avatarUrl: string | null;
    email: string | null;
    notes: string | null;
    attributes: ContactAttribute[];
    isManaged: boolean;
    invitedAt: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface CreateContactBody {
    name: string;
    email?: string;
    avatarUrl?: string;
    notes?: string;
    attributes?: ContactAttribute[];
}
export interface UpdateContactBody {
    name?: string;
    email?: string;
    avatarUrl?: string;
    notes?: string;
    attributes?: ContactAttribute[];
}
//# sourceMappingURL=contact.d.ts.map