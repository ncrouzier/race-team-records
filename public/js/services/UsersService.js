angular.module('mcrrcApp.results').factory('UsersService', ['Restangular', '$uibModal', '$q', function(Restangular, $uibModal, $q) {

    var factory = {};
    var users = Restangular.all('users');

    // Get all users
    factory.getUsers = function() {
        return users.getList().then(function(usersList) {
            return usersList;
        }, function(res) {
            console.log('Error: ' + res.status);
        });
    };

    // Create user
    factory.createUser = function(userData) {
        return users.post(userData).then(function(response) {
            return response;
        }, function(res) {
            console.log('Error: ' + res.status);
            return $q.reject(res);
        });
    };

    // Edit user
    factory.editUser = function(user, options) {
        // Set afresh each save: never left over from an earlier one
        if (options && options.notifyUser) {
            user.notifyUser = true;
        } else {
            delete user.notifyUser;
        }
        return user.save().then(function(response) {
            delete user.notifyUser;
            return response;
        }, function(res) {
            delete user.notifyUser;
            console.log('Error: ' + res.status);
        });
    };

    // Delete user
    factory.deleteUser = function(user) {
        return user.remove().then(function() {}, function(res) {
            console.log('Error: ' + res.status);
        });
    };

    // Show add user modal
    factory.showAddUserModal = function(membersList) {
        var modalInstance = $uibModal.open({
            templateUrl: 'views/modals/userAddModal.html',
            controller: 'UserAddModalInstanceController',
            // Its own width (mcrrc.less): the site's large modals go full width
            windowClass: 'user-modal-window',
            backdrop: 'static',
            resolve: {
                membersList: function() {
                    return membersList;
                }
            }
        });

        return modalInstance.result.then(function(userData) {
            return factory.createUser(userData);
        }, function() {
            return null;
        });
    };

    // Show edit user modal
    factory.showEditUserModal = function(user, membersList) {
        var modalInstance = $uibModal.open({
            templateUrl: 'views/modals/userEditModal.html',
            controller: 'UserEditModalInstanceController',
            // Its own width (mcrrc.less): the site's large modals go full width
            windowClass: 'user-modal-window',
            backdrop: 'static',
            resolve: {
                user: function() {
                    return user;
                },
                membersList: function() {
                    return membersList;
                }
            }
        });

        // { user, notifyUser }: notifyUser emails them that their account is
        // now active (only when it was just enabled)
        return modalInstance.result.then(function(result) {
            return factory.editUser(result.user, { notifyUser: result.notifyUser });
        }, function() {
            return null;
        });
    };

    return factory;
}]);
