var app = angular.module('mcrrcApp');


// The name always goes to the runner. Rows that are themselves clickable
// (results lists, which open the individual result) rely on the
// stopPropagation here to keep the name pointing at the member.
app.directive('resultMembersNames', function () {
    return {
        scope: {
            result:'=result',
            race:'=race'
          },
        template: ' <a class="hoverhand" ng-click="$event.stopPropagation()" ui-sref="/members/member({ member: result.members[0].username })"><span  tooltip-append-to-body="true" uib-tooltip="{{result | membersNamesWithAgeFilter:race}}" >{{result.members | membersNamesFilter | cut:false:25:"..."}}</span></a>'
    };
});

app.directive('resultMembersNamesFull', function () {
    return {
        scope: {
            result:'=result',
            race:'=race'
          },
        template: ' <a class="hoverhand" ng-click="$event.stopPropagation()" ui-sref="/members/member({ member: result.members[0].username })"><span  tooltip-append-to-body="true" uib-tooltip="{{result | membersNamesWithAgeFilter:race}}" >{{result.members | membersNamesFilter}}</span></a>'
    };
});

app.directive('teamRequirements', ['TeamRequirementsConfig', function (TeamRequirementsConfig) {
    var reqConfig = TeamRequirementsConfig.getForYear(new Date().getFullYear());
    return {
        scope: {
            member: '=member',
        },
        controller: function ($scope) {
            $scope.numberOfRequiredRaces = reqConfig.minRaceCount;
            $scope.minAgeGrade = reqConfig.minAgeGrade;
        },
        link: function (scope, element, attrs) {
            scope.getProgressBarClass = function (stats) {
                if (stats.raceCount < scope.numberOfRequiredRaces) {
                    return 'filling';
                } else {
                    if (stats.maxAgeGrade >= scope.minAgeGrade) {
                        return 'full complete';
                    } else {
                        return 'full';
                    }
                }
            };
            scope.getStarClass = function (value) {
                switch (true) {
                    case value === 'N/A':
                        return 'fa-star-o';
                    case value >= 90:
                        return 'fa-star ageworld ageGradedRequirementMetStar';
                    case value >= 80:
                        return 'fa-star agenational ageGradedRequirementMetStar';
                    case value >= scope.minAgeGrade:
                        return 'fa-star ageregional ageGradedRequirementMetStar';
                    default:
                        return 'fa-star-o';
                }
            };
            scope.getText = function (stats) {
                let txt = '<span>' + stats.raceCount + ' out of ' + scope.numberOfRequiredRaces + ' races ran';
                if (stats.maxAgeGrade >= scope.minAgeGrade) {
                    txt += " and age grade requirements met!";
                } else if (stats.maxAgeGrade === 'N/A') {
                    txt += " but no age graded races ran.";
                } else if (stats.maxAgeGrade < scope.minAgeGrade) {
                    txt += " but age grade requirements NOT met.";
                }
                return txt + '</span>';

            };
        },
        template: '<div class="team-requirement-bar" tooltip-placement="bottom" uib-tooltip-html="getText(member.teamRequirementStats)| unsafe">' +
            '<div class="requirement-progress">' +
                '<div class="progress-track">' +
                    '<div class="progress-fill" ng-class="getProgressBarClass(member.teamRequirementStats)" ng-style="{' +
            'width: (member.teamRequirementStats.raceCount / numberOfRequiredRaces) * 100 + \'%\'}"></div>' +
                '</div>' +
                '<div class="requirement-stats">' +
                    '<span class="race-count">{{member.teamRequirementStats.raceCount}}/{{numberOfRequiredRaces}}</span>' +
                    '<i ng-class="getStarClass(member.teamRequirementStats.maxAgeGrade)" class="fa requirement-star"></i>' +
                '</div>' +
            '</div>' +
            '</div>'

    };

}]);




// Collapses a tall block to `show-more` pixels with a fade and a
// "Show more" / "Show less" toggle. Blocks only slightly taller than the
// limit are left open, so the toggle never hides just a line or two.
// `show-more-watch` names the expression whose change means new content
// (e.g. another member's bio), which re-measures and collapses again.
app.directive('showMore', ['$timeout', function ($timeout) {
    var SLACK = 80;
    return {
        restrict: 'A',
        link: function (scope, element, attrs) {
            var limit = parseInt(attrs.showMore, 10) || 500;
            var expanded = false;
            var toggle = angular.element('<button type="button" class="btn btn-link show-more-toggle ng-hide"></button>');
            element.addClass('show-more').after(toggle);

            function update() {
                var tall = element[0].scrollHeight > limit + SLACK;
                var collapsed = tall && !expanded;
                toggle.toggleClass('ng-hide', !tall);
                element.toggleClass('show-more-collapsed', collapsed);
                element.css('max-height', collapsed ? limit + 'px' : '');
                toggle.html(expanded
                    ? 'Show less <i class="fa fa-chevron-up"></i>'
                    : 'Show more <i class="fa fa-chevron-down"></i>');
            }

            toggle.on('click', function () {
                expanded = !expanded;
                update();
                if (!expanded) {
                    element[0].scrollIntoView({ block: 'nearest' });
                }
            });

            scope.$watch(attrs.showMoreWatch, function () {
                expanded = false;
                element.css('max-height', '');
                $timeout(update, 0, false);
            });

            scope.$on('$destroy', function () {
                toggle.off('click').remove();
            });
        }
    };
}]);
