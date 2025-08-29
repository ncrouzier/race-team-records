angular.module('mcrrcApp.members').factory('MembersService', ['Restangular', '$uibModal', '$q', 'MemoryCacheService', function(Restangular, $uibModal, $q, MemoryCacheService) {
    var factory = {};
    var members = Restangular.all('members');
    
    // Cache names for MemoryCacheService
    var CACHE_NAMES = {
        MEMBERS: 'members',
        LOADING_PROMISES: 'loadingPromises'
    };
    

    
    // Helper function to strip functions and clean objects for IndexedDB storage
    function stripFunctions(obj) {
        try {
            // First try the simple approach
            var cleaned = JSON.parse(JSON.stringify(obj));
            
            // Additional cleaning for member objects
            if (Array.isArray(cleaned)) {
                cleaned = cleaned.map(function(member) {
                    if (member && typeof member === 'object') {
                        // Remove any problematic properties that might cause IndexedDB issues
                        var cleanMember = {};
                        for (var key in member) {
                            if (member.hasOwnProperty(key)) {
                                var value = member[key];
                                // Skip functions, undefined, and complex nested objects
                                if (typeof value !== 'function' && value !== undefined) {
                                    // Handle dates
                                    if (value instanceof Date) {
                                        cleanMember[key] = value.toISOString();
                                    }
                                    // Handle simple types
                                    else if (typeof value === 'string' || 
                                             typeof value === 'number' || 
                                             typeof value === 'boolean' || 
                                             value === null) {
                                        cleanMember[key] = value;
                                    }
                                    // Handle arrays and objects (but be careful with deep nesting)
                                    else if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
                                        try {
                                            // Try to serialize and deserialize to ensure it's safe
                                            var testSerialize = JSON.stringify(value);
                                            if (testSerialize.length < 1000000) { // Limit size to 1MB
                                                cleanMember[key] = JSON.parse(testSerialize);
                                            } else {
                                                console.warn("Skipping large property:", key, "size:", testSerialize.length);
                                            }
                                        } catch (e) {
                                            console.warn("Skipping problematic property:", key, e.message);
                                        }
                                    }
                                }
                            }
                        }
                        return cleanMember;
                    }
                    return member;
                });
            }
            
            return cleaned;
        } catch (error) {
            console.error("Error in stripFunctions:", error);
            // Fallback: return a minimal version with just essential properties
            if (Array.isArray(obj)) {
                return obj.map(function(member) {
                    if (member && typeof member === 'object') {
                        return {
                            _id: member._id,
                            firstname: member.firstname,
                            lastname: member.lastname,
                            username: member.username,
                            memberStatus: member.memberStatus,
                            dateofbirth: member.dateofbirth,
                            sex: member.sex
                        };
                    }
                    return member;
                });
            }
            return obj;
        }
    }

    // =====================================
    // MEMBERS API CALLS ===================
    // =====================================

    //retrieve members
    factory.getMembers = function(params) {
        return members.getList(params).then(function(members) {            
            return members;
        });
    };

    //retrieve members with cache support (memory cache only)
    factory.getMembersWithCacheSupport = function(params) {        
        var cacheKey = JSON.stringify(params || {});
        
        // Check memory cache first
        var cachedMembers = MemoryCacheService.get(CACHE_NAMES.MEMBERS, cacheKey);
        if (cachedMembers) {
            return $q.resolve(cachedMembers);
        }
        
        // Check for loading promises to prevent duplicate requests
        var loadingPromises = MemoryCacheService.get(CACHE_NAMES.LOADING_PROMISES, cacheKey);
        if (loadingPromises) {
            return loadingPromises;
        }
        
        
        // Fetch from API and cache in memory only
        var promise = members.getList(params).then(function(membersFromDatabase) {            
            // Cache in memory
            MemoryCacheService.set(CACHE_NAMES.MEMBERS, cacheKey, membersFromDatabase);
            MemoryCacheService.set(CACHE_NAMES.LOADING_PROMISES, cacheKey, null);
            
            return membersFromDatabase;
        }).catch(function(error) {
            console.error("❌ API call failed:", error);
            MemoryCacheService.set(CACHE_NAMES.LOADING_PROMISES, cacheKey, null);
            throw error;
        });
        
        MemoryCacheService.set(CACHE_NAMES.LOADING_PROMISES, cacheKey, promise);
        return promise;
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
