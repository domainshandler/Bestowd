export type EventType = 'birthday' | 'anniversary' | 'christmas' | 'custom';
export type RecurrenceRule = 'once' | 'annual' | string;
export interface BestowdEvent {
    id: string;
    contactId: string;
    type: EventType;
    name: string;
    date: string;
    recurrenceRule: RecurrenceRule;
    reminderDays: number[];
    nextOccurrence: string;
    createdAt: string;
    updatedAt: string;
}
export interface CreateEventBody {
    contactId: string;
    type: EventType;
    name: string;
    date: string;
    recurrenceRule?: RecurrenceRule;
    reminderDays?: number[];
}
export interface UpdateEventBody {
    type?: EventType;
    name?: string;
    date?: string;
    recurrenceRule?: RecurrenceRule;
    reminderDays?: number[];
}
//# sourceMappingURL=event.d.ts.map