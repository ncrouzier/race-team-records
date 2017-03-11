var app = angular.module('mcrrcApp');


app.directive('resultPace', function() {
    return {
        template: '<span class="hoverhand" ng-show="result.agegrade !== undefined && result.agegrade>=90" uib-tooltip-html=\'"<span>Age Grade: {{result.agegrade}}%</span><br><span>World Class</span>" | unsafe \'>{{result | resultToPace}} <i  class="ageworld fa fa-star"></i></span><span class="hoverhand" ng-show="result.agegrade !== undefined && result.agegrade>=80 && result.agegrade<90" uib-tooltip-html=\'"<span>Age Grade: {{result.agegrade}}%</span><br><span>National Class</span>" | unsafe\'>{{result | resultToPace}} <i class="agenational fa fa-star"></i></span><span class="hoverhand" ng-show="result.agegrade !== undefined && result.agegrade>=70 && result.agegrade<80" uib-tooltip-html=\'"<span>Age Grade: {{result.agegrade}}%</span><br><span>Regional Class</span>" | unsafe\'>{{result | resultToPace}} <i class="ageregional fa fa-star"></i></span><span class="hoverhand" ng-show="result.agegrade !== undefined && result.agegrade<70" uib-tooltip-html=\'"<span>Age Grade: {{result.agegrade}}%</span>" | unsafe\'>{{result | resultToPace}}</span><span ng-show="result.agegrade === undefined">{{result | resultToPace}} </span>'
    };
});

app.directive('resultPaceRaceinfo', function() {
    return {
        template: '<span class="hoverhand" ng-show="result.agegrade !== undefined && result.agegrade>=90" uib-tooltip-html=\'"<span>Age Grade: {{result.agegrade}}%</span><br><span>World Class</span>" | unsafe \'>{{result | resultToPace:raceinfo.race}} <i  class="ageworld fa fa-star"></i></span><span class="hoverhand" ng-show="result.agegrade !== undefined && result.agegrade>=80 && result.agegrade<90" uib-tooltip-html=\'"<span>Age Grade: {{result.agegrade}}%</span><br><span>National Class</span>" | unsafe\'>{{result | resultToPace:raceinfo.race}} <i class="agenational fa fa-star"></i></span><span class="hoverhand" ng-show="result.agegrade !== undefined && result.agegrade>=70 && result.agegrade<80" uib-tooltip-html=\'"<span>Age Grade: {{result.agegrade}}%</span><br><span>Regional Class</span>" | unsafe\'>{{result | resultToPace:raceinfo.race}} <i class="ageregional fa fa-star"></i></span><span class="hoverhand" ng-show="result.agegrade !== undefined && result.agegrade<70" uib-tooltip-html=\'"<span>Age Grade: {{result.agegrade}}%</span>" | unsafe\'>{{result | resultToPace:raceinfo.race}}</span><span ng-show="result.agegrade === undefined">{{result | resultToPace:raceinfo.race}} </span>'
    };
});

app.directive('multisportPace', function() {
    return {
        template: '<span class="hoverhand" ng-show="leg.legType === \'swim\'"><span class="bold">{{leg | legToSwimPace}}</span> /100m</span><span class="hoverhand" ng-show="leg.legType === \'bike\'"><span class="bold">{{leg | legToBikePace}}</span> mph</span><span class="hoverhand" ng-show="leg.legType === \'run\'"><span class="bold">{{leg | legToRunPace}}</span> /mi</span>'
    };
});