import HTTPClient from './httpClient.js';

var savedQueries;
(function (savedQueries) {
    const encodePath = (value) => encodeURIComponent(value);
    class Service extends HTTPClient {
        localPath = '/v2/apl-starred-queries';
        /**
         * @see https://axiom.co/docs/restapi/endpoints/getStarredQueries
         */
        list = (options) => this.client.get(this.localPath, {}, options);
        /**
         * @see https://axiom.co/docs/restapi/endpoints/getStarred
         */
        get = (id) => this.client.get(`${this.localPath}/${encodePath(id)}`);
    }
    savedQueries.Service = Service;
})(savedQueries || (savedQueries = {}));

export { savedQueries };
//# sourceMappingURL=savedQueries.js.map
