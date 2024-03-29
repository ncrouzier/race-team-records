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

          function sameDay(d1, d2) {
            return d1.getUTCMonth() === d2.getUTCMonth() && d1.getUTCDate() === d2.getUTCDate();
          }

          //return thanksgiving date for a given year.
          function thanksgivingDayUSA(year){
            first = new Date(year,10,1);
            day_of_week = first.getUTCDay();
            return new Date(year,10,22 + (11 - day_of_week) % 7);
          }

          if ($scope.result.customOptions !== undefined){
            $scope.resultIcons = $scope.result.customOptions.filter(x => x.name === "resultIcon");
          }
          var d1= new Date($scope.result.race.racedate);
          var raceDate = new Date(d1.getUTCFullYear(), d1.getUTCMonth(), d1.getUTCDate());
          $scope.isbirthdayRace = false;
          $scope.result.members.forEach(function(member) {
              if(sameDay(new Date(member.dateofbirth),raceDate)){
                  $scope.isbirthdayRace = true;
              }
          });
          $scope.isThanksgiving = false;
          if (raceDate.getMonth() === 10){ //if November, check if Thanksgiving
            if (sameDay(thanksgivingDayUSA(raceDate.getUTCFullYear()),raceDate)) {
              $scope.isThanksgiving = true;
            }        
          }
          
          $scope.isFourthOfJuly = false;
          if (raceDate.getUTCMonth() === 6 && raceDate.getUTCDate() === 4){
            $scope.isFourthOfJuly = true;
          }

        },
          template:	'<span class="hoverhand" uib-tooltip="Birthday Race!" ng-if="isbirthdayRace">🎂</span><span class="hoverhand" uib-tooltip="Thanksgiving Race!" ng-if="isThanksgiving">🦃</span><span class="hoverhand" uib-tooltip="Fourth of July Race!" ng-if="isFourthOfJuly">🎆</span> <span ng-if="resultIcons.length >0" ng-repeat="resultIcon in resultIcons track by $index"  class="hoverhand resultIcons" uib-tooltip-html="resultIcon.text"><img ng-src="{{resultIcon.value}}"  ng-style="{\'width\' : resultIcon.width ? resultIcon.width : \'16px\', \'height\' : resultIcon.height ? resultIcon.height : \'16px\' }" ></span>'
      };
    
});
