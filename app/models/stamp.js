// The version stamps browsers check their cached data against (SystemInfo:
// resultUpdate, raceUpdate, memberUpdate, volunteerJobUpdate). One update,
// awaited by the save hooks, then the server's cached copy is dropped: the
// next request reads the new stamp, never the old one.
const SystemInfo = require('./systeminfo');

module.exports = function bumpStamp(field, date) {
    return SystemInfo.updateOne({ name: 'mcrrc' }, { $set: { [field]: new Date(date || Date.now()) } })
        .then(function () {
            // Lazily: the service loads the models
            return require('../service').invalidateSystemInfoCache();
        })
        .catch(function (err) {
            console.error('Could not update the ' + field + ' stamp:', err);
        });
};
