const athlinks = require('../app/athlinks');


const ATHLINKS_URL = 'https://www.athlinks.com/event/386693/results/Event/1133982/Course/2670521/Results';

// A runner as Athlinks' results feed has it (the fields read)
const feedRunner = i => ({
    displayName: 'Runner ' + i, gender: i % 2 ? 'M' : 'F', age: 30 + i, bib: String(100 + i),
    chipTimeInMillis: 1499500 + i * 1000, startTimeInMillis: Date.UTC(2026, 7, 23, 23, 30),
    rankings: { overall: i, gender: Math.ceil(i / 2), primary: 1 }, somethingElse: 'x'
});
// A feed answer: `count` runners from `from`, of `total`
const feedPage = (from, count, total) => ({
    race: { name: 'Twilight 5K' },
    division: { totalAthletes: total },
    intervals: [{ distance: { meters: 5000 }, results: Array.from({ length: count }, (_, i) => feedRunner(from + i + 1)) }]
});

describe('athlinks', () => {
    test('the event and course in an address', () => {
        expect(athlinks.parseUrl(ATHLINKS_URL)).toEqual({ eventId: '1133982', raceId: '2670521' });
        expect(athlinks.parseUrl('https://www.athlinks.com/event/386693')).toBeNull();
    });

    test('an evening race is that day in Eastern time, not the next one in UTC', () => {
        expect(athlinks.eventDay(Date.UTC(2026, 7, 23, 23, 30))).toBe('2026-08-23');
        expect(athlinks.eventDay(Date.UTC(2026, 0, 10, 13, 0))).toBe('2026-01-10');
        expect(athlinks.eventDay(null)).toBeNull();
    });

    test('the runners as the extractor\'s table, with the race\'s name, day and distance', () => {
        const payload = { mcrrcAthlinks: 1, url: ATHLINKS_URL, raceName: 'Twilight 5K', total: 3, distance: { meters: 5000 },
            results: [1, 2].map(i => athlinks.runnerOf(feedRunner(i))).concat([{ name: 'No Time', overall: null }]) };
        const out = athlinks.toExtraction(payload);
        expect(out.headers).toEqual(athlinks.HEADERS);
        expect(out.data[0]).toEqual({ Place: '1', Name: 'Runner 1', Gender: 'M', Age: '31', Bib: '101',
            Time: '25:01', 'Gender Place': '1', 'Division Place': '1' });
        expect(out.data[2]).toMatchObject({ Name: 'No Time', Time: '', Place: '' });
        expect(out).toMatchObject({ pageTitle: 'Twilight 5K', raceDay: '2026-08-23', distance: '3.11 miles',
            total: 3, truncated: false, resultUrl: ATHLINKS_URL });
    });

    test('a paste is the bookmarklet\'s output, or not', () => {
        expect(athlinks.fromPaste(JSON.stringify({ mcrrcAthlinks: 1, results: [] }))).toEqual({ mcrrcAthlinks: 1, results: [] });
        expect(athlinks.fromPaste('<html><table></table></html>')).toBeNull();
        expect(athlinks.fromPaste('{"results": []}')).toBeNull();
        expect(athlinks.fromPaste('{not json')).toBeNull();
    });

    test('from the server: every page, stopping at the total', async () => {
        const calls = [];
        const get = url => {
            calls.push(url);
            const from = parseInt(/from=(\d+)/.exec(url)[1], 10);
            return Promise.resolve({ data: feedPage(from, Math.min(100, 250 - from), 250) });
        };
        const payload = await athlinks.fetchAthlinks(ATHLINKS_URL, get);
        expect(payload.results).toHaveLength(250);
        expect(calls).toHaveLength(3);
        expect(calls[2]).toContain('/event/1133982/race/2670521/results?from=200&limit=100');
    });

    test('from the server: a refusal points to the bookmarklet', async () => {
        const get = () => Promise.reject(Object.assign(new Error('403'), { response: { status: 403 } }));
        await expect(athlinks.fetchAthlinks(ATHLINKS_URL, get)).rejects.toMatchObject({
            blocked: true, message: expect.stringContaining('Results → clipboard')
        });
    });

    test('from the server: a feed that never ends stops at MAX_PAGES', async () => {
        let calls = 0;
        const get = () => { calls++; return Promise.resolve({ data: feedPage(0, 100, 0) }); };
        const payload = await athlinks.fetchAthlinks(ATHLINKS_URL, get);
        expect(calls).toBe(athlinks.MAX_PAGES);
        expect(payload.results).toHaveLength(athlinks.MAX_PAGES * 100);
    });

    describe('age groups, worked out from the division places', () => {
        // Runners in finishing order, each placed in its group as the scheme cuts them
        function race(people, groupOf) {
            const counts = {};
            return people.map(([gender, age], i) => {
                const group = gender + groupOf(age);
                counts[group] = (counts[group] || 0) + 1;
                return { name: 'R' + i, gender, age, overall: i + 1, divisionPlace: counts[group], chipTime: 1500000 + i * 1000 };
            });
        }
        const people = [['M', 41], ['M', 37], ['F', 44], ['M', 43], ['F', 29], ['M', 52], ['F', 61], ['M', 9], ['M', 87],
            ['F', 33], ['M', 44], ['M', 82], ['F', 47], ['M', 12], ['M', 38]];

        test('5-year groups, under 15, 80+ (as a real race had them): the groups and their sizes', () => {
            const groupOf = a => (a < 15 ? '0-14' : a >= 80 ? '80+' : Math.floor(a / 5) * 5 + '-' + (Math.floor(a / 5) * 5 + 4));
            const out = athlinks.toExtraction({ results: race(people, groupOf) });
            expect(out.headers).toContain('Age Group');
            expect(out.data.map(r => r['Age Group'])).toEqual(people.map(([g, a]) => g + groupOf(a)));
        });

        test('10-year groups', () => {
            const groupOf = a => Math.floor(a / 10) * 10 + '-' + (Math.floor(a / 10) * 10 + 9);
            expect(athlinks.ageGroups(race(people, groupOf))).toBeTruthy();
        });

        test('places no scheme gives back: no groups, not a guess', () => {
            const runners = race(people, () => 'all').map((r, i) => Object.assign(r, { divisionPlace: (i % 3) + 1 }));
            const out = athlinks.toExtraction({ results: runners });
            expect(athlinks.ageGroups(runners)).toBeNull();
            expect(out.headers).not.toContain('Age Group');
        });

        test('too few runners to tell', () => {
            expect(athlinks.ageGroups(race(people.slice(0, 5), a => a))).toBeNull();
        });
    });
});
