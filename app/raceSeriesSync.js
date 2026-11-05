// Keeps race series in step with races as they are created, edited, replaced and
// deleted. Everything it adds is a suggestion for an admin to confirm, and it never
// undoes an admin's decision: confirmed links follow their race, rejections hold.
//
// Work runs one job at a time, after the race write that triggered it, so two races
// saved together cannot both start a series around the same ungrouped race, and a
// failure here never fails the race save.

const mongoose = require('mongoose');
const RaceSeries = require('./models/raceseries');
const { seriesKey, proposeSeries, describeSeries, findSeriesForRace } = require('./raceSeriesMatcher');

const RACE_FIELDS = 'racename racedate racetype location';

let queue = Promise.resolve();

function enqueue(label, job) {
    queue = queue.then(job).catch(err => console.error('Race series (' + label + '):', err));
    return queue;
}

function Race() {
    // Required lazily: the race model requires this module for its hooks
    return require('./models/race');
}

function isOffDistance(race, series) {
    return !!(series.racetype && series.racetype.name && race.racetype &&
        race.racetype.name !== series.racetype.name);
}

// A series left with nothing an admin has looked at and fewer than two races
// groups nothing: drop it.
async function dropHollowSeries() {
    await RaceSeries.deleteMany({
        $or: [
            { races: { $size: 0 } },
            { races: { $size: 1 }, 'races.status': { $ne: 'confirmed' } }
        ]
    });
}

// Every series as the matcher sees it, plus what is needed to look for
// ungrouped earlier editions.
async function describeAllSeries() {
    const allSeries = await RaceSeries.find().lean();
    const linkedIds = allSeries.flatMap(s => s.races.map(l => l.race));
    const linkedRaces = await Race().find({ _id: { $in: linkedIds } }, RACE_FIELDS).lean();
    const byId = new Map(linkedRaces.map(r => [String(r._id), r]));
    const described = allSeries.map(s =>
        describeSeries(s, s.races.map(l => byId.get(String(l.race))).filter(Boolean)));
    return { allSeries, described, linkedIds };
}

// Earlier editions of `race` in no series, as a proposed new series around it,
// or null. Races an admin rejected somewhere have been looked at, so they are
// left out. `race` needs an _id (a placeholder will do for one not saved yet).
async function ungroupedEditions(race, { allSeries, linkedIds }) {
    const key = seriesKey(race);
    if (!key) return null;
    const rejected = new Set(allSeries.flatMap(s => (s.rejected || []).map(String)));
    const ungrouped = await Race().find({ _id: { $nin: linkedIds.concat(race._id) } }, RACE_FIELDS).lean();
    const editions = ungrouped.filter(r => !rejected.has(String(r._id)) && seriesKey(r) === key);
    if (!editions.length) return null;
    return proposeSeries([race].concat(editions))
        .find(p => p.entries.some(e => String(e.race._id) === String(race._id))) || null;
}

async function suggest(raceId) {
    const race = await Race().findById(raceId, RACE_FIELDS).lean();
    if (!race || await RaceSeries.exists({ 'races.race': race._id })) return;

    const all = await describeAllSeries();
    const now = new Date();
    const match = findSeriesForRace(race, all.described);
    if (match) {
        await RaceSeries.updateOne({ _id: match.series._id }, {
            $push: { races: { race: race._id, status: 'suggested', offDistance: match.offDistance, reason: match.reason, suggestedAt: now } },
            $set: { updatedAt: now }
        });
        return;
    }

    // No series yet: maybe an earlier edition sits ungrouped
    const proposal = await ungroupedEditions(race, all);
    if (!proposal) return;
    await new RaceSeries({
        name: proposal.name,
        racetype: proposal.racetype,
        races: proposal.entries.map(e => ({
            race: e.race._id, status: 'suggested', offDistance: e.offDistance, reason: e.reason, suggestedAt: now
        }))
    }).save();
}

// Name, distance or location changed. A suggestion was made for the old values, so
// it is made again; a confirmed link stays, with off-distance following the new
// distance.
async function changed(raceId) {
    const series = await RaceSeries.findOne({ 'races.race': raceId });
    if (series) {
        const link = series.races.find(l => l.race.equals(raceId));
        if (link.status === 'confirmed') {
            const race = await Race().findById(raceId, 'racetype').lean();
            if (race) {
                link.offDistance = isOffDistance(race, series);
                await series.save();
            }
            return;
        }
        series.races.pull({ race: raceId });
        await series.save();
        await dropHollowSeries();
    }
    await suggest(raceId);
}

// One race took over from another (an edit merged them, or moved the last results
// onto a new race). The old race's link passes to the new one, unless the new one
// already has a confirmed link of its own.
async function replaced(oldId, newId) {
    if (String(oldId) === String(newId)) return;
    const oldSeries = await RaceSeries.findOne({ 'races.race': oldId });
    if (!oldSeries) return;
    const newSeries = await RaceSeries.findOne({ 'races.race': newId });
    if (newSeries) {
        const newLink = newSeries.races.find(l => l.race.equals(newId));
        if (newLink.status === 'confirmed') return;
        await RaceSeries.updateOne({ _id: newSeries._id }, { $pull: { races: { race: newId } } });
    }
    const race = await Race().findById(newId, 'racetype').lean();
    if (!race) return;
    const series = await RaceSeries.findById(oldSeries._id);
    if (!series) return;
    const link = series.races.find(l => l.race.equals(oldId));
    if (!link) return;
    link.race = newId;
    link.offDistance = isOffDistance(race, series);
    await series.save();
    await dropHollowSeries();
}

// An admin picked a series for this race (or none), adding results or editing the
// race. That is a decision, so links it makes are confirmed. Runs after the race's
// own jobs, so it replaces any automatic suggestion. `choice` is one of:
//   { seriesId }                         this series
//   { newSeries: { name, raceIds } }     a new series with these ungrouped races
//   { none: true, declined: [seriesId] } no series; never suggest the declined ones
// Adding results never moves a race out of a confirmed series (the admin may not
// have looked); editing the race does (`override`), and the series it leaves
// will not suggest it again.
async function assigned(raceId, choice, username, override) {
    const current = await RaceSeries.findOne({ 'races.race': raceId });
    const currentLink = current && current.races.find(l => l.race.equals(raceId));
    if (currentLink && currentLink.status === 'confirmed' && !override) return;
    const race = await Race().findById(raceId, RACE_FIELDS).lean();
    if (!race) return;

    const now = new Date();
    const confirmedLink = (raceDoc, series) => ({
        race: raceDoc._id, status: 'confirmed', offDistance: isOffDistance(raceDoc, series),
        reason: override ? 'picked when editing the race' : 'picked when adding results',
        suggestedAt: now, confirmedAt: now, confirmedBy: username
    });
    const leaveCurrent = async () => {
        if (!current) return;
        const update = { $pull: { races: { race: raceId } } };
        if (override) update.$addToSet = { rejected: raceId };
        await RaceSeries.updateOne({ _id: current._id }, update);
    };

    if (choice.seriesId) {
        if (!mongoose.isValidObjectId(choice.seriesId)) return;
        const series = await RaceSeries.findById(choice.seriesId);
        if (!series) return;
        const existing = series.races.find(l => l.race.equals(raceId));
        if (existing) {
            Object.assign(existing, { status: 'confirmed', confirmedAt: now, confirmedBy: username });
        } else {
            await leaveCurrent();
            series.races.push(confirmedLink(race, series));
        }
        series.rejected.pull(raceId);
        await series.save();
    } else if (choice.newSeries) {
        const name = String(choice.newSeries.name || '').trim();
        const ids = (choice.newSeries.raceIds || []).filter(id => mongoose.isValidObjectId(id)).map(oid);
        // Editions only suggested elsewhere (often by this race's own creation job)
        // are taken over; ones an admin confirmed elsewhere stay where they are.
        const holding = await RaceSeries.find({ 'races.race': { $in: ids } }, 'races').lean();
        const confirmedElsewhere = new Set(holding.flatMap(s => s.races)
            .filter(l => l.status === 'confirmed').map(l => String(l.race)));
        const editions = await Race().find({ _id: { $in: ids.filter(id => !confirmedElsewhere.has(String(id))) } }, RACE_FIELDS).lean();
        if (!editions.length || !name) return;
        const proposal = proposeSeries([race].concat(editions))
            .find(p => p.entries.some(e => e.race._id.equals(race._id)));
        if (!proposal) return;
        await leaveCurrent();
        const taken = proposal.entries.map(e => e.race._id);
        await RaceSeries.updateMany({ 'races.race': { $in: taken } }, { $pull: { races: { race: { $in: taken } } } });
        const series = new RaceSeries({ name, racetype: proposal.racetype, races: [] });
        proposal.entries.forEach(e => series.races.push(confirmedLink(e.race, series)));
        await series.save();
    } else if (choice.none) {
        await leaveCurrent();
        const declined = (choice.declined || []).filter(id => mongoose.isValidObjectId(id));
        if (declined.length) {
            await RaceSeries.updateMany({ _id: { $in: declined } }, { $addToSet: { rejected: raceId } });
        }
    }
    await dropHollowSeries();
}

async function deleted(raceId) {
    await RaceSeries.updateMany({ $or: [{ 'races.race': raceId }, { rejected: raceId }] },
        { $pull: { races: { race: raceId }, rejected: raceId } });
    await dropHollowSeries();
}

// Ids arrive as strings from query filters and as ObjectIds from documents;
// $pull only matches the ObjectId form.
function oid(id) {
    return new mongoose.Types.ObjectId(String(id));
}

module.exports = {
    raceCreated: raceId => enqueue('new race', () => suggest(oid(raceId))),
    raceChanged: raceId => enqueue('race edit', () => changed(oid(raceId))),
    raceReplaced: (oldId, newId) => enqueue('race replaced', () => replaced(oid(oldId), oid(newId))),
    raceDeleted: raceId => enqueue('race deleted', () => deleted(oid(raceId))),
    // No choice sent (another client, or the picker never loaded): the automatic
    // suggestion stands.
    raceAssigned: (raceId, choice, username, options) => choice && typeof choice === 'object' ?
        enqueue('series picked', () => assigned(oid(raceId), choice, username, !!(options && options.override))) : queue,
    describeAllSeries,
    ungroupedEditions,
    // Resolves once every job queued so far has run
    idle: () => queue
};
