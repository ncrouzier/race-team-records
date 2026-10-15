// Admin API for race series: reviewing the matcher's suggestions and grouping races
// by hand. A race belongs to at most one series, and a series left with no races is
// deleted. Every link an admin makes or touches here is confirmed.

const mongoose = require('mongoose');
const service = require('./service');
const Race = require('./models/race');
const Result = require('./models/result');
const RaceType = require('./models/racetype');
const RaceSeries = require('./models/raceseries');
const { seriesKey, parkrunName, isVariableDistance, findPossibleMerges, rankSeriesForRace, similarNames } = require('./raceSeriesMatcher');
const raceSeriesSync = require('./raceSeriesSync');
const { seriesStats, teamSeriesStats, distanceKey, surfaceKey } = require('./raceSeriesStats');

function badRequest(res, message) {
    return res.status(400).json({ error: message });
}

function objectIds(ids) {
    if (!Array.isArray(ids) || !ids.length || !ids.every(id => mongoose.isValidObjectId(id))) return null;
    return ids.map(id => new mongoose.Types.ObjectId(id));
}

function locationLabel(race) {
    const loc = race.location || {};
    return loc.state || loc.country || '';
}

function mostCommon(values) {
    const counts = new Map();
    values.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
    let best = null;
    for (const [v, n] of counts) if (!best || n > best[1]) best = [v, n];
    return best ? best[0] : null;
}

function isOffDistance(race, series) {
    return !!(series.racetype && series.racetype.name && race.racetype &&
        race.racetype.name !== series.racetype.name);
}

// A series is a club race when every one of these races (its editions) is one
function allClubRaces(races) {
    return races.length > 0 && races.every(r => r.clubRace);
}

// Marks races as MCRRC club races (or not). Every result keeps a copy of its race,
// so the copies follow, and cached race lists are told to refresh.
async function setClubRace(raceIds, value) {
    await Race.updateMany({ _id: { $in: raceIds } }, { $set: { clubRace: value } });
    await Result.updateMany({ 'race._id': { $in: raceIds } }, { $set: { 'race.clubRace': value } });
    await service.updateSystemInfoAndInvalidateSystemInfoCache('resultUpdate');
}

// Takes races out of every series (but `keep`), then drops series left empty.
async function detachRaces(raceIds, keep) {
    const filter = { 'races.race': { $in: raceIds } };
    if (keep) filter._id = { $ne: keep };
    await RaceSeries.updateMany(filter, { $pull: { races: { race: { $in: raceIds } } } });
    await RaceSeries.deleteMany({ races: { $size: 0 } });
}

// Adds races to a series as confirmed links, moving them out of any other series.
async function attachRaces(series, raceIds, user) {
    await detachRaces(raceIds, series._id);
    const races = await Race.find({ _id: { $in: raceIds } }, 'racetype').lean();
    const already = new Set(series.races.map(l => String(l.race)));
    const now = new Date();
    for (const race of races) {
        if (already.has(String(race._id))) continue;
        series.races.push({
            race: race._id, status: 'confirmed', offDistance: isOffDistance(race, series),
            reason: 'added by an admin', suggestedAt: now, confirmedAt: now, confirmedBy: user.username
        });
    }
    series.rejected = (series.rejected || []).filter(id => !raceIds.some(r => r.equals(id)));
    await series.save();
}

// The fixed distance most of these races share (falling back to a variable one).
function typicalRacetype(races) {
    const fixed = races.filter(r => r.racetype && !isVariableDistance(r));
    const pool = fixed.length ? fixed : races.filter(r => r.racetype);
    const name = mostCommon(pool.map(r => r.racetype.name));
    const match = pool.find(r => r.racetype.name === name);
    return match ? match.racetype : undefined;
}

async function summaries() {
    const all = await RaceSeries.find().lean();
    const races = await Race.find(
        { _id: { $in: all.flatMap(s => s.races.map(l => l.race)) } }, 'racename racedate location clubRace').lean();
    const byId = new Map(races.map(r => [String(r._id), r]));
    return all.map(s => {
        const linked = s.races.map(l => byId.get(String(l.race))).filter(Boolean);
        const dates = linked.map(r => new Date(r.racedate).getTime());
        return {
            // Spellings used across editions, parkrun run numbers aside
            names: [...new Set(linked.map(r => r.racename.replace(/\s*#\s*\d+/g, '').trim()))],
            // Suggestions the matcher was less sure of (distance or state differs)
            flagged: s.races.filter(l => l.status === 'suggested' &&
                l.reason && l.reason !== 'same name' && l.reason !== 'same parkrun').length,
            _id: s._id,
            name: s.name,
            clubRace: allClubRaces(linked),
            clubRaces: linked.filter(r => r.clubRace).length,
            racetype: s.racetype ? { _id: s.racetype._id, name: s.racetype.name } : null,
            total: s.races.length,
            pending: s.races.filter(l => l.status === 'suggested').length,
            offDistance: s.races.filter(l => l.offDistance).length,
            firstDate: dates.length ? new Date(Math.min(...dates)) : null,
            lastDate: dates.length ? new Date(Math.max(...dates)) : null,
            location: mostCommon(linked.map(locationLabel).filter(Boolean)) || ''
        };
    }).sort((a, b) => a.name.localeCompare(b.name));
}

async function ungroupedRaces(filter) {
    const linked = await RaceSeries.distinct('races.race');
    return Race.find(Object.assign({ _id: { $nin: linked } }, filter || {}),
        'racename racedate racetype location clubRace').sort({ racedate: -1 }).lean();
}

function raceRow(race) {
    return {
        _id: race._id,
        racename: race.racename,
        racedate: race.racedate,
        racetype: race.racetype ? { name: race.racetype.name, isVariable: race.racetype.isVariable } : null,
        location: locationLabel(race),
        clubRace: !!race.clubRace
    };
}

// ---- Public ---------------------------------------------------------------
// Only confirmed links exist here, and a series needs two confirmed editions to
// be a series at all.

const MIN_PUBLIC_EDITIONS = 2;

function confirmedRaceIds(series) {
    return series.races.filter(l => l.status === 'confirmed').map(l => l.race);
}

function publicRace(race) {
    return {
        _id: race._id,
        racename: race.racename,
        racedate: race.racedate,
        distanceName: race.distanceName,
        isMultisport: race.isMultisport,
        racetype: race.racetype ? {
            name: race.racetype.name, surface: race.racetype.surface, isVariable: race.racetype.isVariable, miles: race.racetype.miles
        } : null,
        location: race.location ? { country: race.location.country, state: race.location.state } : null,
        clubRace: !!race.clubRace
    };
}

module.exports = function (app) {

    function route(handler) {
        return async function (req, res) {
            try {
                await handler(req, res);
            } catch (err) {
                console.error('Race series error:', err);
                res.status(500).json({ error: 'Something went wrong with the race series.' });
            }
        };
    }

    async function loadSeries(req, res) {
        if (!mongoose.isValidObjectId(req.params.id)) {
            res.status(404).json({ error: 'Series not found' });
            return null;
        }
        const series = await RaceSeries.findById(req.params.id);
        if (!series) res.status(404).json({ error: 'Series not found' });
        return series;
    }

    // The public list
    app.get('/api/series', route(async (req, res) => {
        const all = (await RaceSeries.find({ 'races.status': 'confirmed' }, 'name racetype races').lean())
            .filter(s => confirmedRaceIds(s).length >= MIN_PUBLIC_EDITIONS);
        const ids = all.flatMap(confirmedRaceIds);
        const races = await Race.find({ _id: { $in: ids } }, 'racedate location clubRace').lean();
        const counts = await Result.aggregate([
            { $match: { 'race._id': { $in: ids } } },
            { $group: { _id: '$race._id', n: { $sum: 1 } } }
        ]);
        const raceById = new Map(races.map(r => [String(r._id), r]));
        const resultCount = new Map(counts.map(c => [String(c._id), c.n]));
        res.json(all.map(s => {
            const linked = confirmedRaceIds(s).map(id => raceById.get(String(id))).filter(Boolean);
            const years = linked.map(r => new Date(r.racedate).getUTCFullYear());
            return {
                _id: s._id,
                name: s.name,
                clubRace: allClubRaces(linked),
                racetype: s.racetype ? s.racetype.name : '',
                editions: linked.length,
                firstYear: years.length ? Math.min(...years) : null,
                lastYear: years.length ? Math.max(...years) : null,
                location: mostCommon(linked.map(locationLabel).filter(Boolean)) || '',
                results: linked.reduce((n, r) => n + (resultCount.get(String(r._id)) || 0), 0)
            };
        }).sort((a, b) => a.name.localeCompare(b.name)));
    }));

    // Loyalty and course ratings across every series, for the Racing Stats tab
    // (before /api/series/:id, which would take "stats" for an id).
    // ?parkrun=exclude leaves parkrun series out of the lists; parkrun results
    // still count toward a member's usual age grade elsewhere.
    app.get('/api/series/stats', route(async (req, res) => {
        const noParkrun = req.query.parkrun === 'exclude';
        const all = (await RaceSeries.find({ 'races.status': 'confirmed' }, 'name racetype races').lean())
            .filter(s => confirmedRaceIds(s).length >= MIN_PUBLIC_EDITIONS)
            .filter(s => !noParkrun || !parkrunName(s.name));
        const races = await Race.find({ _id: { $in: all.flatMap(confirmedRaceIds) } }, 'racedate').lean();
        const yearOf = new Map(races.map(r => [String(r._id), new Date(r.racedate).getUTCFullYear()]));
        const seriesList = all.map(s => ({
            _id: s._id,
            name: s.name,
            racetype: s.racetype,
            editions: s.races
                .filter(l => l.status === 'confirmed' && yearOf.has(String(l.race)))
                .map(l => ({ raceId: l.race, year: yearOf.get(String(l.race)), offDistance: !!l.offDistance }))
        }));
        const results = await Result.find({},
            'race._id race.racetype.name race.racetype.surface members._id members.firstname members.lastname members.username members.sex agegrade time').lean();
        res.json(teamSeriesStats({ seriesList, results }));
    }));

    // Racing Stats tab: who runs the most MCRRC club races (Race.clubRace), all
    // time or in one ?year=. A relay counts for each of its runners.
    app.get('/api/series/club-participation', route(async (req, res) => {
        const match = { 'race.clubRace': true };
        const y = parseInt(req.query.year, 10);
        if (y > 1900) match['race.racedate'] = { $gte: new Date(Date.UTC(y, 0, 1)), $lt: new Date(Date.UTC(y + 1, 0, 1)) };
        const results = await Result.find(match, 'race._id members._id members.firstname members.lastname members.username').lean();
        const byMember = new Map();
        for (const r of results) {
            for (const m of r.members || []) {
                const id = String(m._id);
                if (!byMember.has(id)) {
                    byMember.set(id, { member: { _id: m._id, firstname: m.firstname, lastname: m.lastname, username: m.username }, races: new Set() });
                }
                byMember.get(id).races.add(String(r.race._id));
            }
        }
        const members = [...byMember.values()]
            .map(m => ({ member: m.member, races: m.races.size }))
            .sort((a, b) => b.races - a.races || (a.member.lastname || '').localeCompare(b.member.lastname || ''));
        res.json({
            clubRaces: new Set(results.map(r => String(r.race._id))).size,
            runners: members.length,
            members: members.slice(0, 10)
        });
    }));

    // The series a race belongs to, for a link on the race page (null if none)
    app.get('/api/series/by-race/:raceId', route(async (req, res) => {
        if (!mongoose.isValidObjectId(req.params.raceId)) return res.json(null);
        const series = await RaceSeries.findOne(
            { races: { $elemMatch: { race: req.params.raceId, status: 'confirmed' } } }, 'name races').lean();
        const ids = series ? confirmedRaceIds(series) : [];
        if (ids.length < MIN_PUBLIC_EDITIONS) return res.json(null);
        // In date order (same-day editions by their order), for the editions
        // either side of this one
        const races = (await Race.find({ _id: { $in: ids } }, 'racename racedate order clubRace').lean())
            .sort((a, b) => new Date(a.racedate) - new Date(b.racedate) || (a.order || 0) - (b.order || 0));
        const at = races.findIndex(r => String(r._id) === req.params.raceId);
        const edition = r => r ? { _id: r._id, racename: r.racename, racedate: r.racedate } : null;
        res.json({
            _id: series._id, name: series.name, clubRace: allClubRaces(races), editions: ids.length,
            previous: edition(races[at - 1]), next: edition(races[at + 1])
        });
    }));

    app.get('/api/series/:id', route(async (req, res) => {
        const series = mongoose.isValidObjectId(req.params.id) && await RaceSeries.findById(req.params.id).lean();
        const ids = series ? confirmedRaceIds(series) : [];
        if (ids.length < MIN_PUBLIC_EDITIONS) return res.status(404).json({ error: 'Series not found' });

        const races = await Race.find({ _id: { $in: ids } },
            'racename racedate racetype location distanceName isMultisport clubRace').lean();
        const offDistance = new Set(series.races.filter(l => l.offDistance).map(l => String(l.race)));
        const editions = races.map(r => ({ race: publicRace(r), offDistance: offDistance.has(String(r._id)) }));
        const results = await Result.find({ 'race._id': { $in: ids } }, 'race._id members time agegrade ranking').lean();

        // Each member's usual age grade, from their solo results elsewhere
        const memberIds = [...new Set(results.flatMap(r => (r.members || []).map(m => String(m._id))))]
            .map(id => new mongoose.Types.ObjectId(id));
        // per distance and surface; the surface-only averages are summed from those
        const usual = await Result.aggregate([
            { $match: { 'race._id': { $nin: ids }, 'members._id': { $in: memberIds }, members: { $size: 1 }, agegrade: { $gt: 0 } } },
            { $group: {
                _id: { member: { $arrayElemAt: ['$members._id', 0] }, name: '$race.racetype.name', surface: '$race.racetype.surface' },
                sum: { $sum: '$agegrade' }, n: { $sum: 1 }
            } }
        ]);
        const byDistance = new Map();
        const surfaceSums = new Map();
        for (const u of usual) {
            const racetype = { name: u._id.name, surface: u._id.surface };
            byDistance.set(distanceKey(u._id.member, racetype), { avg: u.sum / u.n, n: u.n });
            const key = surfaceKey(u._id.member, racetype);
            const total = surfaceSums.get(key) || { sum: 0, n: 0 };
            surfaceSums.set(key, { sum: total.sum + u.sum, n: total.n + u.n });
        }
        const bySurface = new Map([...surfaceSums].map(([key, t]) => [key, { avg: t.sum / t.n, n: t.n }]));

        res.json({
            _id: series._id,
            name: series.name,
            clubRace: allClubRaces(races),
            racetype: series.racetype ? { name: series.racetype.name, surface: series.racetype.surface } : null,
            location: mostCommon(races.map(locationLabel).filter(Boolean)) || '',
            stats: seriesStats({ editions, results, usualAgeGrades: { byDistance, bySurface } })
        });
    }));

    app.get('/api/race-series', service.isAdminLoggedIn, route(async (req, res) => {
        res.json(await summaries());
    }));

    app.get('/api/race-series/pending-count', service.isAdminLoggedIn, route(async (req, res) => {
        res.json({ series: await RaceSeries.countDocuments({ 'races.status': 'suggested' }) });
    }));

    app.get('/api/race-series/ungrouped', service.isAdminLoggedIn, route(async (req, res) => {
        const q = String(req.query.q || '').trim();
        const filter = q ? { racename: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } : {};
        const races = await ungroupedRaces(filter);
        res.json({ total: races.length, races: races.slice(0, 200).map(raceRow) });
    }));

    app.get('/api/race-series/possible-merges', service.isAdminLoggedIn, route(async (req, res) => {
        const all = await RaceSeries.find({}, 'name racetype rejected distinctFrom races.race').lean();
        const loose = await ungroupedRaces();
        const items = all.map(s => ({
            id: String(s._id), isSeries: true, key: seriesKey({ racename: s.name }),
            racetypeName: s.racetype && s.racetype.name, label: s.name, count: s.races.length,
            rejected: new Set((s.rejected || []).map(String)),
            distinctFrom: new Set((s.distinctFrom || []).map(String))
        })).concat(loose.map(r => ({
            id: String(r._id), isSeries: false, key: seriesKey(r),
            racetypeName: r.racetype && r.racetype.name, label: r.racename, race: raceRow(r)
        })));

        const dismissed = (a, b) => {
            if (a.isSeries && b.isSeries) return a.distinctFrom.has(b.id) || b.distinctFrom.has(a.id);
            const [s, r] = a.isSeries ? [a, b] : [b, a];
            return s.rejected.has(r.id);
        };
        const pairs = findPossibleMerges(items, dismissed).map(p => {
            // Series first, so the page always reads "series <- other"
            const [first, second] = p.a.isSeries ? [p.a, p.b] : [p.b, p.a];
            const side = i => i.isSeries ?
                { type: 'series', _id: i.id, name: i.label, count: i.count } :
                { type: 'race', _id: i.id, race: i.race };
            return { first: side(first), second: side(second), distance: first.racetypeName, why: p.why };
        });
        res.json(pairs);
    }));

    // For the series picker on the add-result forms: what the race being typed
    // could belong to. `race` is the form's race (name, distance, location and
    // the rest of what identifies a race).
    app.post('/api/race-series/candidates', service.isAdminLoggedIn, route(async (req, res) => {
        const race = req.body.race || {};
        if (!race.racename || !race.racetype || !race.racetype.name) return res.json({ candidates: [] });

        // The race itself when it already exists: by id from the race edit dialog,
        // otherwise the race these results will be saved against, found on the
        // same fields the add-result endpoints match on (app/routes.js).
        let existing = null;
        const byId = !!race._id && mongoose.isValidObjectId(race._id);
        if (byId || (race.racetype._id && race.location)) {
            const found = byId ? await Race.findById(race._id, '_id').lean() : await Race.findOne({
                'racename': race.racename,
                'isMultisport': race.isMultisport,
                'distanceName': race.distanceName,
                'racedate': race.racedate,
                'location.country': race.location.country,
                'location.state': race.location.state,
                'racetype._id': race.racetype._id,
                'order': race.order
            }, '_id').lean();
            if (found) {
                const series = await RaceSeries.findOne({ 'races.race': found._id }, 'name races').lean();
                const link = series && series.races.find(l => l.race.equals(found._id));
                existing = {
                    raceId: found._id,
                    series: series ? { _id: series._id, name: series.name, status: link.status } : null
                };
            }
        }

        const all = await raceSeriesSync.describeAllSeries();
        const probe = {
            _id: existing ? existing.raceId : new mongoose.Types.ObjectId(),
            racename: race.racename,
            racedate: race.racedate,
            racetype: race.racetype,
            location: race.location
        };
        const counts = new Map(all.allSeries.map(s => [String(s._id), s.races.length]));
        const row = (series, match, extra) => Object.assign({
            _id: series._id, name: series.name,
            racetype: series.racetype ? series.racetype.name : '', total: counts.get(String(series._id)) || 0,
            match: match
        }, extra);

        const exact = rankSeriesForRace(probe, all.described)
            .map(m => row(m.series, 'exact', { reason: m.reason, offDistance: m.offDistance }));
        // The series the existing race is already suggested for is always on offer
        if (existing && existing.series && !exact.some(c => String(c._id) === String(existing.series._id))) {
            const current = all.described.find(d => String(d.series._id) === String(existing.series._id));
            if (current) exact.unshift(row(current.series, 'exact', { reason: 'current suggestion', offDistance: false }));
        }
        const offered = new Set(exact.map(c => String(c._id)));

        // Looser name matches (a sponsor added, a typo): offered, never preselected
        const key = seriesKey(probe);
        const similar = all.described
            .filter(d => !offered.has(String(d.series._id)) && !d.rejected.has(String(probe._id)))
            .filter(d => d.racetypeName === race.racetype.name || isVariableDistance(probe))
            .map(d => ({ d, why: similarNames(key, seriesKey({ racename: d.series.name })) }))
            .filter(x => x.why)
            .slice(0, 5)
            .map(x => row(x.d.series, 'similar', { reason: x.why, offDistance: x.d.racetypeName !== race.racetype.name }));

        // No series yet, but earlier editions sit ungrouped
        let newSeries = null;
        if (!existing || !existing.series) {
            const proposal = await raceSeriesSync.ungroupedEditions(probe, all);
            if (proposal) {
                newSeries = {
                    name: proposal.name,
                    races: proposal.entries.filter(e => String(e.race._id) !== String(probe._id)).map(e => raceRow(e.race))
                };
            }
        }

        res.json({ existing, candidates: exact.concat(similar), newSeries });
    }));

    app.get('/api/race-series/:id', service.isAdminLoggedIn, route(async (req, res) => {
        const series = await loadSeries(req, res);
        if (!series) return;
        const ids = series.races.map(l => l.race);
        const races = await Race.find({ _id: { $in: ids } }, 'racename racedate racetype location clubRace').lean();
        const counts = await Result.aggregate([
            { $match: { 'race._id': { $in: ids } } },
            { $group: { _id: '$race._id', n: { $sum: 1 } } }
        ]);
        const byId = new Map(races.map(r => [String(r._id), r]));
        const resultCount = new Map(counts.map(c => [String(c._id), c.n]));
        const out = series.toObject();
        out.races = series.races
            .filter(l => byId.has(String(l.race)))
            .map(l => Object.assign(l.toObject(), {
                race: raceRow(byId.get(String(l.race))),
                results: resultCount.get(String(l.race)) || 0
            }))
            .sort((a, b) => new Date(b.race.racedate) - new Date(a.race.racedate));
        res.json(out);
    }));

    // A new series from races picked by hand (from the ungrouped list, or split
    // off another series).
    app.post('/api/race-series', service.isAdminLoggedIn, route(async (req, res) => {
        const raceIds = objectIds(req.body.raceIds);
        const name = String(req.body.name || '').trim();
        if (!raceIds) return badRequest(res, 'Pick at least one race.');
        if (!name) return badRequest(res, 'Give the series a name.');
        const races = await Race.find({ _id: { $in: raceIds } }, 'racename racetype').lean();
        if (races.length !== raceIds.length) return badRequest(res, 'Some of those races no longer exist.');

        const series = new RaceSeries({
            name,
            racetype: typicalRacetype(races),
            races: []
        });
        await attachRaces(series, raceIds, req.user);
        res.json({ _id: series._id });
    }));

    // Confirms every suggestion in several series at once
    app.post('/api/race-series/confirm', service.isAdminLoggedIn, route(async (req, res) => {
        const seriesIds = objectIds(req.body.seriesIds);
        if (!seriesIds) return badRequest(res, 'Pick at least one series.');
        const now = new Date();
        const result = await RaceSeries.updateMany({ _id: { $in: seriesIds } }, {
            $set: {
                'races.$[l].status': 'confirmed',
                'races.$[l].confirmedAt': now,
                'races.$[l].confirmedBy': req.user.username,
                updatedAt: now
            }
        }, { arrayFilters: [{ 'l.status': 'suggested' }] });
        res.json({ ok: true, series: result.modifiedCount });
    }));

    app.put('/api/race-series/:id', service.isAdminLoggedIn, route(async (req, res) => {
        const series = await loadSeries(req, res);
        if (!series) return;
        if (req.body.name !== undefined) {
            const name = String(req.body.name).trim();
            if (!name) return badRequest(res, 'The name cannot be empty.');
            series.name = name;
        }
        if (req.body.racetypeId !== undefined) {
            const racetype = mongoose.isValidObjectId(req.body.racetypeId) && await RaceType.findById(req.body.racetypeId);
            if (!racetype) return badRequest(res, 'Unknown distance.');
            series.racetype = racetype.toObject();
            // Off-distance is relative to the series' distance, so it follows it
            const races = await Race.find({ _id: { $in: series.races.map(l => l.race) } }, 'racetype').lean();
            const byId = new Map(races.map(r => [String(r._id), r]));
            series.races.forEach(l => {
                const race = byId.get(String(l.race));
                if (race) l.offDistance = isOffDistance(race, series);
            });
        }
        await series.save();
        res.json({ ok: true });
    }));

    app.delete('/api/race-series/:id', service.isAdminLoggedIn, route(async (req, res) => {
        const series = await loadSeries(req, res);
        if (!series) return;
        await series.deleteOne();
        res.json({ ok: true });
    }));

    app.post('/api/race-series/:id/confirm', service.isAdminLoggedIn, route(async (req, res) => {
        const series = await loadSeries(req, res);
        if (!series) return;
        // `all: true` confirms every suggestion in the series
        const raceIds = req.body.all ? null : objectIds(req.body.raceIds);
        if (!req.body.all && !raceIds) return badRequest(res, 'Pick at least one race.');
        const now = new Date();
        series.races.forEach(l => {
            if (l.status === 'suggested' && (!raceIds || raceIds.some(id => id.equals(l.race)))) {
                l.status = 'confirmed';
                l.confirmedAt = now;
                l.confirmedBy = req.user.username;
            }
        });
        await series.save();
        res.json({ ok: true });
    }));

    // Not this race: out of the series, and never suggested for it again.
    app.post('/api/race-series/:id/reject', service.isAdminLoggedIn, route(async (req, res) => {
        const series = await loadSeries(req, res);
        if (!series) return;
        const raceIds = objectIds(req.body.raceIds);
        if (!raceIds) return badRequest(res, 'Pick at least one race.');
        series.races = series.races.filter(l => !raceIds.some(id => id.equals(l.race)));
        raceIds.forEach(id => {
            if (!series.rejected.some(r => r.equals(id))) series.rejected.push(id);
        });
        if (series.races.length) await series.save();
        else await series.deleteOne();
        res.json({ ok: true, deleted: !series.races.length });
    }));

    app.post('/api/race-series/:id/add', service.isAdminLoggedIn, route(async (req, res) => {
        const series = await loadSeries(req, res);
        if (!series) return;
        const raceIds = objectIds(req.body.raceIds);
        if (!raceIds) return badRequest(res, 'Pick at least one race.');
        await attachRaces(series, raceIds, req.user);
        res.json({ ok: true });
    }));

    // Races that belong to another series (existing, or a new one when `name` is
    // given instead of `targetId`). They are rejected here so they are not
    // suggested back.
    app.post('/api/race-series/:id/move', service.isAdminLoggedIn, route(async (req, res) => {
        const series = await loadSeries(req, res);
        if (!series) return;
        const raceIds = objectIds(req.body.raceIds);
        if (!raceIds) return badRequest(res, 'Pick at least one race.');

        let target;
        if (req.body.targetId) {
            if (!mongoose.isValidObjectId(req.body.targetId) || series._id.equals(req.body.targetId)) {
                return badRequest(res, 'Pick another series.');
            }
            target = await RaceSeries.findById(req.body.targetId);
            if (!target) return badRequest(res, 'That series no longer exists.');
        } else {
            const name = String(req.body.name || '').trim();
            if (!name) return badRequest(res, 'Give the new series a name.');
            const races = await Race.find({ _id: { $in: raceIds } }, 'racetype').lean();
            target = new RaceSeries({ name, racetype: typicalRacetype(races), races: [] });
        }

        await RaceSeries.updateOne({ _id: series._id }, { $addToSet: { rejected: { $each: raceIds } } });
        await attachRaces(target, raceIds, req.user);
        res.json({ ok: true, targetId: target._id, deleted: !(await RaceSeries.exists({ _id: series._id })) });
    }));

    // Folds another series into this one, keeping each link's status.
    app.post('/api/race-series/:id/merge', service.isAdminLoggedIn, route(async (req, res) => {
        const series = await loadSeries(req, res);
        if (!series) return;
        if (!mongoose.isValidObjectId(req.body.sourceId) || series._id.equals(req.body.sourceId)) {
            return badRequest(res, 'Pick another series.');
        }
        const source = await RaceSeries.findById(req.body.sourceId);
        if (!source) return badRequest(res, 'That series no longer exists.');

        const races = await Race.find({ _id: { $in: source.races.map(l => l.race) } }, 'racetype').lean();
        const byId = new Map(races.map(r => [String(r._id), r]));
        source.races.forEach(l => {
            const link = l.toObject();
            const race = byId.get(String(link.race));
            if (race) link.offDistance = isOffDistance(race, series);
            series.races.push(link);
        });
        const linked = new Set(series.races.map(l => String(l.race)));
        series.rejected = series.rejected.filter(id => !linked.has(String(id)));
        const rejected = new Set(series.rejected.map(String));
        source.rejected.forEach(id => {
            if (!linked.has(String(id)) && !rejected.has(String(id))) series.rejected.push(id);
        });
        series.distinctFrom = series.distinctFrom.filter(id => !id.equals(source._id));
        await source.deleteOne();
        await series.save();
        res.json({ ok: true });
    }));

    // Two series with similar names that are different races.
    app.post('/api/race-series/:id/distinct', service.isAdminLoggedIn, route(async (req, res) => {
        const series = await loadSeries(req, res);
        if (!series) return;
        if (!mongoose.isValidObjectId(req.body.otherId)) return badRequest(res, 'Pick another series.');
        await RaceSeries.updateOne({ _id: series._id }, { $addToSet: { distinctFrom: req.body.otherId } });
        res.json({ ok: true });
    }));

    // Marks races of this series as MCRRC club races (or not): the given ones, or
    // every race in it when `raceIds` is left out
    app.post('/api/race-series/:id/club-race', service.isAdminLoggedIn, route(async (req, res) => {
        const series = await loadSeries(req, res);
        if (!series) return;
        if (typeof req.body.clubRace !== 'boolean') return badRequest(res, 'Say whether they are club races.');
        const inSeries = series.races.map(l => l.race);
        let raceIds = inSeries;
        if (req.body.raceIds !== undefined) {
            raceIds = objectIds(req.body.raceIds);
            if (!raceIds || !raceIds.every(id => inSeries.some(r => r.equals(id)))) {
                return badRequest(res, 'Pick races from this series.');
            }
        }
        await setClubRace(raceIds, req.body.clubRace);
        res.json({ ok: true });
    }));

    app.put('/api/race-series/:id/races/:raceId', service.isAdminLoggedIn, route(async (req, res) => {
        const series = await loadSeries(req, res);
        if (!series) return;
        const link = series.races.find(l => String(l.race) === req.params.raceId);
        if (!link) return res.status(404).json({ error: 'That race is not in this series.' });
        if (req.body.offDistance !== undefined) link.offDistance = !!req.body.offDistance;
        await series.save();
        res.json({ ok: true });
    }));
};
