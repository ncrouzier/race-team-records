// Usage: node scripts/seed-crf-responses.js
// Seeds 20 fake responses for the first form matching title "sdfsdfsdf"
require('dotenv').config();
const mongoose = require('mongoose');
const { CompRaceForm, CompRaceFormResponse } = require('../app/models/compraceform');
const Member = require('../app/models/member');
const User = require('../app/models/user');

const RACES = [
    { racename: 'Cherry Blossom 10M', racedate: new Date('2025-04-06') },
    { racename: 'Army Ten-Miler', racedate: new Date('2024-10-13') },
    { racename: 'MCM 50K', racedate: new Date('2024-10-26') },
    { racename: 'Credit Union Cherry Blossom', racedate: new Date('2025-04-06') },
    { racename: 'GW Parkway Classic', racedate: new Date('2025-04-27') },
    { racename: 'Riva Run 10K', racedate: new Date('2025-05-04') },
    { racename: 'Rockville Twilight 8K', racedate: new Date('2025-06-21') },
];

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
];

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function main() {
    await mongoose.connect(process.env.MONGO_DEV_URL);
    console.log('Connected to', process.env.MONGO_DEV_URL);

    const form = await CompRaceForm.findOne({ title: /sdfsdfsdf/i });
    if (!form) { console.error('Form not found'); process.exit(1); }
    console.log('Form:', form.title, form._id);

    // Delete existing responses for this form
    const deleted = await CompRaceFormResponse.deleteMany({ form: form._id });
    console.log('Deleted', deleted.deletedCount, 'existing responses');

    // Grab up to 20 users that have an associated member
    const users = await User.find({ member: { $exists: true, $ne: null } }).limit(20).lean();
    if (!users.length) { console.error('No users with members found'); process.exit(1); }
    console.log('Found', users.length, 'users with members');

    const memberIds = users.map(u => u.member);
    const membersArr = await Member.find({ _id: { $in: memberIds } }).lean();
    const memberById = {};
    membersArr.forEach(m => { memberById[m._id.toString()] = m; });

    const responses = [];
    for (const user of users) {
        const member = memberById[user.member.toString()];
        const recentRace = rand(RACES);
        // realistic finish time: 28–55 min for ~8K-10M equivalent in centiseconds
        const recentTimeSec = randInt(28 * 60, 55 * 60);
        const projTimeSec = recentTimeSec + randInt(-120, 120);
        const recentAg = parseFloat((randInt(550, 820) / 10).toFixed(1));
        const projAg = parseFloat((recentAg + (Math.random() * 4 - 2)).toFixed(1));

        responses.push({
            form: form._id,
            user: user._id,
            member: member ? member._id : undefined,
            recentResult: {
                isManual: false,
                time: recentTimeSec * 100,
                agegrade: recentAg,
                race: recentRace
            },
            projectedTimeCentiseconds: projTimeSec * 100,
            projectedAgeGrade: projAg,
            comments: rand(COMMENTS),
            submittedAt: new Date(Date.now() - randInt(0, 7 * 24 * 3600 * 1000))
        });
    }

    await CompRaceFormResponse.insertMany(responses);
    console.log('Inserted', responses.length, 'responses');
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
