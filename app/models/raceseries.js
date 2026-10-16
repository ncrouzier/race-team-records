var mongoose = require('mongoose');
const racetypeSchema = require('./racetype').schema;

// The same race across editions (Cherry Blossom 10 Miler every April, Kensington
// parkrun every Saturday). One series per comparable race: the Cherry Blossom 5K is
// its own series. Links live here rather than on Race because every result embeds a
// full copy of its race, and a field there would have to be kept in sync on all of
// them.
// A series is an MCRRC club race when every one of its races is marked as one
// (Race.clubRace); it has no flag of its own.
var raceSeriesSchema = mongoose.Schema({
    name: { type: String, required: true, trim: true },
    racetype: racetypeSchema,
    // A new race is suggested for this series when its name normalizes (see
    // app/raceSeriesMatcher.js) to the name of a race already in it, so linking a
    // renamed edition by hand teaches the matcher the new name.
    races: [{
        _id: false,
        race: { type: mongoose.Schema.Types.ObjectId, required: true },
        // Only confirmed links count in public stats; suggestions wait for an admin.
        status: { type: String, enum: ['suggested', 'confirmed'], required: true },
        // Run at a distance other than the series' usual one (a short course year).
        // Still part of the series, but left out of time comparisons.
        offDistance: Boolean,
        // Why the matcher suggested it, shown to the admin reviewing it.
        reason: String,
        suggestedAt: Date,
        confirmedAt: Date,
        confirmedBy: String
    }],
    // Races an admin rejected for this series, so they are never suggested again.
    rejected: [mongoose.Schema.Types.ObjectId],
    // Other series an admin said are a different race despite a similar name
    // (Boston / Houston Marathon), so they stop showing as possible merges.
    distinctFrom: [mongoose.Schema.Types.ObjectId],
    createdAt: Date,
    updatedAt: Date
});

raceSeriesSchema.index({ 'races.race': 1 });
raceSeriesSchema.index({ 'races.status': 1 });

// Any change to any series moves SystemInfo.seriesUpdate, which tells browsers
// their cached series index is stale. On every kind of write, so no route,
// hook or script can forget it; a burst of writes (the backfill saves hundreds)
// is one update. unref: a pending update never keeps a script alive, so a
// script that writes series bumps it itself before it exits.
let seriesChangePending = null;
function seriesChanged() {
    if (seriesChangePending) return;
    seriesChangePending = setTimeout(function () {
        seriesChangePending = null;
        require('../service').updateSystemInfoAndInvalidateSystemInfoCache('seriesUpdate')
            .catch(err => console.error('Could not record a race series change:', err));
    }, 200);
    if (seriesChangePending.unref) seriesChangePending.unref();
}

raceSeriesSchema.post('save', seriesChanged);
raceSeriesSchema.post(['updateOne', 'updateMany', 'deleteOne', 'deleteMany', 'findOneAndUpdate', 'findOneAndDelete', 'replaceOne'],
    seriesChanged);
raceSeriesSchema.post('deleteOne', { document: true, query: false }, seriesChanged);

raceSeriesSchema.pre('save', function () {
    const date = Date.now();
    if (this.isNew) {
        this.createdAt = date;
    }
    this.updatedAt = date;
});

module.exports = mongoose.model('RaceSeries', raceSeriesSchema);
