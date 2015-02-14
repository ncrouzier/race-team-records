var app = angular.module('mcrrcApp');


app.directive('resultMembersNames', function() {
    return {
        template: '<span tooltip-html-unsafe="{{result.members | membersNamesFilter}}" >{{result.members | membersNamesFilter | cut:false:25:"..."}}</span>'
    };
});