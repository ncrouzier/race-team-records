const { rosterOn, parseDay } = require('../app/bookmarkletRoster');

const member = (first, last, sex, periods, alternateFullNames) => ({
    firstname: first, lastname: last, sex, alternateFullNames,
    membershipDates: periods.map(([start, end]) => ({ start: new Date(start), end: end ? new Date(end) : null }))
});

describe('the team on a race day, for the bookmark', () => {
    // Ann left at the end of 2024; Bob joined in 2025 and is still on the
    // team; Cy has two stints; Dee has another name she races under
    const members = [
        member('Ann', 'Lee', 'Female', [['2015-01-01', '2024-12-31']]),
        member('Bob', 'Kim', 'Male', [['2025-01-01', null]]),
        member('Cy', 'Park', 'Male', [['2016-01-01', '2018-12-31'], ['2023-01-01', null]]),
        member('Dee', 'Ross', 'Female', [['2020-01-01', null]], ['Dee Ross-Hall']),
        member('Eve', 'Nobody', 'Female', [])
    ];

    test('those on the team that day, other names as more entries', () => {
        expect(rosterOn(members, parseDay('2026-04-20'))).toEqual([
            ['Bob', 'Kim', 'Male'], ['Cy', 'Park', 'Male'], ['Dee', 'Ross', 'Female'], ['Dee', 'Ross-Hall', 'Female']]);
        expect(rosterOn(members, parseDay('2017-04-17')).map(m => m[0])).toEqual(['Ann', 'Cy']);
        expect(rosterOn(members, parseDay('2024-12-31')).map(m => m[0])).toEqual(['Ann', 'Cy', 'Dee', 'Dee']);
        expect(rosterOn(members, parseDay('2010-04-19'))).toEqual([]);
    });

    test('a date, or not', () => {
        expect(parseDay('2025-04-21').toISOString()).toBe('2025-04-21T00:00:00.000Z');
        for (const bad of ['2025-02-30', '21/04/2025', '', undefined, '2025-4-21']) expect(parseDay(bad)).toBeNull();
    });
});
