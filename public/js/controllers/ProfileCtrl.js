angular.module('mcrrcApp.authentication').controller('ProfileController', ['$scope', '$http', function($scope, $http) {

    $scope.editingProfile = false;
    $scope.editData = {};
    $scope.passwordData = {};
    $scope.profileMessage = '';
    $scope.profileSuccess = false;
    $scope.passwordMessage = '';
    $scope.passwordSuccess = false;

    // Load profile
    $http.get('/api/profile').success(function(data) {
        $scope.user = data.user;
    });

    // Profile editing
    $scope.startEditProfile = function() {
        $scope.editData = {
            username: $scope.user.username,
            email: $scope.user.email
        };
        $scope.profileMessage = '';
        $scope.editingProfile = true;
    };

    $scope.cancelEditProfile = function() {
        $scope.editingProfile = false;
        $scope.profileMessage = '';
    };

    $scope.saveProfile = function() {
        $http.put('/api/profile', $scope.editData).success(function(data) {
            $scope.user = data;
            $scope.editingProfile = false;
            $scope.profileMessage = 'Profile updated successfully.';
            $scope.profileSuccess = true;
        }).error(function(data) {
            $scope.profileMessage = (data && data.message) || 'An error occurred.';
            $scope.profileSuccess = false;
        });
    };

    // Password change
    $scope.changePassword = function() {
        if ($scope.passwordData.newPassword !== $scope.passwordData.confirmPassword) {
            $scope.passwordMessage = 'Passwords do not match.';
            $scope.passwordSuccess = false;
            return;
        }

        $http.post('/api/profile/change-password', {
            currentPassword: $scope.passwordData.currentPassword,
            newPassword: $scope.passwordData.newPassword
        }).success(function(data) {
            $scope.passwordMessage = data.message;
            $scope.passwordSuccess = true;
            $scope.passwordData = {};
        }).error(function(data) {
            $scope.passwordMessage = (data && data.message) || 'An error occurred.';
            $scope.passwordSuccess = false;
        });
    };

}]);
