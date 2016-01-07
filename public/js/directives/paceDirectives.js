var app = angular.module('mcrrcApp');


app.directive('resultPace', function() {
    return {
        template: '<span class="hoverhand" ng-show="result.agegrade !== undefined && result.agegrade>=90" tooltip-html-unsafe="Age Grade: {{result.agegrade}}%<br><span>National Level</span>">{{result | resultToPace}} <i  class="ageworld fa fa-star"></i></span><span class="hoverhand" ng-show="result.agegrade !== undefined && result.agegrade>=80 && result.agegrade<90" tooltip-html-unsafe="Age Grade: {{result.agegrade}}%<br><span>Regional Level</span>">{{result | resultToPace}} <i class="agenational fa fa-star"></i></span><span class="hoverhand" ng-show="result.agegrade !== undefined && result.agegrade<80" tooltip-html-unsafe="Age Grade: {{result.agegrade}}%">{{result | resultToPace}}</span><span ng-show="result.agegrade === undefined">{{result | resultToPace}} </span>'
    };
});

