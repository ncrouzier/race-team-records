var app = angular.module('mcrrcApp');

app.directive('rankingResult', function() {
    return {
				template:	'<span class="hoverhand" ng-show="(result.ranking.agerank !== undefined && result.ranking.agerank !== \'\') || (result.ranking.genderrank !== undefined && result.ranking.genderrank !== \'\') || (result.ranking.overallrank !== undefined && result.ranking.overallrank !== \'\')"  tooltip-trigger="mouseenter"  uib-tooltip-html="\'<span>{{result.ranking | rankTooltip}}</span>\'" >{{result.ranking.agerank}} / {{result.ranking.genderrank}} / {{result.ranking.overallrank}}</span>'
    };
});

app.directive('resultIcon', function() {
    return {
        controller: controller,
        scope: {
          result:'=result',
        },
        link: function($scope, element, attrs) {
          // $scope.imgsrc = "";
          // $scope.title = "";
          $scope.test = "slkdjfksjdf";
          if ($scope.result.customOptions !== undefined){
            $scope.resultIcon = $scope.result.customOptions[$scope.result.customOptions.findIndex(x => x.name == "resultIcon")];
            if ($scope.resultIcon !== undefined){
              $scope.imgsrc = $scope.resultIcon.value;
              $scope.title = $scope.resultIcon.text;
              $scope.tooltip  = '<span>'+$scope.title+'</span>';
            }
          }
        },
        template:	'<span ng-if="resultIcon" class="hoverhand" uib-tooltip-html="tooltip"> <img src="{{imgsrc}}"  width="16" height="16"></span>'
    };

    function controller($scope, $attrs) {

        // $scope.getResultIcon = function(result){
        //   return result.customOptions[result.customOptions.findIndex(x => x.name == "resultIcon")];
        // };
    }
});
