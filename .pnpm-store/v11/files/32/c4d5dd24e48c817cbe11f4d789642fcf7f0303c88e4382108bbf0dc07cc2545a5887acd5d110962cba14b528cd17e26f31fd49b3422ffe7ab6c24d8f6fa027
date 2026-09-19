'use strict';

var annotations = require('./annotations.cjs');
var dashboards = require('./dashboards.cjs');
var datasets = require('./datasets.cjs');
var monitors = require('./monitors.cjs');
var savedQueries = require('./savedQueries.cjs');
var users = require('./users.cjs');
var batch = require('./batch.cjs');
var httpClient = require('./httpClient.cjs');
var token = require('./token.cjs');

class BaseClient extends httpClient.default {
    annotations;
    dashboards;
    datasets;
    monitors;
    savedQueries;
    users;
    localPath = '/v1';
    onError = console.error;
    constructor(options) {
        if (options.token && token.isAxiomPersonalToken(options.token)) {
            console.warn('Using a personal token (`xapt-...`) is deprecated for security reasons. Please use an API token (`xaat-...`) instead. Support for personal tokens will be removed in a future release.');
        }
        super(options);
        this.annotations = new annotations.annotations.Service(options);
        this.dashboards = new dashboards.dashboards.Service(options);
        this.datasets = new datasets.datasets.Service(options);
        this.monitors = new monitors.monitors.Service(options);
        this.savedQueries = new savedQueries.savedQueries.Service(options);
        this.users = new users.users.Service(options);
        this.query = this.query.bind(this); // bind `this` so method uses client state when passed around
        this.aplQuery = this.aplQuery.bind(this); // bind `this` so method uses client state when passed around
        if (options.onError) {
            this.onError = options.onError;
        }
    }
    // Services create their own HTTPClient instances, so appending after construction
    // must update the base client and each mounted service client.
    appendAxiomClient = (axiomClient) => {
        super.appendAxiomClient(axiomClient);
        this.annotations.appendAxiomClient(axiomClient);
        this.dashboards.appendAxiomClient(axiomClient);
        this.datasets.appendAxiomClient(axiomClient);
        this.monitors.appendAxiomClient(axiomClient);
        this.savedQueries.appendAxiomClient(axiomClient);
        this.users.appendAxiomClient(axiomClient);
    };
    /**
     * Ingest events into the provided dataset using raw data types, e.g: string, buffer or a stream.
     *
     * @param dataset - name of the dataset to ingest events into
     * @param data - data to be ingested
     * @param contentType - optional content type, defaults to JSON
     * @param contentEncoding - optional content encoding, defaults to Auto
     * @param options - optional ingest options
     * @returns result a promise of ingest and its status, check: {@link IngestStatus}
     * @example
     * ```
     * import { AxiomWithoutBatching } from '@axiomhq/js';
     *
     * const axiom = new AxiomWithoutBatching();
     * ```
     *
     */
    ingestRaw = async (dataset, data, contentType = exports.ContentType.JSON, contentEncoding = exports.ContentEncoding.Auto, options) => {
        try {
            const encoded = await this.encodeIngestPayload(data, contentEncoding);
            const ingestUrl = httpClient.resolveIngestUrl(this.clientOptions, dataset);
            return await this.client.post(ingestUrl, {
                headers: {
                    'Content-Type': contentType,
                    'Content-Encoding': encoded.contentEncoding,
                },
                body: encoded.data,
            }, {
                'timestamp-field': options?.timestampField,
                'timestamp-format': options?.timestampFormat,
                'csv-delimiter': options?.csvDelimiter,
            }, undefined, // use default timeout
            true);
        }
        catch (err) {
            this.onError(err);
            return await Promise.resolve({
                ingested: 0,
                failed: 0,
                processedBytes: 0,
                blocksCreated: 0,
                walLength: 0,
            });
        }
    };
    encodeIngestPayload = async (data, contentEncoding) => {
        if (contentEncoding !== exports.ContentEncoding.Auto) {
            return { data, contentEncoding };
        }
        if (typeof CompressionStream === 'undefined') {
            return { data, contentEncoding: exports.ContentEncoding.Identity };
        }
        try {
            const source = this.resolveCompressionSource(data);
            if (!source) {
                return { data, contentEncoding: exports.ContentEncoding.Identity };
            }
            const stream = source.pipeThrough(new CompressionStream('gzip'));
            const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
            return { data: compressed, contentEncoding: exports.ContentEncoding.GZIP };
        }
        catch (err) {
            this.onError(err);
            return { data, contentEncoding: exports.ContentEncoding.Identity };
        }
    };
    resolveCompressionSource = (data) => {
        if (typeof ReadableStream !== 'undefined' && data instanceof ReadableStream) {
            return data;
        }
        if (this.isAsyncIterable(data)) {
            return new ReadableStream({
                start: async (controller) => {
                    for await (const chunk of data) {
                        controller.enqueue(this.normalizeChunk(chunk));
                    }
                    controller.close();
                },
            });
        }
        if (typeof data === 'string' || data instanceof Uint8Array) {
            return new Blob([data]).stream();
        }
        return null;
    };
    isAsyncIterable = (value) => {
        return (value !== null &&
            typeof value === 'object' &&
            Symbol.asyncIterator in value &&
            typeof value[Symbol.asyncIterator] === 'function');
    };
    normalizeChunk = (chunk) => {
        if (chunk instanceof Uint8Array) {
            return chunk;
        }
        if (chunk instanceof ArrayBuffer) {
            return new Uint8Array(chunk);
        }
        if (typeof chunk === 'string') {
            return new TextEncoder().encode(chunk);
        }
        return new TextEncoder().encode(String(chunk));
    };
    /**
     * Executes a legacy dataset query against the provided dataset.
     *
     * @param dataset - name of the dataset to query
     * @param query - legacy query request
     * @param options - optional query options
     * @returns Promise<QueryLegacyResult>
     * @see https://axiom.co/docs/restapi/endpoints/queryDataset
     */
    queryLegacy = (dataset, query, options) => this.client.post(this.localPath + '/datasets/' + dataset + '/query', {
        body: JSON.stringify(query),
    }, {
        'streaming-duration': options?.streamingDuration,
        nocache: options?.noCache,
    }, 120_000);
    query(query, options) {
        if (options?.type === 'mpl') {
            return this.queryMpl(query, options);
        }
        return this.queryApl(query, options);
    }
    queryApl = (apl, options) => {
        const req = { apl: apl };
        const format = options?.format ?? 'tabular';
        if (options?.startTime) {
            req.startTime = options?.startTime;
        }
        if (options?.endTime) {
            req.endTime = options?.endTime;
        }
        return this.client
            .post(httpClient.resolveAplQueryUrl(this.clientOptions), {
            body: JSON.stringify(req),
        }, {
            'streaming-duration': options?.streamingDuration,
            nocache: options?.noCache,
            format,
            cursor: options?.cursor,
        }, 120_000, true)
            .then((res) => {
            if (format !== 'tabular') {
                return res;
            }
            const result = res;
            return {
                ...res,
                tables: result.tables.map((t) => {
                    return {
                        ...t,
                        events: function* () {
                            let iteration = 0;
                            if (!this.columns) {
                                return;
                            }
                            while (iteration <= this.columns[0].length) {
                                const value = Object.fromEntries(this.fields.map((field, fieldIdx) => [field.name, this.columns[fieldIdx][iteration]]));
                                if (iteration >= this.columns[0].length) {
                                    return value;
                                }
                                yield value;
                                iteration++;
                            }
                        },
                    };
                }),
            };
        });
    };
    queryMpl = async (mpl, options) => {
        const req = {
            mpl,
            startTime: options.startTime,
            endTime: options.endTime,
        };
        const init = {
            body: JSON.stringify(req),
        };
        if (options.accept) {
            init.headers = {
                Accept: options.accept,
            };
        }
        return this.client.post(httpClient.resolveMplQueryUrl(this.clientOptions, options), init, {
            format: options.format,
        }, 120_000, true);
    };
    aplQuery(apl, options) {
        return this.queryApl(apl, options);
    }
}
/**
 * Axiom's client without batching events in the background.
 * In most cases you'll want to use the {@link Axiom} client instead.
 *
 *
 * @param options - The {@link ClientOptions} to configure authentication
 *
 */
class AxiomWithoutBatching extends BaseClient {
    /**
     * Ingest event(s) asynchronously
     *
     * @param dataset - name of the dataset to ingest events into
     * @param events - list of events to be ingested, could be a single object as well
     * @param options - optional ingest options
     * @returns the result of the ingest, check: {@link IngestStatus}
     *
     * @example
     * ```
     * import { AxiomWithoutBatching } from '@axiomhq/js';
     *
     * const axiom = new AxiomWithoutBatching();
     * await axiom.ingest('dataset-name', [{ foo: 'bar' }])
     * ```
     *
     */
    async ingest(dataset, events, options) {
        const array = Array.isArray(events) ? events : [events];
        const json = array.map((v) => JSON.stringify(v)).join('\n');
        return this.ingestRaw(dataset, json, exports.ContentType.NDJSON, exports.ContentEncoding.Auto, options);
    }
}
/**
 * Axiom's default client that queues events in the background,
 * sends them asynchronously to the server every 1s or every 1000 events.
 *
 * @param options - The options passed to the client
 *
 */
class Axiom extends BaseClient {
    batch = {};
    /**
     * Ingest events asynchronously
     *
     * @remarks
     * Events passed to ingest method will be queued in a batch and sent
     * in the background every second or every 1000 events.
     *
     * @param dataset - name of the dataset to ingest events into
     * @param events - list of events to be ingested, could be a single object as well
     * @param options - optional ingest options
     * @returns void, as the events are sent in the background
     *
     */
    ingest = (dataset, events, options) => {
        const key = batch.createBatchKey(dataset, options);
        if (!this.batch[key]) {
            this.batch[key] = new batch.Batch((dataset, events, options) => {
                const array = Array.isArray(events) ? events : [events];
                const json = array.map((v) => JSON.stringify(v)).join('\n');
                return this.ingestRaw(dataset, json, exports.ContentType.NDJSON, exports.ContentEncoding.Auto, options);
            }, dataset, options, { onError: this.onError });
        }
        return this.batch[key].ingest(events);
    };
    /**
     * Flushes all the events that have been queued in the background
     *
     * @remarks
     * calling `await flush()` will wait for all the events to be sent to the server
     * and is necessary to ensure data delivery.
     */
    flush = async () => {
        let promises = [];
        for (const key in this.batch) {
            promises.push(this.batch[key].flush().catch(this.onError));
        }
        await Promise.all(promises).catch(this.onError);
    };
}
BigInt.prototype.toJSON = function () {
    return this.toString();
};
exports.ContentType = void 0;
(function (ContentType) {
    ContentType["JSON"] = "application/json";
    ContentType["NDJSON"] = "application/x-ndjson";
    ContentType["CSV"] = "text/csv";
})(exports.ContentType || (exports.ContentType = {}));
exports.ContentEncoding = void 0;
(function (ContentEncoding) {
    ContentEncoding["Auto"] = "auto";
    ContentEncoding["Identity"] = "";
    ContentEncoding["GZIP"] = "gzip";
})(exports.ContentEncoding || (exports.ContentEncoding = {}));
exports.AggregationOp = void 0;
(function (AggregationOp) {
    AggregationOp["Count"] = "count";
    AggregationOp["Distinct"] = "distinct";
    AggregationOp["Sum"] = "sum";
    AggregationOp["Avg"] = "avg";
    AggregationOp["Min"] = "min";
    AggregationOp["Max"] = "max";
    AggregationOp["Topk"] = "topk";
    AggregationOp["Percentiles"] = "percentiles";
    AggregationOp["Histogram"] = "histogram";
    AggregationOp["Variance"] = "variance";
    AggregationOp["Stdev"] = "stdev";
    AggregationOp["ArgMin"] = "argmin";
    AggregationOp["ArgMax"] = "argmax";
    AggregationOp["MakeSet"] = "makeset";
    AggregationOp["MakeSetIf"] = "makesetif";
    AggregationOp["CountIf"] = "countif";
    AggregationOp["CountDistinctIf"] = "distinctif";
})(exports.AggregationOp || (exports.AggregationOp = {}));
exports.FilterOp = void 0;
(function (FilterOp) {
    FilterOp["And"] = "and";
    FilterOp["Or"] = "or";
    FilterOp["Not"] = "not";
    FilterOp["Equal"] = "==";
    FilterOp["NotEqual"] = "!=";
    FilterOp["Exists"] = "exists";
    FilterOp["NotExists"] = "not-exists";
    FilterOp["GreaterThan"] = ">";
    FilterOp["GreaterThanOrEqualTo"] = ">=";
    FilterOp["LessThan"] = "<";
    FilterOp["LessThanOrEqualTo"] = "<=";
    FilterOp["Gt"] = "gt";
    FilterOp["Gte"] = "gte";
    FilterOp["Lt"] = "lt";
    FilterOp["Lte"] = "lte";
    FilterOp["StartsWith"] = "starts-with";
    FilterOp["NotStartsWith"] = "not-starts-with";
    FilterOp["EndsWith"] = "ends-with";
    FilterOp["NotEndsWith"] = "not-ends-with";
    FilterOp["Contains"] = "contains";
    FilterOp["NotContains"] = "not-contains";
    FilterOp["Regexp"] = "regexp";
    FilterOp["NotRegexp"] = "not-regexp";
})(exports.FilterOp || (exports.FilterOp = {}));

exports.Axiom = Axiom;
exports.AxiomWithoutBatching = AxiomWithoutBatching;
//# sourceMappingURL=client.cjs.map
