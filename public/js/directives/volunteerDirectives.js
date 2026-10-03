// Event + date fields shared by the add and edit volunteer job modals.
//
// Most jobs are at one of the team's races: picking the race names the event
// and sets the date to race day, which stays editable for set-up the day
// before or a packet pickup. Anything else is typed in by hand, as before.
//
// `model` carries: eventType ('race' | 'other'), race, eventName, jobDate.
angular.module('mcrrcApp').directive('volunteerEventFields', ['ResultsService', function (ResultsService) {
    // Escaped because the races API turns the search into a regex
    function escapeRegex(text) {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    return {
        restrict: 'E',
        scope: {
            model: '='
        },
        template:
            '<div class="vj-event-fields">' +
            '  <div class="btn-group btn-group-sm vj-event-type">' +
            '    <button type="button" class="btn btn-default" ng-class="{active: model.eventType === \'race\'}"' +
            '      ng-click="model.eventType = \'race\'"><i class="fa fa-flag-checkered"></i> At a race</button>' +
            '    <button type="button" class="btn btn-default" ng-class="{active: model.eventType === \'other\'}"' +
            '      ng-click="model.eventType = \'other\'"><i class="fa fa-pencil"></i> Other event</button>' +
            '  </div>' +
            '  <div class="row">' +
            '    <div class="col-md-7">' +
            '      <div class="form-group" ng-if="model.eventType === \'race\'">' +
            '        <label class="text-left">Race:</label>' +
            '        <ui-select ng-model="model.race" theme="select2" style="width: 100%;" append-to-body="true"' +
            '          on-select="raceSelected($item)">' +
            '          <ui-select-match placeholder="Search for a race">{{$select.selected.racename}}' +
            '            <small class="text-muted">{{$select.selected.racedate | date:\'mediumDate\':\'UTC\'}}</small>' +
            '          </ui-select-match>' +
            '          <ui-select-choices repeat="race in races track by race._id"' +
            '            refresh="searchRaces($select.search)" refresh-delay="250">' +
            '            <div ng-bind-html="race.racename | highlight: $select.search"></div>' +
            '            <small>{{race.racedate | date:\'mediumDate\':\'UTC\'}}' +
            '              <span ng-if="race.location.state"> &middot; {{race.location.state}}</span>' +
            '              <span ng-if="!race.location.state && race.location.country"> &middot; {{race.location.country}}</span>' +
            '            </small>' +
            '          </ui-select-choices>' +
            '        </ui-select>' +
            '        <p class="help-block vj-help">Only races with team results are listed. For any other' +
            '          event, use <a class="hoverhand" ng-click="model.eventType = \'other\'">Other event</a>.</p>' +
            '      </div>' +
            '      <div class="form-group" ng-if="model.eventType === \'other\'">' +
            '        <label class="text-left">Event Name:</label>' +
            '        <input type="text" class="form-control input-md text-left" ng-model="model.eventName"' +
            '          placeholder="e.g. Course measurement, club clinic">' +
            '      </div>' +
            '    </div>' +
            '    <div class="col-md-5">' +
            '      <div class="form-group">' +
            '        <label class="text-left">Job Date:</label>' +
            '        <p class="input-group">' +
            '          <input type="text" class="form-control" uib-datepicker-popup="yyyy-MM-dd"' +
            '            ng-model="model.jobDate" ng-model-options="{timezone: \'utc\'}"' +
            '            is-open="picker.opened" min-date="\'2013-01-01\'" max-date="\'3015-01-01\'"' +
            '            datepicker-append-to-body="true" close-text="Close" />' +
            '          <span class="input-group-btn">' +
            '            <button type="button" class="btn btn-default" ng-click="openPicker($event)">' +
            '              <i class="glyphicon glyphicon-calendar"></i>' +
            '            </button>' +
            '          </span>' +
            '        </p>' +
            '        <p class="help-block vj-help" ng-if="model.eventType === \'race\' && model.race && !isRaceDay()">' +
            '          <i class="fa fa-info-circle"></i> Not race day ({{model.race.racedate | date:\'mediumDate\':\'UTC\'}}).' +
            '          <a class="hoverhand" ng-click="useRaceDate()">Use race date</a>' +
            '        </p>' +
            '      </div>' +
            '    </div>' +
            '  </div>' +
            '</div>',
        link: function (scope) {
            scope.races = [];
            scope.picker = { opened: false };

            scope.openPicker = function ($event) {
                $event.preventDefault();
                $event.stopPropagation();
                scope.picker.opened = true;
            };

            // Empty search lists the latest races, which is where nearly every
            // job is; typing searches the whole history by name
            scope.searchRaces = function (search) {
                var filters = {};
                if (search) {
                    filters.racename = escapeRegex(search);
                } else {
                    var soon = new Date();
                    soon.setDate(soon.getDate() + 30);
                    filters.dateTo = soon.toISOString();
                }
                return ResultsService.getRaces({
                    filters: JSON.stringify(filters),
                    sort: '-racedate',
                    limit: 25
                }).then(function (races) {
                    scope.races = races.plain ? races.plain() : races;
                });
            };

            scope.raceSelected = function (race) {
                if (race && race.racedate) {
                    scope.model.jobDate = new Date(race.racedate);
                }
            };

            scope.useRaceDate = function () {
                scope.raceSelected(scope.model.race);
            };

            function dayOf(date) {
                return date ? new Date(date).toISOString().slice(0, 10) : null;
            }

            scope.isRaceDay = function () {
                return !scope.model.race || dayOf(scope.model.jobDate) === dayOf(scope.model.race.racedate);
            };
        }
    };
}]);

// Event cell for volunteer job tables: a link to the race page when the job
// was at a race, plain text otherwise.
angular.module('mcrrcApp').directive('volunteerEventName', function () {
    return {
        restrict: 'E',
        scope: {
            job: '='
        },
        template:
            '<a ng-if="job.race && job.race._id" ui-sref="/races({ raceId: job.race._id })"' +
            '  title="Open race">{{job.eventName}}</a>' +
            '<span ng-if="!job.race || !job.race._id">{{job.eventName}}</span>'
    };
});
