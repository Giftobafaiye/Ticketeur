import HTTPClient from './httpClient.js';
export declare namespace dashboards {
    type DashboardDocument = Record<string, unknown>;
    interface DashboardResource {
        id?: string;
        uid: string;
        dashboard: DashboardDocument;
        createdAt?: string;
        createdBy?: string;
        updatedAt?: string;
        updatedBy?: string;
        version?: number;
        [key: string]: unknown;
    }
    interface ListOptions {
        limit?: number;
        offset?: number;
    }
    class Service extends HTTPClient {
        private readonly localPath;
        /**
         * @see https://axiom.co/docs/restapi/endpoints/getDashboards
         */
        list: (options?: ListOptions) => Promise<DashboardResource[]>;
        /**
         * @see https://axiom.co/docs/restapi/endpoints/getDashboard
         */
        get: (uid: string) => Promise<DashboardResource>;
    }
}
//# sourceMappingURL=dashboards.d.ts.map