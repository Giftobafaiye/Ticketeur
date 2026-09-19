'use strict';

var httpClient = require('./httpClient.cjs');

exports.dashboards = void 0;
(function (dashboards) {
    const encodePath = (value) => encodeURIComponent(value);
    class Service extends httpClient.default {
        localPath = '/v2/dashboards';
        /**
         * @see https://axiom.co/docs/restapi/endpoints/getDashboards
         */
        list = (options) => this.client.get(this.localPath, {}, options);
        /**
         * @see https://axiom.co/docs/restapi/endpoints/getDashboard
         */
        get = (uid) => this.client.get(`${this.localPath}/uid/${encodePath(uid)}`);
    }
    dashboards.Service = Service;
})(exports.dashboards || (exports.dashboards = {}));
//# sourceMappingURL=dashboards.cjs.map
