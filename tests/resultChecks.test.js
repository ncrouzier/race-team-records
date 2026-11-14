const { checkResult, distancesInName, statesInName, parkrunDay, daysApartInYear, relayRunners } = require('../app/resultChecks');

const road10k = { _id: 'rt10k', name: '10k', surface: 'road', meters: 10000 };
const road5k = { _id: 'rt5k', name: '5k', surface: 'road', meters: 5000 };
const trail = { _id: 'rtv', name: 'Trail (variable)', surface: 'trail', meters: 9817, isVariable: true };
const robert = {
    _id: 'm1', firstname: 'Robert', sex: 'Male', dateofbirth: new Date('1980-05-01'),
    membershipDates: [{ start: new Date('2020-01-01') }]
};
const liz = { _id: 'm2', firstname: 'Liz', sex: 'Female', dateofbirth: new Date('1985-02-01'), membershipDates: [{ start: new Date('2019-01-01') }] };
const now = new Date('2026-11-14T12:00:00Z');

function result(changes) {
    return Object.assign({
        time: 215400,
        members: [robert],
        ranking: {},
        race: {
            racename: 'Turkey Chase 10K',
            racedate: new Date('2026-11-08T00:00:00Z'),
            location: { country: 'USA', state: 'MD' },
            racetype: road10k
        }
    }, changes);
}

function codes(res, ctx) {
    return checkResult(res, Object.assign({ now, isNew: true, members: res.members, ageGrades: { m1: 70 } }, ctx)).map(w => w.code);
}

describe('a clean result', () => {
    test('says nothing', () => {
        expect(codes(result())).toEqual([]);
    });
});

describe('time and distance', () => {
    test('1. age grade out of range', () => {
        expect(codes(result(), { ageGrades: { m1: 97.2 } })).toContain('agegrade-high');
        expect(codes(result(), { ageGrades: { m1: 30 } })).toContain('agegrade-low');
        const impossible = checkResult(result(), { now, members: [robert], ageGrades: { m1: 2097.7 } }).find(w => w.code === 'agegrade-high');
        expect(impossible.level).toBe('danger');
        expect(impossible.message).toContain('world record');
    });

    test('2. much faster than the runner\'s best', () => {
        const bests = { m1: { time: 250000, racename: 'Pike\'s Peek', racedate: new Date('2025-04-20') } };
        expect(codes(result(), { bests })).toContain('faster-than-best');
        expect(codes(result({ time: 240000 }), { bests })).not.toContain('faster-than-best');
    });

    test('3. pace bounds where age grading cannot judge', () => {
        const trailRace = Object.assign({}, result().race, { racename: 'Black Hill Trail', racetype: trail });
        expect(codes(result({ race: trailRace, time: 9000 }))).toContain('pace-fast');      // 1:30 for 6 miles
        expect(codes(result({ race: trailRace, time: 900000 }))).toContain('pace-slow');    // 2.5 hours
        expect(codes(result({ race: trailRace, time: 284200 }))).toEqual([]);
    });

    test('4. legs that do not add up', () => {
        const tri = Object.assign({}, result().race, { racename: 'Sprint Tri', isMultisport: true, racetype: { name: 'Multisport', surface: 'multiple' } });
        const legs = [{ time: 80000 }, { time: 100000 }];
        expect(codes(result({ race: tri, legs, time: 200000 }))).toContain('legs-sum');
        expect(codes(result({ race: tri, legs, time: 180000 }))).not.toContain('legs-sum');
    });
});

describe('places', () => {
    test('5. places that do not fit together', () => {
        expect(codes(result({ ranking: { overallrank: 50, overalltotal: 40 } }))).toContain('place-over-total');
        expect(codes(result({ ranking: { agerank: 12, genderrank: 3 } }))).toContain('places-order');
        expect(codes(result({ ranking: { agetotal: 300, gendertotal: 200 } }))).toContain('totals-order');
        expect(codes(result({ ranking: { agerank: 2, agetotal: 30, genderrank: 10, gendertotal: 200, overallrank: 15, overalltotal: 400 } }))).toEqual([]);
    });

    test('6. a different overall count from teammates', () => {
        const raceResults = [{ _id: 'r2', ranking: { overalltotal: 412 } }, { _id: 'r3', ranking: { overalltotal: 412 } }];
        expect(codes(result({ ranking: { overalltotal: 421 } }), { raceResults })).toContain('overall-total');
        expect(codes(result({ ranking: { overalltotal: 412 } }), { raceResults })).not.toContain('overall-total');
    });

    test('16. gender finishers against teammates', () => {
        const mate = (who, gendertotal) => ({ _id: 'r' + who._id, members: [who], ranking: { gendertotal, overalltotal: 400 } });
        const bob = Object.assign({}, robert, { _id: 'm3', firstname: 'Bob' });
        expect(codes(result({ ranking: { gendertotal: 230, overalltotal: 400 } }), { raceResults: [mate(bob, 210)] })).toContain('gender-total');
        expect(codes(result({ ranking: { gendertotal: 170, overalltotal: 400 } }), { raceResults: [mate(liz, 170)] })).toContain('gender-total');
        expect(codes(result({ ranking: { gendertotal: 230, overalltotal: 400 } }), { raceResults: [mate(liz, 170), mate(bob, 230)] })).not.toContain('gender-total');
    });
});

describe('dates', () => {
    test('7. outside the runner\'s membership', () => {
        const past = Object.assign({}, robert, { membershipDates: [{ start: new Date('2018-01-01'), end: new Date('2024-12-31') }] });
        expect(codes(result({ members: [past] }))).toContain('membership');
    });

    test('8. future (danger) and old (new results only)', () => {
        const future = Object.assign({}, result().race, { racedate: new Date('2026-12-01') });
        const warnings = checkResult(result({ race: future }), { now, members: [robert] });
        expect(warnings.find(w => w.code === 'future').level).toBe('danger');
        const old = Object.assign({}, result().race, { racedate: new Date('2026-06-01') });
        expect(codes(result({ race: old }))).toContain('old');
        expect(codes(result({ race: old }), { isNew: false })).not.toContain('old');
    });

    test('9. the same runner twice that day', () => {
        expect(codes(result(), { sameDay: [{ memberId: 'm1', racename: 'Turkey Chase 5K' }] })).toContain('same-day');
    });

    test('10. parkrun on the wrong day', () => {
        expect(parkrunDay(new Date('2026-11-14'))).toBe(true);   // Saturday
        expect(parkrunDay(new Date('2026-11-26'))).toBe(true);   // Thanksgiving
        expect(parkrunDay(new Date('2026-12-25'))).toBe(true);
        expect(parkrunDay(new Date('2026-11-13'))).toBe(false);
        const parkrun = Object.assign({}, result().race, { racename: 'Kensington parkrun #384', racetype: road5k, racedate: new Date('2026-11-13') });
        expect(codes(result({ race: parkrun, time: 120000 }))).toContain('parkrun-day');
    });
});

describe('race and location', () => {
    test('11. a race with this name and date but other details', () => {
        const other = { _id: 'race9', racename: 'Turkey Chase 10K', racedate: new Date('2026-11-08'), location: { country: 'USA', state: 'VA' }, racetype: road10k };
        const warnings = checkResult(result(), { now, members: [robert], sameNameRaces: [other] });
        const w = warnings.find(x => x.code === 'near-duplicate-race');
        expect(w.message).toContain('state VA');
        expect(w.race._id).toBe('race9');
    });

    test('12. different from the race\'s other editions', () => {
        const edition = { _id: 'e1', racename: 'Turkey Chase 10K', racedate: new Date('2025-11-27'), location: { country: 'USA', state: 'MD' }, racetype: road10k };
        expect(codes(result(), { editions: [edition] })).toEqual([]);
        expect(codes(result(), { editions: [Object.assign({}, edition, { location: { country: 'USA', state: 'VA' } })] })).toContain('edition-place');
        expect(codes(result(), { editions: [Object.assign({}, edition, { racetype: road5k })] })).toContain('edition-distance');
        expect(codes(result(), { editions: [Object.assign({}, edition, { racedate: new Date('2025-06-01') })] })).toContain('edition-date');
        expect(daysApartInYear(new Date('2025-12-30'), new Date('2026-01-03'))).toBe(4);
    });

    test('13. a state in the name', () => {
        expect(statesInName('West Virginia Trail Half').map(s => s.code)).toEqual(['WV']);
        expect(statesInName('Philadelphia Marathon')).toEqual([]);
        const named = Object.assign({}, result().race, { racename: 'Virginia 10K Classic' });
        expect(codes(result({ race: named }))).toContain('state-in-name');
    });

    test('14. a distance in the name', () => {
        expect(distancesInName('Turkey Chase 10K')).toEqual([10000]);
        expect(distancesInName('Cherry Blossom 10 (9.39) Miler').map(Math.round)).toEqual([16093, 15112]);
        expect(distancesInName('Going Green Track Meet 4x400')).toEqual([]);
        expect(distancesInName('Riley\'s Rumble Half Marathon')).toEqual([21097.5]);
        expect(distancesInName('Black Hill "10K"')).toEqual([10000]);
        const wrong = Object.assign({}, result().race, { racetype: road5k });
        expect(codes(result({ race: wrong, time: 110000 }))).toContain('distance-in-name');
        // Black Hill "10K" is 6.1 miles: close enough
        const blackHill = Object.assign({}, result().race, { racename: 'Black Hill "10K"', racetype: trail });
        expect(codes(result({ race: blackHill, time: 284200 }))).not.toContain('distance-in-name');
    });
});

describe('runners', () => {
    test('15. relays', () => {
        expect(relayRunners({ racename: 'Going Green 4x400' })).toEqual({ exactly: 4 });
        const relay = Object.assign({}, result().race, { racename: 'Going Green 4x400', racetype: { _id: 'r4', name: '4x400', surface: 'track', meters: 1600 } });
        expect(codes(result({ race: relay, members: [robert, liz], time: 30000 }), { ageGrades: {} })).toContain('relay-runners');
        expect(codes(result({ members: [robert, liz] }), { ageGrades: {} })).toContain('relay-runners');
    });

    test('runners the site cannot age grade', () => {
        const noDob = Object.assign({}, robert, { dateofbirth: null });
        expect(codes(result({ members: [noDob] }), { ageGrades: {} })).toContain('runner-details');
    });
});
