import type { BestowdEvent, CreateEventBody, UpdateEventBody } from '@bestowd/types';
export declare function listEvents(): Promise<BestowdEvent[]>;
export declare function getEvent(id: string): Promise<BestowdEvent>;
export declare function createEvent(body: CreateEventBody): Promise<BestowdEvent>;
export declare function updateEvent(id: string, body: UpdateEventBody): Promise<BestowdEvent>;
export declare function deleteEvent(id: string): Promise<void>;
//# sourceMappingURL=events.d.ts.map