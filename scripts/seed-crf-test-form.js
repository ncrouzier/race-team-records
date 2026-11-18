// Usage: node scripts/seed-crf-test-form.js
// Creates a test CRF form with 40 responses using real member results.
require('dotenv').config();
const mongoose = require('mongoose');
const { CompRaceForm, CompRaceFormResponse } = require('../app/models/compraceform');
const Member = require('../app/models/member');
const User = require('../app/models/user');
const Result = require('../app/models/result');

const FORM_TITLE = '[TEST] MCM 10K Comp Race Form';

// The form's target race — a 10K road race
const FORM_RACE = {
    racename: 'Marine Corps 10K',
    racedate: new Date('2026-10-18'),
    racetype: {
        _id: new mongoose.Types.ObjectId('54af4d985203ee25d43e0629'),
        name: '10k',
        surface: 'road',
        meters: 10000
    }
};

const COMMENTS = [
    'Coming off a solid training block, feeling confident.',
    'Recovering from a slight hamstring issue, going conservative.',
    'This will be my first time at this distance!',
    'Targeting a PR — everything feels on track.',
    '',
    'Just here for the experience.',
    'Should be close to my training paces.',
    '',
    'Peaked last month, hoping to hold fitness.',
    'Weather dependent — if hot I will back off.',
    'Building back after a spring marathon.',
    'Looking forward to running with the team!',
];

// Manual fallback races spanning different types
const MANUAL_RACES = [
    { racename: 'Cherry Blossom 10M', racedate: '2026-04-05', time: 58 * 60 * 100, racetype: { name: '10 miles', surface: 'road' } },
    { racename: 'GW Parkway Classic 10M', racedate: '2026-04-26', time: 62 * 60 * 100, racetype: { name: '10 miles', surface: 'road' } },
    { racename: 'Riva Run 10K', racedate: '2026-05-03', time: 46 * 60 * 100, racetype: { name: '10k', surface: 'road' } },
    { racename: 'Rockville Twilight 8K', racedate: '2026-06-20', time: 35 * 60 * 100, racetype: { name: '8k', surface: 'road' } },
    { racename: 'Frederick Half Marathon', racedate: '2026-05-03', time: 95 * 60 * 100, racetype: { name: 'Half Marathon', surface: 'road' } },
    { racename: 'MCRRC 8K Turkey Burnoff', racedate: '2025-11-29', time: 39 * 60 * 100, racetype: { name: '8k', surface: 'road' } },
    { racename: 'Seneca Creek Greenway Trail Marathon', racedate: '2026-03-28', time: 260 * 60 * 100, racetype: { name: 'Marathon', surface: 'trail' } },
    { racename: 'Army Ten-Miler', racedate: '2025-10-12', time: 72 * 60 * 100, racetype: { name: '10 miles', surface: 'road' } },
    { racename: 'Shamrock 5K', racedate: '2026-03-15', time: 22 * 60 * 100, racetype: { name: '5k', surface: 'road' } },
    { racename: 'MCRRC Summer Mile', racedate: '2025-08-07', time: 6 * 60 * 100, racetype: { name: '1 mile', surface: 'road' } },
];

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function main() {
    await mongoose.connect(process.env.MONGO_DEV_URL);
    console.log('Connected to', process.env.MONGO_DEV_URL);

    // Find or create the test form
    let form = await CompRaceForm.findOne({ title: FORM_TITLE });
    if (form) {
        console.log('Found existing form:', form._id);
        const deleted = await CompRaceFormResponse.deleteMany({ form: form._id });
        console.log('Cleared', deleted.deletedCount, 'existing responses');
    } else {
        // Find a captain user (any admin or captain)
        const captain = await User.findOne({ role: { $in: ['admin', 'captain'] } }).lean();
        if (!captain) { console.error('No admin/captain user found'); process.exit(1); }
        form = await CompRaceForm.create({
            title: FORM_TITLE,
            description: '<p>Sign up to be considered for a comp or discount entry to the Marine Corps 10K. Captains will review your recent result and projected time.</p>',
            race: FORM_RACE,
            isOpen: true,
            numComps: 8,
            numDiscounts: 5,
            uniqueId: 'test-mcm-10k-2026',
            createdBy: captain._id,
        });
        console.log('Created form:', form._id);
    }

    // Get up to 40 users with member profiles
    const users = await User.find({ member: { $exists: true, $ne: null } }).limit(40).lean();
    console.log('Found', users.length, 'users with members');

    const memberIds = users.map(u => u.member);
    const membersArr = await Member.find({ _id: { $in: memberIds } }).lean();
    const memberById = Object.fromEntries(membersArr.map(m => [m._id.toString(), m]));

    // Load each member's most recent result from the DB
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const responses = [];
    let fromDb = 0, fromManual = 0;

    for (const user of users) {
        const member = memberById[user.member.toString()];

        // Look up this member's most recent result
        const dbResult = await Result.findOne({
            'members._id': user.member,
            isRecordEligible: true,
            'race.racedate': { $gte: sixMonthsAgo }
        }).sort({ 'race.racedate': -1 }).lean();

        let recentResult;
        if (dbResult) {
            recentResult = {
                _id: dbResult._id,
                time: dbResult.time,
                agegrade: dbResult.agegrade,
                isManual: false,
                race: {
                    _id: dbResult.race._id,
                    racename: dbResult.race.racename,
                    racedate: dbResult.race.racedate,
                    racetype: dbResult.race.racetype,
                }
            };
            fromDb++;
        } else {
            // Fall back to a varied manual entry with a plausible time
            const manual = rand(MANUAL_RACES);
            const jitter = randInt(-300, 300) * 100; // ±5 min in centiseconds
            recentResult = {
                time: manual.time + jitter,
                agegrade: null,
                isManual: true,
                race: {
                    racename: manual.racename,
                    racedate: new Date(manual.racedate),
                    racetype: manual.racetype,
                }
            };
            fromManual++;
        }

        // Projected time: within ±3 min of recent time, scaled to 10K
        const projectedCs = recentResult.time + randInt(-180, 180) * 100;

        responses.push({
            form: form._id,
            user: user._id,
            member: member ? member._id : undefined,
            recentResult,
            projectedTimeCentiseconds: projectedCs > 0 ? projectedCs : recentResult.time,
            projectedAgeGrade: null,
            comments: rand(COMMENTS),
            submittedAt: new Date(Date.now() - randInt(0, 10 * 24 * 3600 * 1000)),
        });
    }

    await CompRaceFormResponse.insertMany(responses);
    console.log(`Inserted ${responses.length} responses (${fromDb} from DB results, ${fromManual} manual)`);
    console.log(`Form URL: /form/${form.uniqueId}`);
    console.log(`Captain view: /comp-race-forms/${form._id}`);
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
