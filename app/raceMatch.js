// The filter that finds an existing race from a race's details, for the
// routes that add or edit results and races (app/routes.js,
// app/raceSeriesRoutes.js). A race's identity is its name, date, location,
// race type, order in the day, multisport flag and distance name.
//
// Older races never stored some of these: half have no isMultisport, many no
// distanceName or order. The forms send false, '' or 0 for them, so "not set"
// must match "missing" — or saving a result would not find its own race and
// create a copy of it (losing the club race flag, photos and achievements).

function unset(value) {
    return value === undefined || value === null || value === '';
}

function raceMatchFilter(race) {
    const location = race.location || {};
    return {
        racename: race.racename,
        racedate: race.racedate,
        'location.country': location.country,
        'location.state': unset(location.state) ? { $in: [null, ''] } : location.state,
        'racetype._id': race.racetype && race.racetype._id,
        order: unset(race.order) || race.order === 0 ? { $in: [null, 0] } : race.order,
        isMultisport: race.isMultisport ? true : { $ne: true },
        distanceName: unset(race.distanceName) ? { $in: [null, ''] } : race.distanceName
    };
}

module.exports = { raceMatchFilter };
