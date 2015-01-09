angular.module('AdminCtrl', []).controller('AdminController', ['$scope', '$modal', 'AuthService', 'Restangular', function($scope, $modal, AuthService, Restangular) {

    $scope.user = AuthService.isLoggedIn();
    var racetypes = Restangular.all('racetypes');

    Restangular.all('racetypes').getList().then(function(racetypes) {
        $scope.racetypesList = racetypes;
    });


    $scope.showAddRaceTypeModal = function() {
        var modalInstance = $modal.open({
            templateUrl: 'raceTypeModal.html',
            controller: 'RaceTypeModalInstanceCtrl',
            size: 'lg',
            resolve: {
                racetype: false
            }
        });

        modalInstance.result.then(function(racetype) {
            $scope.createRaceType(racetype);
        }, function() {
            //cancel
        });
    };

    $scope.createRaceType = function(racetype) {
        console.log(racetype);
        racetypes.post(racetype).then(
            function(racetypes) {
                $scope.racetypesList = racetypes;
            },
            function(res) {
                console.log('Error: ' + res.status);
            });
    };

}]);

angular.module('AdminCtrl').controller('RaceTypeModalInstanceCtrl', ['$scope', '$modalInstance', 'racetype', 'Restangular', function($scope, $modalInstance, racetype, Restangular) {


    $scope.editmode = false;
    if (racetype) {
        $scope.formData = racetype;
        $scope.editmode = true;
    } else {
        $scope.formData = {};
        $scope.editmode = false;
    }

    $scope.surfaces = [{
        surface: 'road'
    }, {
        surface: 'track'
    }, {
        surface: 'cross country'
    }, {
        surface: 'ultra'
    }, {
        surface: 'other'
    }];

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
