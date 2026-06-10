const API_PREFIXES = ['/paperai', '/pageindex'];

function registerRoutes(router, method, subpath, ...handlers) {
    for (const prefix of API_PREFIXES) {
        router[method](`${prefix}${subpath}`, ...handlers);
    }
}

module.exports = {
    API_PREFIXES,
    registerRoutes,
};
