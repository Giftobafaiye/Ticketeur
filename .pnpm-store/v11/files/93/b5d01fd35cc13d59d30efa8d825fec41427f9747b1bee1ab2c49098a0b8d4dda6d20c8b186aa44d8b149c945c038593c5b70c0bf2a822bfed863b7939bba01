import { FetchClient } from './fetchClient.js';
/**
 * ClientOptions is used to configure the HTTPClient and provide the necessary
 * authentication information.
 *
 * @example
 * ```
 * const axiom = new Axiom({
 *     token: "my-token",
 *     orgId: "my-org-id",
 * })
 * ```
 *
 * @example
 * ```
 * // Using an edge domain for lower latency ingestion
 * const axiom = new Axiom({
 *     token: "my-token",
 *     edge: "eu-central-1.aws.edge.axiom.co",
 * })
 * ```
 *
 * @example
 * ```
 * // Using both url (for API operations) and edge (for ingest/query)
 * const axiom = new Axiom({
 *     token: "my-token",
 *     url: "https://api.eu.axiom.co",
 *     edge: "eu-central-1.aws.edge.axiom.co",
 * })
 * ```
 */
export interface ClientOptions {
    /**
     * an API or personal token to use for authentication, you can get one
     * from @{link: Axiom settings | https://app.axiom.co/api-tokens}.
     */
    token: string;
    /**
     * the ID of the organization to use, you can get this from Axiom settings page of your
     * organization. This is only needed if you are using a personal token.
     */
    orgId?: string;
    /**
     * URI of the Axiom API endpoint. Used for all API operations (datasets, users, etc.).
     * When edge options are set, this is used for non-ingest/query operations only.
     *
     * @example "https://api.eu.axiom.co"
     */
    url?: string;
    /**
     * The Axiom edge domain for ingestion and query operations.
     * Specify just the domain without scheme (https:// is added automatically).
     * When set, ingest and query operations are routed to this edge endpoint.
     * Can be used together with `url` - in that case, `url` handles API operations
     * while `edge` handles ingest/query.
     *
     * @example "eu-central-1.aws.edge.axiom.co"
     */
    edge?: string;
    /**
     * The Axiom edge URL for ingestion and query operations.
     * Specify the full URL with scheme.
     * Takes precedence over `edge` if both are set.
     * If the URL has a custom path, it is used as-is.
     * If the URL has no path, the edge path format is used.
     *
     * @example "https://eu-central-1.aws.edge.axiom.co"
     * @example "http://localhost:3400/ingest"
     */
    edgeUrl?: string;
    /**
     * Additional product tokens to append to the X-Axiom-Client header.
     * Use product/version tokens separated by spaces.
     *
     * @example "axiom-react/1.2.3 my-app/4.5.6"
     */
    axiomClient?: string;
    onError?: (error: Error) => void;
    /**
     * Custom fetch implementation. When provided, all HTTP requests use this
     * function instead of the global `fetch`. Useful for routing through a
     * proxy with a custom dispatcher (e.g., `undici.ProxyAgent`).
     *
     * @example
     * ```
     * import { ProxyAgent } from 'undici';
     *
     * const dispatcher = new ProxyAgent('http://proxy:8080');
     * const axiom = new Axiom({
     *     token: "my-token",
     *     fetch: (input, init) => fetch(input, { ...init, dispatcher }),
     * })
     * ```
     */
    fetch?: typeof globalThis.fetch;
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
export declare function resolveIngestUrl(options: Pick<ClientOptions, 'url' | 'edge' | 'edgeUrl'>, dataset: string): string;
export declare function resolveEdgeQueryUrl(clientOptions: Pick<ClientOptions, 'url' | 'edge' | 'edgeUrl'>, options: {
    edge?: string;
    edgeUrl?: string;
    edgeDeployment?: string | null;
} | undefined, path: string, operation: string): string;
/**
 * Resolves the APL query endpoint URL.
 *
 * @see https://axiom.co/docs/restapi/endpoints/queryApl
 * @see https://axiom.co/docs/restapi/endpoints/queryEdge
 */
export declare function resolveAplQueryUrl(options: Pick<ClientOptions, 'url' | 'edge' | 'edgeUrl'>): string;
/**
 * Resolves the MPL query endpoint URL.
 *
 * @see https://axiom.co/docs/restapi/endpoints/queryMetrics
 */
export declare function resolveMplQueryUrl(clientOptions: Pick<ClientOptions, 'url' | 'edge' | 'edgeUrl'>, options?: {
    edge?: string;
    edgeUrl?: string;
    edgeDeployment?: string | null;
}): string;
export default abstract class HTTPClient {
    protected readonly client: FetchClient;
    protected readonly clientOptions: ClientOptions;
    constructor({ orgId, token, url, edge, edgeUrl, axiomClient, onError, fetch: fetchFn }: ClientOptions);
    appendAxiomClient(axiomClient: string): void;
}
export declare function appendAxiomClient(baseAxiomClient: string, axiomClient?: string): string;
//# sourceMappingURL=httpClient.d.ts.map