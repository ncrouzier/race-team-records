const { teamRecordOps, locationOps } = require('../app/achievementUpdates');

const fiveK = { _id: 'rt5k', name: '5k', surface: 'road' };
const tenK = { _id: 'rt10k', name: '10k', surface: 'road' };
let n = 0;
const result = (date, time, sex, category, racetype, achievements) => ({
    _id: 'r' + (++n),
    time,
    category,
    members: [{ sex }],
    race: { racedate: new Date(date + 'T00:00:00Z'), order: 0, racetype: racetype || fiveK },
    achievements: achievements || []
});
const recordsSet = ops => ops.map(o => ({
    id: o.updateOne.filter._id,
    records: o.updateOne.update.$set.achievements.filter(a => a.name === 'teamRecord').map(a => a.text)
}));

describe('teamRecordOps', () => {
    test('a faster time on a later date sets a new record; a slower one does not', () => {
        const a = result('2020-01-01', 120000, 'Male', 'Open');
        const b = result('2021-01-01', 125000, 'Male', 'Open');
        const c = result('2022-01-01', 118000, 'Male', 'Open');
        expect(recordsSet(teamRecordOps([a, b, c], new Set()))).toEqual([
            { id: a._id, records: ['New team record: 5k (road) : Open Male!'] },
            { id: c._id, records: ['New team record: 5k (road) : Open Male!'] }
        ]);
    });

    test('a tie on the same date tags both; a tie on a later date does not', () => {
        const a = result('2020-01-01', 120000, 'Female', 'Open');
        const b = result('2020-01-01', 120000, 'Female', 'Open');
        const c = result('2021-01-01', 120000, 'Female', 'Open');
        expect(recordsSet(teamRecordOps([a, b, c], new Set())).map(x => x.id)).toEqual([a._id, b._id]);
    });

    test('a Master record that is also the Open record is one combined achievement', () => {
        const a = result('2020-01-01', 120000, 'Male', 'Master');
        expect(recordsSet(teamRecordOps([a], new Set()))).toEqual([
            { id: a._id, records: ['New team record: 5k (road) : Open and Master Male!'] }
        ]);
    });

    test('sexes and race types are separate records', () => {
        const a = result('2020-01-01', 120000, 'Male', 'Open');
        const b = result('2021-01-01', 130000, 'Female', 'Open');
        const c = result('2021-01-01', 300000, 'Male', 'Open', tenK);
        expect(recordsSet(teamRecordOps([a, b, c], new Set())).map(x => x.id)).toEqual([a._id, b._id, c._id]);
    });

    test('excluded race types, missing category or sex, and no time are skipped', () => {
        const a = result('2020-01-01', 120000, 'Male', 'Open', { _id: 'rtOdd', name: 'Odd road distance', surface: 'road' });
        const b = result('2020-01-01', 120000, 'Male', undefined);
        const c = result('2020-01-01', 0, 'Male', 'Open');
        expect(teamRecordOps([a, b, c], new Set(['rtOdd']))).toEqual([]);
    });

    test('nothing is written when the achievements are already right, and other achievements are kept', () => {
        const pb = { name: 'pb', text: 'PB', value: {} };
        const a = result('2020-01-01', 120000, 'Male', 'Open');
        const first = teamRecordOps([a], new Set());
        a.achievements = [pb].concat(first[0].updateOne.update.$set.achievements);
        expect(teamRecordOps([a], new Set())).toEqual([]);
        expect(first[0].updateOne.update.$set.achievements.map(x => x.name)).toEqual(['teamRecord']);
        // A result with other achievements that gains a record keeps them
        const b = result('2021-01-01', 110000, 'Male', 'Open', undefined, [pb]);
        const ops = teamRecordOps([a, b], new Set());
        expect(ops.map(o => o.updateOne.filter._id)).toEqual([b._id]);
        expect(ops[0].updateOne.update.$set.achievements.map(x => x.name)).toEqual(['pb', 'teamRecord']);
    });

    test('a result that lost its record has it removed', () => {
        const a = result('2020-01-01', 120000, 'Male', 'Open');
        a.achievements = teamRecordOps([a], new Set())[0].updateOne.update.$set.achievements;
        const earlier = result('2019-01-01', 110000, 'Male', 'Open');
        const ops = teamRecordOps([earlier, a], new Set());
        expect(ops.find(o => o.updateOne.filter._id === a._id).updateOne.update.$set.achievements).toEqual([]);
    });
});

describe('locationOps', () => {
    const achievement = { name: 'newLocation', text: 'First team race in MD!', value: { country: 'USA', state: 'MD', locationName: 'MD' } };
    const first = (achievements) => ({ _id: 'first', location: { country: 'USA', state: 'MD' }, achievements: achievements || [] });

    test('the first race gets it', () => {
        expect(locationOps(first(), [])).toEqual([
            { updateOne: { filter: { _id: 'first' }, update: { $set: { achievements: [achievement] } } } }
        ]);
    });

    test('nothing is written when the first race already holds it, once', () => {
        expect(locationOps(first([achievement]), [first([achievement])])).toEqual([]);
    });

    test('duplicate copies on the first race become one', () => {
        const other = { name: 'pb', text: 'x', value: {} };
        const f = first([achievement, other, achievement, achievement]);
        expect(locationOps(f, [f])).toEqual([
            { updateOne: { filter: { _id: 'first' }, update: { $set: { achievements: [other, achievement] } } } }
        ]);
    });

    test('a later race that held it loses it', () => {
        const later = { _id: 'later', achievements: [achievement] };
        expect(locationOps(first(), [later])).toEqual([
            { updateOne: { filter: { _id: 'later' }, update: { $set: { achievements: [] } } } },
            { updateOne: { filter: { _id: 'first' }, update: { $set: { achievements: [achievement] } } } }
        ]);
    });

    test('a race abroad is named by its country', () => {
        const abroad = { _id: 'b', location: { country: 'DEU' }, achievements: [] };
        expect(locationOps(abroad, [])[0].updateOne.update.$set.achievements[0]).toEqual(
            { name: 'newLocation', text: 'First team race in DEU!', value: { country: 'DEU', state: undefined, locationName: 'DEU' } });
    });
});
