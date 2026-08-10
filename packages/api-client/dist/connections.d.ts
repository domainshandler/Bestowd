export interface UserConnection {
    requesterId: string;
    addresseeId: string;
    status: 'pending' | 'accepted' | 'blocked';
    createdAt: string;
}
export declare function listConnections(): Promise<UserConnection[]>;
export declare function createConnection(addresseeEmail: string): Promise<UserConnection>;
export declare function updateConnection(requesterId: string, status: 'accepted' | 'blocked'): Promise<UserConnection>;
//# sourceMappingURL=connections.d.ts.map