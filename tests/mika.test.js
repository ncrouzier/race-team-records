const mika = require('../app/mika');

// The bookmark's copy (public/bookmarklets/results.js, mika())
const copy = extra => Object.assign({
    mcrrcMika: 1, url: 'https://results.baa.org/2026/', host: 'results.baa.org', year: '2026',
    pageTitle: 'Boston Athletic Association', event: 'R', eventName: 'Runner',
    totals: { overall: 29037, gender: { M: 16346, W: 12588 }, groups: { 'M|9': 2414, 'W|9': 1900 } },
    runners: [
        { first: 'Ann', last: 'Lee', bib: '19556', sex: 'Female', sexCode: 'W', group: '45-49', groupCode: '9',
            overall: 16767, genderPlace: 5975, groupPlace: 361, time: '03:37:04' },
        { first: 'Bob', last: 'Kim', bib: '12706', sex: 'Male', sexCode: 'M', group: '45-49', groupCode: '9',
            overall: 16245, genderPlace: 10497, groupPlace: 1828, time: '03:35:03', nation: 'USA', home: 'Garrett Park' }
    ],
    searched: 2
}, extra);

describe('mika:timing copy', () => {
    test('recognised, or not', () => {
        expect(mika.fromPaste(JSON.stringify(copy()))).toMatchObject({ mcrrcMika: 1 });
        expect(mika.fromPaste('{"mcrrcAthlinks":1,"results":[]}')).toBeNull();
        expect(mika.fromPaste('{broken')).toBeNull();
    });

    test('each place with what it is out of; a known race named and placed', () => {
        const out = mika.toExtraction(copy());
        expect(out.headers).toEqual(mika.HEADERS);
        // fastest first: Bob (3:35:03) before Ann (3:37:04)
        expect(out.data[0]).toEqual({
            Place: '16245/29037', Name: 'Bob Kim', Gender: 'M', 'Age Group': 'M45-49', Bib: '12706', Time: '03:35:03',
            'Gender Place': '10497/16346', 'Division Place': '1828/2414', Home: 'Garrett Park', Country: 'USA'
        });
        expect(out.data[1]).toMatchObject({ Gender: 'F', 'Age Group': 'F45-49', 'Gender Place': '5975/12588', 'Division Place': '361/1900' });
        expect(mika.toExtraction(copy({ raceDay: '2026-04-20' })).raceDay).toBe('2026-04-20');
        expect(mika.toExtraction(copy({ raceDay: 'soon' })).raceDay).toBeUndefined();
        expect(out).toMatchObject({ pageTitle: 'Boston Marathon 2026', distance: '26.2 miles', wholeField: false,
            location: { country: 'USA', state: 'MA' }, total: 29037, notes: null, resultUrl: 'https://results.baa.org/2026/' });
    });

    test('a column the site does not list: blank, and said', () => {
        const runners = copy().runners.map(r => Object.assign({}, r, { groupPlace: null }));
        const out = mika.toExtraction(copy({ runners }));
        expect(out.data.map(r => r['Division Place'])).toEqual(['', '']);
        expect(out.notes).toMatch(/no age group place/);
    });

    test('an unknown race on the system: named after its page; a total not counted stays off', () => {
        const out = mika.toExtraction(copy({ host: 'results.example-marathon.org', pageTitle: 'Example Marathon',
            totals: { overall: 500, gender: {}, groups: {} } }));
        expect(out).toMatchObject({ pageTitle: 'Example Marathon 2026', distance: '26.2 miles' });
        expect(out.location).toBeUndefined();
        expect(out.data[0]['Gender Place']).toBe('10497');
    });

    test('no finish time, no row', () => {
        const runners = copy().runners.concat([{ first: 'Cy', last: 'Lee', time: '' }]);
        expect(mika.toExtraction(copy({ runners })).data).toHaveLength(2);
    });

    test('one runner found by two searches ("Meg" and "Megan") is one row', () => {
        const megan = { first: 'Megan', last: 'Ryan', sex: 'Female', sexCode: 'W', overall: 8833, time: '03:15:52' };
        const runners = [
            Object.assign({ href: '?content=detail&idp=9TGHS6FF1ADAE2&search%5Bfirstname%5D=Meg' }, megan),
            Object.assign({ href: '?content=detail&idp=9TGHS6FF1ADAE2&search%5Bfirstname%5D=Megan' }, megan)
        ];
        expect(mika.toExtraction(copy({ runners })).data).toHaveLength(1);
    });
});
