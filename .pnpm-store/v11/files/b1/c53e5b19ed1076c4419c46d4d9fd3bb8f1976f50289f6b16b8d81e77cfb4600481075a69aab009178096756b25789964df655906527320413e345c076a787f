'use strict';

var fetchRetry = require('fetch-retry');
var limit = require('./limit.cjs');

async function parseErrorMessage(resp) {
    const body = await resp.text().catch(() => '');
    if (body.length === 0) {
        return `Unknown ${resp.status} error`;
    }
    try {
        const payload = JSON.parse(body);
        if (typeof payload === 'object' &&
            payload !== null &&
            'message' in payload &&
            typeof payload.message === 'string' &&
            payload.message.length > 0) {
            return payload.message;
        }
    }
    catch {
        // Non-JSON error responses are returned as plain text.
    }
    return body;
}
function requestEndpoint(url) {
    try {
        return new URL(url).pathname;
    }
    catch {
        return url.split('?')[0];
    }
}
class AxiomRequestError extends Error {
    status;
    method;
    endpoint;
    constructor(status, method, endpoint, message) {
        super(`${method} ${endpoint} failed with ${status}: ${message}`);
        this.status = status;
        this.method = method;
        this.endpoint = endpoint;
        this.name = 'AxiomRequestError';
        Object.setPrototypeOf(this, AxiomRequestError.prototype);
    }
}
class FetchClient {
    config;
    constructor(config) {
        this.config = config;
    }
    async doReq(endpoint, method, init = {}, searchParams = {}, timeout = this.config.timeout, useAbsoluteUrl = false) {
        let finalUrl = useAbsoluteUrl ? endpoint : `${this.config.baseUrl}${endpoint}`;
        const params = this._prepareSearchParams(searchParams);
        if (params) {
            finalUrl += `?${params.toString()}`;
        }
        const headers = { ...this.config.headers, ...init.headers };
        const fetchFn = this.config.fetch ?? fetch;
        const resp = await fetchRetry(fetchFn)(finalUrl, {
            retries: 1,
            retryDelay: function (attempt, error, response) {
                return Math.pow(2, attempt) * 1000; // 1000, 2000, 4000
            },
            retryOn: [503, 502, 504, 500],
            headers,
            method,
            body: init.body ? init.body : undefined,
            signal: AbortSignal.timeout(timeout),
            cache: 'no-store',
        });
        if (resp.status === 204) {
            return resp;
        }
        else if (resp.status == 429) {
            const limit$1 = limit.parseLimitFromResponse(resp);
            return Promise.reject(new AxiomTooManyRequestsError(limit$1));
        }
        else if (resp.status === 401) {
            return Promise.reject(new Error('forbidden'));
        }
        else if (resp.status >= 400) {
            return Promise.reject(new AxiomRequestError(resp.status, method, requestEndpoint(finalUrl), await parseErrorMessage(resp)));
        }
        return (await resp.json());
    }
    post(url, init = {}, searchParams = {}, timeout = this.config.timeout, useAbsoluteUrl = false) {
        return this.doReq(url, 'POST', init, searchParams, timeout, useAbsoluteUrl);
    }
    get(url, init = {}, searchParams = {}, timeout = this.config.timeout, useAbsoluteUrl = false) {
        return this.doReq(url, 'GET', init, searchParams, timeout, useAbsoluteUrl);
    }
    put(url, init = {}, searchParams = {}, timeout = this.config.timeout, useAbsoluteUrl = false) {
        return this.doReq(url, 'PUT', init, searchParams, timeout, useAbsoluteUrl);
    }
    delete(url, init = {}, searchParams = {}, timeout = this.config.timeout, useAbsoluteUrl = false) {
        return this.doReq(url, 'DELETE', init, searchParams, timeout, useAbsoluteUrl);
    }
    _prepareSearchParams = (searchParams) => {
        const params = new URLSearchParams();
        let hasParams = false;
        Object.keys(searchParams).forEach((k) => {
            if (searchParams[k]) {
                params.append(k, searchParams[k]);
                hasParams = true;
            }
        });
        return hasParams ? params : null;
    };
}
class AxiomTooManyRequestsError extends Error {
    limit;
    shortcircuit;
    message = '';
    constructor(limit$1, shortcircuit = false) {
        super();
        this.limit = limit$1;
        this.shortcircuit = shortcircuit;
        Object.setPrototypeOf(this, AxiomTooManyRequestsError.prototype); // https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work
        const retryIn = AxiomTooManyRequestsError.timeUntilReset(limit$1);
        this.message = `${limit$1.type} limit exceeded, try again in ${retryIn.minutes}m${retryIn.seconds}s`;
        if (limit$1.type == limit.LimitType.api) {
            this.message = `${limit$1.scope} ` + this.message;
        }
    }
    static timeUntilReset(limit) {
        const total = limit.reset.getTime() - new Date().getTime();
        const seconds = Math.floor((total / 1000) % 60);
        const minutes = Math.floor((total / 1000 / 60) % 60);
        return {
            total,
            minutes,
            seconds,
        };
    }
}

exports.AxiomRequestError = AxiomRequestError;
exports.AxiomTooManyRequestsError = AxiomTooManyRequestsError;
exports.FetchClient = FetchClient;
//# sourceMappingURL=fetchClient.cjs.map
