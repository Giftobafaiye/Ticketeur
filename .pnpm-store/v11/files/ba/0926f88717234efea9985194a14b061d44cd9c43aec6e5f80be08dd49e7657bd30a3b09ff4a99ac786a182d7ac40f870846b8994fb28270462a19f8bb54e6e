import HTTPClient from './httpClient.js';
export declare namespace datasets {
    const TimestampField = "_time";
    type DatasetKind = 'otel:metrics:v1' | 'otel:traces:v1' | 'otel:logs:v1' | 'axiom:events:v1';
    interface Dataset {
        id: string;
        name: string;
        description: string;
        who: string;
        created: string;
        kind: DatasetKind;
        canWrite?: boolean;
        edgeDeployment?: string | null;
        mapFields?: string[] | null;
        region?: string;
        retentionDays?: number;
        sharedByOrg?: string;
        updatedAt?: string;
        useRetentionPeriod?: boolean;
    }
    interface Field {
        name: string;
        type: string;
        description?: string;
        unit?: string;
        hidden?: boolean;
        [key: string]: unknown;
    }
    type TrimResult = Response;
    type MapFields = string[];
    interface CreateRequest {
        name: string;
        description?: string;
        edgeDeployment?: string | null;
        kind?: DatasetKind;
        region?: string;
        retentionDays?: number;
        useRetentionPeriod?: boolean;
    }
    interface CreateOptions {
        referrer?: string;
    }
    interface UpdateRequest {
        description?: string;
        retentionDays?: number;
        useRetentionPeriod?: boolean;
    }
    interface MetricsInfoOptions {
        start: string;
        end: string;
        edge?: string;
        edgeUrl?: string;
        edgeDeployment?: string | null;
        accept?: string;
    }
    interface MetricInfo {
        temporality: string;
        type: string;
        unit: string | null;
        [key: string]: unknown;
    }
    type MetricsInfo = Record<string, MetricInfo>;
    class Service extends HTTPClient {
        private readonly localPath;
        /**
         * @see https://axiom.co/docs/restapi/endpoints/getDatasets
         */
        list: () => Promise<Dataset[]>;
        /**
         * @see https://axiom.co/docs/restapi/endpoints/getDataset
         */
        get: (id: string) => Promise<Dataset>;
        /**
         * @see https://axiom.co/docs/restapi/endpoints/createDataset
         */
        create: (req: CreateRequest, opts?: CreateOptions) => Promise<Dataset>;
        /**
         * @see https://axiom.co/docs/restapi/endpoints/updateDataset
         */
        update: (id: string, req: UpdateRequest) => Promise<Dataset>;
        /**
         * @see https://axiom.co/docs/restapi/endpoints/deleteDataset
         */
        delete: (id: string) => Promise<Response>;
        /**
         * @see https://axiom.co/docs/restapi/endpoints/trimDataset
         */
        trim: (id: string, maxDurationStr: string) => Promise<TrimResult>;
        /**
         * @see https://axiom.co/docs/restapi/endpoints/getFieldsForDataset
         */
        fields: (dataset: string) => Promise<Field[]>;
        /**
         * @see https://axiom.co/docs/restapi/endpoints/getMapFields
         */
        mapFields: (dataset: string) => Promise<MapFields>;
        /**
         * @see https://axiom.co/docs/restapi/endpoints/getDatasetMetrics
         */
        metrics: (dataset: string, options: MetricsInfoOptions) => Promise<MetricsInfo>;
        /**
         * @see https://axiom.co/docs/restapi/endpoints/getDatasetMetricTags
         */
        metricTags: (dataset: string, metric: string, options: MetricsInfoOptions) => Promise<string[]>;
        /**
         * @see https://axiom.co/docs/restapi/endpoints/getDatasetMetricTagValues
         */
        metricTagValues: (dataset: string, metric: string, tag: string, options: MetricsInfoOptions) => Promise<string[]>;
        /**
         * @see https://axiom.co/docs/restapi/endpoints/getDatasetTags
         */
        metricDatasetTags: (dataset: string, options: MetricsInfoOptions) => Promise<string[]>;
        /**
         * @see https://axiom.co/docs/restapi/endpoints/getDatasetTagValues
         */
        metricDatasetTagValues: (dataset: string, tag: string, options: MetricsInfoOptions) => Promise<string[]>;
        private datasetPath;
        private getMetricsInfo;
    }
}
//# sourceMappingURL=datasets.d.ts.map