const { raceMatchFilter } = require('../app/raceMatch');

const base = {
    racename: 'Going Green Track Meet 4x400',
    racedate: new Date('2024-08-02T00:00:00Z'),
    location: { country: 'USA', state: 'MD' },
    racetype: { _id: 'rt1', name: '4x400' },
    order: 0
};

describe('raceMatchFilter', () => {
    test('the identifying fields', () => {
        expect(raceMatchFilter(Object.assign({ isMultisport: true, distanceName: 'Sprint' }, base))).toEqual({
            racename: 'Going Green Track Meet 4x400',
            racedate: base.racedate,
            'location.country': 'USA',
            'location.state': 'MD',
            'racetype._id': 'rt1',
            order: { $in: [null, 0] },
            isMultisport: true,
            distanceName: 'Sprint'
        });
    });

    // The result form sends isMultisport: false where the race never stored
    // the field: half the races. A missing flag means "not multisport".
    test('not multisport matches races that never stored the flag', () => {
        expect(raceMatchFilter(Object.assign({ isMultisport: false }, base)).isMultisport).toEqual({ $ne: true });
        expect(raceMatchFilter(base).isMultisport).toEqual({ $ne: true });
    });

    test('no distance name matches a missing, null or empty one', () => {
        expect(raceMatchFilter(Object.assign({ distanceName: undefined }, base)).distanceName).toEqual({ $in: [null, ''] });
        expect(raceMatchFilter(Object.assign({ distanceName: '' }, base)).distanceName).toEqual({ $in: [null, ''] });
    });

    test('no order matches a missing one or 0, and a real order exactly', () => {
        expect(raceMatchFilter(Object.assign({}, base, { order: 2 })).order).toBe(2);
        const noOrder = Object.assign({}, base);
        delete noOrder.order;
        expect(raceMatchFilter(noOrder).order).toEqual({ $in: [null, 0] });
    });

    test('no state matches a missing, null or empty one (races abroad)', () => {
        const abroad = Object.assign({}, base, { location: { country: 'FRA' } });
        expect(raceMatchFilter(abroad)['location.state']).toEqual({ $in: [null, ''] });
    });
});
