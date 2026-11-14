// <new-race-club-flag race="formData.race" edit-mode="editmode">: on the result
// form, says whether saving adds the result to a race already on the site or
// creates a new one, and for a new race offers the "MCRRC club race" flag
// (race.clubRace, which the result endpoints give the race they create). An
// existing race keeps its own flag: it is changed from the race edit dialog.
//
//   edit-mode  editing a result: a change to its race details makes a new
//              race, which keeps the flag the result's race had unless the
//              admin unticks it. Adding results starts each new race unticked.
angular.module('mcrrcApp').directive('newRaceClubFlag', ['$http', '$timeout', function ($http, $timeout) {
    return {
        restrict: 'E',
        scope: { race: '<', editMode: '<' },
        template:
            '<div class="new-race-club-flag" ng-if="state">' +
            '  <span class="nrc-existing" ng-if="state.race">' +
            '    <i class="fa fa-flag-checkered"></i> Race already on the site' +
            '    <span class="site-tag" ng-class="state.race.clubRace ? \'site-tag-info\' : \'site-tag-muted\'">' +
            '      {{ state.race.clubRace ? \'MCRRC club race\' : \'not a club race\' }}</span>' +
            '  </span>' +
            '  <span class="nrc-new" ng-if="!state.race">' +
            '    <span class="nrc-label"><i class="fa fa-plus-circle"></i> New race</span>' +
            '    <label class="nrc-check"><input type="checkbox" ng-model="race.clubRace" ng-change="ticked()"> MCRRC club race</label>' +
            '  </span>' +
            '</div>',
        link: function (scope) {
            var pending = null;
            var requestId = 0;
            var tickedFor = null;   // the race (signature) the admin set the flag for
            scope.state = null;

            // What identifies the race, as saving matches it (app/raceMatch.js)
            function signature(race) {
                if (!race || !race.racename || !race.racedate || !race.racetype || !race.racetype._id) return '';
                var loc = race.location || {};
                if (!loc.country) return '';
                return [race.racename, new Date(race.racedate).toISOString().slice(0, 10), loc.country, loc.state,
                    race.racetype._id, race.order, !!race.isMultisport, race.distanceName].join('|');
            }

            scope.ticked = function () {
                tickedFor = signature(scope.race);
            };

            function lookUp(sig) {
                var id = ++requestId;
                var race = angular.copy(scope.race);
                delete race._id;
                $http.post('/api/races/match', { race: race }).then(function (res) {
                    if (id !== requestId) return;
                    scope.state = res.data.complete ? { race: res.data.race } : null;
                    // A new race starts unticked when adding (the form keeps the
                    // last race's details, flag included, between results)
                    if (scope.state && !scope.state.race && !scope.editMode && tickedFor !== sig) {
                        scope.race.clubRace = false;
                    }
                }, function () {
                    if (id === requestId) scope.state = null;
                });
            }

            scope.$watch(function () { return signature(scope.race); }, function (sig) {
                if (pending) $timeout.cancel(pending);
                if (!sig) {
                    requestId++;
                    scope.state = null;
                    return;
                }
                pending = $timeout(function () { lookUp(sig); }, 400);
            });
        }
    };
}]);
