import HTTPClient from './httpClient.js';

var dashboards;
(function (dashboards) {
    const encodePath = (value) => encodeURIComponent(value);
    class Service extends HTTPClient {
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
})(dashboards || (dashboards = {}));

export { dashboards };
//# sourceMappingURL=dashboards.js.map
