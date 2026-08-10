import type { User } from '@bestowd/types';
export declare function googleLogin(idToken: string): Promise<{
    token: string;
    user: User;
}>;
export declare function getMe(): Promise<User>;
//# sourceMappingURL=auth.d.ts.map