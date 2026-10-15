const {
    normalizeRaceName, parkrunName, seriesKey, proposeSeries, describeSeries, findSeriesForRace,
    similarNames, findPossibleMerges
} = require('../app/raceSeriesMatcher');

const FIVE_K = { name: '5k', isVariable: false };
const TEN_MILES = { name: '10 miles', isVariable: false };
const ODD_ROAD = { name: 'Odd road distance', isVariable: true };

function race(racename, racedate, racetype = FIVE_K, state = 'MD') {
    return { _id: racename + racedate, racename, racedate: new Date(racedate), racetype, location: { country: 'USA', state } };
}

describe('normalizeRaceName', () => {
    test.each([
        ['Cherry Blossom 10 (9.39) Miler', 'Cherry Blossom 10 Miler'],
        ['Cherry Blossom 10 Miler 2015', 'Cherry Blossom 10 Mile'],
        ['45th Annual Turkey Chase 10K', 'Turkey Chase 10K'],
        ['Cold Turkey "10K"', 'Cold Turkey 10 K'],
        ['Fletcher’s Cove 5K', "Fletcher's Cove 5K"],
        ['IRONMAN 70.3 ST. GEORGE', 'Ironman 70.3 St George'],
    ])('%s matches %s', (a, b) => {
        expect(normalizeRaceName(a)).toBe(normalizeRaceName(b));
    });

    test('keeps the distance that tells races at one meet apart', () => {
        expect(normalizeRaceName('Going Green Track Meet 1 Mile'))
            .not.toBe(normalizeRaceName('Going Green Track Meet 4x400'));
    });
});

describe('parkruns', () => {
    test('event number is not part of the series', () => {
        expect(parkrunName('Kensington parkrun #313')).toBe('Kensington parkrun');
        expect(seriesKey({ racename: 'Kensington parkrun #313' }))
            .toBe(seriesKey({ racename: 'Kensington parkrun #12' }));
    });

    test('different parks are different series', () => {
        expect(seriesKey({ racename: 'Kensington parkrun #1' }))
            .not.toBe(seriesKey({ racename: 'College Park parkrun #1' }));
    });

    test('a parkrun named "parkrun de X"', () => {
        expect(parkrunName('parkrun de Montsouris #46')).toBe('parkrun de Montsouris');
    });

    test('a non-parkrun is not a parkrun', () => {
        expect(parkrunName('College Park Mothers Day 5K')).toBeNull();
    });
});

describe('proposeSeries', () => {
    test('ignores the date of year', () => {
        const [s] = proposeSeries([race('Boston Marathon', '2019-04-15'), race('Boston Marathon', '2021-10-11')]);
        expect(s.entries).toHaveLength(2);
    });

    test('a short-course year joins the series as off-distance', () => {
        const [s, ...rest] = proposeSeries([
            race('Cherry Blossom 10 Miler', '2018-04-08', TEN_MILES, 'DC'),
            race('Cherry Blossom 10 Miler', '2022-04-03', TEN_MILES, 'DC'),
            race('Cherry Blossom 10 (9.96) Miler', '2019-04-07', ODD_ROAD, 'DC'),
        ]);
        expect(rest).toHaveLength(0);
        expect(s.racetype.name).toBe('10 miles');
        expect(s.entries.filter(e => e.offDistance).map(e => e.race.racename))
            .toEqual(['Cherry Blossom 10 (9.96) Miler']);
    });

    test('an edition in another state stays in, flagged for review', () => {
        const series = proposeSeries([
            race('Roosevelt Island DC parkrun #396', '2026-01-03', FIVE_K, 'DC'),
            race('Roosevelt Island DC parkrun #416', '2026-06-20', FIVE_K, 'DC'),
            race('Roosevelt Island DC parkrun #193', '2021-11-06', FIVE_K, 'MD'),
        ]);
        expect(series).toHaveLength(1);
        expect(series[0].location).toBe('DC');
        expect(series[0].entries.map(e => e.reason).filter(r => /state/.test(r)))
            .toEqual(['same parkrun; different state (MD; series is mostly in DC)']);
    });

    test('a single race is not a series', () => {
        expect(proposeSeries([race('One Off 5K', '2020-01-01')])).toEqual([]);
    });

    test('weekly parkruns are one series named after the park', () => {
        const [s] = proposeSeries([
            race('Kensington parkrun #313', '2024-01-06'),
            race('Kensington parkrun #314', '2024-01-13'),
        ]);
        expect(s.entries).toHaveLength(2);
        expect(s.name).toBe('Kensington parkrun');
    });
});

describe('findSeriesForRace', () => {
    const cb2018 = race('Cherry Blossom 10 Miler', '2018-04-08', TEN_MILES, 'DC');
    const cherry = describeSeries({ name: 'Cherry Blossom 10 Miler', racetype: TEN_MILES, rejected: [] }, [cb2018]);

    test('a new edition matches its series', () => {
        const m = findSeriesForRace(race('Cherry Blossom 10 Miler', '2027-04-04', TEN_MILES, 'DC'), [cherry]);
        expect(m.series.name).toBe('Cherry Blossom 10 Miler');
        expect(m.offDistance).toBe(false);
    });

    test('a short course matches as off-distance', () => {
        const m = findSeriesForRace(race('Cherry Blossom 10 (9.39) Miler', '2027-04-04', ODD_ROAD, 'DC'), [cherry]);
        expect(m.offDistance).toBe(true);
    });

    test('another fixed distance is a different race', () => {
        expect(findSeriesForRace(race('Cherry Blossom 10 Miler', '2027-04-04', FIVE_K, 'DC'), [cherry])).toBeNull();
    });

    test('a relocated race is still suggested, with the reason', () => {
        const m = findSeriesForRace(race('Cherry Blossom 10 Miler', '2027-04-04', TEN_MILES, 'VA'), [cherry]);
        expect(m.reason).toMatch(/different state \(VA; series is in DC\)/);
    });

    test('prefers the series in the same state', () => {
        const md = describeSeries({ name: 'Turkey Trot 5K', racetype: FIVE_K }, [race('Turkey Trot 5K', '2023-11-23', FIVE_K, 'MD')]);
        const pa = describeSeries({ name: 'Turkey Trot 5K', racetype: FIVE_K }, [race('Turkey Trot 5K', '2023-11-23', FIVE_K, 'PA')]);
        expect(findSeriesForRace(race('Turkey Trot 5K', '2025-11-27', FIVE_K, 'PA'), [md, pa]).series).toBe(pa.series);
    });

    test('never re-suggests a rejected race', () => {
        const r = race('Cherry Blossom 10 Miler', '2027-04-04', TEN_MILES, 'DC');
        const d = describeSeries({ name: 'Cherry Blossom 10 Miler', racetype: TEN_MILES, rejected: [r._id] }, [cb2018]);
        expect(findSeriesForRace(r, [d])).toBeNull();
    });
});

describe('similarNames (possible merges only)', () => {
    const k = normalizeRaceName;
    test.each([
        ['Wood Acres Jogfest 5K', 'Woodacres Jogfest 5K'],
        ['Frederick Summer Solstice 8K', 'Frederick Sumer Solstice 8K'],
        ['Turkey Chase 10K', 'Bethesda Turkey Chase 10K'],
    ])('%s ~ %s', (a, b) => {
        expect(similarNames(k(a), k(b))).not.toBeNull();
    });

    test('short names are not compared letter by letter', () => {
        expect(similarNames(k("Leo's Run"), k("Ben's Run"))).toBeNull();
    });

    test('pairs only races at the same distance, and never two lone races', () => {
        const items = [
            { key: k('Turkey Chase 10K'), racetypeName: '10k', isSeries: true },
            { key: k('Bethesda Turkey Chase 10K'), racetypeName: '10k', isSeries: false },
            { key: k('Bethesda Turkey Chase 10K'), racetypeName: '5k', isSeries: false },
            { key: k('Woodacres Jogfest 5K'), racetypeName: '5k', isSeries: false },
            { key: k('Wood Acres Jogfest 5K'), racetypeName: '5k', isSeries: false },
        ];
        expect(findPossibleMerges(items)).toHaveLength(1);
    });
});
