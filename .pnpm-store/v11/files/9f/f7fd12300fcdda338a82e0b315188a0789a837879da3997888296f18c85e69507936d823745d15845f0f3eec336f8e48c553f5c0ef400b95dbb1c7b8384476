import HTTPClient, { resolveEdgeQueryUrl } from './httpClient.js';

var datasets;
(function (datasets) {
    datasets.TimestampField = '_time';
    const encodePath = (value) => encodeURIComponent(value);
    class Service extends HTTPClient {
        localPath = '/v2/datasets';
        /**
         * @see https://axiom.co/docs/restapi/endpoints/getDatasets
         */
        list = () => this.client.get(this.localPath);
        /**
         * @see https://axiom.co/docs/restapi/endpoints/getDataset
         */
        get = (id) => this.client.get(this.datasetPath(id));
        /**
         * @see https://axiom.co/docs/restapi/endpoints/createDataset
         */
        create = (req, opts) => {
            const params = new URLSearchParams();
            if (opts?.referrer) {
                params.set('referrer', opts.referrer);
            }
            const query = params.toString();
            const path = query ? `${this.localPath}?${query}` : this.localPath;
            return this.client.post(path, { body: JSON.stringify(req) });
        };
        /**
         * @see https://axiom.co/docs/restapi/endpoints/updateDataset
         */
        update = (id, req) => this.client.put(this.datasetPath(id), { body: JSON.stringify(req) });
        /**
         * @see https://axiom.co/docs/restapi/endpoints/deleteDataset
         */
        delete = (id) => this.client.delete(this.datasetPath(id));
        /**
         * @see https://axiom.co/docs/restapi/endpoints/trimDataset
         */
        trim = (id, maxDurationStr) => {
            // Go's 'time.Duration' uses nanoseconds as its base unit. So parse the
            // duration string and convert to nanoseconds. 1ms = 1000000ns.
            const req = { maxDuration: maxDurationStr };
            return this.client.post(this.datasetPath(id) + '/trim', { body: JSON.stringify(req) });
        };
        /**
         * @see https://axiom.co/docs/restapi/endpoints/getFieldsForDataset
         */
        fields = (dataset) => this.client.get(this.datasetPath(dataset) + '/fields');
        /**
         * @see https://axiom.co/docs/restapi/endpoints/getMapFields
         */
        mapFields = (dataset) => this.client.get(this.datasetPath(dataset) + '/mapfields');
        /**
         * @see https://axiom.co/docs/restapi/endpoints/getDatasetMetrics
         */
        metrics = (dataset, options) => this.getMetricsInfo(`datasets/${encodePath(dataset)}/metrics`, options);
        /**
         * @see https://axiom.co/docs/restapi/endpoints/getDatasetMetricTags
         */
        metricTags = (dataset, metric, options) => this.getMetricsInfo(`datasets/${encodePath(dataset)}/metrics/${encodePath(metric)}/tags`, options);
        /**
         * @see https://axiom.co/docs/restapi/endpoints/getDatasetMetricTagValues
         */
        metricTagValues = (dataset, metric, tag, options) => this.getMetricsInfo(`datasets/${encodePath(dataset)}/metrics/${encodePath(metric)}/tags/${encodePath(tag)}/values`, options);
        /**
         * @see https://axiom.co/docs/restapi/endpoints/getDatasetTags
         */
        metricDatasetTags = (dataset, options) => this.getMetricsInfo(`datasets/${encodePath(dataset)}/tags`, options);
        /**
         * @see https://axiom.co/docs/restapi/endpoints/getDatasetTagValues
         */
        metricDatasetTagValues = (dataset, tag, options) => this.getMetricsInfo(`datasets/${encodePath(dataset)}/tags/${encodePath(tag)}/values`, options);
        datasetPath = (dataset) => this.localPath + '/' + encodePath(dataset);
        getMetricsInfo = async (path, options) => {
            const init = options.accept ? { headers: { Accept: options.accept } } : {};
            return this.client.get(resolveEdgeQueryUrl(this.clientOptions, options, `/v1/query/metrics/info/${path.replace(/^\/+/, '')}`, 'metrics metadata requests'), init, { start: options.start, end: options.end }, undefined, true);
        };
    }
    datasets.Service = Service;
})(datasets || (datasets = {}));

export { datasets };
//# sourceMappingURL=datasets.js.map
