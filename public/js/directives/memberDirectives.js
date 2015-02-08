var app = angular.module('mcrrcApp');


app.directive('resultMembersNames', function() {
    return {
        template: '<span tooltip-html-unsafe="{{result.member | membersNamesFilter}}" >{{result.member | membersNamesFilter | cut:false:25:"..."}}</span>'
    };
});