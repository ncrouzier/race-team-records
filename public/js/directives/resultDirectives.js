var app = angular.module('mcrrcApp');

app.directive('rankingResult', function() {
    return {
				template:	'<span class="hoverhand" ng-show="(result.ranking.agerank !== undefined && result.ranking.agerank !== \'\') || (result.ranking.genderrank !== undefined && result.ranking.genderrank !== \'\') || (result.ranking.overallrank !== undefined && result.ranking.overallrank !== \'\')"  tooltip-trigger="mouseenter"  uib-tooltip-html="\'<span>{{result.ranking | rankTooltip}}</span>\'" >{{result.ranking.agerank}} / {{result.ranking.genderrank}} / {{result.ranking.overallrank}}</span>'
    };
});

app.directive('resultIcon', function() {
    return {
        scope: {
          result:'=result',
        },
        link: function($scope, element, attrs) {
          // $scope.imgsrc = "";
          // $scope.title = "";
          if ($scope.result.customOptions !== undefined){
            $scope.resultIcons = $scope.result.customOptions.filter(x => x.name === "resultIcon");
          }
        },
        template:	'<span ng-if="resultIcons.length >0" ng-repeat="resultIcon in resultIcons track by $index"  class="hoverhand resultIcons" uib-tooltip-html="resultIcon.text"><img ng-src="{{resultIcon.value}}"  width="16" height="16"></span>'
    };
});
