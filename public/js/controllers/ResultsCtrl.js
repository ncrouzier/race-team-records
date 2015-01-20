angular.module('mcrrcApp.results').controller('ResultsController', ['$scope', 'AuthService', 'ResultsService', function($scope, AuthService, ResultsService) {

    $scope.user = AuthService.isLoggedIn();

    $scope.resultsList = [];


    ResultsService.getResults({
        "limit": 15,
        "sort": '-updatedAt'
    }).then(function(results) {
        $scope.resultsList = results;
    });



    $scope.showAddResultModal = function() {
        ResultsService.showAddResultModal().then(function(result) {
            $scope.resultsList.push(result);
        });
    };

    $scope.retrieveResultForEdit = function(result) {
        ResultsService.retrieveResultForEdit(result).then(function() {
        });
    };

    $scope.removeResult = function(result) {
        ResultsService.deleteResult(result).then(function() {
            var index = $scope.resultsList.indexOf(result);
            if (index > -1) $scope.resultsList.splice(index, 1);
        });
    };

}]);

angular.module('mcrrcApp.results').controller('ResultModalInstanceController', ['$scope', '$modalInstance', 'result', 'MembersService', 'ResultsService', function($scope, $modalInstance, result, MembersService, ResultsService) {

    MembersService.getMembers().then(function(members) {
        $scope.membersList = members;
    });

    ResultsService.getRaceTypes().then(function(racetypes) {
        $scope.racetypesList = racetypes;
    });

    $scope.editmode = false;
    if (result) {
        $scope.formData = result;
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
