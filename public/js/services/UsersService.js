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
    factory.editUser = function(user) {
        return user.save().then(function(response) {
            return response;
        }, function(res) {
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
            size: 'lg',
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
            size: 'lg',
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

        return modalInstance.result.then(function(updatedUser) {
            return factory.editUser(updatedUser);
        }, function() {
            return null;
        });
    };

    return factory;
}]);
