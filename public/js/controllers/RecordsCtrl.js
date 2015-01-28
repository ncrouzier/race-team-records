angular.module('mcrrcApp.results').controller('RecordsController', ['$scope', '$analytics', 'AuthService', 'ResultsService', '$http', 'dialogs', function($scope, $analytics, AuthService, ResultsService, $http, dialogs) {

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


    ResultsService.getRaceTypes({
        sort: 'meters'
    }).then(function(racetypes) {
        $scope.racetypesList = racetypes;
    });


    $scope.getResults = function() {
        if ($scope.paramModel.racetype !== '') {
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
        }
        $analytics.eventTrack('viewRecords', {
            category: 'Records',
            label: 'viewing record for ' + $scope.paramModel.racetype.name + ' (' + $scope.paramModel.racetype.surface+') sex= '+$scope.paramModel.sex+' category= '+$scope.paramModel.category+ ' mode= '+$scope.paramModel.mode
        });

    };

    $scope.retrieveResultForEdit = function(result) {
        ResultsService.retrieveResultForEdit(result).then(function(result) {});
    };

    $scope.removeResult = function(result) {
        var dlg = dialogs.confirm("Remove Result?", "Are you sure you want to remove this result?");
        dlg.result.then(function(btn) {
            ResultsService.deleteResult(result).then(function() {
                var index = $scope.resultsList.indexOf(result);
                if (index > -1) $scope.resultsList.splice(index, 1);
            });
        }, function(btn) {});
    };


}]);
