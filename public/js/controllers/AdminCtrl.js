angular.module('mcrrcApp.results').controller('AdminController', ['$scope', '$modal', 'AuthService', 'ResultsService', function($scope, $modal, AuthService, ResultsService) {
    $scope.user = AuthService.isLoggedIn();


    ResultsService.getRaceTypes({
        sort: 'meters'
    }).then(function(raceTypes) {
        $scope.racetypesList = raceTypes;
    });


    $scope.showAddRaceTypeModal = function() {
        var modalInstance = $modal.open({
            templateUrl: 'raceTypeModal.html',
            controller: 'RaceTypeModalInstanceController',
            size: 'lg',
            resolve: {
                racetype: false
            }
        });

        modalInstance.result.then(function(racetype) {
            ResultsService.createRaceType(racetype);
            $scope.racetypesList.push(racetype);
        }, function() {});
    };

    // select a racetype after checking it
    $scope.retrieveRaceTypeForEdit = function(racetype) {
        if (racetype) {
            var modalInstance = $modal.open({
                templateUrl: 'raceTypeModal.html',
                controller: 'RaceTypeModalInstanceController',
                size: 'lg',
                resolve: {
                    racetype: function() {
                        return racetype;
                    }
                }
            });

            modalInstance.result.then(function(racetype) {
                ResultsService.editRaceType(racetype);
            }, function() {
                //cancel
            });
        }
    };

    $scope.removeRaceType = function(racetype) {
        ResultsService.deleteRaceType(racetype).then(function() {
            var index = $scope.racetypesList.indexOf(racetype);
            if (index > -1) $scope.racetypesList.splice(index, 1);
        });
    };



}]);

angular.module('mcrrcApp.results').controller('RaceTypeModalInstanceController', ['$scope', '$modalInstance', 'racetype',  function($scope, $modalInstance, racetype) {


    $scope.editmode = false;
    if (racetype) {
        $scope.formData = racetype;
        $scope.editmode = true;
    } else {
        $scope.formData = {};
        $scope.editmode = false;
    }

    $scope.surfaces = ['road', 'track', 'cross country', 'ultra', 'other'];

    $scope.addRaceType = function() {
        $modalInstance.close($scope.formData);
    };

    $scope.editRaceType = function() {
        $modalInstance.close($scope.formData);
    };

    $scope.cancel = function() {
        $modalInstance.dismiss('cancel');
    };



}]);
