'use strict';

var httpClient = require('./httpClient.cjs');

exports.savedQueries = void 0;
(function (savedQueries) {
    const encodePath = (value) => encodeURIComponent(value);
    class Service extends httpClient.default {
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
})(exports.savedQueries || (exports.savedQueries = {}));
//# sourceMappingURL=savedQueries.cjs.map
