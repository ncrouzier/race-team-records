const { clean, commonJobs, runnerName } = require('../app/volunteerSubmissions');

describe('clean', () => {
    const form = {
        memberId: 'm1',
        raceId: 'race1',
        eventName: ' Matthew Henson 5K ',
        jobDate: '2026-10-10',
        description: ' Course marshal '
    };

    test('a complete form', () => {
        expect(clean(form)).toEqual({
            values: {
                memberId: 'm1',
                raceId: 'race1',
                eventName: 'Matthew Henson 5K',
                jobDate: new Date('2026-10-10T00:00:00Z'),
                description: 'Course marshal'
            }
        });
    });

    test('a typed name and an event that is not a race', () => {
        const { values } = clean(Object.assign({}, form, { memberId: '', runnerName: 'New Runner', raceId: '', eventName: 'Club clinic' }));
        expect(values.runnerName).toBe('New Runner');
        expect(values.memberId).toBeUndefined();
        expect(values.raceId).toBeUndefined();
        expect(values.eventName).toBe('Club clinic');
    });

    test('says which field is wrong', () => {
        const field = (changes) => clean(Object.assign({}, form, changes)).field;
        expect(field({ memberId: '', runnerName: ' ' })).toBe('runner');
        expect(field({ eventName: '' })).toBe('event');
        expect(field({ jobDate: '2026-02-30' })).toBe('jobDate');
        expect(field({ jobDate: '2099-01-01' })).toBe('jobDate');
        expect(field({ jobDate: '2012-12-31' })).toBe('jobDate');
        expect(field({ description: '  ' })).toBe('description');
    });
});

describe('commonJobs', () => {
    test('one entry per job whatever the case, its most used spelling, one-offs left out', () => {
        const rows = [
            { _id: 'Course Marshal', n: 10 },
            { _id: 'course marshal', n: 3 },
            { _id: 'Course Marshall', n: 6 },
            { _id: 'Photography', n: 9 },
            { _id: 'Registration', n: 5 },
            { _id: 'Chip recovery', n: 1 },
            { _id: 'Presented on injury prevention and form to the 8k/10k program', n: 2 },
            { _id: '', n: 4 }
        ];
        expect(commonJobs(rows, 2)).toEqual(['Course Marshal', 'Photography']);
        expect(commonJobs(rows, 10)).toEqual(['Course Marshal', 'Photography', 'Registration']);
    });
});

test('runnerName', () => {
    expect(runnerName({ member: { _id: 'm1', firstname: 'Liz', lastname: 'Ozeki' } })).toBe('Liz Ozeki');
    expect(runnerName({ runnerName: 'New Runner' })).toBe('New Runner');
});
