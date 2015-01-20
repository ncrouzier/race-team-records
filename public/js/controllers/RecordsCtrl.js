angular.module('mcrrcApp.results').controller('RecordsController', ['$scope', 'AuthService', 'ResultsService', '$http', function($scope, AuthService, ResultsService, $http) {

    $scope.user = AuthService.isLoggedIn();

    // =====================================
    // FILTER PARAMS CONFIG ================
    // =====================================
    $scope.paramModel = {};
    $scope.paramModel.sex = '.*';
    $scope.paramModel.category = '.*';
    $scope.paramModel.mode = 'All';
    $scope.paramModel.sort = 'time';
    $scope.paramModel.racetype = "";
    $scope.paramModel.limit = 5;


    ResultsService.getRaceTypes().then(function(racetypes) {
        $scope.racetypesList = racetypes;
    });


    $scope.getResults = function() {

        var params = {
            "filters": {
                "sex": $scope.paramModel.sex,
                "category": $scope.paramModel.category,
                "mode": $scope.paramModel.mode,
                "racetype": $scope.paramModel.racetype,
            },
            "limit": $scope.paramModel.limit,
            "sort": $scope.paramModel.sort
        };


        ResultsService.getResults(params).then(function(results) {
            $scope.resultsList = results;
        });
    };

    $scope.retrieveResultForEdit = function(result) {
        ResultsService.retrieveResultForEdit(result).then(function(result) {});
    };


}]);
