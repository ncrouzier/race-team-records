var app = angular.module('mcrrcApp');


app.directive('resultPace', function() {
	var reg ='<span class="resultPace" ng-if="race.racetype.name !== \'Swim\' && race.racetype.name !== \'Cycling\'" ><span class="hoverhand" ng-show="result.agegrade !== undefined && result.agegrade>=90" tooltip-append-to-body="true" uib-tooltip-html=\'"<span>Age Grade: {{result.agegrade}}%</span><br><span>World Class</span>" | unsafe \'>{{result | resultToPace:race}} <i  class="ageworld fa fa-star"></i><br><small class="resultPaceTxt">min/mi</small></span><span class="hoverhand" ng-show="result.agegrade !== undefined && result.agegrade>=80 && result.agegrade<90" tooltip-append-to-body="true" uib-tooltip-html=\'"<span>Age Grade: {{result.agegrade}}%</span><br><span>National Class</span>" | unsafe\'>{{result | resultToPace:race}} <i class="agenational fa fa-star"></i><br><small class="resultPaceTxt">min/mi</small></span><span class="hoverhand" ng-show="result.agegrade !== undefined && result.agegrade>=70 && result.agegrade<80" tooltip-append-to-body="true" uib-tooltip-html=\'"<span>Age Grade: {{result.agegrade}}%</span><br><span>Regional Class</span>" | unsafe\'>{{result | resultToPace:race}} <i class="ageregional fa fa-star"></i><br><small class="resultPaceTxt">min/mi</small></span><span class="hoverhand" ng-show="result.agegrade !== undefined && result.agegrade<70" tooltip-append-to-body="true" uib-tooltip-html=\'"<span>Age Grade: {{result.agegrade}}%</span>" | unsafe\'>{{result | resultToPace:race}}<br><small class="resultPaceTxt">min/mi</small></span><span ng-show="result.agegrade === undefined">{{result | resultToPace:race}}<br><small class="resultPaceTxt">min/mi</small></span></span>';
	var swim = '<span class="resultPace" ng-if="race.racetype.name === \'Swim\'"><span>{{result | resultToSwimPace:race}}</span><br><small class="resultPaceTxt">/100m</small></span>';
	var bike = '<span class="resultPace" ng-if="race.racetype.name === \'Cycling\'"><span>{{result | resultToBikePace:race}}</span><br><small class="resultPaceTxt">mph</small></span>';
    return {
        scope: {
            race:'=race',
            result:'=result'
          },
        template: reg+swim+bike
    };
});

app.directive('resultPaceRaceinfo', function() {
	var run = '<span ng-if="raceinfo.race.racetype.name !== \'Swim\' && raceinfo.race.racetype.name !== \'Cycling\'"><span class="hoverhand" ng-show="result.agegrade !== undefined && result.agegrade>=90" tooltip-append-to-body="true" uib-tooltip-html=\'"<span>Age Grade: {{result.agegrade}}%</span><br><span>World Class</span>" | unsafe \'>{{result | resultToPace:raceinfo.race}} <i  class="ageworld fa fa-star"></i></span><span class="hoverhand" ng-show="result.agegrade !== undefined && result.agegrade>=80 && result.agegrade<90" tooltip-append-to-body="true" uib-tooltip-html=\'"<span>Age Grade: {{result.agegrade}}%</span><br><span>National Class</span>" | unsafe\'>{{result | resultToPace:raceinfo.race}} <i class="agenational fa fa-star"></i></span><span class="hoverhand" ng-show="result.agegrade !== undefined && result.agegrade>=70 && result.agegrade<80" tooltip-append-to-body="true" uib-tooltip-html=\'"<span>Age Grade: {{result.agegrade}}%</span><br><span>Regional Class</span>" | unsafe\'>{{result | resultToPace:raceinfo.race}} <i class="ageregional fa fa-star"></i></span><span class="hoverhand" ng-show="result.agegrade !== undefined && result.agegrade<70" tooltip-append-to-body="true" uib-tooltip-html=\'"<span>Age Grade: {{result.agegrade}}%</span>" | unsafe\'>{{result | resultToPace:raceinfo.race}}</span><span ng-show="result.agegrade === undefined">{{result | resultToPace:raceinfo.race}} </span></span>';
	var swim = '<span  ng-if="raceinfo.race.racetype.name === \'Swim\'"> <span>{{result | resultToSwimPace:raceinfo}}</span> /100m</span>';
	var bike = '<span  ng-if="raceinfo.race.racetype.name === \'Cycling\'"><span>{{result | resultToBikePace:raceinfo}}</span> mph</span>';
    return {
        scope: {
            raceinfo:'=race'
          },
		template: run+swim+bike
    };
});

app.directive('multisportPace', function() {
    return {
        template: '<span class="hoverhand" ng-show="leg.legType === \'swim\'"><span class="bold">{{leg | legToSwimPace}}</span> /100m</span><span class="hoverhand" ng-show="leg.legType === \'bike\'"><span class="bold">{{leg | legToBikePace}}</span> mph</span><span class="hoverhand" ng-show="leg.legType === \'run\'"><span class="bold">{{leg | legToRunPace}}</span> /mi</span>'
    };
});
