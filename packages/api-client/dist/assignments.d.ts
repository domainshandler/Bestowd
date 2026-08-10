import type { GiftAssignment, CreateAssignmentBody, UpdateAssignmentBody } from '@bestowd/types';
export declare function listAssignments(params?: {
    contactId?: string;
    eventId?: string;
}): Promise<GiftAssignment[]>;
export declare function createAssignment(body: CreateAssignmentBody): Promise<GiftAssignment>;
export declare function updateAssignment(id: string, body: UpdateAssignmentBody): Promise<GiftAssignment>;
export declare function deleteAssignment(id: string): Promise<void>;
//# sourceMappingURL=assignments.d.ts.map