import HTTPClient from './httpClient.js';

var users;
(function (users) {
    const encodePath = (value) => encodeURIComponent(value);
    class Service extends HTTPClient {
        localPath = '/v2/users';
        /**
         * @see https://axiom.co/docs/restapi/endpoints/getCurrentUser
         */
        current = () => this.client.get('/v2/user');
        /**
         * @see https://axiom.co/docs/restapi/endpoints/getUsers
         */
        list = () => this.client.get(this.localPath);
        /**
         * @see https://axiom.co/docs/restapi/endpoints/getUser
         */
        get = (id) => this.client.get(`${this.localPath}/${encodePath(id)}`);
    }
    users.Service = Service;
})(users || (users = {}));

export { users };
//# sourceMappingURL=users.js.map
