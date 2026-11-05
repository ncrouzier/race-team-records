// The result page's data from the cached race list when this browser already has
// it: the result with its race, where its time stands (window.ResultStanding,
// app/resultStanding.js) and its runners' race counts (SeriesService), the same
// shared code the /api/results/:id/detail endpoint runs. Without a cached list,
// that endpoint answers; downloading the whole list for one result would cost
// more than it saves.
angular.module('mcrrcApp').factory('ResultDetailService', ['$q', 'ResultsService', 'SeriesService',
    function ($q, ResultsService, SeriesService) {

    var factory = {};

    function fromCache(resultId, races) {
        var race = null, result = null;
        for (var i = 0; i < races.length && !result; i++) {
            var found = (races[i].results || []).filter(function (r) { return String(r._id) === String(resultId); })[0];
            if (found) {
                race = races[i];
                result = found;
            }
        }
        if (!result) return null;

        // The result as the endpoint sends it: its race on it, without the
        // race's own list of results
        var raceCopy = {};
        Object.keys(race).forEach(function (key) {
            if (key !== 'results') raceCopy[key] = race[key];
        });
        var full = angular.extend({}, result, { race: raceCopy });

        // Every record-eligible solo result with a time at this race type
        var typeId = race.racetype && race.racetype._id;
        var sameDistance = [];
        races.forEach(function (other) {
            if (!other.racetype || other.racetype._id !== typeId) return;
            (other.results || []).forEach(function (r) {
                if (r.isRecordEligible !== true || !(r.time > 0) || !r.members || r.members.length !== 1) return;
                sameDistance.push({
                    _id: r._id, time: r.time, memberId: r.members[0]._id, sex: r.members[0].sex,
                    dob: r.members[0].dateofbirth, racedate: other.racedate, racename: other.racename
                });
            });
        });
        var standing = window.ResultStanding.resultStanding({ result: full, race: raceCopy, sameDistance: sameDistance });

        return $q.when(SeriesService.memberCounts(full)).then(function (memberCounts) {
            // Without the series index there are no counts to show; the
            // endpoint has them
            if (!memberCounts) return null;
            return angular.extend({ result: full, memberCounts: memberCounts }, standing);
        });
    }

    // Resolves with what GET /api/results/:id/detail sends
    factory.getDetail = function (resultId) {
        return $q.when(ResultsService.peekCachedRaceList()).then(function (races) {
            return races ? fromCache(resultId, races) : null;
        }).catch(function () {
            return null;
        }).then(function (detail) {
            return detail || ResultsService.getResultDetail(resultId);
        });
    };

    return factory;
}]);
