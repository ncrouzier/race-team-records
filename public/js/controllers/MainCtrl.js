angular.module('MainCtrl', []).controller('MainController', ['$scope', '$modal', 'AuthService', 'Restangular', function($scope, $modal, AuthService, Restangular) {

    $scope.user = AuthService.isLoggedIn();
    var results = Restangular.all('results');
    $scope.resultsList = [];


    Restangular.all('results').getList().then(function(results) {
        $scope.resultsList = results;
    });




    $scope.showAddResultModal = function() {
        var modalInstance = $modal.open({
            templateUrl: 'resultModal.html',
            controller: 'ResultModalInstanceCtrl',
            size: 'lg',
            resolve: {
                result: false
            }
        });

        modalInstance.result.then(function(result) {
            $scope.createResult(result);
        }, function() {
            //cancel
        });
    };


    $scope.createResult = function(result) {
        results.post(result).then(
            function(results) {
                $scope.resultsList = results;
            },
            function(res) {
                console.log('Error: ' + res.status);
            });
    };


}]);

angular.module('MainCtrl').controller('ResultModalInstanceCtrl', ['$scope', '$modalInstance', 'result', 'Restangular', function($scope, $modalInstance, result, Restangular) {

    Restangular.all('members').getList().then(function(members) {
        $scope.membersList = members;
    });

    Restangular.all('racetypes').getList().then(function(racetypes) {
        $scope.racetypes = racetypes;
    });


    $scope.editmode = false;
    if (result) {
        $scope.formData = result;
        $scope.editmode = true;
    } else {
        $scope.formData = {};
        $scope.editmode = false;
    }

    // =====================================
    // DATE PICKER CONFIG ==================
    // =====================================
    $scope.today = function() {
        $scope.formData.racedate = new Date();
    };
    $scope.today();

    $scope.addResult = function() {
        $scope.formData.time = $scope.time.hours * 3600 + $scope.time.minutes * 60 + $scope.time.seconds;
        console.log($scope.formData);
        $modalInstance.close($scope.formData);
    };

    $scope.editResult = function() {
        $modalInstance.close($scope.formData);
    };

    $scope.cancel = function() {
        $modalInstance.dismiss('cancel');
    };

  

}]);
