// Year in review (app/yearInReview.js): a member's year and the team's, as
// data for the page (public/views/yearInReview.html) and as a share image
// (app/yearInReviewImage.js). Public, like the member and stats pages.
//
//   GET /api/year-in-review/team/:year            the team's year
//   GET /api/year-in-review/team/:year/image.png
//   GET /api/year-in-review/members/:username/:year
//   GET /api/year-in-review/members/:username/:year/image.png?race=&place=&food=&stat=&bg=

const Member = require('./models/member');
const Result = require('./models/result');
const VolunteerJob = require('./models/volunteerjob');
const { FIRST_YEAR, FOODS, foodBurned, teamRanks, validYear, memberYear, teamYear, withChoices } = require('./yearInReview');
const image = require('./yearInReviewImage');

const RESULT_FIELDS = 'time ranking members agegrade legs miles achievements race._id race.racename race.racedate race.order ' +
    'race.racetype race.distanceName race.location race.isMultisport';
const CACHE_MS = 5 * 60 * 1000;

// A few minutes of each answer (and image): results change rarely, and a
// shared link brings many views at once
const cache = new Map();
function cached(key, make) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
    const value = make();
    cache.set(key, { at: Date.now(), value });
    value.catch(() => cache.delete(key));
    if (cache.size > 500) cache.delete(cache.keys().next().value);
    return value;
}

function yearRange(year) {
    return { $gte: new Date(Date.UTC(year, 0, 1)), $lt: new Date(Date.UTC(year + 1, 0, 1)) };
}

function findMember(username, withPhoto) {
    const fields = 'firstname lastname username sex achievements' + (withPhoto ? ' pictureLink +profileThumb' : '');
    return Member.findOne({ username: String(username) }).select(fields).lean();
}

async function memberData(username, year) {
    const member = await findMember(username, false);
    if (!member) return null;
    const range = yearRange(year);
    const [results, earlier, jobs, years, ranks, hasPhoto] = await Promise.all([
        Result.find({ 'members._id': member._id, 'race.racedate': range }).select(RESULT_FIELDS).lean(),
        Result.find({ 'members._id': member._id, 'race.racedate': { $lt: range.$gte } })
            .select('time agegrade legs miles members._id race.racedate race.racetype race.distanceName race.location').lean(),
        VolunteerJob.find({ 'member._id': member._id, jobDate: range }).select('_id').lean(),
        Result.distinct('race.racedate', { 'members._id': member._id }),
        getTeamRanks(year),
        Member.exists({ _id: member._id, pictureLink: { $nin: [null, ''] } })
    ]);
    const raceIds = [...new Set(results.map(r => r.race && r.race._id).filter(Boolean).map(String))];
    const raceResults = raceIds.length
        ? await Result.find({ 'race._id': { $in: raceIds } }).select('members race._id').lean()
        : [];
    const lastStart = new Date(Date.UTC(year - 1, 0, 1));
    const data = memberYear({
        member,
        year,
        results,
        earlier,
        lastYear: earlier.filter(r => new Date(r.race.racedate) >= lastStart),
        raceResults,
        volunteerJobs: jobs,
        teamRanks: ranks
    });
    // Whether their bio photo can be the image's background
    data.member.hasPhoto = !!hasPhoto;
    // The foods the page offers for "Fuel burned"
    // (each with what the year's miles burned, so the page needs no sums)
    data.foods = FOODS.map(f => Object.assign({ key: f.key, label: f.many.charAt(0).toUpperCase() + f.many.slice(1) }, foodBurned(data.totals.miles, f.key)));
    // The years they raced, for the page's year picker
    data.years = [...new Set(years.map(d => new Date(d).getUTCFullYear()))].filter(y => y >= FIRST_YEAR).sort((a, b) => b - a);
    return data;
}

async function teamData(year) {
    const range = yearRange(year);
    const [results, earlier, jobs, members] = await Promise.all([
        Result.find({ 'race.racedate': range }).select(RESULT_FIELDS).lean(),
        Result.find({ 'race.racedate': { $lt: range.$gte } }).select('members._id race.racedate race.location legs miles race.racetype').lean(),
        VolunteerJob.find({ jobDate: range }).select('member._id').lean(),
        Member.find({ 'membershipDates.start': range }).select('firstname lastname username membershipDates').lean()
    ]);
    const lastStart = new Date(Date.UTC(year - 1, 0, 1));
    const data = teamYear({
        year,
        results,
        earlier,
        lastYear: earlier.filter(r => new Date(r.race.racedate) >= lastStart),
        volunteerJobs: jobs,
        members
    });
    const current = new Date().getUTCFullYear();
    data.years = [];
    for (let y = current; y >= FIRST_YEAR; y--) data.years.push(y);
    return data;
}

function getMemberYear(username, year) {
    return cached('m:' + username + ':' + year, () => memberData(username, year));
}

// Everyone's places on the team that year (races, miles, age grade), for
// the "Team rank" stat
function getTeamRanks(year) {
    return cached('tr:' + year, async () => teamRanks(await Result.find({ 'race.racedate': yearRange(year) })
        .select('members._id agegrade legs miles race.racetype').lean()));
}

// The thumbnails of everyone who raced that year, for the team image's
// background, in a fixed shuffled order (the same image each time)
async function teamFaces(year) {
    const ids = await Result.distinct('members._id', { 'race.racedate': yearRange(year) });
    const members = await Member.find({ _id: { $in: ids }, 'profileThumb.data': { $exists: true } }).select('+profileThumb').lean();
    const profileThumbnails = require('./profileThumbnails');
    const hash = id => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) | 0; return h; };
    return members.sort((a, b) => hash(a._id) - hash(b._id)).map(m => profileThumbnails.toBuffer(m.profileThumb.data));
}

function getTeamYear(year) {
    return cached('t:' + year, () => teamData(year));
}

// The share image's picks, from its address: ?race=<result id>&place=overall|gender|age&food=<key>
// (withChoices keeps the best guess for anything else)
function picksFrom(query) {
    const pick = v => (typeof v === 'string' && /^[\w-]{1,40}$/.test(v) ? v : '');
    return { race: pick(query.race), place: pick(query.place), food: pick(query.food), stat: pick(query.stat), bg: pick(query.bg) };
}

function sendImage(res, png) {
    res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' });
    res.end(png);
}

module.exports = function (app) {
    app.get('/api/year-in-review/team/:year', async function (req, res) {
        const year = validYear(req.params.year);
        if (!year) return res.status(404).json({ error: 'No review for that year' });
        try {
            res.json(await getTeamYear(year));
        } catch (err) {
            console.error('Year in review (team) error:', err);
            res.status(500).json({ error: 'Could not load the year' });
        }
    });

    app.get('/api/year-in-review/team/:year/image.png', async function (req, res) {
        const year = validYear(req.params.year);
        if (!year) return res.status(404).end();
        try {
            const png = await cached('ti:' + year, async () => {
                const [data, faces] = await Promise.all([getTeamYear(year), teamFaces(year)]);
                return image.render(data, null, faces);
            });
            sendImage(res, png);
        } catch (err) {
            console.error('Year in review image (team) error:', err);
            res.status(500).end();
        }
    });

    app.get('/api/year-in-review/members/:username/:year', async function (req, res) {
        const year = validYear(req.params.year);
        if (!year) return res.status(404).json({ error: 'No review for that year' });
        try {
            const data = await getMemberYear(req.params.username, year);
            if (!data) return res.status(404).json({ error: 'No such member' });
            res.json(data);
        } catch (err) {
            console.error('Year in review (member) error:', err);
            res.status(500).json({ error: 'Could not load the year' });
        }
    });

    app.get('/api/year-in-review/members/:username/:year/image.png', async function (req, res) {
        const year = validYear(req.params.year);
        if (!year) return res.status(404).end();
        try {
            const picks = picksFrom(req.query);
            const key = 'mi:' + req.params.username + ':' + year + ':' + [picks.race, picks.place, picks.food, picks.stat, picks.bg].join(':');
            const png = await cached(key, async () => {
                const [data, member] = await Promise.all([getMemberYear(req.params.username, year), findMember(req.params.username, true)]);
                return data ? image.render(withChoices(data, picks), member) : null;
            });
            if (!png) return res.status(404).end();
            sendImage(res, png);
        } catch (err) {
            console.error('Year in review image (member) error:', err);
            res.status(500).end();
        }
    });
};

module.exports.getMemberYear = getMemberYear;
module.exports.getTeamYear = getTeamYear;
module.exports.picksFrom = picksFrom;
