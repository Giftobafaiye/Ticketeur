import HTTPClient from './httpClient.js';
export declare namespace savedQueries {
    interface SavedQuery {
        id: string;
        kind: 'apl';
        metadata: Record<string, unknown>;
        name: string;
        query: SavedQueryQuery;
        who: string;
        dataset?: string;
        [key: string]: unknown;
    }
    interface SavedQueryQuery {
        apl: string;
        startTime?: string;
        endTime?: string;
        [key: string]: unknown;
    }
    interface ListOptions {
        limit?: number;
        who?: string;
    }
    class Service extends HTTPClient {
        private readonly localPath;
        /**
         * @see https://axiom.co/docs/restapi/endpoints/getStarredQueries
         */
        list: (options?: ListOptions) => Promise<SavedQuery[]>;
        /**
         * @see https://axiom.co/docs/restapi/endpoints/getStarred
         */
        get: (id: string) => Promise<SavedQuery>;
    }
}
//# sourceMappingURL=savedQueries.d.ts.map