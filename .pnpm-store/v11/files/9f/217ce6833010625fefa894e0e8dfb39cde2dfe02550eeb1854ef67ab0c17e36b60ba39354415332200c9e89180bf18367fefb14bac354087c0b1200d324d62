import HTTPClient from './httpClient.js';
export declare namespace users {
    interface UserRole {
        id: string;
        name: string;
        [key: string]: unknown;
    }
    interface User {
        id: string;
        name: string;
        emails?: string[];
        email?: string;
        role?: UserRole | null;
        [key: string]: unknown;
    }
    class Service extends HTTPClient {
        private readonly localPath;
        /**
         * @see https://axiom.co/docs/restapi/endpoints/getCurrentUser
         */
        current: () => Promise<User>;
        /**
         * @see https://axiom.co/docs/restapi/endpoints/getUsers
         */
        list: () => Promise<User[]>;
        /**
         * @see https://axiom.co/docs/restapi/endpoints/getUser
         */
        get: (id: string) => Promise<User>;
    }
}
//# sourceMappingURL=users.d.ts.map