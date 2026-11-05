const { resultStanding, ageAtDate, buildTimeDistribution } = require('../app/resultStanding');

const road5k = { name: '5k', surface: 'road' };
const race = (date, more) => Object.assign({ racedate: new Date(date), racetype: road5k }, more || {});

const ann = { _id: 'ann', sex: 'Female', dateofbirth: new Date('1990-06-15') };
const bea = { _id: 'bea', sex: 'Female', dateofbirth: new Date('1990-01-01') };
const carl = { _id: 'carl', sex: 'Male', dateofbirth: new Date('1985-03-01') };

const entry = (id, member, time, date, racename) => ({
    _id: id, time, memberId: member._id, sex: member.sex, dob: member.dateofbirth,
    racedate: new Date(date), racename: racename || 'Race ' + id
});

// Out of order on purpose
const sameDistance = [
    entry('a3', ann, 1300, '2024-05-01', 'Spring 5k'),
    entry('a1', ann, 1400, '2022-05-01'),
    entry('a2', ann, 1350, '2023-05-01', 'Earlier 5k'),
    entry('b1', bea, 1300, '2024-07-01'),
    entry('b2', bea, 1500, '2023-07-01'),
    entry('c1', carl, 1100, '2024-02-01'),
    entry('c2', carl, 1200, '2023-02-01')
];
const ofAnn = (id, more) => {
    const e = sameDistance.find(r => r._id === id);
    return { _id: id, time: e.time, members: [ann], isRecordEligible: true, category: 'Open', ...more };
};

describe('resultStanding', () => {
    const s = resultStanding({ result: ofAnn('a3'), race: race('2024-05-01'), sameDistance });

    test('team ranks: ties take the better rank and are counted', () => {
        expect(s.stats.teamAllTime).toEqual({ rank: 3, total: 7, tied: 1 });
        expect(s.stats.teamGender).toEqual({ rank: 1, total: 5, tied: 1 });
        expect(s.stats.teamYear).toEqual({ rank: 2, total: 3, tied: 1 });
        expect(s.stats.teamGenderYear).toEqual({ rank: 1, total: 2, tied: 1 });
    });

    test('personal rank and previous best as of race day', () => {
        expect(s.stats.personal).toEqual({ rank: 1, total: 3, tied: 0 });
        expect(s.stats.isPersonalBest).toBe(true);
        expect(s.stats.previousBest).toEqual({
            _id: 'a2', time: 1350, racename: 'Earlier 5k', racedate: new Date('2023-05-01'), improvement: 50
        });
    });

    test('no previous best before the first race', () => {
        const first = resultStanding({ result: ofAnn('a1'), race: race('2022-05-01'), sameDistance });
        expect(first.stats.previousBest).toBeNull();
        expect(first.stats.personal.rank).toBe(3);
    });

    test('previous best ties go to the earlier race', () => {
        const list = sameDistance.concat([entry('a0', ann, 1350, '2021-05-01', 'Earliest 5k')]);
        const later = resultStanding({ result: ofAnn('a3'), race: race('2024-05-01'), sameDistance: list });
        expect(later.stats.previousBest._id).toBe('a0');
    });

    test('age group: same sex, same age on race day', () => {
        // Ann is 33 at her 2024 race; Bea was 33 at her 2023 race, 34 in 2024
        expect(s.stats.teamAgeGroup).toEqual({ age: 33, rank: 1, total: 2, tied: 0 });
    });

    test('no age group without a date of birth', () => {
        const noDob = { ...ann, dateofbirth: null };
        const r = resultStanding({ result: ofAnn('a3', { members: [noDob] }), race: race('2024-05-01'), sameDistance });
        expect(r.stats.teamAgeGroup).toBeNull();
    });

    test('a woman opens on the women\'s histogram', () => {
        expect(s.defaultDistribution).toBe('gender');
        const men = resultStanding({
            result: { _id: 'c1', time: 1100, members: [carl], isRecordEligible: true },
            race: race('2024-02-01'), sameDistance
        });
        expect(men.defaultDistribution).toBe('all');
    });

    test('histograms need at least 8 times', () => {
        expect(s.distributions).toEqual({ all: null, gender: null, member: null });
    });

    test('nothing to rank for relays, multisport, variable distances, ineligible or untimed results', () => {
        const none = { stats: null, distributions: null, defaultDistribution: 'all' };
        const day = race('2024-05-01');
        expect(resultStanding({ result: ofAnn('a3', { members: [ann, bea] }), race: day, sameDistance })).toEqual(none);
        expect(resultStanding({ result: ofAnn('a3'), race: race('2024-05-01', { isMultisport: true }), sameDistance })).toEqual(none);
        expect(resultStanding({
            result: ofAnn('a3'), race: race('2024-05-01', { racetype: { name: 'Odd road distance', isVariable: true } }), sameDistance
        })).toEqual(none);
        expect(resultStanding({ result: ofAnn('a3', { isRecordEligible: false }), race: day, sameDistance })).toEqual(none);
        expect(resultStanding({ result: ofAnn('a3', { time: 0 }), race: day, sameDistance })).toEqual(none);
    });
});

describe('ageAtDate', () => {
    test('counts the birthday itself, never negative', () => {
        expect(ageAtDate('1990-06-15', '2024-06-14')).toBe(33);
        expect(ageAtDate('1990-06-15', '2024-06-15')).toBe(34);
        expect(ageAtDate('2025-01-01', '2024-01-01')).toBe(0);
    });
});

describe('buildTimeDistribution', () => {
    test('null under 8 times', () => {
        expect(buildTimeDistribution([1, 2, 3, 4, 5, 6, 7], 3)).toBeNull();
    });

    test('every time lands in a bucket, slow tail in the overflow bar', () => {
        // Twenty 5ks between 20:00 and 21:35, and one 45-minute walk
        const times = Array.from({ length: 20 }, (_, i) => 120000 + i * 500).concat([270000]);
        const d = buildTimeDistribution(times, 125000);
        expect(d.total).toBe(21);
        expect(d.buckets.reduce((n, b) => n + b.count, 0)).toBe(21);
        expect(d.overflowCount).toBe(1);
        expect(d.buckets[d.buckets.length - 1]).toMatchObject({ overflow: true, end: null, count: 1 });
        const marked = d.buckets[d.markIndex];
        expect(marked.start <= 125000 && 125000 < marked.end).toBe(true);
    });

    test('a slow viewed result moves the cutoff out instead of joining the overflow', () => {
        const times = Array.from({ length: 20 }, (_, i) => 120000 + i * 500).concat([270000]);
        const d = buildTimeDistribution(times, 270000);
        expect(d.overflowCount).toBe(0);
        expect(d.buckets[d.markIndex].count).toBeGreaterThan(0);
    });
});
