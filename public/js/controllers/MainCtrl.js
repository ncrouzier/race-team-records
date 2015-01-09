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

    // select a result after checking it
    $scope.retrieveResultForEdit = function(result) {
        if (result) {
            var modalInstance = $modal.open({
                templateUrl: 'resultModal.html',
                controller: 'ResultModalInstanceCtrl',
                size: 'lg',
                resolve: {
                    result: function() {
                        return result;
                    }
                }
            });

            modalInstance.result.then(function(result) {
                $scope.editResult(result);
            }, function() {
                //cancel
            });
        }
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

    // when submitting the add form, send the text to the node API
    $scope.editResult = function(result) {
        result.save();
    };

    // delete a result after checking it
    $scope.deleteResult = function(result) {
        result.remove().then(
            function() {
                var index = $scope.resultsList.indexOf(result);
                if (index > -1) $scope.resultsList.splice(index, 1);
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
        $scope.racetypesList = racetypes;
    });


    $scope.editmode = false;
    if (result) {
        $scope.formData = result;
        console.log(result);
        $scope.editmode = true;
        $scope.formData.dateofbirth = new Date();
        $scope.time = {};
        $scope.time.hours = Math.floor($scope.formData.time / 3600);
        $scope.time.minutes = Math.floor($scope.formData.time / 60) % 60;
        $scope.time.seconds = $scope.formData.time % 60;
    } else {
        $scope.formData = {};
        $scope.editmode = false;
    }



    $scope.addResult = function() {
        $scope.formData.time = $scope.time.hours * 3600 + $scope.time.minutes * 60 + $scope.time.seconds;
        console.log($scope.formData);
        $modalInstance.close($scope.formData);
    };

    $scope.editResult = function() {
        $scope.formData.time = $scope.time.hours * 3600 + $scope.time.minutes * 60 + $scope.time.seconds;
        $modalInstance.close($scope.formData);
    };

    $scope.cancel = function() {
        $modalInstance.dismiss('cancel');
    };

    // =====================================
    // DATE PICKER CONFIG ==================
    // =====================================

    $scope.open = function($event) {
        $event.preventDefault();
        $event.stopPropagation();

        $scope.opened = true;
    };


}]);
