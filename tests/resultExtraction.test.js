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
