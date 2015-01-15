angular.module('mcrrcApp.results').controller('RecordsController', ['$scope', 'AuthService', 'ResultsService', '$http', function($scope, AuthService, ResultsService, $http) {


    // =====================================
    // FILTER PARAMS CONFIG ================
    // =====================================
    $scope.paramModel = {};
    $scope.paramModel.sex = '.*';
    $scope.paramModel.category = '.*';
    $scope.paramModel.mode = 'All';
    $scope.paramModel.sort = 'time';
    $scope.paramModel.racetype = "";
    $scope.paramModel.limit = 10;


    ResultsService.getRaceTypes().then(function(racetypes) {
        $scope.racetypesList = racetypes;
    });


    $scope.getResults = function() {

        // var params = {
        //     "sex": $scope.paramModel.sex,
        //     "category": $scope.paramModel.category,
        //     "mode": $scope.paramModel.mode,
        //     "racetype": $scope.paramModel.racetype,
        //     "limit": $scope.paramModel.limit
        // };

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


    $scope.getResults();

}]);
