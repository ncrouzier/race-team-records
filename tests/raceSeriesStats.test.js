const { seriesStats, distanceKey, surfaceKey } = require('../app/raceSeriesStats');

const ann = { _id: 'm1', firstname: 'Ann', lastname: 'Lee', username: 'alee', sex: 'Female', dateofbirth: '1980-01-01' };
const bob = { _id: 'm2', firstname: 'Bob', lastname: 'Ray', username: 'bray', sex: 'Male' };
const cat = { _id: 'm3', firstname: 'Cat', lastname: 'Fox', username: 'cfox', sex: 'Female' };

const race = (id, date) => ({ _id: id, racename: 'Spring 10K', racedate: new Date(date), racetype: { name: '10k', surface: 'road', miles: 6.2137 } });
let resultIds = 0;
const result = (raceId, member, time, agegrade, ranking) => ({ _id: 'res' + (++resultIds), race: { _id: raceId }, members: [member], time, agegrade, ranking });

const editions = [
    { race: race('r22', '2022-04-01') },
    { race: race('r23', '2023-04-01'), offDistance: true },
    { race: race('r24', '2024-04-01') }
];
const results = [
    result('r22', ann, 300000, 70, { genderrank: 2 }),
    result('r22', bob, 280000, 65),
    result('r23', ann, 200000, 80), // short course: fastest time, but not a 10K
    result('r24', ann, 290000, 72),
    result('r24', cat, 310000, 60, { genderrank: 1 })
];

describe('seriesStats', () => {
    const stats = seriesStats({ editions, results });

    test('summary counts every result and runner', () => {
        expect(stats.summary).toEqual({
            editions: 3, firstYear: 2022, lastYear: 2024, results: 5, runners: 3, genderPodiums: 2,
            teamSeries: false, hasAgeGrades: true
        });
    });

    test('a series with no age grade anywhere says so', () => {
        const noGrades = [result('r22', ann, 300000), result('r24', bob, 280000)];
        expect(seriesStats({ editions, results: noGrades }).summary.hasAgeGrades).toBe(false);
    });

    test('an off-distance edition never sets a best time', () => {
        expect(stats.bests.women.map(b => [b.member.firstname, b.time])).toEqual([['Ann', 290000], ['Cat', 310000]]);
        expect(stats.members.find(m => m.member._id === 'm1').best.time).toBe(290000);
    });

    test('but its age grade counts', () => {
        expect(stats.bests.ageGrade[0]).toMatchObject({ agegrade: 80, raceId: 'r23' });
    });

    test('each best performance names its result, to open it', () => {
        const annBest = results.find(r => r.race._id === 'r24' && r.members[0]._id === 'm1');
        expect(stats.bests.women[0].resultId).toBe(annBest._id);
    });

    test('one entry per member in each best list', () => {
        expect(stats.bests.ageGrade.map(b => b.member.firstname)).toEqual(['Ann', 'Bob', 'Cat']);
    });

    test('members by appearances, with their history newest first', () => {
        const [first] = stats.members;
        expect(first.member.firstname).toBe('Ann');
        expect(first.count).toBe(3);
        expect(first.history.map(h => h.raceId)).toEqual(['r24', 'r23', 'r22']);
    });

    test('a member\'s history marks their bests, the gap to the best, pace and place', () => {
        const ann = stats.members.find(m => m.member._id === 'm1');
        const byRace = id => ann.history.find(h => h.raceId === id);
        expect(byRace('r24')).toMatchObject({ bestTime: true, behindBest: 0, team: false });
        expect(byRace('r22')).toMatchObject({ behindBest: 10000, place: { genderrank: 2 } });
        expect(byRace('r23').bestAgeGrade).toBe(true);
        expect(byRace('r23').behindBest).toBeUndefined(); // short course: no time comparison
        expect(byRace('r24').pace).toBeCloseTo(290000 / 100 / 60 / 6.2137, 5);
        expect(byRace('r24').distance).toBe('10k');
        expect(byRace('r24').resultId).toBe(results.find(r => r.race._id === 'r24' && r.members[0]._id === 'm1')._id);
    });

    test('an ordinary series has no team list', () => {
        expect(stats.bests.teams).toEqual([]);
    });

    test('no date of birth leaves the server', () => {
        expect(JSON.stringify(stats)).not.toMatch(/dateofbirth/);
    });

    test('each edition names its fastest entry', () => {
        expect(stats.editions[0]).toMatchObject({ results: 2, fastest: { time: 290000, team: false } });
        expect(stats.editions[0].fastest.members[0].firstname).toBe('Ann');
    });

    describe('a team series (any result with more than one runner)', () => {
        const relayRace = (id, date) => ({ _id: id, racename: 'Track Meet 4x400', racedate: new Date(date), racetype: { name: '4x400', surface: 'track', miles: 0.9942 } });
        const teamEditions = [{ race: relayRace('t13', '2013-08-10') }, { race: relayRace('t14', '2014-08-09') }];
        const teamResults = [
            { race: { _id: 't13' }, members: [ann, bob], time: 25680 },
            { race: { _id: 't14' }, members: [ann, bob, cat], time: 25550 },
            { race: { _id: 't14' }, members: [ann], time: 25550 }, // Ann on a second team of non-members
            // One member named, the rest not club members: still a team's result
            { race: { _id: 't14' }, members: [bob], time: 24000, agegrade: 70, ranking: { genderrank: 1 } }
        ];
        const team = seriesStats({ editions: teamEditions, results: teamResults });

        test('is flagged, with no age grades and no individual bests or podiums', () => {
            expect(team.summary).toMatchObject({ teamSeries: true, hasAgeGrades: false, genderPodiums: 0 });
            expect(team.bests.men).toEqual([]);
            expect(team.bests.women).toEqual([]);
            expect(team.bests.ageGrade).toEqual([]);
            expect(team.course).toBeNull();
        });

        test('a result with one runner named is a team result too', () => {
            const bob14 = team.members.find(m => m.member._id === 'm2').history.find(h => h.raceId === 't14');
            expect(bob14).toMatchObject({ team: true, time: 24000, teammates: [] });
            expect(bob14.agegrade).toBeUndefined();
        });

        test('the fastest teams list has every entry, one runner named or more', () => {
            expect(team.bests.teams.map(t => [t.time, t.members.length])).toEqual([[24000, 1], [25550, 3], [25550, 1], [25680, 2]]);
        });

        test('a team keeps its time, as each member\'s result', () => {
            const ann13 = team.members.find(m => m.member._id === 'm1').history.find(h => h.raceId === 't13');
            expect(ann13).toMatchObject({ team: true, time: 25680, behindBest: 130 });
            expect(ann13.teammates.map(t => t.firstname)).toEqual(['Bob']);
            expect(ann13.pace).toBeGreaterThan(0);
        });

        test('a member who ran an edition twice has one row for it, their best there', () => {
            const annStats = team.members.find(m => m.member._id === 'm1');
            expect(annStats.count).toBe(2);
            expect(annStats.history.find(h => h.raceId === 't14')).toMatchObject({ time: 25550, runs: 2, otherTimes: [25550] });
            expect(annStats.best).toMatchObject({ time: 25550, team: true });
        });

        test('each edition names its fastest entry', () => {
            expect(team.editions[0].fastest).toMatchObject({ time: 24000, team: true });
        });
    });

    describe('how the course rates', () => {
        const road10k = { name: '10k', surface: 'road' };
        // Ann: 75 at road 10Ks, 70 on the road overall; Bob too few results to count
        const usualAgeGrades = {
            byDistance: new Map([[distanceKey('m1', road10k), { avg: 75, n: 5 }], [distanceKey('m2', road10k), { avg: 60, n: 2 }]]),
            bySurface: new Map([[surfaceKey('m1', road10k), { avg: 70, n: 20 }]])
        };

        test('needs enough comparable results', () => {
            expect(seriesStats({ editions, results, usualAgeGrades }).course).toBeNull();
        });

        test('against the same distance and surface, and the same surface only', () => {
            const many = [];
            for (let i = 0; i < 12; i++) many.push(result('r22', ann, 300000, 72));
            expect(seriesStats({ editions, results: many, usualAgeGrades }).course).toEqual({
                sameDistance: { diff: -3, results: 12, members: 1 },
                sameSurface: { diff: 2, results: 12, members: 1 }
            });
        });

        test('a result 20 or more points below usual is left out (not raced)', () => {
            const many = [];
            for (let i = 0; i < 12; i++) many.push(result('r22', ann, 300000, 72));
            many.push(result('r22', ann, 900000, 55)); // walked it: 20 below her 75
            expect(seriesStats({ editions, results: many, usualAgeGrades }).course.sameDistance)
                .toEqual({ diff: -3, results: 12, members: 1 });
        });

        test('a short-course year only counts on the same surface', () => {
            const many = [];
            for (let i = 0; i < 12; i++) many.push(result('r23', ann, 200000, 72));
            expect(seriesStats({ editions, results: many, usualAgeGrades }).course).toEqual({
                sameDistance: null,
                sameSurface: { diff: 2, results: 12, members: 1 }
            });
        });
    });
});

describe('teamSeriesStats (Racing Stats tab)', () => {
    const { teamSeriesStats } = require('../app/raceSeriesStats');
    const road10k = { name: '10k', surface: 'road' };
    const res = (raceId, member, agegrade, more) => Object.assign(
        { race: { _id: raceId, racetype: road10k }, members: [member], agegrade }, more || {});
    // Spring 10K 2019, 2021, 2022, 2023; Fall 10K 2022, 2023
    const spring = { _id: 'sp', name: 'Spring 10K', racetype: road10k, editions: [2019, 2021, 2022, 2023].map(y => ({ raceId: 'sp' + y, year: y })) };
    const fall = { _id: 'fa', name: 'Fall 10K', racetype: road10k, editions: [2022, 2023].map(y => ({ raceId: 'fa' + y, year: y })) };

    test('most editions: one entry per member, for the race they ran most', () => {
        const results = ['sp2019', 'sp2021', 'sp2022', 'fa2022', 'fa2023'].map(id => res(id, ann))
            .concat(['fa2022', 'fa2023'].map(id => res(id, bob)));
        const { mostEditions } = teamSeriesStats({ seriesList: [spring, fall], results });
        expect(mostEditions.map(m => [m.member.firstname, m.series.name, m.count])).toEqual([['Ann', 'Spring 10K', 3], ['Bob', 'Fall 10K', 2]]);
    });

    test('courses rate against members\' usual elsewhere, at the same distance and surface', () => {
        const results = [];
        // Ann: 70 at other races, 74 at Spring (fast), 66 at Fall (tough). Her usual
        // for one series is everything else, the other series included:
        // Spring vs (12 x 66 + 4 x 70) / 16 = 67, Fall vs (12 x 74 + 4 x 70) / 16 = 73
        for (let i = 0; i < 4; i++) results.push(res('other' + i, ann, 70));
        for (let i = 0; i < 12; i++) results.push(res('sp2023', ann, 74));
        for (let i = 0; i < 12; i++) results.push(res('fa2023', ann, 66));
        const { fastestCourses, toughestCourses } = teamSeriesStats({ seriesList: [spring, fall], results });
        expect(fastestCourses.map(c => [c.series.name, c.diff])).toEqual([['Spring 10K', 7], ['Fall 10K', -7]]);
        expect(toughestCourses[0]).toMatchObject({ series: { name: 'Fall 10K' }, diff: -7, results: 12, members: 1 });
    });

    test('a course rating leaves out results 20 or more points below usual', () => {
        const results = [];
        for (let i = 0; i < 4; i++) results.push(res('other' + i, ann, 70));
        for (let i = 0; i < 12; i++) results.push(res('sp2023', ann, 74));
        for (let i = 0; i < 5; i++) results.push(res('sp2022', ann, 40)); // walked with family
        const [course] = teamSeriesStats({ seriesList: [spring], results }).fastestCourses;
        expect(course).toMatchObject({ diff: 4, results: 12 });
    });

    test('team best times: fastest man and woman at each race\'s usual distance', () => {
        const t = (raceId, member, time) => res(raceId, member, undefined, { time });
        const short = Object.assign({}, spring, { editions: spring.editions.map(e => e.year === 2019 ? Object.assign({}, e, { offDistance: true }) : e) });
        const results = [
            t('sp2021', ann, 3000), t('sp2022', cat, 3100), t('sp2023', bob, 2800),
            t('sp2019', cat, 1000),                      // short course year: not a record
            t('fa2022', ann, 3300), t('fa2023', bob, 2900),
            { race: { _id: 'fa2023', racetype: road10k }, members: [cat], time: 100 } // no: only from runners on their own
        ];
        results[results.length - 1].members = [cat, bob];   // a relay in Fall makes it a team series
        const { recordHolders } = teamSeriesStats({ seriesList: [short, fall], results });
        expect(recordHolders.all.map(h => [h.member.firstname, h.count, h.records.map(r => r.series.name + ' ' + r.sex)]))
            .toEqual([['Ann', 1, ['Spring 10K Female']], ['Bob', 1, ['Spring 10K Male']]]);
        expect(recordHolders.men.map(h => h.member.firstname)).toEqual(['Bob']);
        expect(recordHolders.men[0].records[0]).toMatchObject({ distance: '10k', time: 2800, year: 2023 });
        expect(recordHolders.women.map(h => h.member.firstname)).toEqual(['Ann']);
    });

    test('a team series has no course rating', () => {
        const results = [];
        for (let i = 0; i < 4; i++) results.push(res('other' + i, ann, 70));
        for (let i = 0; i < 12; i++) results.push(res('sp2023', ann, 74));
        results.push({ race: { _id: 'sp2022', racetype: road10k }, members: [ann, bob] });
        expect(teamSeriesStats({ seriesList: [spring], results }).fastestCourses).toEqual([]);
    });
});

describe('mainLocation', () => {
    const { mainLocation } = require('../app/raceSeriesStats');
    const at = (state, date, country) => ({ racedate: new Date(date), location: { state, country } });

    test('the most common location', () => {
        expect(mainLocation([at('MD', '2020-01-01'), at('MD', '2021-01-01'), at('VA', '2022-01-01')])).toBe('MD');
    });

    test('a tie goes to the most recent edition, whatever the order', () => {
        const fin = at(null, '2023-08-27', 'FIN'), zaf = at(null, '2018-09-02', 'ZAF');
        expect(mainLocation([fin, zaf])).toBe('FIN');
        expect(mainLocation([zaf, fin])).toBe('FIN');
    });

    test('no location at all', () => {
        expect(mainLocation([{ racedate: new Date() }])).toBe('');
    });
});
