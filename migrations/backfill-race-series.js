/**
 * Groups existing races into series (the same race across editions). Every link it
 * makes is a *suggestion*: an admin confirms or rejects it on the series admin page.
 *
 *   node migrations/backfill-race-series.js             dry run: print what it would do
 *   node migrations/backfill-race-series.js --write     save the suggestions
 *   node migrations/backfill-race-series.js --reset     dry run as if series with no
 *                                                       confirmed link did not exist
 *   node migrations/backfill-race-series.js --reset --write
 *                                                       delete those, then save afresh
 *   --all   print every proposed series, not just the largest and the unusual ones
 *
 * Safe to re-run: races already in a series are left alone, and a race matching an
 * existing series is suggested for it instead of starting a new one.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Race = require('../app/models/race');
const RaceSeries = require('../app/models/raceseries');
const { proposeSeries, describeSeries, findSeriesForRace } = require('../app/raceSeriesMatcher');

const args = new Set(process.argv.slice(2));
const WRITE = args.has('--write');
const RESET = args.has('--reset');
const ALL = args.has('--all');

function day(d) {
    return new Date(d).toISOString().slice(0, 10);
}

function dateRange(races) {
    const dates = races.map(r => new Date(r.racedate).getTime()).sort((a, b) => a - b);
    return day(dates[0]) + ' .. ' + day(dates[dates.length - 1]);
}

function printProposal(p) {
    const races = p.entries.map(e => e.race);
    console.log('  ' + p.name + '  [' + (p.racetype && p.racetype.name) +
        (p.location ? ', ' + p.location : '') + ']  ' + races.length + ' races, ' + dateRange(races));
    const distinctNames = [...new Set(races.map(r => r.racename))];
    if (!p.isParkrun && distinctNames.length > 1) {
        console.log('      names: ' + distinctNames.join(' | '));
    }
    for (const e of p.entries.filter(x => x.reason !== 'same name' && x.reason !== 'same parkrun')) {
        console.log('      ' + day(e.race.racedate) + ' ' + e.race.racename + ' -> ' + e.reason);
    }
}

async function main() {
    const url = process.env.MONGODB_URI || process.env.MONGO_DEV_URL;
    await mongoose.connect(url);
    console.log('Database: ' + url.replace(/\/\/[^@]*@/, '//***@'));
    console.log(WRITE ? 'WRITE mode\n' : 'Dry run (use --write to save)\n');

    const races = await Race.find({}, 'racename racedate racetype location').lean();
    let allSeries = await RaceSeries.find().lean();

    const unconfirmed = allSeries.filter(s => !s.races.some(l => l.status === 'confirmed'));
    if (RESET) {
        console.log('Reset: ' + unconfirmed.length + ' series with no confirmed link ' +
            (WRITE ? 'deleted' : 'would be deleted') + '.\n');
        if (WRITE) await RaceSeries.deleteMany({ _id: { $in: unconfirmed.map(s => s._id) } });
        const gone = new Set(unconfirmed.map(s => String(s._id)));
        allSeries = allSeries.filter(s => !gone.has(String(s._id)));
    }

    const raceById = new Map(races.map(r => [String(r._id), r]));
    const linked = new Set(allSeries.flatMap(s => s.races.map(l => String(l.race))));
    const described = allSeries.map(s =>
        describeSeries(s, s.races.map(l => raceById.get(String(l.race))).filter(Boolean)));

    // Pass 1: races that belong to a series that already exists.
    const additions = [];
    const remaining = [];
    for (const race of races) {
        if (linked.has(String(race._id))) continue;
        const match = findSeriesForRace(race, described);
        if (match) additions.push({ race, ...match });
        else remaining.push(race);
    }

    // Pass 2: new series from what is left. A race an admin rejected from a series
    // has been looked at, so it is not grouped again behind their back.
    const rejected = new Set(allSeries.flatMap(s => (s.rejected || []).map(String)));
    const proposals = proposeSeries(remaining.filter(r => !rejected.has(String(r._id))));

    const grouped = proposals.reduce((n, p) => n + p.entries.length, 0);
    const offDistance = proposals.flatMap(p => p.entries).filter(e => e.offDistance);
    const otherState = proposals.flatMap(p => p.entries).filter(e => /different state/.test(e.reason));

    console.log('Races: ' + races.length + ' (' + linked.size + ' already in a series)');
    console.log('Suggested for existing series: ' + additions.length);
    console.log('New series: ' + proposals.length +
        ', holding ' + grouped + ' races');
    console.log('Off-distance editions: ' + offDistance.length);
    console.log('Editions in a different state from the rest: ' + otherState.length);
    console.log('Races left on their own: ' + (remaining.length - grouped) + '\n');

    if (additions.length) {
        console.log('== Suggested for existing series');
        for (const a of additions) {
            console.log('  ' + day(a.race.racedate) + ' ' + a.race.racename + ' -> ' + a.series.name + ' (' + a.reason + ')');
        }
        console.log();
    }

    if (ALL) {
        console.log('== All new series');
        proposals.forEach(printProposal);
    } else {
        console.log('== Largest new series');
        proposals.slice(0, 15).forEach(printProposal);
        const unusual = proposals.slice(15).filter(p =>
            new Set(p.entries.map(e => e.race.racename)).size > 1 && !p.isParkrun ||
            p.entries.some(e => e.offDistance || /state/.test(e.reason)));
        console.log('\n== Other series with differing names, distances or states (' + unusual.length + ')');
        unusual.forEach(printProposal);
    }

    if (WRITE) {
        const now = new Date();
        for (const a of additions) {
            await RaceSeries.updateOne({ _id: a.series._id }, {
                $push: { races: { race: a.race._id, status: 'suggested', offDistance: a.offDistance, reason: a.reason, suggestedAt: now } },
                $set: { updatedAt: now }
            });
        }
        for (const p of proposals) {
            await new RaceSeries({
                name: p.name,
                racetype: p.racetype,
                races: p.entries.map(e => ({
                    race: e.race._id, status: 'suggested', offDistance: e.offDistance, reason: e.reason, suggestedAt: now
                }))
            }).save();
        }
        console.log('\nSaved ' + proposals.length + ' new series and ' + additions.length + ' suggestions for existing ones.');
    }
    if (WRITE) {
        // Browsers refresh their cached series index on this. The model would
        // record it too, but not before this script exits.
        await require('../app/service').updateSystemInfoAndInvalidateSystemInfoCache('seriesUpdate');
    }

    await mongoose.disconnect();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
