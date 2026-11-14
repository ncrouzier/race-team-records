const {
    parseTime, formatTime, formatTimeDigits, normalizeLink, clean, formValues, runnerName, distanceLabel, placeText
} = require('../app/resultSubmissions');

describe('parseTime', () => {
    test('minutes and seconds, hours, hundredths', () => {
        expect(parseTime('32:10')).toBe(193000);
        expect(parseTime('1:25:00')).toBe(510000);
        expect(parseTime('4:52.31')).toBe(29231);
        expect(parseTime('4:52.3')).toBe(29230);
        expect(parseTime(' 15:57 ')).toBe(95700);
    });

    test('refuses what is not a time', () => {
        expect(parseTime('')).toBeNull();
        expect(parseTime('32')).toBeNull();
        expect(parseTime('19:75')).toBeNull();
        expect(parseTime('1:75:00')).toBeNull();
        expect(parseTime('0:00')).toBeNull();
        expect(parseTime('swim 33:00')).toBeNull();
    });

    // A 100-minute half without the hours is still a time people type
    test('minutes past 59 without hours', () => {
        expect(parseTime('100:00')).toBe(600000);
    });

    test('formatTime reads back', () => {
        ['32:10', '1:25:00', '4:52.31'].forEach(t => expect(formatTime(parseTime(t))).toBe(t));
    });
});

describe('formatTimeDigits', () => {
    test('fills in from the seconds up', () => {
        expect(formatTimeDigits('32')).toBe('32');
        expect(formatTimeDigits('3210')).toBe('32:10');
        expect(formatTimeDigits('12500')).toBe('1:25:00');
        expect(formatTimeDigits('1:25:00')).toBe('1:25:00');
        expect(formatTimeDigits('452')).toBe('4:52');
    });

    test('keeps hundredths after a dot', () => {
        expect(formatTimeDigits('452.31')).toBe('4:52.31');
        expect(formatTimeDigits('452.')).toBe('4:52.');
        expect(formatTimeDigits('452.317')).toBe('4:52.31');
    });
});

describe('normalizeLink', () => {
    test('adds the scheme, refuses others', () => {
        expect(normalizeLink('coolrunning.com/results/1')).toEqual({ ok: true, url: 'https://coolrunning.com/results/1' });
        expect(normalizeLink('')).toEqual({ ok: true, url: '' });
        expect(normalizeLink('javascript:alert(1)').ok).toBe(false);
        expect(normalizeLink('none').ok).toBe(false);
    });
});

describe('clean', () => {
    const options = { today: '2026-11-12', countries: ['USA', 'FRA'], states: ['MD', 'VA'] };
    const form = {
        memberId: 'm1',
        racename: 'Turkey Chase 10K',
        racedate: '2026-11-08',
        country: 'USA',
        state: 'MD',
        racetypeId: 'rt10k',
        time: '35:54',
        agerank: '3', agetotal: '125',
        overallrank: '', overalltotal: '400',
        resultlink: 'runsignup.com/Race/Results/1',
        photoLink: '',
        highlight: '  First time under 36!  ',
        comments: ''
    };

    test('a complete form', () => {
        const { values, error } = clean(form, options);
        expect(error).toBeUndefined();
        expect(values).toEqual({
            memberId: 'm1',
            racename: 'Turkey Chase 10K',
            racedate: new Date('2026-11-08T00:00:00Z'),
            location: { country: 'USA', state: 'MD' },
            racetypeId: 'rt10k',
            time: 215400,
            splits: null,
            ranking: { agerank: 3, agetotal: 125, overalltotal: 400 },
            noResultLink: false,
            resultlink: 'https://runsignup.com/Race/Results/1',
            photoLink: null,
            highlight: 'First time under 36!',
            comments: null
        });
    });

    test('a runner not on the list, a race abroad, another distance, no link', () => {
        const { values } = clean(Object.assign({}, form, {
            memberId: '', runnerName: 'New Runner', country: 'FRA', state: 'MD',
            racetypeId: 'other', distanceText: 'Sprint triathlon', noResultLink: true, resultlink: ''
        }), options);
        expect(values.memberId).toBeUndefined();
        expect(values.runnerName).toBe('New Runner');
        expect(values.location).toEqual({ country: 'FRA', state: null });
        expect(values.racetypeId).toBeUndefined();
        expect(values.distanceText).toBe('Sprint triathlon');
        expect(values.raceId).toBeUndefined();
        expect(values.resultlink).toBeNull();
    });

    test('says which field is wrong', () => {
        const field = (changes) => clean(Object.assign({}, form, changes), options).field;
        expect(field({ memberId: '', runnerName: '' })).toBe('runner');
        expect(field({ racename: ' ' })).toBe('racename');
        expect(field({ racedate: '2026-02-30' })).toBe('racedate');
        expect(field({ racedate: '2026-11-20' })).toBe('racedate');
        expect(field({ racedate: '2012-12-31' })).toBe('racedate');
        expect(field({ country: 'XXX' })).toBe('country');
        expect(field({ state: '' })).toBe('state');
        expect(field({ racetypeId: '' })).toBe('distance');
        expect(field({ racetypeId: 'other', distanceText: '' })).toBe('distance');
        expect(field({ time: '35' })).toBe('time');
        expect(field({ agerank: '200' })).toBe('agerank');
        expect(field({ genderrank: '2.5' })).toBe('genderrank');
        expect(field({ resultlink: '' })).toBe('resultlink');
        expect(field({ resultlink: 'none' })).toBe('resultlink');
        expect(field({ photoLink: 'not a link' })).toBe('photoLink');
    });

    test('a race picked from the site', () => {
        expect(clean(Object.assign({}, form, { raceId: 'race1' }), options).values.raceId).toBe('race1');
    });

    // The runner's evening race, a day ahead of the server in UTC
    test('a day of slack for the time zone', () => {
        expect(clean(Object.assign({}, form, { racedate: '2026-11-13' }), options).error).toBeUndefined();
    });
});

describe('formValues', () => {
    const submission = {
        member: { _id: 'm1', firstname: 'Nicolas', lastname: 'Crouzier' },
        racename: 'Turkey Chase 10K',
        racedate: new Date('2026-11-08T00:00:00Z'),
        location: { country: 'USA', state: 'MD' },
        racetype: { _id: 'rt10k', name: '10k', surface: 'road' },
        time: 215450,
        ranking: { agerank: 3, agetotal: 125, overalltotal: 400 },
        resultlink: 'https://runsignup.com/Race/Results/1',
        comments: 'Windy!'
    };

    test('from the submission', () => {
        expect(formValues(submission)).toEqual({
            race: {
                racename: 'Turkey Chase 10K',
                racedate: new Date('2026-11-08T00:00:00Z'),
                isMultisport: false,
                distanceName: undefined,
                location: { country: 'USA', state: 'MD' },
                racetype: submission.racetype
            },
            time: { hours: 0, minutes: 35, seconds: 54, centiseconds: 50 },
            ranking: { agerank: 3, agetotal: 125, overalltotal: 400 },
            resultlink: 'https://runsignup.com/Race/Results/1',
            comments: 'Windy!'
        });
    });

    test('"Other" distance: no race type, the words as the display name', () => {
        const values = formValues(Object.assign({}, submission, { racetype: undefined, distanceText: '7.2 miles' }));
        expect(values.race.racetype).toBeNull();
        expect(values.race.distanceName).toBe('7.2 miles');
    });

    test('joining a race already on the site', () => {
        const race = {
            _id: 'race1', racename: 'Montgomery County Turkey Chase 10K', racedate: '2026-11-08T00:00:00.000Z',
            order: 1, isMultisport: false, location: { country: 'USA', state: 'MD' },
            racetype: { _id: 'rt10k', name: '10k', surface: 'road' }
        };
        const values = formValues(submission, race);
        expect(values.race.racename).toBe('Montgomery County Turkey Chase 10K');
        expect(values.race.order).toBe(1);
        expect(values.time.minutes).toBe(35);
    });
});

describe('labels', () => {
    test('runner, distance, places', () => {
        expect(runnerName({ member: { _id: 'm1', firstname: 'Liz', lastname: 'Ozeki' } })).toBe('Liz Ozeki');
        expect(runnerName({ runnerName: 'New Runner' })).toBe('New Runner');
        expect(distanceLabel({ racetype: { name: '10k', surface: 'road' } })).toBe('10k (road)');
        expect(distanceLabel({ distanceText: 'Sprint tri' })).toBe('Sprint tri');
        expect(placeText({ agerank: 3, agetotal: 125 }, 'agerank')).toBe('3 / 125');
        expect(placeText({ overalltotal: 400 }, 'overallrank')).toBe('of 400');
        expect(placeText({}, 'genderrank')).toBe('');
    });
});
