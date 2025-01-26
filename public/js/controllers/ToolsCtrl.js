angular.module('mcrrcApp.tools').controller('ToolsController', ['$scope', '$location', '$timeout', '$state', '$stateParams', '$http', '$analytics', 'AuthService', 'MembersService', 'ResultsService', 'dialogs', '$filter', 'UtilsService', 'localStorageService', function ($scope, $location, $timeout, $state, $stateParams, $http, $analytics, AuthService, MembersService, ResultsService, dialogs, $filter, UtilsService, localStorageService) {

    $scope.authService = AuthService;
    $scope.$watch('authService.isLoggedIn()', function (user) {
        $scope.user = user;
    });

    $scope.$watch('formData.age', function (user) {
        if ($scope.formData.age >= 5 && $scope.formData.age <= 110 && $scope.formData.sex) {
            $scope.submitForm();
        }
    });

    if (localStorageService.get('tools.agegrade.options')){
        $scope.formData = localStorageService.get('tools.agegrade.options');
    }else{
        $scope.formData = {
        };
    }

    $scope.getAgeGrade = function (time,ref) {
        return $filter('timeToAgeGrade')(time, ref,false);
    };
   

    $scope.getYears = function () {
        var years = [];
        for (var i = 18; i <= 99; i++) {
            years.push(i);
        }
        return years;
    };

    $scope.getSexes = function () {
        return ['Male', 'Female'];
    };

    $scope.getSurfaces = function () {
        return ['Road', 'Track'];
    };

    $scope.submitForm = function () {
        if ($scope.formData.age >= 5 && $scope.formData.age <= 110 && $scope.formData.sex) {
            UtilsService.getAgeGrade({
                sex: $scope.formData.sex,
                surface: $scope.formData.surface,
                age: $scope.formData.age
            }).then(function (agegrade) {
                localStorageService.set('tools.agegrade.options', $scope.formData);
                $scope.roadTableData = agegrade[0];
                $scope.trackTableData = agegrade[1];
                if (!$scope.roadTableData) {
                    $scope.currentType = 'Track';
                } else {
                    $scope.currentType = 'Road';
                }
                $scope.currentAge = $scope.formData.age;
            });
        }
    };


    $scope.switchType = function () {
        $scope.currentType = $scope.currentType === 'Road' ? 'Track' : 'Road';
    };

    $scope.hasOtherType = function () {
        if ($scope.currentType === 'Road' && $scope.trackTableData) {
            return true;
        } else if ($scope.currentType === 'Track' && $scope.roadTableData) {
            return true;
        }
        return false;
    };

    $scope.getDistances = function () {
        if ($scope.currentType === 'Road') {
            data = $scope.roadTableData;
        } else if ($scope.currentType === 'Track') {
            data = $scope.trackTableData;
        }
        if (!data) {
            return [];
        }

        return Object.keys(data).slice(5).reduce(function (obj, key) {
            obj[key] = data[key];
            return obj;
        }, {});
    };



}]);


