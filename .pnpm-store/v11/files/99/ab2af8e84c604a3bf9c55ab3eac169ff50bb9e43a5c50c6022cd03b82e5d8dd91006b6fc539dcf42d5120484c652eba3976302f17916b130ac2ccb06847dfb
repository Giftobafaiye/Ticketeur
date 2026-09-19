'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var fetchClient = require('./fetchClient.cjs');

const Version = 'AXIOM_VERSION';
const AxiomURL = 'https://api.axiom.co';
const AxiomClientHeader = 'X-Axiom-Client';
/**
 * Builds an ingest URL using edge path format: /v1/ingest/{dataset}
 */
function buildEdgeIngestUrl(baseUrl, dataset) {
    try {
        const parsed = new URL(baseUrl);
        const path = parsed.pathname;
        if (path === '' || path === '/') {
            // Use edge path format
            parsed.pathname = `/v1/ingest/${dataset}`;
            return parsed.toString();
        }
        // URL has a custom path, use as-is (trim trailing slashes)
        parsed.pathname = path.replace(/\/+$/, '');
        return parsed.toString();
    }
    catch {
        // If URL parsing fails, do simple string concatenation as fallback
        const trimmed = baseUrl.replace(/\/+$/, '');
        return `${trimmed}/v1/ingest/${dataset}`;
    }
}
/**
 * Builds an ingest URL using legacy path format: /v1/datasets/{dataset}/ingest
 */
function buildLegacyIngestUrl(baseUrl, dataset) {
    try {
        const parsed = new URL(baseUrl);
        const path = parsed.pathname;
        if (path === '' || path === '/') {
            // Use legacy path format
            parsed.pathname = `/v1/datasets/${dataset}/ingest`;
            return parsed.toString();
        }
        // URL has a custom path, use as-is (trim trailing slashes)
        parsed.pathname = path.replace(/\/+$/, '');
        return parsed.toString();
    }
    catch {
        // If URL parsing fails, do simple string concatenation as fallback
        const trimmed = baseUrl.replace(/\/+$/, '');
        return `${trimmed}/v1/datasets/${dataset}/ingest`;
    }
}
/**
 * Resolves the ingest endpoint URL based on the client options.
 *
 * Priority: edgeUrl > edge > url > default cloud endpoint
 *
 * Edge endpoints use: /v1/ingest/{dataset}
 * Legacy endpoints use: /v1/datasets/{dataset}/ingest
 *
 * @param options - The client options
 * @param dataset - The dataset name to ingest into
 * @returns The full URL to use for ingestion
 */
function resolveIngestUrl(options, dataset) {
    // If edgeUrl is set, use it (takes precedence over edge)
    if (options.edgeUrl) {
        return buildEdgeIngestUrl(options.edgeUrl, dataset);
    }
    // If edge domain is set, build edge URL
    if (options.edge) {
        return `https://${options.edge}/v1/ingest/${dataset}`;
    }
    // If url is set, use legacy path format
    if (options.url) {
        return buildLegacyIngestUrl(options.url, dataset);
    }
    // Default: use cloud endpoint with legacy path format
    return `${AxiomURL}/v1/datasets/${dataset}/ingest`;
}
function buildQueryUrl(baseUrl, path) {
    try {
        const parsed = new URL(baseUrl);
        const currentPath = parsed.pathname;
        if (currentPath === '' || currentPath === '/') {
            parsed.pathname = path;
            return parsed.toString();
        }
        parsed.pathname = currentPath.replace(/\/+$/, '');
        return parsed.toString();
    }
    catch {
        const trimmed = baseUrl.replace(/\/+$/, '');
        return `${trimmed}${path}`;
    }
}
const edgeDeploymentUrls = {
    'cloud.us-east-1.aws': 'https://us-east-1.aws.edge.axiom.co',
    'cloud.eu-central-1.aws': 'https://eu-central-1.aws.edge.axiom.co',
};
function resolveEdgeUrlFromDeployment(edgeDeployment) {
    if (!edgeDeployment || edgeDeployment === 'null') {
        return undefined;
    }
    return edgeDeploymentUrls[edgeDeployment.toLowerCase()];
}
function assertNoUnsupportedEdgeDeployment(edgeDeployment, operation) {
    if (!edgeDeployment || edgeDeployment === 'null' || resolveEdgeUrlFromDeployment(edgeDeployment)) {
        return;
    }
    throw new Error(`Unsupported edgeDeployment "${edgeDeployment}". Pass edgeUrl or edge to route ${operation} to that deployment.`);
}
function resolveEdgeQueryUrl(clientOptions, options, path, operation) {
    if (options?.edgeUrl) {
        return buildQueryUrl(options.edgeUrl, path);
    }
    if (options?.edge) {
        return `https://${options.edge}${path}`;
    }
    const deploymentEdgeUrl = resolveEdgeUrlFromDeployment(options?.edgeDeployment);
    if (deploymentEdgeUrl) {
        return buildQueryUrl(deploymentEdgeUrl, path);
    }
    assertNoUnsupportedEdgeDeployment(options?.edgeDeployment, operation);
    if (clientOptions.edgeUrl) {
        return buildQueryUrl(clientOptions.edgeUrl, path);
    }
    if (clientOptions.edge) {
        return `https://${clientOptions.edge}${path}`;
    }
    throw new Error(`${operation} must be routed to an Axiom edge deployment. Set edge, edgeUrl, or edgeDeployment.`);
}
/**
 * Resolves the APL query endpoint URL.
 *
 * @see https://axiom.co/docs/restapi/endpoints/queryApl
 * @see https://axiom.co/docs/restapi/endpoints/queryEdge
 */
function resolveAplQueryUrl(options) {
    if (options.edgeUrl) {
        return buildQueryUrl(options.edgeUrl, '/v1/query/_apl');
    }
    if (options.edge) {
        return `https://${options.edge}/v1/query/_apl`;
    }
    if (options.url) {
        return buildQueryUrl(options.url, '/v1/datasets/_apl');
    }
    return `${AxiomURL}/v1/datasets/_apl`;
}
/**
 * Resolves the MPL query endpoint URL.
 *
 * @see https://axiom.co/docs/restapi/endpoints/queryMetrics
 */
function resolveMplQueryUrl(clientOptions, options) {
    return resolveEdgeQueryUrl(clientOptions, options, '/v1/query/_mpl', 'MPL queries');
}
class HTTPClient {
    client;
    clientOptions;
    constructor({ orgId = '', token, url, edge, edgeUrl, axiomClient, onError, fetch: fetchFn }) {
        if (!token) {
            console.warn('Missing Axiom token');
        }
        // Store options for use in ingest URL resolution
        this.clientOptions = { orgId, token, url, edge, edgeUrl, axiomClient, onError, fetch: fetchFn };
        // For the main API client, always use url or default (never edge options)
        // edge/edgeUrl only affects ingest endpoints, not other API calls
        const baseUrl = url ? url.replace(/\/+$/, '') : AxiomURL;
        const headers = {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token,
            [AxiomClientHeader]: appendAxiomClient('axiom-js/' + Version, axiomClient),
        };
        if (orgId) {
            headers['X-Axiom-Org-Id'] = orgId;
        }
        this.client = new fetchClient.FetchClient({
            baseUrl,
            headers,
            timeout: 20_000,
            ...(fetchFn && { fetch: fetchFn }),
        });
    }
    appendAxiomClient(axiomClient) {
        const headers = this.client.config.headers;
        if (!headers[AxiomClientHeader]) {
            return;
        }
        headers[AxiomClientHeader] = appendAxiomClient(headers[AxiomClientHeader], axiomClient);
    }
}
function appendAxiomClient(baseAxiomClient, axiomClient) {
    const additionalProducts = axiomClient?.trim().split(/\s+/).filter(Boolean) ?? [];
    if (additionalProducts.length === 0) {
        return baseAxiomClient;
    }
    const products = baseAxiomClient.trim().split(/\s+/).filter(Boolean);
    const productSet = new Set(products);
    for (const product of additionalProducts) {
        if (!productSet.has(product)) {
            products.push(product);
            productSet.add(product);
        }
    }
    return products.join(' ');
}

exports.appendAxiomClient = appendAxiomClient;
exports.default = HTTPClient;
exports.resolveAplQueryUrl = resolveAplQueryUrl;
exports.resolveEdgeQueryUrl = resolveEdgeQueryUrl;
exports.resolveIngestUrl = resolveIngestUrl;
exports.resolveMplQueryUrl = resolveMplQueryUrl;
//# sourceMappingURL=httpClient.cjs.map
