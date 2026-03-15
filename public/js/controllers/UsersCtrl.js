angular.module('mcrrcApp.results').controller('UsersController', ['$scope', 'AuthService', 'UsersService', 'MembersService', 'dialogs', function($scope, AuthService, UsersService, MembersService, dialogs) {

    // =====================================
    // AUTHENTICATION SETUP ================
    $scope.authService = AuthService;
    $scope.$watch('authService.isLoggedIn()', function(user) {
        $scope.user = user;
    });

    // =====================================
    // FILTERS =============================
    $scope.searchQuery = '';
    $scope.roleFilter = 'All';
    $scope.rolesList = ['All', 'admin', 'captain', 'user'];

    $scope.userFilter = function(user) {
        // Role filter
        if ($scope.roleFilter !== 'All' && user.role !== $scope.roleFilter) {
            return false;
        }
        // Search filter
        if ($scope.searchQuery) {
            var q = $scope.searchQuery.toLowerCase();
            var username = (user.username || '').toLowerCase();
            var email = (user.email || '').toLowerCase();
            if (username.indexOf(q) === -1 && email.indexOf(q) === -1) {
                return false;
            }
        }
        return true;
    };

    // =====================================
    // LOAD DATA ===========================
    UsersService.getUsers().then(function(users) {
        $scope.usersList = users;
    });

    MembersService.getMembersWithCacheSupport({}).then(function(members) {
        $scope.membersList = members.sort(function(a, b) {
            var aStatus = a.memberStatus === 'past' ? 1 : 0;
            var bStatus = b.memberStatus === 'past' ? 1 : 0;
            if (aStatus !== bStatus) return aStatus - bStatus;
            var lastNameCompare = (a.lastname || '').localeCompare(b.lastname || '');
            if (lastNameCompare !== 0) return lastNameCompare;
            return (a.firstname || '').localeCompare(b.firstname || '');
        });
    });

    // =====================================
    // CRUD OPERATIONS =====================

    // Add user
    $scope.addUser = function() {
        UsersService.showAddUserModal($scope.membersList).then(function(newUser) {
            if (newUser) {
                $scope.usersList.push(newUser);
            }
        });
    };

    // Edit user
    $scope.editUser = function(user) {
        UsersService.showEditUserModal(user, $scope.membersList).then(function() {
            // User is already updated via Restangular reference
        });
    };

    // Delete user
    $scope.removeUser = function(user) {
        var dlg = dialogs.confirm("Remove User?", "Are you sure you want to delete user <strong>" + user.username + "</strong>? This action cannot be undone.");
        dlg.result.then(function(btn) {
            UsersService.deleteUser(user).then(function() {
                var index = $scope.usersList.indexOf(user);
                if (index > -1) {
                    $scope.usersList.splice(index, 1);
                }
            });
        }, function(btn) {
            // User cancelled
        });
    };

}]);

// =====================================
// ADD MODAL INSTANCE CONTROLLER ========
angular.module('mcrrcApp.results').controller('UserAddModalInstanceController', ['$scope', '$uibModalInstance', 'membersList', function($scope, $uibModalInstance, membersList) {

    $scope.membersList = membersList;

    $scope.formData = {
        username: '',
        email: '',
        password: '',
        role: 'user',
        member: null
    };

    $scope.roleOptions = ['admin', 'captain', 'user'];

    $scope.createUser = function() {
        var data = {
            username: $scope.formData.username,
            email: $scope.formData.email,
            password: $scope.formData.password,
            role: $scope.formData.role
        };
        if ($scope.formData.member) {
            data.member = $scope.formData.member._id;
        }
        $uibModalInstance.close(data);
    };

    $scope.cancel = function() {
        $uibModalInstance.dismiss('cancel');
    };

}]);

// =====================================
// EDIT MODAL INSTANCE CONTROLLER =======
angular.module('mcrrcApp.results').controller('UserEditModalInstanceController', ['$scope', '$uibModalInstance', 'user', 'membersList', function($scope, $uibModalInstance, user, membersList) {

    $scope.membersList = membersList;

    // Copy the user data
    $scope.formData = {
        username: user.username,
        email: user.email,
        role: user.role,
        member: null
    };

    // Find matching member object from membersList
    if (user.member && user.member._id) {
        $scope.formData.member = membersList.find(function(m) {
            return m._id === user.member._id;
        }) || null;
    }

    $scope.roleOptions = ['admin', 'captain', 'user'];

    $scope.saveUser = function() {
        user.username = $scope.formData.username;
        user.email = $scope.formData.email;
        user.role = $scope.formData.role;
        user.member = $scope.formData.member ? $scope.formData.member._id : null;
        $uibModalInstance.close(user);
    };

    $scope.cancel = function() {
        $uibModalInstance.dismiss('cancel');
    };

}]);
