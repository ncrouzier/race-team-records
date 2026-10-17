const {
    SURFACES, formValues, changesBetween, describeChange,
    requestRole, editKinds, keepOpenDefault, afterSave
} = require('../app/correctionRequests');

const nico = { _id: 'm1', firstname: 'Nicolas', lastname: 'Crouzier', username: 'nicolascrouzier' };
const liz = { _id: 'm2', firstname: 'Liz', lastname: 'Ozeki', username: 'lizozeki' };

const road5k = {
    _id: 'r1',
    time: 95700,
    category: 'Master',
    resultlink: 'https://results.example.com/countryroad2026',
    comments: null,
    ranking: { overallrank: 3, overalltotal: 412, genderrank: 3, gendertotal: 230, agerank: 1, agetotal: 31 },
    members: [nico],
    race: {
        _id: 'race1',
        racename: 'Country Road 5K',
        racedate: new Date('2026-09-20T00:00:00Z'),
        location: { country: 'USA', state: 'MD' },
        racetype: { name: '5k', surface: 'road' }
    }
};

const triathlon = Object.assign({}, road5k, {
    race: Object.assign({}, road5k.race, { isMultisport: true, racetype: { name: 'Sprint triathlon', surface: 'multiple' } }),
    legs: [
        { order: 1, legName: 'Swim', legType: 'swim', distanceName: '750m', time: 84200 },
        { order: 2, legName: 'T1', legType: 'transition', isTransition: true, time: 10500 },
        { order: 3, legName: 'Bike', legType: 'bike', distanceName: '20k', time: 217000 },
        { order: 4, legName: 'T2', legType: 'transition', isTransition: true, time: 5800 },
        { order: 5, legName: 'Run', legType: 'run', distanceName: '5k', time: 116000 }
    ]
});

const suggest = (result, patch) => Object.assign(formValues(result), patch);

describe('formValues', () => {
    test('a result as the form shows it', () => {
        const v = formValues(road5k);
        expect(v).toMatchObject({
            time: 95700, overallrank: 3, overalltotal: 412,
            racename: 'Country Road 5K', racedate: '2026-09-20', country: 'USA', state: 'MD',
            distance: '5k', surface: 'road', legs: []
        });
    });

    test('a variable race type shows its distance name', () => {
        const odd = Object.assign({}, road5k, {
            race: Object.assign({}, road5k.race, { distanceName: '5.2 miles', racetype: { name: 'Odd road distance', surface: 'road', isVariable: true } })
        });
        expect(formValues(odd).distance).toBe('5.2 miles');
    });

    test('missing data comes out as null, never undefined', () => {
        const bare = { _id: 'r2', time: 120000, members: [nico], race: { _id: 'race2', racename: 'Bare', racedate: new Date('2026-01-01T00:00:00Z'), racetype: { name: '5k' } } };
        const v = formValues(bare);
        expect(v.country).toBeNull();
        expect(v.state).toBeNull();
        expect(v.overallrank).toBeNull();
        expect(v.surface).toBeNull();
        expect(v.legs).toEqual([]);
        expect(Object.values(v).some(x => x === undefined)).toBe(false);
    });

    test('legs, transitions without a distance', () => {
        const legs = formValues(triathlon).legs;
        expect(legs.map(l => l.legName)).toEqual(['Swim', 'T1', 'Bike', 'T2', 'Run']);
        expect(legs[1]).toMatchObject({ isTransition: true, distance: null, time: 10500 });
        expect(legs[2]).toMatchObject({ distance: '20k', time: 217000 });
    });
});

describe('changesBetween', () => {
    test('nothing changed, nothing listed', () => {
        expect(changesBetween(formValues(road5k), formValues(road5k))).toEqual([]);
    });

    test('the same value typed again is not a change', () => {
        const v = suggest(road5k, { racename: ' Country Road 5K ', time: '95700', overallrank: '3', racedate: '2026-09-20', comments: '' });
        expect(changesBetween(formValues(road5k), v)).toEqual([]);
    });

    test('time and overall place', () => {
        const changes = changesBetween(formValues(road5k), suggest(road5k, { time: 94700, overallrank: 2 }));
        expect(changes).toEqual([
            { field: 'time', label: 'Time', from: 95700, to: 94700, raceWide: false },
            { field: 'overallrank', label: 'Overall place', from: 3, to: 2, raceWide: false }
        ]);
    });

    test('a race date is race-wide', () => {
        const changes = changesBetween(formValues(road5k), suggest(road5k, { racedate: '2026-09-27' }));
        expect(changes).toEqual([{ field: 'racedate', label: 'Date', from: '2026-09-20', to: '2026-09-27', raceWide: true }]);
    });

    test('a leg time', () => {
        const current = formValues(triathlon);
        const suggested = formValues(triathlon);
        suggested.legs[2].time = 205000;
        expect(changesBetween(current, suggested)).toEqual([
            { field: 'leg.time', label: 'Bike time', from: 217000, to: 205000, raceWide: false, legOrder: 3 }
        ]);
    });
});

describe('describeChange', () => {
    test('times read as times, empty as a dash', () => {
        expect(describeChange({ field: 'time', label: 'Time', from: 95700, to: 94700 })).toBe('Time: 15:57 → 15:47');
        expect(describeChange({ field: 'state', label: 'State', from: 'MD', to: null })).toBe('State: MD → —');
        expect(describeChange({ field: 'leg.time', label: 'Bike time', from: 360000, to: 359950 })).toBe('Bike time: 1:00:00 → 59:59.50');
    });
});

describe('requestRole', () => {
    const relay = Object.assign({}, road5k, { members: [nico, liz] });
    const asUser = member => ({ role: 'user', member: member });
    const openBy = member => ({ status: 'open', sender: { member: member } });

    test('who may send', () => {
        expect(requestRole({ role: 'admin', member: nico }, road5k, null)).toBe('admin');
        expect(requestRole({ role: 'user' }, road5k, null)).toBe('none');
        expect(requestRole(null, road5k, null)).toBe('none');
        expect(requestRole(asUser(nico), road5k, null)).toBe('can-send');
        expect(requestRole(asUser(liz), road5k, null)).toBe('none');
    });

    test('with a request open on the result', () => {
        expect(requestRole(asUser(nico), relay, openBy(nico))).toBe('own-pending');
        expect(requestRole(asUser(liz), relay, openBy(nico))).toBe('other-pending');
    });
});

describe('closing a request', () => {
    const resultChange = { field: 'time', raceWide: false };
    const raceChange = { field: 'racedate', raceWide: true };
    const admin = { _id: 'u9', username: 'nico-admin', role: 'admin' };
    const now = new Date('2026-10-16T12:00:00Z');

    test('editKinds', () => {
        expect(editKinds([resultChange, raceChange])).toEqual({ result: true, race: true });
        expect(editKinds([raceChange])).toEqual({ result: false, race: true });
    });

    test('kept open while the other kind of edit is still to come', () => {
        const both = { changes: [resultChange, raceChange], savedKinds: [] };
        expect(keepOpenDefault(both, 'result')).toBe(true);
        expect(keepOpenDefault(both, 'race')).toBe(true);
        // The result was saved: editing the race is the last edit
        expect(keepOpenDefault({ changes: [resultChange, raceChange], savedKinds: ['result'] }, 'race')).toBe(false);
        // Editing the result again: the race is still to come
        expect(keepOpenDefault({ changes: [resultChange, raceChange], savedKinds: ['result'] }, 'result')).toBe(true);
        expect(keepOpenDefault({ changes: [resultChange], savedKinds: [] }, 'result')).toBe(false);
    });

    test('a save closes it, unless kept open', () => {
        const open = { status: 'open', changes: [resultChange], savedKinds: [] };
        expect(afterSave(open, 'result', false, admin, now)).toEqual({
            savedKinds: ['result'], status: 'handled', closedAt: now, closedBy: { _id: 'u9', username: 'nico-admin' }
        });
        expect(afterSave(open, 'result', true, admin, now)).toEqual({ savedKinds: ['result'] });
    });

    test('a request closed meanwhile is left alone', () => {
        expect(afterSave({ status: 'declined', changes: [resultChange], savedKinds: [] }, 'result', false, admin, now)).toBeNull();
    });

    test('the surfaces on offer', () => {
        expect(SURFACES).toEqual(['road', 'track', 'trail', 'ultra', 'other', 'multiple', 'pool', 'open water']);
    });
});

// Final review fixes
describe('legs numbered from 0, as the result form saves them', () => {
    const { applyChanges, changeKey } = require('../app/correctionRequests');
    const fromZero = Object.assign({}, triathlon, { legs: triathlon.legs.map(l => Object.assign({}, l, { order: l.order - 1 })) });

    test('a first-leg change carries legOrder 0 and its own key', () => {
        const suggested = formValues(fromZero);
        suggested.legs[0].time = 80000;
        const changes = changesBetween(formValues(fromZero), suggested);
        expect(changes).toEqual([{ field: 'leg.time', label: 'Swim time', from: 84200, to: 80000, raceWide: false, legOrder: 0 }]);
        expect(changeKey(changes[0])).toBe('leg:0:time');
        expect(changeKey({ field: 'time' })).toBe('time');
    });

    test('a pending request reapplied puts the swim change on the swim leg', () => {
        const changes = [{ field: 'leg.time', legOrder: 0, to: 80000 }, { field: 'time', to: 400000 }];
        const values = applyChanges(formValues(fromZero), changes);
        expect(values.legs[0].time).toBe(80000);
        expect(values.time).toBe(400000);
        expect(values['leg.time']).toBeUndefined();
    });
});

describe('mergeSuggestion: only what the member changed, onto the result as stored', () => {
    const { mergeSuggestion } = require('../app/correctionRequests');

    test('fields not sent keep the stored value (an admin may have edited them meanwhile)', () => {
        const stored = formValues(road5k);
        const merged = mergeSuggestion(stored, { overallrank: 2 });
        expect(changesBetween(stored, merged)).toEqual([
            { field: 'overallrank', label: 'Overall place', from: 3, to: 2, raceWide: false }
        ]);
    });

    test('legs merge by order; unknown keys and a non-array legs are ignored', () => {
        const stored = formValues(triathlon);
        const merged = mergeSuggestion(stored, { legs: [{ order: 3, time: 205000 }], hacked: 1 });
        expect(merged.hacked).toBeUndefined();
        expect(changesBetween(stored, merged).map(c => c.label)).toEqual(['Bike time']);
        expect(changesBetween(stored, mergeSuggestion(stored, { legs: 'nope' }))).toEqual([]);
    });
});

describe('a stored time with a rounding artefact', () => {
    test('is not a change when the form shows it rounded', () => {
        const odd = Object.assign({}, road5k, { time: 720399.9999 });
        expect(changesBetween(formValues(odd), suggest(odd, { time: 720400 }))).toEqual([]);
    });
});

describe('changedValues', () => {
    const { changedValues, mergeSuggestion } = require('../app/correctionRequests');
    test('only the changes, which merge back into the same changes', () => {
        const fromZero = Object.assign({}, triathlon, { legs: triathlon.legs.map(l => Object.assign({}, l, { order: l.order - 1 })) });
        const stored = formValues(fromZero);
        const suggested = formValues(fromZero);
        suggested.time = 420000;
        suggested.legs[0].time = 80000;
        suggested.racedate = '2026-09-21';
        const changes = changesBetween(stored, suggested);
        const sent = changedValues(changes);
        expect(sent).toEqual({ time: 420000, racedate: '2026-09-21', legs: [{ order: 0, time: 80000 }] });
        expect(changesBetween(stored, mergeSuggestion(stored, sent))).toEqual(changes);
    });
});

describe('category and text length', () => {
    const { mergeSuggestion, FIELDS, MAX_TEXT } = require('../app/correctionRequests');

    test('category is not on offer: it follows from the runner\'s date of birth', () => {
        expect(FIELDS.map(f => f.key)).not.toContain('category');
        expect(formValues(road5k).category).toBeUndefined();
        const stored = formValues(road5k);
        expect(changesBetween(stored, mergeSuggestion(stored, { category: 'Open' }))).toEqual([]);
    });

    test('text is capped at 500 characters', () => {
        expect(MAX_TEXT).toBe(500);
        const stored = formValues(road5k);
        const merged = mergeSuggestion(stored, { comments: 'x'.repeat(800), legs: [] });
        expect(merged.comments).toHaveLength(500);
        expect(changesBetween(stored, merged)[0].to).toHaveLength(500);
    });
});

describe('changeValue', () => {
    const { changeValue } = require('../app/correctionRequests');
    test('one side of a change, as describeChange shows it', () => {
        const change = { field: 'time', label: 'Time', from: 95700, to: 94750 };
        expect(changeValue(change, 'from')).toBe('15:57');
        expect(changeValue(change, 'to')).toBe('15:47.50');
        expect(changeValue({ field: 'state', from: 'MD', to: null }, 'to')).toBe('—');
    });
});
