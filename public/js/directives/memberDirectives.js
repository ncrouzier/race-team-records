var app = angular.module('mcrrcApp');


app.directive('resultMembersNames', function() {
    return {
        template: ' <a class="hoverhand" ui-sref="/members({ member: result.members[0].firstname+result.members[0].lastname })"><span tooltip-html-unsafe="{{result | membersNamesWithAgeFilter}}" >{{result.members | membersNamesFilter | cut:false:25:"..."}}</span></a>'
    };
});

