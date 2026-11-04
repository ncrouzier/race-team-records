// The version stamps browsers check their cached data against (SystemInfo:
// resultUpdate, raceUpdate, memberUpdate, memberProfileUpdate,
// volunteerJobUpdate). One update, awaited by the save hooks, then the
// server's cached copy is dropped: the next request reads the new stamp,
// never the old one. `quiet`: drop only that cached copy, without the
// data-change listeners (the server's race list rebuild), for a change the
// race list does not contain.
const SystemInfo = require('./systeminfo');

module.exports = function bumpStamp(field, date, options) {
    const quiet = !!(options && options.quiet);
    return SystemInfo.updateOne({ name: 'mcrrc' }, { $set: { [field]: new Date(date || Date.now()) } })
        .then(function () {
            // Lazily: the service loads the models
            const service = require('../service');
            return quiet ? service.forgetSystemInfoCache() : service.invalidateSystemInfoCache();
        })
        .catch(function (err) {
            console.error('Could not update the ' + field + ' stamp:', err);
        });
};
