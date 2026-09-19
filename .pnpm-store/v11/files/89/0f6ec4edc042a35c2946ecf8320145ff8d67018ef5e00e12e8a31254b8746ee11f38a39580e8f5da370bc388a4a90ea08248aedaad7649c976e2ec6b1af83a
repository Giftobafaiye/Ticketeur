'use strict';

var httpClient = require('./httpClient.cjs');

exports.monitors = void 0;
(function (monitors) {
    class Service extends httpClient.default {
        localPath = '/v2/monitors';
        /**
         * @see https://axiom.co/docs/restapi/endpoints/getMonitors
         */
        list = () => this.client.get(this.localPath);
        /**
         * @see https://axiom.co/docs/restapi/endpoints/getMonitor
         */
        get = (id) => this.client.get(this.localPath + '/' + id);
        /**
         * @see https://axiom.co/docs/restapi/endpoints/createMonitor
         */
        create = (req) => this.client.post(this.localPath, { body: JSON.stringify(req) });
        /**
         * @see https://axiom.co/docs/restapi/endpoints/updateMonitor
         */
        update = (id, req) => this.client.put(this.localPath + '/' + id, { body: JSON.stringify(req) });
        /**
         * @see https://axiom.co/docs/restapi/endpoints/deleteMonitor
         */
        delete = (id) => this.client.delete(this.localPath + '/' + id);
    }
    monitors.Service = Service;
})(exports.monitors || (exports.monitors = {}));
//# sourceMappingURL=monitors.cjs.map
