const { runnersKey, savedResultFilter, saveSummary } = require('../app/resultDuplicates');

describe('result duplicates', () => {
    test('the same runners give the same key, in any order', () => {
        expect(runnersKey(['b', 'a'])).toBe(runnersKey(['a', 'b']));
        expect(runnersKey(['a'])).not.toBe(runnersKey(['a', 'b']));
    });

    test('a saved result in the race with exactly these runners', () => {
        expect(savedResultFilter('race1', ['m1', 'm2'])).toEqual({
            'race._id': 'race1',
            'members._id': { $all: ['m1', 'm2'] },
            members: { $size: 2 }
        });
    });

    test('what the admin is told', () => {
        expect(saveSummary(3, [], 0)).toBe('Saved 3 results');
        expect(saveSummary(1, ['Ann Lee', 'Bob Kim'], 0)).toBe('Saved 1 result; skipped 2 already saved (Ann Lee, Bob Kim)');
        expect(saveSummary(0, ['Ann Lee'], 2)).toBe('Saved 0 results; skipped 1 already saved (Ann Lee); 2 could not be saved');
    });
});
