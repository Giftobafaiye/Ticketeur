'use strict';

var httpClient = require('./httpClient.cjs');

exports.annotations = void 0;
(function (annotations) {
    class Service extends httpClient.default {
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
})(exports.annotations || (exports.annotations = {}));
//# sourceMappingURL=annotations.cjs.map
