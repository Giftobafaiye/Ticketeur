import HTTPClient from './httpClient.js';

var annotations;
(function (annotations) {
    class Service extends HTTPClient {
        localPath = '/v2/annotations';
        /**
         * @see https://axiom.co/docs/restapi/endpoints/getAnnotations
         */
        list = (req) => this.client.get(this.localPath, {}, req);
        /**
         * @see https://axiom.co/docs/restapi/endpoints/getAnnotation
         */
        get = (id) => this.client.get(this.localPath + '/' + id);
        /**
         * @see https://axiom.co/docs/restapi/endpoints/createAnnotation
         */
        create = (req) => this.client.post(this.localPath, { body: JSON.stringify(req) });
        /**
         * @see https://axiom.co/docs/restapi/endpoints/updateAnnotation
         */
        update = (id, req) => this.client.put(this.localPath + '/' + id, { body: JSON.stringify(req) });
        /**
         * @see https://axiom.co/docs/restapi/endpoints/deleteAnnotation
         */
        delete = (id) => this.client.delete(this.localPath + '/' + id);
    }
    annotations.Service = Service;
})(annotations || (annotations = {}));

export { annotations };
//# sourceMappingURL=annotations.js.map
