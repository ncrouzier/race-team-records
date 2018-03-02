var app = angular.module('mcrrcApp');


app.directive('resultPace', function() {
	var reg ='<span ng-if="result.race.racetype.name !== \'Swim\' && result.race.racetype.name !== \'Cycling\'" ><span class="hoverhand" ng-show="result.agegrade !== undefined && result.agegrade>=90" uib-tooltip-html=\'"<span>Age Grade: {{result.agegrade}}%</span><br><span>World Class</span>" | unsafe \'>{{result | resultToPace}} <i  class="ageworld fa fa-star"></i></span><span class="hoverhand" ng-show="result.agegrade !== undefined && result.agegrade>=80 && result.agegrade<90" uib-tooltip-html=\'"<span>Age Grade: {{result.agegrade}}%</span><br><span>National Class</span>" | unsafe\'>{{result | resultToPace}} <i class="agenational fa fa-star"></i></span><span class="hoverhand" ng-show="result.agegrade !== undefined && result.agegrade>=70 && result.agegrade<80" uib-tooltip-html=\'"<span>Age Grade: {{result.agegrade}}%</span><br><span>Regional Class</span>" | unsafe\'>{{result | resultToPace}} <i class="ageregional fa fa-star"></i></span><span class="hoverhand" ng-show="result.agegrade !== undefined && result.agegrade<70" uib-tooltip-html=\'"<span>Age Grade: {{result.agegrade}}%</span>" | unsafe\'>{{result | resultToPace}}</span><span ng-show="result.agegrade === undefined">{{result | resultToPace}} </span></span>';
	var swim = '<span ng-if="result.race.racetype.name === \'Swim\'"><span>{{result | resultToSwimPace}}</span> /100m</span>';
	var bike = '<span ng-if="result.race.racetype.name === \'Cycling\'"><span>{{result | resultToBikePace}}</span> mph</span>';
    return {
        template: reg+swim+bike
    };
});

app.directive('resultPaceRaceinfo', function() {
	var run = '<span ng-if="raceinfo.race.racetype.name !== \'Swim\' && raceinfo.race.racetype.name !== \'Cycling\'"><span class="hoverhand" ng-show="result.agegrade !== undefined && result.agegrade>=90" uib-tooltip-html=\'"<span>Age Grade: {{result.agegrade}}%</span><br><span>World Class</span>" | unsafe \'>{{result | resultToPace:raceinfo.race}} <i  class="ageworld fa fa-star"></i></span><span class="hoverhand" ng-show="result.agegrade !== undefined && result.agegrade>=80 && result.agegrade<90" uib-tooltip-html=\'"<span>Age Grade: {{result.agegrade}}%</span><br><span>National Class</span>" | unsafe\'>{{result | resultToPace:raceinfo.race}} <i class="agenational fa fa-star"></i></span><span class="hoverhand" ng-show="result.agegrade !== undefined && result.agegrade>=70 && result.agegrade<80" uib-tooltip-html=\'"<span>Age Grade: {{result.agegrade}}%</span><br><span>Regional Class</span>" | unsafe\'>{{result | resultToPace:raceinfo.race}} <i class="ageregional fa fa-star"></i></span><span class="hoverhand" ng-show="result.agegrade !== undefined && result.agegrade<70" uib-tooltip-html=\'"<span>Age Grade: {{result.agegrade}}%</span>" | unsafe\'>{{result | resultToPace:raceinfo.race}}</span><span ng-show="result.agegrade === undefined">{{result | resultToPace:raceinfo.race}} </span></span>';
	var swim = '<span  ng-if="raceinfo.race.racetype.name === \'Swim\'"> <span>{{result | resultToSwimPace:raceinfo}}</span> /100m</span>';
	var bike = '<span  ng-if="raceinfo.race.racetype.name === \'Cycling\'"><span>{{result | resultToBikePace:raceinfo}}</span> mph</span>';
    return {
		template: run+swim+bike
    };
});

app.directive('multisportPace', function() {
    return {
        template: '<span class="hoverhand" ng-show="leg.legType === \'swim\'"><span class="bold">{{leg | legToSwimPace}}</span> /100m</span><span class="hoverhand" ng-show="leg.legType === \'bike\'"><span class="bold">{{leg | legToBikePace}}</span> mph</span><span class="hoverhand" ng-show="leg.legType === \'run\'"><span class="bold">{{leg | legToRunPace}}</span> /mi</span>'
    };
});
