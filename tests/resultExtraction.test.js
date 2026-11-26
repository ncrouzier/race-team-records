// The browser's ResultExtractionService (public/js/services/), loaded through
// a stand-in for angular.module().factory(): the result extractor page, the
// parkrun check and the race edit modal all match and parse with it.
let service;
global.angular = {
    module: () => ({
        factory: (name, deps) => {
            service = deps[deps.length - 1]({ post: () => Promise.resolve({}) });
        }
    })
};
require('../public/js/services/ResultExtractionService.js');

const member = (id, firstname, lastname, alternateFullNames) => ({ _id: id, firstname, lastname, alternateFullNames });

describe('matchMember', () => {
    const ann = member('ann', 'Joann', 'Leeson');
    const smithson = member('smithson', 'Jo', 'Smithson');
    const kimball = member('kimball', 'Jordan', 'Kimball');
    const team = [ann, smithson, kimball];

    test.each([
        ['Ann', 'Lee'], ['Jo', 'Smith'], ['Dan', 'Kim'], ['Leeson', ''], ['Jo', 'Smithso'],
    ])('%s %s is nobody on the team: part of a name is not a name', (first, last) => {
        expect(service.matchMember(first, last, team)).toBeNull();
    });

    test('the same name, whatever the case, accents and punctuation', () => {
        const jose = member('jose', 'José', "O'Brien-Smith");
        expect(service.matchMember('JOSE', 'OBRIEN SMITH', [jose])).toBe(jose);
        expect(service.matchMember('Jose', "O'Brien-Smith", [jose])).toBe(jose);
        expect(service.matchMember('Mary', 'Ann Smith', [member('m', 'Maryann', 'Smith')])).toBeTruthy();
    });

    test('a middle name or initial, a second last name or a suffix on one side', () => {
        const john = member('john', 'John', 'Smith');
        expect(service.matchMember('John', 'A. Smith', [john])).toBe(john);
        expect(service.matchMember('John', 'Smith Jr', [john])).toBe(john);
        const maria = member('maria', 'Maria', 'Garcia Lopez');
        expect(service.matchMember('Maria', 'Garcia', [maria])).toBe(maria);
    });

    test('not on initials alone', () => {
        expect(service.matchMember('John', 'A', [member('john', 'John', 'A Smith')])).toBeNull();
    });

    test('an alternate name', () => {
        const liz = member('liz', 'Elizabeth', 'Jones', ['Liz Jones', 'Beth Jones-Carter']);
        expect(service.matchMember('Liz', 'Jones', [liz])).toBe(liz);
        expect(service.matchMember('Beth', 'Jones Carter', [liz])).toBe(liz);
        expect(service.matchMember('Liz', 'Jonesy', [liz])).toBeNull();
    });

    test('last name first, as some timers write it', () => {
        const john = member('john', 'John', 'Smith');
        expect(service.matchMember('Smith,', 'John', [john])).toBe(john);
    });

    test('an exact match wins over a close one; two close ones are no guess', () => {
        const johnA = member('a', 'John', 'A Smith');
        const johnB = member('b', 'John', 'B Smith');
        const john = member('j', 'John', 'Smith');
        expect(service.matchMember('John', 'Smith', [johnA, john, johnB])).toBe(john);
        expect(service.matchMember('John', 'Smith', [johnA, johnB])).toBeNull();
        expect(service.matchMember('John', 'A Smith', [johnA, johnB])).toBe(johnA);
    });
});

describe('parseRow', () => {
    const mapping = { Pos: 'place', Name: 'name', Time: 'time', Gender: 'gender', Cat: 'ageGroup' };
    const table = [
        { Pos: '1', Name: 'Ann Lee', Time: '18:01', Gender: 'Female1', Cat: 'W30' },
        { Pos: '2', Name: 'Bob Kim', Time: '18:30 PB', Gender: 'Male1', Cat: 'M40' },
        { Pos: '3', Name: 'Cat Fox', Time: '19:02.5', Gender: 'Female2', Cat: 'W30' },
        { Pos: '', Name: 'Dan Roe', Time: 'DNF', Gender: 'Male', Cat: 'M40' },
    ];
    const options = { stripPersonalBest: true, stripDigitsFromGender: true };

    test('time, overall place, and the gender and age group ranks worked out from the table', () => {
        expect(service.parseRow(table[2], mapping, table, options)).toEqual({
            firstname: 'Cat', lastname: 'Fox', time: 114250,
            ranking: { overallrank: 3, overalltotal: 3, genderrank: 2, gendertotal: 2, agerank: 2, agetotal: 2 }
        });
        expect(service.parseRow(table[1], mapping, table, options).time).toBe(111000);
    });

    test('a runner with no time (DNF) is no result', () => {
        expect(service.parseRow(table[3], mapping, table, options)).toBeNull();
        expect(service.cleanTime('DNF')).toBe(0);
        expect(service.cleanTime('—')).toBe(0);
    });

    test('"rank/total" columns', () => {
        const rows = [{ Name: 'Ann Lee', 'Net Time': '1:02:03', 'Sex/Tot': '4/120', 'Div/Tot': '2/15' }];
        const parsed = service.parseRow(rows[0], { Name: 'name', 'Net Time': 'time', 'Sex/Tot': 'genderRank', 'Div/Tot': 'ageRank' }, rows);
        expect(parsed.time).toBe(372300);
        expect(parsed.ranking).toEqual({ genderrank: 4, gendertotal: 120, agerank: 2, agetotal: 15 });
    });

    test('a 17,000-runner table parses in well under a second', () => {
        const big = Array.from({ length: 17000 }, (_, i) => ({
            Pos: String(i + 1), Name: 'Runner ' + i, Time: '50:00', Gender: i % 2 ? 'M' : 'F', Cat: 'A' + (i % 12)
        }));
        const started = Date.now();
        big.forEach(row => service.parseRow(row, mapping, big));
        expect(Date.now() - started).toBeLessThan(1000);
        expect(service.parseRow(big[16999], mapping, big).ranking).toMatchObject({ overalltotal: 17000, gendertotal: 8500, genderrank: 8500 });
    });

    test('parseName: a full name column, or first and last ones', () => {
        expect(service.parseName({ Name: 'Mary Ann Smith' }, { Name: 'name' })).toEqual({ firstname: 'Mary', lastname: 'Ann Smith' });
        expect(service.parseName({ F: 'Mary', L: 'Smith' }, { F: 'firstname', L: 'lastname' })).toEqual({ firstname: 'Mary', lastname: 'Smith' });
        expect(service.parseName({ Name: 'Cher' }, { Name: 'name' })).toBeNull();
    });
});

describe('parseRow on part of the field (the mika:timing copy)', () => {
    const mapping = { Place: 'place', Name: 'name', Gender: 'gender', 'Age Group': 'ageGroup', Time: 'time',
        'Gender Place': 'genderRank', 'Division Place': 'ageRank' };
    const table = [
        { Place: '16245/29037', Name: 'Bob Kim', Gender: 'M', 'Age Group': 'M45-49', Time: '03:35:03', 'Gender Place': '10497/16346', 'Division Place': '' },
        { Place: '16767/29037', Name: 'Ann Lee', Gender: 'F', 'Age Group': 'F45-49', Time: '03:37:04', 'Gender Place': '', 'Division Place': '361/1900' }
    ];

    test('places and totals as the cells say them, nothing counted within the table', () => {
        const bob = service.parseRow(table[0], mapping, table, { wholeField: false });
        expect(bob.ranking).toEqual({ overallrank: 16245, overalltotal: 29037, genderrank: 10497, gendertotal: 16346 });
        const ann = service.parseRow(table[1], mapping, table, { wholeField: false });
        expect(ann.ranking).toEqual({ overallrank: 16767, overalltotal: 29037, agerank: 361, agetotal: 1900 });
    });

    test('a whole field still counts within the table where a cell is blank', () => {
        const bob = service.parseRow(table[0], mapping, table, {});
        expect(bob.ranking).toMatchObject({ agerank: 1, agetotal: 1 });
    });

    test('the column names the copy uses map without help', () => {
        expect(service.guessColumnMapping('mikatiming', Object.keys(mapping))).toEqual(mapping);
    });
});

describe('is the matched runner the member? (identityConcerns)', () => {
    test.each([
        ['M45-49', { min: 45, max: 49 }], ['45-49', { min: 45, max: 49 }], ['F 50 - 54', { min: 50, max: 54 }],
        ['M4049', { min: 40, max: 49 }], ['80+', { min: 80, max: 120 }], ['W70 and over', { min: 70, max: 120 }],
        ['19 and under', { min: 0, max: 19 }], ['-19', { min: 0, max: 19 }], ['U20', { min: 0, max: 19 }],
        ['JU20', { min: 0, max: 19 }], ['45', { min: 45, max: 49 }], ['18-39', { min: 18, max: 39 }],
        ['H', null], ['Open', null], ['Masters', null], ['M Top Finishers', null], ['', null],
    ])('age group %s', (label, range) => {
        expect(service.ageGroupRange(label)).toEqual(range);
    });

    const ann = { firstname: 'Ann', lastname: 'Lee', sex: 'Female', dateofbirth: '1979-06-01T00:00:00.000Z' };
    const mapping = { 'Age Group': 'ageGroup', Gender: 'gender', Name: 'name' };
    const raceDay = new Date(Date.UTC(2026, 3, 20)); // she is 46

    test('her age group and sex: nothing to say', () => {
        expect(service.identityConcerns(ann, { 'Age Group': 'F45-49', Gender: 'F' }, mapping, raceDay)).toEqual([]);
    });

    test('a year either way is allowed (Berlin goes by the age reached that year)', () => {
        expect(service.identityConcerns(ann, { 'Age Group': '40-44' }, mapping, new Date(Date.UTC(2024, 3, 20)))).toEqual([]); // 44
        expect(service.identityConcerns(ann, { 'Age Group': '45-49' }, mapping, new Date(Date.UTC(2025, 0, 10)))).toEqual([]); // 45
        expect(service.identityConcerns(ann, { 'Age Group': '50-54' }, mapping, raceDay)).toHaveLength(1); // 46: 50 is too far
    });

    test('a namesake: another age group, another sex', () => {
        const concerns = service.identityConcerns(ann, { 'Age Group': 'M18-39', Gender: 'M' }, mapping, raceDay);
        expect(concerns).toEqual([
            'age group M18-39, but Ann was 46 on race day',
            'listed as a man, but Ann\'s record says female'
        ]);
    });

    test('the sex in the age group alone counts; nothing to compare, nothing said', () => {
        expect(service.identityConcerns(ann, { 'Age Group': 'M45-49' }, { 'Age Group': 'ageGroup' }, raceDay)).toHaveLength(1);
        expect(service.identityConcerns(ann, { 'Age Group': 'Open' }, mapping, raceDay)).toEqual([]);
        expect(service.identityConcerns(Object.assign({}, ann, { dateofbirth: null }), { 'Age Group': '18-39' }, mapping, raceDay)).toEqual([]);
        expect(service.identityConcerns(ann, { Name: 'Ann Lee' }, { Name: 'name' }, raceDay)).toEqual([]);
    });
});
