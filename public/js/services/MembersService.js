angular.module('mcrrcApp.members').factory('MembersService', ['Restangular', function(Restangular) {

    var factory = {};
    var members = Restangular.all('members');

    // =====================================
    // MEMBERS API CALLS ===================
    // =====================================

    //retrieve members
    factory.getMembers = function(params) {
        return members.getList(params).then(function(members) {
            return members;
        });
    };


    //retrieve a member by id
    factory.getMember = function(id) {
        return Restangular.one('members', id).get().then(
            function(member) {
                return member;
            },
            function(res) {
                console.log('Error: ' + res.status);
            });
    };

    //create a member
    factory.createMember = function(member) {
        return members.post(member).then(
            function(members) {
            },
            function(res) {
                console.log('Error: ' + res.status);
            });
    };

    //edit a member
    factory.editMember = function(member) {
        member.save();
    };

    //delete a member
    factory.deleteMember = function(member) {
        return member.remove().then(
            function() {},
            function(res) {
                console.log('Error: ' + res.status);
            });
    };



    return factory;

}]);
