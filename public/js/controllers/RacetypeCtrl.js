angular.module('mcrrcApp.results').controller('RaceTypeController', ['$scope', 'AuthService', 'ResultsService', 'dialogs', function($scope, AuthService, ResultsService, dialogs) {

    $scope.authService = AuthService;
    $scope.$watch('authService.isLoggedIn()', function(user) {
        $scope.user = user;
    });

    ResultsService.getRaceTypes({
        sort: 'meters'
    }).then(function(raceTypes) {
        $scope.racetypesList = raceTypes;
    });


    $scope.showAddRaceTypeModal = function() {
        ResultsService.showAddRaceTypeModal().then(function(racetype) {
            if (racetype !== null) {
                $scope.racetypesList.push(racetype);
            }
        });
    };

    // select a racetype after checking it
    $scope.retrieveRaceTypeForEdit = function(racetype) {
        ResultsService.retrieveRaceTypeForEdit(racetype).then(function() {});
    };

    $scope.removeRaceType = function(racetype) {
        var dlg = dialogs.confirm("Remove RaceType?", "Are you sure you want to remove this racetype?");
        dlg.result.then(function(btn) {
            ResultsService.deleteRaceType(racetype).then(function() {
                var index = $scope.racetypesList.indexOf(racetype);
                if (index > -1) $scope.racetypesList.splice(index, 1);
            });
        }, function(btn) {});
    };



}]);

angular.module('mcrrcApp.results').controller('RaceTypeModalInstanceController', ['$scope', '$uibModalInstance', 'racetype', function($scope, $uibModalInstance, racetype) {
    $scope.autoconvert = true;
    $scope.editmode = false;
    if (racetype) {
        $scope.formData = racetype;
        $scope.editmode = true;
    } else {
        $scope.formData = {};
        $scope.formData.isVariable = false;
        $scope.editmode = false;
    }

    $scope.surfaces = ['road', 'track', 'cross country', 'ultra', 'other'];

    $scope.onMetersChange = function() {
        if ($scope.autoconvert) {
            $scope.formData.miles = $scope.formData.meters * 0.000621371;
        }
    };

    $scope.onMilesChange = function() {
        if ($scope.autoconvert) {
            $scope.formData.meters = $scope.formData.miles * 1609.3440;
        }
    };

    $scope.addRaceType = function() {
        if ($scope.formData.isVariable){
            $scope.formData.meters = null;
            $scope.formData.miles = null;
        }
        $uibModalInstance.close($scope.formData);
    };

    $scope.editRaceType = function() {
        if ($scope.formData.isVariable){
            $scope.formData.meters = null;
            $scope.formData.miles = null;
        }
        $uibModalInstance.close($scope.formData);
    };

    $scope.cancel = function() {
        $uibModalInstance.dismiss('cancel');
    };



}]);
