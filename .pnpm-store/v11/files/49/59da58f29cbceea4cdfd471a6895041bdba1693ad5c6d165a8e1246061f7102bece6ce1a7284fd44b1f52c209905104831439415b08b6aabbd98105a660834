import HTTPClient from './httpClient.js';
export declare namespace monitors {
    type MonitorType = 'Threshold' | 'MatchEvent' | 'AnomalyDetection';
    type MonitorOperator = 'Below' | 'BelowOrEqual' | 'Above' | 'AboveOrEqual' | 'AboveOrBelow';
    interface Monitor {
        id: string;
        createdAt: string;
        createdBy: string;
        name: string;
        type: MonitorType;
        description?: string;
        aplQuery?: string;
        mplQuery?: string;
        operator?: MonitorOperator;
        threshold?: number;
        alertOnNoData?: boolean;
        notifyByGroup?: boolean;
        resolvable?: boolean;
        notifierIds?: string[];
        /**
         * @deprecated Use `notifierIds` instead.
         */
        notifierIDs?: string[];
        intervalMinutes?: number;
        rangeMinutes?: number;
        disabled?: boolean;
        disabledUntil?: string;
        [key: string]: unknown;
    }
    interface CreateRequest extends Omit<Monitor, 'id' | 'createdAt' | 'createdBy'> {
    }
    interface UpdateRequest extends Omit<Monitor, 'id' | 'createdAt' | 'createdBy'> {
    }
    class Service extends HTTPClient {
        private readonly localPath;
        /**
         * @see https://axiom.co/docs/restapi/endpoints/getMonitors
         */
        list: () => Promise<Monitor[]>;
        /**
         * @see https://axiom.co/docs/restapi/endpoints/getMonitor
         */
        get: (id: string) => Promise<Monitor>;
        /**
         * @see https://axiom.co/docs/restapi/endpoints/createMonitor
         */
        create: (req: CreateRequest) => Promise<Monitor>;
        /**
         * @see https://axiom.co/docs/restapi/endpoints/updateMonitor
         */
        update: (id: string, req: UpdateRequest) => Promise<Monitor>;
        /**
         * @see https://axiom.co/docs/restapi/endpoints/deleteMonitor
         */
        delete: (id: string) => Promise<Response>;
    }
}
//# sourceMappingURL=monitors.d.ts.map