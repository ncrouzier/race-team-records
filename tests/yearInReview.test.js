const { validYear, resultMiles, distanceName, milesLike, withChoices, teamRanks, memberYear, teamYear } = require('../app/yearInReview');

const NOW = new Date('2026-11-16T12:00:00Z');
const road5k = { name: '5k', surface: 'road', miles: 3.1 };
const road10k = { name: '10k', surface: 'road', miles: 6.2 };

const ann = { _id: 'm1', firstname: 'Ann', lastname: 'Lee', username: 'annlee', sex: 'Female' };
const bob = { _id: 'm2', firstname: 'Bob', lastname: 'Ray', username: 'bobray', sex: 'Male' };
const cat = { _id: 'm3', firstname: 'Cat', lastname: 'Fox', username: 'catfox', sex: 'Female' };

let n = 0;
function result(members, race, extra) {
    n++;
    return Object.assign({
        _id: 'r' + n,
        members,
        time: 120000,
        race: Object.assign({ _id: 'race' + n, racename: 'Race ' + n, racedate: new Date('2026-03-10'), racetype: road5k, location: { country: 'USA', state: 'MD' } }, race)
    }, extra);
}

describe('validYear', () => {
    test('from the team\'s first season to this year', () => {
        expect(validYear('2026', NOW)).toBe(2026);
        expect(validYear(2013, NOW)).toBe(2013);
        expect(validYear(2012, NOW)).toBeNull();
        expect(validYear(2027, NOW)).toBeNull();
        expect(validYear('abc', NOW)).toBeNull();
    });
});

describe('resultMiles and distanceName', () => {
    test('a set distance, a variable one, a multisport result\'s running legs', () => {
        expect(resultMiles({ race: { racetype: road5k } })).toBe(3.1);
        expect(resultMiles({ race: { racetype: { isVariable: true, miles: 5 } }, miles: 6.1 })).toBe(6.1);
        expect(resultMiles({ race: { racetype: road5k }, legs: [{ legType: 'swim', miles: 1 }, { legType: 'run', miles: 6.2 }] })).toBe(6.2);
    });

    test('a variable distance goes by the race\'s own name', () => {
        expect(distanceName({ racetype: road5k })).toBe('5k (road)');
        expect(distanceName({ racetype: { name: 'Other', isVariable: true }, distanceName: '6.1 miles' })).toBe('6.1 miles');
    });
});

describe('milesLike', () => {
    test('the biggest comparison that fits', () => {
        expect(milesLike(8738)).toEqual({ count: 3.1, text: 'trips across the USA' });
        expect(milesLike(450)).toEqual({ count: 2, text: 'trips from DC to New York' });
        expect(milesLike(88)).toEqual({ count: 1.4, text: 'laps of the Capital Beltway' });
        expect(milesLike(26.2)).toEqual({ count: 1, text: 'marathon' });
        expect(milesLike(9.3)).toEqual({ count: 3, text: '5Ks' });
        expect(milesLike(0)).toBeNull();
    });
});

describe('memberYear', () => {
    const results = [
        result([ann], { racedate: new Date('2026-03-10'), racetype: road5k }, {
            time: 110000, agegrade: 71.2, ranking: { overallrank: 2, overalltotal: 412, genderrank: 1, agerank: 1 },
            achievements: [{ name: 'pb', value: { memberId: 'm1' } }, { name: 'raceCount', value: { raceCount: 50, memberId: 'm1' } }]
        }),
        result([ann], { racedate: new Date('2026-03-24'), racetype: road5k, location: { country: 'FRA' } }, {
            time: 108000, agegrade: 73.5,
            achievements: [{ name: 'pb', value: { memberId: 'm1' } }, { name: 'teamRecord', text: 'New team record: 5k' }]
        }),
        result([ann], { racedate: new Date('2026-09-05'), racetype: road10k }, { time: 240000, agegrade: 70.1, ranking: { agerank: 2 } }),
        // a relay: no places counted for her
        result([ann, cat], { racedate: new Date('2026-09-20'), racetype: road5k }, { ranking: { overallrank: 1 } })
    ];
    const raceResults = [
        result([bob], { _id: results[0].race._id }),
        result([bob], { _id: results[2].race._id }),
        result([cat], { _id: results[2].race._id })
    ];
    const year = memberYear({
        member: Object.assign({ achievements: [{ name: 'ROY', text: 'Runner of the Year 2026' }, { name: 'ROY', text: 'Runner of the Year 2019' }] }, ann),
        year: 2026,
        results,
        earlier: [result([ann], { racedate: new Date('2025-05-01'), location: { country: 'USA', state: 'MD' } }, { agegrade: 69 })],
        lastYear: [result([ann], { racedate: new Date('2025-05-01') }, { agegrade: 69 })],
        raceResults: raceResults.concat(results),
        volunteerJobs: [{}, {}],
        now: NOW
    });

    test('totals', () => {
        expect(year.partial).toBe(true);
        expect(year.totals.races).toBe(4);
        expect(year.totals.miles).toBe(15.5);
        expect(year.totals.states).toEqual([{ code: 'MD', name: 'Maryland' }]);
        expect(year.totals.countries).toEqual([{ code: 'FRA', name: 'France' }, { code: 'USA', name: 'United States' }]);
        expect(year.totals.newPlaces).toEqual(['France']);
        expect(year.firstYear).toBe(false);
    });

    test('months', () => {
        expect(year.months[2]).toBe(2);
        expect(year.months[8]).toBe(2);
        expect(year.busiestMonth).toEqual({ month: 'Mar', index: 2, count: 2 });
        // Mar 10, Mar 24, Sep 5, Sep 20: one result each
        expect(year.raceDays).toEqual([[2, 10, 1], [2, 24, 1], [8, 5, 1], [8, 20, 1]]);
        expect(year.longest.distance).toBe('10k (road)');
        expect(year.mostRun).toEqual({ name: '5k (road)', count: 3 });
    });

    test('highlights', () => {
        expect(year.bestAgeGrade.agegrade).toBe(73.5);
        expect(year.pbs).toHaveLength(1);
        expect(year.pbs[0].time).toBe(108000);
        expect(year.teamRecords).toHaveLength(1);
        expect(year.milestones[0].count).toBe(50);
        expect(year.awards).toEqual([{ name: 'ROY', text: 'Runner of the Year 2026' }]);
        expect(year.volunteerJobs).toBe(2);
    });

    test('places count only her own results', () => {
        expect(year.ranking).toEqual({ wins: 0, overallPodiums: 1, genderWins: 1, genderPodiums: 1, ageWins: 1 });
    });

    test('teammates, most shared races first', () => {
        expect(year.teammates.map(t => [t.username, t.count])).toEqual([['bobray', 2], ['catfox', 2]]);
    });

    test('against the year before', () => {
        expect(year.lastYear).toEqual({ races: 1, miles: 3.1, bestAgeGrade: 69 });
    });

    test('the fun side', () => {
        expect(year.fun.miles.text).toBe('5Ks');
        expect(year.fun.food).toEqual({ key: 'poptart', count: 8, text: 'strawberry Pop-Tarts' });
        // 18:00 for 3.1 miles
        expect(year.fun.fastestPace).toMatchObject({ pace: 348, distance: '5k (road)' });
    });

    test('best race: her own races with a place, the best guess first', () => {
        // the relay's win is not hers; the 10k has only an age place
        expect(year.fun.raceChoices.map(c => Object.keys(c.places))).toEqual([['overall', 'gender', 'age'], ['age']]);
        // 2nd of 412 overall: further up its field than anything else
        expect(year.fun.bestRace).toEqual({ resultId: results[0]._id, place: 'overall' });
        expect(year.fun.race).toMatchObject({ racename: results[0].race.racename, place: 'overall', rank: 2, total: 412 });
    });

    test('best race and food, as picked', () => {
        const picked = withChoices(year, { race: results[2]._id, place: 'gender', food: 'gu' });
        // that race has no gender place: its first place it has
        expect(picked.fun.race).toMatchObject({ resultId: results[2]._id, place: 'age', rank: 2 });
        expect(picked.fun.food).toEqual({ key: 'gu', count: 16, text: 'GU energy gels' });
        // the same race, another place
        expect(withChoices(year, { place: 'age' }).fun.race).toMatchObject({ resultId: results[0]._id, place: 'age', rank: 1 });
        // not hers, or unknown: the best guess
        const odd = withChoices(year, { race: 'nope', place: 'fastest', food: 'caviar' });
        expect(odd.fun.race).toMatchObject({ resultId: results[0]._id, place: 'overall' });
        expect(odd.fun.food.key).toBe('poptart');
        // the year itself is left as it was
        expect(year.fun.food.key).toBe('poptart');
    });

    test('the stats to pick from, in the default order', () => {
        const ranks = teamRanks(results.concat(raceResults));
        const y = memberYear({
            member: ann, year: 2026, results,
            earlier: [result([ann], { racedate: new Date('2025-05-01'), racetype: road5k, location: { country: 'USA', state: 'MD' } }, { time: 115000, agegrade: 69 })],
            lastYear: [result([ann], { racedate: new Date('2025-05-01') }, { agegrade: 69 })],
            raceResults: raceResults.concat(results), teamRanks: ranks, now: NOW
        });
        const stats = {};
        y.fun.stats.forEach(x => { stats[x.key] = x.text; });
        // 19:10 then 18:20, then 18:00: the biggest cut, 50 seconds
        expect(stats.pbdrop).toBe('Cut 50 seconds off their 5k (road) best');
        // 4 races, the most of the 3 who raced
        expect(stats.rank).toBe('#1 of 3 on the team for number of races run');
        expect(stats.agegrade).toBe('+4.5% vs 2025 (73.5%)');
        expect(stats.newplaces).toBe('First race in France');
        expect(stats.teammates).toBe('Raced alongside 2 teammates');
        expect(stats.streak).toBeUndefined(); // March, then September
        expect(y.fun.stat.key).toBe('pbdrop');
        expect(withChoices(y, { stat: 'teammates' }).fun.stat.key).toBe('teammates');
        expect(withChoices(y, { stat: 'nope' }).fun.stat.key).toBe('pbdrop');
    });

    test('a first year with the team', () => {
        const first = memberYear({ member: ann, year: 2026, results: [results[0]], earlier: [], now: NOW });
        expect(first.firstYear).toBe(true);
        expect(first.lastYear).toBeNull();
    });
});

describe('teamYear', () => {
    const shared = { _id: 'big', racename: 'Big Race', racedate: new Date('2026-04-01') };
    const results = [
        result([ann], shared, { agegrade: 80, achievements: [{ name: 'pb', value: { memberId: 'm1' } }], ranking: { overallrank: 1, genderrank: 1 } }),
        result([bob], shared, { agegrade: 70 }),
        result([cat], { racedate: new Date('2026-06-01'), racetype: road10k, location: { country: 'CAN' } },
            { achievements: [{ name: 'teamRecord', text: 'New team record' }] }),
        result([ann], { racedate: new Date('2026-06-15') })
    ];
    const year = teamYear({
        year: 2025,
        results,
        earlier: [result([ann], { location: { country: 'USA', state: 'MD' } })],
        lastYear: [result([ann], {}), result([bob], {})],
        volunteerJobs: [{ member: ann }, { member: ann }, { member: bob }],
        now: NOW
    });

    test('totals', () => {
        expect(year.partial).toBe(false);
        expect(year.totals).toMatchObject({ results: 4, races: 3, runners: 3, firstTimers: 2, pbs: 1 });
        expect(year.totals.newPlaces).toEqual(['Canada']);
    });

    test('new and returning members: by their memberships', () => {
        const d = (y, m) => new Date(Date.UTC(y, m, 1));
        const y = teamYear({
            year: 2026, results: [result([ann], {})], now: NOW,
            members: [
                Object.assign({ membershipDates: [{ start: d(2026, 2) }] }, ann),
                // left in 2015, back in 2026
                Object.assign({ membershipDates: [{ start: d(2013, 0), end: d(2015, 11) }, { start: d(2026, 6) }] }, bob),
                // a member since 2020: neither
                Object.assign({ membershipDates: [{ start: d(2020, 0) }] }, cat)
            ]
        });
        expect(y.totals).toMatchObject({ newMembers: 1, returning: 1 });
        expect(y.joined.new.map(m => m.username)).toEqual(['annlee']);
        expect(y.joined.returning.map(m => m.username)).toEqual(['bobray']);
    });

    test('leaders and turnouts', () => {
        expect(year.leaders.races[0]).toMatchObject({ username: 'annlee', value: 2 });
        expect(year.leaders.agegrade[0]).toMatchObject({ username: 'annlee', value: 80 });
        expect(year.leaders.pbs).toHaveLength(1);
        expect(year.biggestTurnouts[0]).toMatchObject({ racename: 'Big Race', runners: 2 });
    });

    test('the fun side', () => {
        expect(year.fun.ace).toMatchObject({ username: 'annlee', agegrade: 80 });
        expect(year.fun.mostRaces).toMatchObject({ username: 'annlee', races: 2, others: [] });
        expect(year.fun.turnout).toMatchObject({ racename: 'Big Race', runners: 2 });
    });

    test('records, places, volunteering, last year', () => {
        expect(year.teamRecords).toHaveLength(1);
        expect(year.ranking.wins).toBe(1);
        expect(year.volunteer).toEqual({ jobs: 3, volunteers: 2 });
        expect(year.lastYear).toEqual({ results: 2, runners: 2, miles: 6.2 });
    });
});
