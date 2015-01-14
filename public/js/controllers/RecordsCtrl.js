angular.module('mcrrcApp.results').controller('RecordsController', ['$scope', 'AuthService', 'ResultsService', function($scope, AuthService, ResultsService) {


    // =====================================
    // FILTER PARAMS CONFIG ================
    // =====================================
    $scope.paramModel = {};
    $scope.paramModel.sex = '.*';
    $scope.paramModel.category = '.*';
    $scope.paramModel.mode = 'All';
    $scope.paramModel.sort = '';
    $scope.paramModel.limit = 5;


    ResultsService.getRaceTypes().then(function(racetypes) {
        $scope.racetypesList = racetypes;
    });


    $scope.getResults = function() {
        var params = {
            "filters[sex]": $scope.paramModel.sex,
            "filters[category]": $scope.paramModel.category,
            "filters[mode]": $scope.paramModel.mode,
            "filters[race]": $scope.paramModel.race,
            limit: $scope.paramModel.race
        };
        ResultsService.getResults(params).then(function(results) {
            console.log(results);
            $scope.resultsList = results;
        });
    };


    $scope.getResults();

}]);
