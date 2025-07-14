angular.module('mcrrcApp.members').factory('MembersService', ['Restangular', '$uibModal', function(Restangular, $uibModal) {

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
            function(members) {},
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

        //retrieve a member by id
    factory.getMemberPbs = function(member) {
         return Restangular.one('members', member._id).customGET("pbs").then(
            function(results) {
                return results;
            },
            function(res) {
                console.log('Error: ' + res.status);
            });
    };


    factory.getParticipation = function(params){
        return Restangular.one('stats/participation').get(params).then(function(results) {
            return results;
        });
       
    };

    // =====================================
    // MEMBER MODALS ======================
    // =====================================

    factory.showAddMemberModal = function() {
        var modalInstance = $uibModal.open({
            templateUrl: 'views/modals/memberModal.html',
            controller: 'MemberModalInstanceController',
            size: 'lg',
            backdrop: 'static',
            resolve: {
                member: false
            }
        });

        return modalInstance.result.then(function(member) {
            factory.createMember(member);
            return member;
        }, function() {
            return null;
        });
    };

    factory.retrieveMemberForEdit = function(member) {
        if (member) {
            var modalInstance = $uibModal.open({
                templateUrl: 'views/modals/memberModal.html',
                controller: 'MemberModalInstanceController',
                size: 'lg',
                backdrop: 'static',
                resolve: {
                    member: function() {
                        return member;
                    }
                }
            });

            return modalInstance.result.then(function(member) {
                factory.editMember(member);
            }, function() {
                return null;
            });
        }
    };

    return factory;

}]);
