export type AssignmentStatus = 'idea' | 'purchased' | 'given';
export interface GiftAssignment {
    id: string;
    giftId: string;
    giverId: string;
    contactId: string;
    eventId: string | null;
    status: AssignmentStatus;
    givenAt: string | null;
    purchasePrice: string | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface CreateAssignmentBody {
    giftId: string;
    contactId: string;
    eventId?: string;
    status?: AssignmentStatus;
    notes?: string;
}
export interface UpdateAssignmentBody {
    status?: AssignmentStatus;
    givenAt?: string;
    purchasePrice?: string;
    notes?: string;
}
//# sourceMappingURL=assignment.d.ts.map