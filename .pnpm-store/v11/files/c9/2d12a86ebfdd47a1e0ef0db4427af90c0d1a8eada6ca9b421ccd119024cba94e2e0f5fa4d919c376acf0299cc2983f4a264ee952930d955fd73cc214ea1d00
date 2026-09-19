import HTTPClient from './httpClient.js';
export declare namespace annotations {
    interface Annotation {
        id: string;
        type: string;
        datasets: string[];
        title?: string;
        description?: string;
        url?: string;
        time: string;
        endTime?: string;
    }
    interface ListingQueryParams {
        datasets?: string[];
        start?: string;
        end?: string;
    }
    interface CreateRequest {
        type: string;
        datasets: string[];
        title?: string;
        description?: string;
        url?: string;
        time?: string;
        endTime?: string;
    }
    interface UpdateRequest {
        type?: string;
        datasets?: string[];
        title?: string;
        description?: string;
        url?: string;
        time?: string;
        endTime?: string;
    }
    class Service extends HTTPClient {
        private readonly localPath;
        /**
         * @see https://axiom.co/docs/restapi/endpoints/getAnnotations
         */
        list: (req?: ListingQueryParams) => Promise<Annotation[]>;
        /**
         * @see https://axiom.co/docs/restapi/endpoints/getAnnotation
         */
        get: (id: string) => Promise<Annotation>;
        /**
         * @see https://axiom.co/docs/restapi/endpoints/createAnnotation
         */
        create: (req: CreateRequest) => Promise<Annotation>;
        /**
         * @see https://axiom.co/docs/restapi/endpoints/updateAnnotation
         */
        update: (id: string, req: UpdateRequest) => Promise<Annotation>;
        /**
         * @see https://axiom.co/docs/restapi/endpoints/deleteAnnotation
         */
        delete: (id: string) => Promise<Response>;
    }
}
//# sourceMappingURL=annotations.d.ts.map