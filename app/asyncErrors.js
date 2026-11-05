// Express 4 does not catch errors from async route handlers: the rejected
// promise goes unhandled, and Node then stops the whole server. One bad
// request (a malformed query string, say) took the site down.
//
// Called on the app before any route is registered (server.js), this wraps
// every handler given to app.get/post/put/delete/patch/all so that an error,
// thrown or rejected, goes to next(): Express answers that request with a 500
// and carries on serving the others.

const METHODS = ['get', 'post', 'put', 'delete', 'patch', 'all'];

function wrap(handler) {
    if (Array.isArray(handler)) return handler.map(wrap);
    // Error-handling middleware (4 arguments) is left as it is
    if (typeof handler !== 'function' || handler.length >= 4) return handler;
    const fail = function (req, next) {
        return function (err) {
            console.error('Error in ' + req.method + ' ' + req.originalUrl + ':', err);
            next(err);
        };
    };
    return function (req, res, next) {
        try {
            const result = handler(req, res, next);
            if (result && typeof result.catch === 'function') result.catch(fail(req, next));
            return result;
        } catch (err) {
            fail(req, next)(err);
        }
    };
}

module.exports = function catchAsyncErrors(app) {
    METHODS.forEach(function (method) {
        const original = app[method];
        app[method] = function (path) {
            // app.get('setting') reads a setting
            if (method === 'get' && arguments.length === 1 && typeof path === 'string') {
                return original.call(this, path);
            }
            const args = Array.prototype.slice.call(arguments);
            return original.apply(this, [args[0]].concat(args.slice(1).map(wrap)));
        };
    });
    return app;
};
