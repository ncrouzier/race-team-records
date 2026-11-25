const { parseUrl, resultSetsFromPage, pickResultSet, buildTable, eventInfo, fetchRunSignUp } = require('../app/runsignup');

describe('parseUrl', () => {
    test.each([
        ['https://runsignup.com/Race/Results/108889', '108889', null],
        ['https://runsignup.com/Race/Results/108889#resultSetId-734286;perpage:100', '108889', '734286'],
        ['https://runsignup.com/Race/Results/60154?resultSetId=349753', '60154', '349753'],
        // Both: the one after the # is what the page showed
        ['https://runsignup.com/Race/Results/84732/?eventId=1051665&resultSetId=692372#resultSetId-692437;perpage:100', '84732', '692437'],
    ])('%s', (url, raceId, resultSetId) => {
        expect(parseUrl(url)).toEqual({ raceId, resultSetId });
    });

    test('not a RunSignUp results address', () => {
        expect(parseUrl('https://runsignup.com/Race/MD/Baltimore/Port2Fort')).toBeNull();
    });
});

// The result set list as the race's results page has it (trimmed)
const PAGE = `<title>Port to Fort 6K Results</title><select id="resultsSelect">
    <option value="" data-year="2026">--- Select Result Set ---</option>
    <option value="734286" data-year="2026" data-has-top-finishers="T">
        Adult Individual Runner Overall Results
    </option>
    <option value="617590" data-year="2026">Virtual Runner (Virtual Registration)</option>
    <option value="" data-year="2026" data-url="/Race/Results/108889/IndividualResult/2026">Participant Lookup</option>
    <option value="559287" data-year="2025">Adult Individual Runner Overall Results</option>
</select>`;

describe('result sets', () => {
    test('the sets the page offers', () => {
        expect(resultSetsFromPage(PAGE)).toEqual([
            { id: '734286', year: 2026, name: 'Adult Individual Runner Overall Results' },
            { id: '617590', year: 2026, name: 'Virtual Runner (Virtual Registration)' },
            { id: '559287', year: 2025, name: 'Adult Individual Runner Overall Results' },
        ]);
    });

    test('this year\'s only real one is taken; several, or none, are the admin\'s pick', () => {
        expect(pickResultSet(resultSetsFromPage(PAGE)).id).toBe('734286');
        expect(pickResultSet([
            { id: '1', year: 2026, name: '5K' }, { id: '2', year: 2026, name: '10K' }])).toBeNull();
        expect(pickResultSet([])).toBeNull();
    });
});

// The results feed (trimmed)
const headings = [
    { name: 'Place', key: 'race_placement' }, { name: 'Name', key: 'name' },
    { name: 'Gender', key: 'gender' }, { name: 'Age Place', key: 'division_place' },
    { name: 'Age Group', key: 'division' }, { name: 'Chip Time', key: 'chip_time' },
    { name: 'Clock Time', key: 'clock_time', hidden: true },
];
const feedPage = (results, numResults) => ({
    headings,
    resultSet: { numResults, results, setInfo: { race_category_id: 1093134, individual_result_set_name: 'Adult Overall' } }
});

describe('buildTable', () => {
    test('visible columns only; an award division and its place left blank', () => {
        const table = buildTable([feedPage([
            [1, 'Stephen Porembski', 'M', '1', 'M Top Finishers', '21:43.662', '21:44'],
            [6, 'Phil Roth', 'M', '1', 'M4049', '24:06.801', '24:07'],
            [7, 'Peter Borger', 'M', '1', 'OVL_M', '24:10', ''],
            [826, 'Alexa Walker', 'F', null, '', '', ''],
        ], 4)]);
        expect(table.headers).toEqual(['Place', 'Name', 'Gender', 'Age Place', 'Age Group', 'Chip Time']);
        expect(table.data[0]).toMatchObject({ 'Age Place': '', 'Age Group': '' });
        expect(table.data[1]).toMatchObject({ 'Age Place': '1', 'Age Group': 'M4049', 'Chip Time': '24:06.801' });
        expect(table.data[2]).toMatchObject({ 'Age Place': '', 'Age Group': '' });
        expect(table.data[3]).toEqual({ Place: '826', Name: 'Alexa Walker', Gender: 'F', 'Age Place': '', 'Age Group': '', 'Chip Time': '' });
    });
});

describe('eventInfo', () => {
    const race = {
        address: { state: 'MD', country_code: 'US' },
        events: [{ event_id: 1093134, start_time: '10/24/2026 08:30', distance: '3.76 Miles' },
            { event_id: 921262, start_time: '10/25/2025 08:30', distance: '3.76 Miles' }]
    };

    test('the event\'s day and distance, the race\'s state', () => {
        expect(eventInfo(race, 921262)).toEqual({ raceDay: '2025-10-25', distance: '3.76 Miles', location: { country: 'USA', state: 'MD' } });
    });

    test('an event not listed, a race abroad', () => {
        expect(eventInfo({ address: { country_code: 'CA', state: 'ON' }, events: [] }, 1)).toEqual({});
    });
});

describe('fetchRunSignUp', () => {
    const race = { race: { address: { state: 'DC', country_code: 'US' }, events: [{ event_id: 1093134, start_time: '9/20/2026 07:00', distance: '13.1 Miles' }] } };
    const runner = i => [i, 'Runner ' + i, 'F', '', 'F3039', '1:50:00', ''];

    function fakeGet(pages, calls) {
        return url => {
            calls.push(url);
            if (url.includes('/Rest/race/')) return Promise.resolve({ data: race });
            if (url.includes('format=json')) {
                const n = parseInt(/page=(\d+)/.exec(url)[1], 10);
                return Promise.resolve({ data: pages[n - 1] });
            }
            return Promise.resolve({ data: PAGE });
        };
    }

    test('page after page until every runner is in, with the date, distance and state', async () => {
        const calls = [];
        const pages = [feedPage([runner(1), runner(2)], 5), feedPage([runner(3), runner(4)], 5), feedPage([runner(5)], 5)];
        const out = await fetchRunSignUp('https://runsignup.com/Race/Results/84732#resultSetId-692437', fakeGet(pages, calls));
        expect(out.data).toHaveLength(5);
        expect(out).toMatchObject({ truncated: false, total: 5, raceDay: '2026-09-20', distance: '13.1 Miles',
            location: { country: 'USA', state: 'DC' }, resultSetName: 'Adult Overall', pageTitle: 'Port to Fort 6K' });
        expect(calls.filter(u => u.includes('/Race/Results/') && u.includes('format=json'))).toHaveLength(3);
        expect(calls.every(u => !u.includes('resultSetId=null'))).toBe(true);
    });

    test('no set in the address: this year\'s only real one', async () => {
        const calls = [];
        const out = await fetchRunSignUp('https://runsignup.com/Race/Results/108889', fakeGet([feedPage([runner(1)], 1)], calls));
        expect(out.resultSetId).toBe('734286');
        expect(calls.some(u => u.includes('resultSetId=734286'))).toBe(true);
    });

    test('several possible: the list, for the admin to pick', async () => {
        const page = PAGE.replace('Virtual Runner (Virtual Registration)', '10K Overall');
        const out = await fetchRunSignUp('https://runsignup.com/Race/Results/108889',
            url => Promise.resolve({ data: url.includes('format=json') ? null : page }));
        expect(out.needsChoice).toBe(true);
        expect(out.resultSets.map(s => s.id)).toEqual(['734286', '617590', '559287']);
    });

    test('the race API failing costs the date, not the results', async () => {
        const get = url => url.includes('/Rest/race/') ? Promise.reject(new Error('down'))
            : Promise.resolve({ data: url.includes('format=json') ? feedPage([runner(1)], 1) : PAGE });
        const out = await fetchRunSignUp('https://runsignup.com/Race/Results/1#resultSetId-2', get);
        expect(out.data).toHaveLength(1);
        expect(out.raceDay).toBeUndefined();
    });
});
