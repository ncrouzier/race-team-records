// DEBUG_TRACE=on in .env: debug traces in the server log, all over the app.
// Off (unset, or anything else), nothing extra is logged or added.
//
// - Every /api request, timed step by step (app/requestTrace.js, mounted in
//   server.js); a route adds its own steps with req.trace(message).
// - debug.log(area, message) for any other code that wants a trace line.

const enabled = /^(on|true|1|yes)$/i.test(process.env.DEBUG_TRACE || '');

function log(area, message) {
    if (enabled) console.log('[debug ' + area + '] ' + message);
}

module.exports = { enabled, log };
