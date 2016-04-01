var app = angular.module('mcrrcApp');


app.directive('resultPace', function() {
    return {
        template: '<span class="hoverhand" ng-show="result.agegrade !== undefined && result.agegrade>=90" uib-tooltip-html=\'"<span>Age Grade: {{result.agegrade}}%</span><br><span>World Class</span>" | unsafe \'>{{result | resultToPace}} <i  class="ageworld fa fa-star"></i></span><span class="hoverhand" ng-show="result.agegrade !== undefined && result.agegrade>=80 && result.agegrade<90" uib-tooltip-html=\'"<span>Age Grade: {{result.agegrade}}%</span><br><span>National Class</span>" | unsafe\'>{{result | resultToPace}} <i class="agenational fa fa-star"></i></span><span class="hoverhand" ng-show="result.agegrade !== undefined && result.agegrade>=70 && result.agegrade<80" uib-tooltip-html=\'"<span>Age Grade: {{result.agegrade}}%</span><br><span>Regional Class</span>" | unsafe\'>{{result | resultToPace}} <i class="ageregional fa fa-star"></i></span><span class="hoverhand" ng-show="result.agegrade !== undefined && result.agegrade<70" uib-tooltip-html=\'"<span>Age Grade: {{result.agegrade}}%</span>" | unsafe\'>{{result | resultToPace}}</span><span ng-show="result.agegrade === undefined">{{result | resultToPace}} </span>'
    };
});

