angular.module('mcrrcApp.members').factory('MembersService', ['Restangular', function(Restangular) {

    var factory = {};
    var members = Restangular.all('members');

    factory.getMembers = function(params) {
        return members.getList(params).then(function(members) {
            return members;
        });
    };


    // select a member after checking it
    factory.getMember = function(id) {
        return Restangular.one('members', id).get().then(
            function(member) {
                return member;
            },
            function(res) {
                console.log('Error: ' + res.status);
            });
    };

    // when submitting the add form, send the text to the node API
    factory.createMember = function(member) {
        return members.post(member).then(
            function(members) {

            },
            function(res) {
                console.log('Error: ' + res.status);
            });
    };

    // when submitting the add form, send the text to the node API
    factory.editMember = function(member) {
        member.save();
    };

    // delete a member after checking it
    factory.deleteMember = function(member) {
        return member.remove().then(
            function() {},
            function(res) {
                console.log('Error: ' + res.status);
            });
    };



    return factory;

}]);
