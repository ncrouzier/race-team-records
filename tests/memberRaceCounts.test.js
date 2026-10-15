const { memberRaceCounts } = require('../app/memberRaceCounts');

const road5k = { name: '5k', surface: 'road' };
const road10k = { name: '10k', surface: 'road' };
const trail = { name: 'Odd trail distance', surface: 'trail', isVariable: true };

const entry = (id, date, racetype, more) => ({
    _id: id,
    race: Object.assign({ _id: 'race-' + id, racename: 'Race ' + id, racedate: new Date(date), racetype }, more || {})
});

// Out of order on purpose: counting follows the race dates
const history = [
    entry('d', '2024-04-06', road10k, { _id: 'cb24' }),
    entry('a', '2022-03-01', road5k),
    entry('c', '2023-11-24', road5k),
    entry('b', '2023-04-02', road10k, { _id: 'cb23' }),
    entry('e', '2024-06-01', trail),
    entry('f', '2024-06-01', road5k, { order: 1 }) // same day, later race
];
const series = { _id: 's1', name: 'Cherry Blossom 10 Miler', raceIds: new Set(['cb23', 'cb24']) };
const of = id => history.find(r => r._id === id);

describe('memberRaceCounts', () => {
    test('Nth race overall, in date order', () => {
        expect(memberRaceCounts({ result: of('d'), history, series: null }).overall).toEqual({ n: 4, of: 6 });
    });

    test('Nth on this surface, at this distance, this year', () => {
        const c = memberRaceCounts({ result: of('d'), history, series: null });
        expect(c.surface).toEqual({ surface: 'road', n: 4, of: 5 });
        expect(c.distance).toEqual({ name: '10k', surface: 'road', n: 2, of: 2 });
        expect(c.year).toEqual({ year: 2024, n: 1, of: 3 });
    });

    test('Nth time at this race series', () => {
        expect(memberRaceCounts({ result: of('d'), history, series }).series)
            .toEqual({ _id: 's1', name: 'Cherry Blossom 10 Miler', n: 2, of: 2 });
    });

    test('the race before, and how long ago', () => {
        const c = memberRaceCounts({ result: of('d'), history, series: null });
        expect(c.previous).toMatchObject({ resultId: 'c', days: 134 });
    });

    test('same-day races follow their order', () => {
        const c = memberRaceCounts({ result: of('f'), history, series: null });
        expect(c.overall.n).toBe(6);
        expect(c.previous).toMatchObject({ resultId: 'e', days: 0 });
    });

    test('a variable distance has no distance count', () => {
        expect(memberRaceCounts({ result: of('e'), history, series: null }).distance).toBeNull();
    });

    test('the first race has no race before it', () => {
        const c = memberRaceCounts({ result: of('a'), history, series: null });
        expect(c.overall).toEqual({ n: 1, of: 6 });
        expect(c.previous).toBeNull();
    });
});
