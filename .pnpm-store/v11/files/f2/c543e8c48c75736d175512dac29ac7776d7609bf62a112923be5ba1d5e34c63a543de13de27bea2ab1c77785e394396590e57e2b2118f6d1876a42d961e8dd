import HTTPClient from './httpClient.js';

var monitors;
(function (monitors) {
    class Service extends HTTPClient {
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
})(monitors || (monitors = {}));

export { monitors };
//# sourceMappingURL=monitors.js.map
