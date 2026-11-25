const { eventBase, latestResultsUrl, eventResultsUrl, dateResultsUrl, linkVariants, buildList, eventNumberOf, parkrunMetadata } = require('../app/parkrunCheck');
const { formatDuration } = require('../app/resultTableParser');

describe('eventBase', () => {
    test.each([
        ['https://www.parkrun.us/fletcherscove/results/8/', 'https://www.parkrun.us', 'fletcherscove'],
        ['http://parkrun.us/kensington/results/384', 'https://parkrun.us', 'kensington'],
        ['https://www.parkrun.us/Kensington/results/latestresults/', 'https://www.parkrun.us', 'kensington'],
        ['https://www.parkrun.org.uk/bushy/results/1000/', 'https://www.parkrun.org.uk', 'bushy'],
        ['https://www.parkrun.com.au/albertmelbourne/results/12/', 'https://www.parkrun.com.au', 'albertmelbourne'],
        ['https://www.parkrun.fr/montsouris/results/46/', 'https://www.parkrun.fr', 'montsouris'],
    ])('%s is %s / %s', (link, origin, slug) => {
        expect(eventBase(link)).toEqual({ origin, slug });
    });

    test.each([
        'https://www.mcrrc.org/race-result/x/',
        'https://parkrun.us.evil.com/kensington/results/1/',
        'https://www.parkrun.us/parkrunner/123456/',
        'https://www.parkrun.us/kensington/',
        'ftp://www.parkrun.us/kensington/results/1/',
        'not a url',
        '',
        null,
    ])('%s is not a parkrun results page', (link) => {
        expect(eventBase(link)).toBeNull();
    });

    test('the latest results, an event page and a day\'s results', () => {
        const base = eventBase('https://www.parkrun.us/fletcherscove/results/8/');
        expect(latestResultsUrl(base)).toBe('https://www.parkrun.us/fletcherscove/results/latestresults/');
        expect(eventResultsUrl(base, 9)).toBe('https://www.parkrun.us/fletcherscove/results/9/');
        expect(dateResultsUrl(base, '2024-05-04')).toBe('https://www.parkrun.us/fletcherscove/results/2024-05-04/');
    });

    test('a saved link matches whatever its spelling', () => {
        const v = linkVariants('https://www.parkrun.us/kensington/results/385/');
        for (const s of ['https://www.parkrun.us/kensington/results/385/', 'http://parkrun.us/kensington/results/385',
            'https://parkrun.us/kensington/results/385/', 'http://www.parkrun.us/kensington/results/385']) {
            expect(v).toContain(s);
        }
    });
});

describe('buildList', () => {
    const now = new Date('2026-11-21T12:00:00Z');
    const day = (iso) => new Date(iso + 'T00:00:00Z');
    const race = (name, date, state) => ({ racename: name, racedate: day(date), location: { country: 'USA', state: state || 'MD' } });
    const runs = (name, n, firstDate) => Array.from({ length: n }, (_, i) =>
        race(name + ' #' + (i + 1), new Date(day(firstDate).getTime() + i * 7 * 864e5).toISOString().slice(0, 10)));

    test('the most run and the recent ones, most run first; old one-offs left out', () => {
        const races = [
            ...runs('Kensington parkrun', 6, '2025-01-04'),
            ...runs('College Park parkrun', 9, '2024-01-06'),
            race('Scarborough parkrun #300', '2026-10-11', null),
            race('parkrun de Montsouris #46', '2017-09-16'),
            race('Leakin Park parkrun #10', '2026-08-15'), // over 3 months ago, once
            race('Cherry Blossom 10 Miler', '2026-04-05'),
        ];
        const list = buildList(races, [], { now });
        expect(list.map(p => [p.name, p.runs])).toEqual([
            ['College Park parkrun', 9], ['Kensington parkrun', 6], ['Scarborough parkrun', 1]]);
        expect(list[1]).toMatchObject({ lastRacename: 'Kensington parkrun #6', lastDate: day('2025-02-08'),
            lastEvent: { eventNumber: 6, day: '2025-02-08' } });
    });

    test('each address comes from the most recent saved result linking to it', () => {
        const races = runs('Kensington parkrun', 5, '2026-01-03');
        const links = [
            { racename: 'Kensington parkrun #1', racedate: day('2026-01-03'), resultlink: 'https://www.parkrun.us/kensington/results/1/' },
            { racename: 'Kensington parkrun #5', racedate: day('2026-01-31'), resultlink: 'https://www.parkrun.us/kensingtonnew/results/5/' },
            { racename: 'Kensington parkrun #4', racedate: day('2026-01-24'), resultlink: 'https://www.mcrrc.org/whatever' },
        ];
        expect(buildList(races, links, { now })[0].latestUrl).toBe('https://www.parkrun.us/kensingtonnew/results/latestresults/');
    });

    test('a parkrun with no link to its results is listed, without an address', () => {
        const list = buildList([race('Foster parkrun #2', '2026-11-14')], [], { now });
        expect(list).toEqual([expect.objectContaining({ name: 'Foster parkrun', latestUrl: null })]);
    });

    test('the latest race gives the name and the location to prefill', () => {
        const list = buildList([race('Anacostia parkrun #1', '2026-10-03', 'DC'), race('anacostia parkrun #2', '2026-10-10', 'DC')], [], { now });
        expect(list).toEqual([expect.objectContaining({ runs: 2, lastRacename: 'anacostia parkrun #2', location: { country: 'USA', state: 'DC' } })]);
    });
});

describe('event numbers', () => {
    test('the event number in a race name', () => {
        expect(eventNumberOf('Kensington parkrun #384')).toBe(384);
        expect(eventNumberOf('Kensington parkrun')).toBeNull();
    });
});

describe('parkrunMetadata', () => {
    const page = (date, number) => '<div class="Results-header"><h1>Kensington parkrun</h1>' +
        '<h3><span class="format-date">' + date + '</span><span class="spacer">|</span><span>#' + number + '</span></h3></div>';

    test.each([
        ['2026-11-14', 'parkrun.us, since 2026'],
        ['14/11/2026', 'the other parkrun sites'],
    ])('the event, its number and its day from %s (%s)', (date) => {
        const meta = parkrunMetadata(page(date, 384));
        expect(meta).toMatchObject({ pageTitle: 'Kensington parkrun #384', eventNumber: 384, raceDay: '2026-11-14' });
        expect(meta.raceDate.getFullYear()).toBe(2026);
        expect(meta.raceDate.getMonth()).toBe(10);
        expect(meta.raceDate.getDate()).toBe(14);
    });

    test('not a parkrun page', () => {
        expect(parkrunMetadata('<h1>Turkey Chase</h1>')).toBeNull();
    });
});

describe('formatDuration (Athlinks times)', () => {
    test.each([
        [1499500, '25:00'],   // 24:59.5 rounds up, and never to "24:60"
        [1499000, '24:59'],
        [1080001, '18:01'],
        [3723000, '1:02:03'],
        [3599100, '1:00:00'],
        [null, ''], [0, ''], [undefined, ''],
    ])('%s ms is "%s"', (ms, text) => {
        expect(formatDuration(ms)).toBe(text);
    });
});
