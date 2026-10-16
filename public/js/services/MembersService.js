angular.module('mcrrcApp.members').factory('MembersService', ['Restangular', '$uibModal', '$q', 'DexieService', 'DataCacheService', function (Restangular, $uibModal, $q, DexieService, DataCacheService) {
    var factory = {};
    var members = Restangular.all('members');

    // =====================================
    // MEMBERS API CALLS ===================
    // =====================================

    //retrieve members
    factory.getMembers = function (params) {
        return members.getList(params).then(function (members) {
            return members;
        });
    };

    // Members, kept in this browser like the race list: answered at once from
    // the copy here, replaced in the background when members change
    // (DataCacheService). One copy per query: pages ask for different
    // fields, filters and orders, which only the server applies.
    var memberLists = {};
    factory.getMembersWithCacheSupport = function (params) {
        var key = JSON.stringify(params || {});
        if (!memberLists[key]) {
            memberLists[key] = DataCacheService.create({
                name: 'members:' + key,
                stampFields: DataCacheService.RACE_DATA,
                readStore: function () {
                    return $q.when(DexieService.open()).then(function () {
                        return DexieService.members.get(key);
                    }).then(function (stored) {
                        if (!stored || !stored.data) return null;
                        return {
                            stamp: stored.stamp,
                            data: Restangular.restangularizeCollection(null, JSON.parse(stored.data), 'members', true)
                        };
                    });
                },
                writeStore: function (entry) {
                    return $q.when(DexieService.members.put({ params: key, stamp: entry.stamp, data: JSON.stringify(entry.data) }));
                },
                fetchFresh: function () {
                    return members.getList(params);
                }
            });
        }
        return memberLists[key].get();
    };


    //retrieve a member by id
    factory.getMember = function (id) {
        return Restangular.one('members', id).get().then(
            function (member) {
                return member;
            },
            function (res) {
                console.log('Error: ' + res.status);
            });
    };

    //create a member
    factory.createMember = function (member) {
        return members.post(member).then(
            function (members) { },
            function (res) {
                console.log('Error: ' + res.status);
            });
    };

    //edit a member
    factory.editMember = function (member) {
        member.save();
    };

    //edit a member's bio only
    factory.editMemberBio = function (memberId, bio) {
        return Restangular.one('members', memberId).customPUT({ bio: bio }, 'bio');
    };

    factory.showEditBioModal = function (member) {
        var modalInstance = $uibModal.open({
            templateUrl: 'views/modals/bioEditModal.html',
            controller: 'BioEditModalInstanceController',
            size: 'lg',
            backdrop: 'static',
            resolve: {
                member: function () {
                    return member;
                }
            }
        });

        return modalInstance.result.then(function (bio) {
            return factory.editMemberBio(member._id, bio).then(function () {
                member.bio = bio;
                return bio;
            });
        }, function () {
            return null;
        });
    };

    //edit a member's photo link only
    factory.editMemberPhoto = function (memberId, pictureLink) {
        return Restangular.one('members', memberId).customPUT({ pictureLink: pictureLink }, 'photo');
    };

    factory.showEditPhotoModal = function (member) {
        var modalInstance = $uibModal.open({
            templateUrl: 'views/modals/photoEditModal.html',
            controller: 'PhotoEditModalInstanceController',
            size: 'lg',
            backdrop: 'static',
            resolve: {
                member: function () {
                    return member;
                }
            }
        });

        return modalInstance.result.then(function (pictureLink) {
            return factory.editMemberPhoto(member._id, pictureLink).then(function () {
                member.pictureLink = pictureLink;
                return pictureLink;
            });
        }, function () {
            return null;
        });
    };

    //delete a member
    factory.deleteMember = function (member) {
        return member.remove().then(
            function () { },
            function (res) {
                console.log('Error: ' + res.status);
            });
    };

    //retrieve a member by id
    factory.getMemberPbs = function (member) {
        return Restangular.one('members', member._id).customGET("pbs").then(
            function (results) {
                return results;
            },
            function (res) {
                console.log('Error: ' + res.status);
            });
    };


    factory.getParticipation = function (params) {
        return Restangular.one('stats/participation').get(params).then(function (results) {
            return results;
        });

    };

    // Volunteering stats for one year (YYYY) or all time ('all'); logged-in
    // users only, so a 401 here means the session has ended.
    factory.getVolunteeringStats = function (year) {
        return Restangular.one('stats/volunteering').get({ year: year || 'all' }).then(function (stats) {
            return stats.plain ? stats.plain() : stats;
        });
    };

    // =====================================
    // MEMBER MODALS ======================
    // =====================================

    factory.showAddMemberModal = function () {
        var modalInstance = $uibModal.open({
            templateUrl: 'views/modals/memberModal.html',
            controller: 'MemberModalInstanceController',
            size: 'lg',
            backdrop: 'static',
            resolve: {
                member: false
            }
        });

        return modalInstance.result.then(function (member) {
            factory.createMember(member);
            return member;
        }, function () {
            return null;
        });
    };

    factory.retrieveMemberForEdit = function (member) {
        if (member) {
            var modalInstance = $uibModal.open({
                templateUrl: 'views/modals/memberModal.html',
                controller: 'MemberModalInstanceController',
                size: 'lg',
                backdrop: 'static',
                resolve: {
                    member: function () {
                        return member;
                    }
                }
            });

            return modalInstance.result.then(function (member) {
                factory.editMember(member);
            }, function () {
                return null;
            });
        }
    };

    return factory;

}]);
