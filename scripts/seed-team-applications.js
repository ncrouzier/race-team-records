/**
 * Seeds a spread of team applications for working on the /applications page.
 *
 *   node scripts/seed-team-applications.js          create the test data
 *   node scripts/seed-team-applications.js --clean  remove it again
 *
 * Everything created here uses @example.invalid addresses (except one, see below)
 * and TEST_MEMBER_LASTNAMES for the placeholder members, so --clean can find it all.
 * Age grades are calculated with the same service the real form uses.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const service = require('../app/service');
const TeamApplication = require('../app/models/teamapplication');
const Member = require('../app/models/member');
const RaceType = require('../app/models/racetype');

const TEST_EMAIL_DOMAIN = '@example.invalid';
// Placeholder past members, so approving a "returning" application never touches a
// real member record. Delete these with --clean.
const TEST_MEMBER_LASTNAMES = ['Comeback', 'Renamed'];

// One application uses a plus-addressed version of CAPTAINS_EMAIL so you can send a
// real approval/rejection email to yourself. Needs SEND_EMAIL_FOR_FORM=true to send.
function realishEmail() {
    const captains = process.env.CAPTAINS_EMAIL || '';
    const at = captains.indexOf('@');
    if (at === -1) return 'applicant.real' + TEST_EMAIL_DOMAIN;
    return captains.slice(0, at) + '+applicant' + captains.slice(at);
}

function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
}

function centis(str) {
    const parts = str.split(':').map(Number);
    if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 100;
    return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 100;
}

// Same calculation the apply form and the API use
async function ageGradeFor(sex, dateofbirth, racetype, racedate, timeCentiseconds) {
    const gradingSex = sex === 'female' ? 'female' : (sex === 'male' ? 'male' : null);
    if (!gradingSex || !racetype) return null;
    try {
        const age = service.calculateAge(racedate, dateofbirth);
        const ag = await service.getAgeGrading(gradingSex, age, racetype.surface, racedate);
        const key = racetype.name.toLowerCase();
        if (!ag || !ag[key]) return null;
        return parseFloat(((ag[key] / (timeCentiseconds / 100)) * 100).toFixed(2));
    } catch (err) {
        return null;
    }
}

async function main() {
    const clean = process.argv.includes('--clean');
    await mongoose.connect(process.env.MONGO_DEV_URL);

    if (clean) {
        const apps = await TeamApplication.deleteMany({
            $or: [
                { email: new RegExp(TEST_EMAIL_DOMAIN.replace('.', '\\.') + '$') },
                { email: realishEmail() }
            ]
        });
        const members = await Member.deleteMany({ lastname: { $in: TEST_MEMBER_LASTNAMES } });
        console.log('Removed ' + apps.deletedCount + ' application(s) and ' + members.deletedCount + ' placeholder member(s).');
        await mongoose.disconnect();
        return;
    }

    // Race types to build the submitted races from
    const byName = {};
    const wanted = [
        { name: '5k', surface: 'road' },
        { name: '10k', surface: 'road' },
        { name: 'Half Marathon', surface: 'road' },
        { name: 'Marathon', surface: 'road' },
        { name: '8k', surface: 'road' }
    ];
    for (const w of wanted) {
        const rt = await RaceType.findOne({ name: w.name, surface: w.surface }).lean();
        if (rt) byName[w.name] = { _id: rt._id, name: rt.name, surface: rt.surface, meters: rt.meters, miles: rt.miles };
    }

    // --- Placeholder past members, to trigger the returning-member warning ---
    await Member.deleteMany({ lastname: { $in: TEST_MEMBER_LASTNAMES } });

    const comeback = new Member({
        firstname: 'Dana', lastname: 'Comeback', sex: 'Female', dateofbirth: new Date('1987-03-12'),
        membershipDates: [{ start: new Date('2017-01-01'), end: new Date('2021-12-31') }]
    });
    await comeback.save();

    const renamed = new Member({
        firstname: 'Priya', lastname: 'Renamed', sex: 'Female', dateofbirth: new Date('1993-09-05'),
        alternateFullNames: ['Priya Newsurname'],
        membershipDates: [{ start: new Date('2019-01-01'), end: new Date('2022-12-31') }]
    });
    await renamed.save();

    // --- The applications ---
    const specs = [
        {
            label: 'strong / clean approve',
            firstname: 'Maya', lastname: 'Fastfeet', email: 'maya.fastfeet' + TEST_EMAIL_DOMAIN,
            sex: 'female', dateofbirth: new Date('1994-06-18'), committedToRaces: true,
            motivation: 'I moved to Rockville last spring and have been training on my own since. I miss having people ' +
                'to do workouts with, and I am aiming at a sub-3 marathon this fall — I think racing with a team would ' +
                'push me there.',
            races: [
                { racename: 'Kensington 8K', type: '8k', racedate: daysAgo(48), time: '30:10', link: 'https://www.mcrrc.org/race-results/kensington-8k/' },
                { racename: 'Parks Half Marathon', type: 'Half Marathon', racedate: daysAgo(96), time: '1:26:40', link: 'https://results.parksHalf.example.com/2026/results?bib=1421' }
            ]
        },
        {
            label: 'one race under the threshold',
            firstname: 'Tom', lastname: 'Borderline', email: 'tom.borderline' + TEST_EMAIL_DOMAIN,
            sex: 'male', dateofbirth: new Date('1989-11-02'), committedToRaces: true,
            motivation: 'Coming back from a stress fracture last year so my half is well off where it should be. The 5k ' +
                'is a truer reflection of where I am now and I am building back up.',
            races: [
                { racename: 'Rockville Twilight 8K', type: '8k', racedate: daysAgo(30), time: '30:20' },
                { racename: 'Frederick Half Marathon', type: 'Half Marathon', racedate: daysAgo(140), time: '1:38:30' }
            ]
        },
        {
            label: 'cannot commit to the race minimum',
            firstname: 'Ellie', lastname: 'Busyschedule', email: 'ellie.busy' + TEST_EMAIL_DOMAIN,
            sex: 'female', dateofbirth: new Date('1998-02-24'), committedToRaces: false,
            motivation: 'I travel a lot for work so I cannot promise eight races, but I would still love to train with ' +
                'the group and race when I am in town.',
            races: [
                { racename: 'Riley\'s Rumble Half Marathon', type: 'Half Marathon', racedate: daysAgo(21), time: '1:32:15', link: 'https://www.mcrrc.org/race-results/rileys-rumble-half-marathon/' },
                { racename: 'Going Green Track Meet 5k', type: '5k', racedate: daysAgo(75), time: '19:05' }
            ]
        },
        {
            label: 'gender "other" — no age grade available',
            firstname: 'Alex', lastname: 'Nonbinary', email: 'alex.n' + TEST_EMAIL_DOMAIN,
            sex: 'other', dateofbirth: new Date('1996-07-30'), committedToRaces: true,
            motivation: 'I have been coming to the Tuesday track workouts as a guest for a few months and would like to ' +
                'make it official and score for the team.',
            races: [
                { racename: 'Jingle Bell Jog 8K', type: '8k', racedate: daysAgo(60), time: '29:40' },
                { racename: 'Pike\'s Peek 10K', type: '10k', racedate: daysAgo(115), time: '38:20' }
            ]
        },
        {
            label: 'returning member — matches Dana Comeback by name',
            firstname: 'Dana', lastname: 'Comeback', email: 'dana.comeback' + TEST_EMAIL_DOMAIN,
            sex: 'female', dateofbirth: new Date('1987-03-12'), committedToRaces: true,
            motivation: 'I was on the team from 2017 to 2021 and stepped away after my second child was born. I am ' +
                'finally racing again and would love to rejoin.',
            races: [
                { racename: 'Piece of Cake 10K', type: '10k', racedate: daysAgo(35), time: '42:50', link: 'https://www.mcrrc.org/race-results/piece-of-cake-10k/' },
                { racename: 'Kensington 8K', type: '8k', racedate: daysAgo(88), time: '33:20' }
            ]
        },
        {
            label: 'returning member — matches Priya Renamed via alternate name',
            firstname: 'Priya', lastname: 'Newsurname', email: realishEmail(),
            sex: 'female', dateofbirth: new Date('1993-09-05'), committedToRaces: true,
            motivation: 'I raced with the team as Priya Renamed before I got married. Took two years off and I am back ' +
                'to racing regularly now.',
            races: [
                { racename: 'Sneaks 5K', type: '5k', racedate: daysAgo(26), time: '19:48' },
                { racename: 'Germantown 5 Miler', type: '10k', racedate: daysAgo(70), time: '41:10' }
            ]
        },
        {
            label: 'already rejected — for testing the rejection letter',
            firstname: 'Chris', lastname: 'Turneddown', email: 'chris.t' + TEST_EMAIL_DOMAIN,
            sex: 'male', dateofbirth: new Date('1985-01-15'), committedToRaces: true,
            motivation: 'Just getting into racing this year and would love to be part of a team to learn from.',
            status: 'rejected',
            reviewNotes: 'Both age grades well short of the standard. Encouraged to reapply next season.',
            reviewedByUsername: 'seed',
            races: [
                { racename: 'Turkey Chase 10K', type: '10k', racedate: daysAgo(50), time: '52:40' },
                { racename: 'Riley\'s Rumble Half Marathon', type: 'Half Marathon', racedate: daysAgo(110), time: '2:04:00' }
            ]
        }
    ];

    // Wipe any previous run of these, then insert
    await TeamApplication.deleteMany({
        $or: [
            { email: new RegExp(TEST_EMAIL_DOMAIN.replace('.', '\\.') + '$') },
            { email: realishEmail() }
        ]
    });

    console.log('');
    for (let i = 0; i < specs.length; i++) {
        const spec = specs[i];
        const races = [];
        for (const r of spec.races) {
            const racetype = byName[r.type];
            const timeCentiseconds = centis(r.time);
            races.push({
                racename: r.racename,
                racedate: r.racedate,
                racetype: racetype || null,
                timeCentiseconds: timeCentiseconds,
                agegrade: await ageGradeFor(spec.sex, spec.dateofbirth, racetype, r.racedate, timeCentiseconds),
                // Left blank on some races on purpose — the link is optional
                resultlink: r.link || ''
            });
        }

        const application = new TeamApplication({
            firstname: spec.firstname,
            lastname: spec.lastname,
            email: spec.email,
            sex: spec.sex,
            dateofbirth: spec.dateofbirth,
            races: races,
            motivation: spec.motivation,
            committedToRaces: spec.committedToRaces,
            status: spec.status || 'pending',
            reviewNotes: spec.reviewNotes,
            reviewedByUsername: spec.reviewedByUsername,
            reviewedAt: spec.status ? daysAgo(2) : null,
            ipAddress: '127.0.0.1'
        });
        // Stagger createdAt so the list has a sensible newest-first order
        application.createdAt = daysAgo(i);
        await application.save();

        const grades = races.map(function (r) {
            return r.agegrade === null ? 'n/a' : r.agegrade.toFixed(1) + '%';
        }).join(', ');
        console.log('  ' + (application.status === 'pending' ? '[pending] ' : '[' + application.status + ']') +
            ' ' + spec.firstname + ' ' + spec.lastname + '  AG: ' + grades + '   — ' + spec.label);
    }

    console.log('\nPlaceholder past members created: Dana Comeback, Priya Renamed (alt name "Priya Newsurname")');
    console.log('Review them at ' + (process.env.PORT ? 'http://localhost:' + process.env.PORT : 'http://localhost:8090') + '/applications');
    console.log('Remove everything with: node scripts/seed-team-applications.js --clean\n');

    await mongoose.disconnect();
}

main().catch(function (err) {
    console.error(err);
    process.exit(1);
});
