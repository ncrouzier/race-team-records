// The sanity checks on a result before it is saved (app/resultChecks.js): this
// gathers what they compare against (the runners, their bests, the race's
// other results and editions...) and serves them to the admin's result form.
// The Result Submissions page runs them on each pending submission too.

const mongoose = require('mongoose');
const service = require('./service');
const Member = require('./models/member');
const Race = require('./models/race');
const Result = require('./models/result');
const RaceSeries = require('./models/raceseries');
const { raceMatchFilter } = require('./raceMatch');
const { checkResult } = require('./resultChecks');

function escapeRegex(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sameDay(date) {
    const start = new Date(date);
    start.setUTCHours(0, 0, 0, 0);
    return { $gte: start, $lt: new Date(start.getTime() + 86400000) };
}

function idOf(x) {
    return x && x._id !== undefined ? String(x._id) : String(x);
}

// Ids that are valid ObjectIds, as ObjectIds
function objectIds(list) {
    return list.filter(x => mongoose.isValidObjectId(x)).map(x => new mongoose.Types.ObjectId(String(x)));
}

// The age grade this time gives one runner, or null when the site has no
// standard for it (no gender or date of birth, a distance without tables)
async function ageGradeFor(member, race, time) {
    if (!member.sex || !member.dateofbirth || !race.racetype || !race.racetype.name || !race.racetype.surface || !time) return null;
    try {
        const ag = await service.getAgeGrading(member.sex.toLowerCase(),
            service.calculateAge(race.racedate, member.dateofbirth), race.racetype.surface, race.racedate);
        const standard = ag && ag[race.racetype.name.toLowerCase()];
        return standard ? Number(((standard / (time / 100)) * 100).toFixed(2)) : null;
    } catch (err) {
        return null;
    }
}

// The race's other editions. seriesChoice is what the admin picked in the
// form's series picker (app/raceSeriesSync.js): none (no editions to compare
// with), a series (its races), a new series (the earlier editions it groups).
// Picked nothing: the races in its series (found through any race of the same
// name), or the races of the same name when it has none.
async function editionsFor(race, seriesChoice) {
    const fields = 'racename racedate location racetype distanceName';
    const choice = seriesChoice || {};
    let editions;
    if (choice.none) {
        editions = [];
    } else if (choice.seriesId && mongoose.isValidObjectId(choice.seriesId)) {
        const picked = await RaceSeries.findById(choice.seriesId, 'races').lean();
        editions = picked ? await Race.find({ _id: { $in: picked.races.filter(l => !l.offDistance).map(l => l.race) } }, fields).lean() : [];
    } else if (choice.newSeries) {
        editions = await Race.find({ _id: { $in: objectIds(choice.newSeries.raceIds || []) } }, fields).lean();
    } else {
        const named = await Race.find({ racename: new RegExp('^' + escapeRegex(race.racename) + '$', 'i') }, fields).lean();
        const ids = named.map(r => r._id);
        const series = ids.length ? await RaceSeries.findOne({ 'races.race': { $in: ids } }, 'races').lean() : null;
        editions = series
            ? await Race.find({ _id: { $in: series.races.filter(l => !l.offDistance).map(l => l.race) } }, fields).lean()
            : named;
    }
    // Not this race itself (same day)
    const day = new Date(race.racedate).toISOString().slice(0, 10);
    return editions.filter(e => new Date(e.racedate).toISOString().slice(0, 10) !== day);
}

/**
 * Runs the checks on a result as the form would save it.
 * result: { race, members: [{ _id }], time, ranking, legs }
 * options: { resultId (when editing), isNew, seriesChoice (the form's series pick) }
 */
async function checksFor(result, options) {
    options = options || {};
    const race = result.race || {};
    if (!race.racename || !race.racedate) return [];
    const resultId = mongoose.isValidObjectId(options.resultId) ? new mongoose.Types.ObjectId(String(options.resultId)) : null;
    const memberIds = objectIds((result.members || []).map(idOf));
    const members = memberIds.length
        ? await Member.find({ _id: { $in: memberIds } }, 'firstname lastname sex dateofbirth membershipDates').lean()
        : [];
    const time = Number(result.time) || 0;
    const notThis = resultId ? { _id: { $ne: resultId } } : {};

    // The race it would be saved to, if it exists
    const location = race.location || {};
    const matched = race.racetype && race.racetype._id && location.country
        ? await Race.findOne(raceMatchFilter(race), '_id').lean()
        : null;

    const [ageGrades, bests, raceResults, sameDayResults, sameNameRaces, editions] = await Promise.all([
        // The time's age grade, per runner
        Promise.all(members.map(m => ageGradeFor(m, race, time))).then(list => {
            const byId = {};
            members.forEach((m, i) => { byId[String(m._id)] = list[i]; });
            return byId;
        }),
        // Their best at this race type, alone
        race.racetype && race.racetype._id && mongoose.isValidObjectId(race.racetype._id)
            ? Promise.all(members.map(m => Result.findOne(Object.assign({
                'members._id': m._id, 'members.1': { $exists: false },
                'race.racetype._id': new mongoose.Types.ObjectId(String(race.racetype._id)),
                time: { $gt: 0 }
            }, notThis), 'time race.racename race.racedate').sort({ time: 1 }).lean())).then(list => {
                const byId = {};
                members.forEach((m, i) => {
                    if (list[i]) byId[String(m._id)] = { time: list[i].time, racename: list[i].race.racename, racedate: list[i].race.racedate };
                });
                return byId;
            })
            : {},
        // The race's other results
        matched ? Result.find(Object.assign({ 'race._id': matched._id }, notThis), 'members ranking').lean() : [],
        // These runners' other results that day
        memberIds.length
            ? Result.find(Object.assign({ 'members._id': { $in: memberIds }, 'race.racedate': sameDay(race.racedate) }, notThis), 'members race.racename').lean()
            : [],
        // A race of this name and date the result would not be saved to
        matched ? [] : Race.find({
            racename: new RegExp('^' + escapeRegex(race.racename) + '$', 'i'),
            racedate: sameDay(race.racedate)
        }, 'racename racedate location racetype distanceName isMultisport order').lean(),
        editionsFor(race, options.seriesChoice)
    ]);

    const otherSameDay = [];
    sameDayResults.forEach(r => {
        r.members.forEach(m => {
            if (memberIds.some(id => id.equals(m._id))) otherSameDay.push({ memberId: String(m._id), racename: r.race.racename });
        });
    });

    return checkResult(result, {
        now: new Date(),
        isNew: !!options.isNew,
        members,
        ageGrades,
        bests,
        raceResults,
        sameDay: otherSameDay,
        sameNameRaces,
        editions
    });
}

module.exports = function (app) {
    // Admins: the checks on the result the form would save
    app.post('/api/results/checks', service.isAdminLoggedIn, async function (req, res) {
        try {
            const body = req.body || {};
            const warnings = await checksFor(body.result || {}, { resultId: body.resultId, isNew: !body.resultId, seriesChoice: body.seriesChoice });
            res.json({ warnings });
        } catch (err) {
            console.error('Result checks error:', err);
            res.status(500).json({ error: 'Could not check the result' });
        }
    });
};

module.exports.checksFor = checksFor;
