var app = angular.module('mcrrcApp');


app.directive('resultMembersNames', function () {
    return {
        scope: {
            result:'=result',
            race:'=race'
          },
        template: ' <a class="hoverhand" ui-sref="/members/member({ member: result.members[0].username })"><span  tooltip-append-to-body="true" uib-tooltip="{{result | membersNamesWithAgeFilter:race}}" >{{result.members | membersNamesFilter | cut:false:25:"..."}}</span></a>'
    };    
});

app.directive('resultMembersNamesFull', function () {
    return {
        scope: {
            result:'=result',
            race:'=race'
          },
        template: ' <a class="hoverhand" ui-sref="/members/member({ member: result.members[0].username })"><span  tooltip-append-to-body="true" uib-tooltip="{{result | membersNamesWithAgeFilter:race}}" >{{result.members | membersNamesFilter}}</span></a>'
    };
});

app.directive('teamRequirements', ['TeamRequirementsConfig', function (TeamRequirementsConfig) {
    var reqConfig = TeamRequirementsConfig.getForYear(new Date().getFullYear());
    return {
        scope: {
            member: '=member',
        },
        controller: function ($scope) {
            $scope.numberOfRequiredRaces = reqConfig.minRaceAndVolunteerCount;
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



