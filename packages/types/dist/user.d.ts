export type IdentitySource = 'google' | 'email';
export type SubscriptionStatus = 'free' | 'premium' | 'past_due' | 'cancelled';
export interface AiProviderConfig {
    provider: 'openai' | 'anthropic' | 'gemini';
    apiKey: string;
    model: string;
}
export interface User {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    identitySource: IdentitySource;
    emailVerified: boolean;
    subscriptionStatus: SubscriptionStatus;
    createdAt: string;
}
export interface UpdateUserBody {
    name?: string;
    avatarUrl?: string;
    aiProviderConfig?: AiProviderConfig;
}
//# sourceMappingURL=user.d.ts.map