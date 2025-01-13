var app = angular.module('mcrrcApp');


app.directive('resultMembersNames', function () {
    return {
        template: ' <a class="hoverhand" ui-sref="/members({ member: result.members[0].firstname+result.members[0].lastname })"><span uib-tooltip="{{result | membersNamesWithAgeFilter}}" >{{result.members | membersNamesFilter | cut:false:25:"..."}}</span></a>'
    };
});

app.directive('resultMembersNamesFull', function () {
    return {
        template: ' <a class="hoverhand" ui-sref="/members({ member: result.members[0].firstname+result.members[0].lastname })"><span uib-tooltip="{{result | membersNamesWithAgeFilter}}" >{{result.members | membersNamesFilter}}</span></a>'
    };
});

app.directive('teamRequirements', function () {
    return {
        scope: {
            member: '=member',
        },
        controller: function ($scope) {
            $scope.numberOfRequiredRaces = 8;
        },
        link: function (scope, element, attrs) {
            scope.getProgressBarClass = function (stats) {
                if (stats.raceCount < scope.numberOfRequiredRaces) {
                    return 'filling';
                } else {
                    if (stats.maxAgeGrade >= 70) {
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
                    case value >= 70:
                        return 'fa-star ageregional ageGradedRequirementMetStar';
                    default: // under 70
                        return 'fa-star-o';
                }
            };
            scope.getText = function (stats) {
                let txt = '<span>' + stats.raceCount + ' out of ' + scope.numberOfRequiredRaces + ' races ran';
                if (stats.maxAgeGrade >= 70) {
                    txt += " and age grade requirements met!";
                } else if (stats.maxAgeGrade === 'N/A') {
                    txt += " but no age graded races ran.";
                } else if (stats.maxAgeGrade < 70) {
                    txt += " but age grade requirements NOT met.";
                }
                return txt + '</span>';

            };
        },
        template: '<div tooltip-placement="bottom"  uib-tooltip-html="getText(member.teamRequirementStats)| unsafe"  class="progress-bar">' +
            '<div class="progress-bar-fill" ng-class="getProgressBarClass(member.teamRequirementStats)" ng-style="{' +
            'width: (member.teamRequirementStats.raceCount / numberOfRequiredRaces) * 100 + \'%\'}"></div>' +
            '<i  ng-class="getStarClass(member.teamRequirementStats.maxAgeGrade)" class="fa"></i>' +
            '</div>'

    };

});



