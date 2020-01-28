angular.module('mcrrcApp.results').controller('RecordsController', ['$scope', '$analytics', 'AuthService', 'ResultsService', '$http', 'dialogs', 'localStorageService', function($scope, $analytics, AuthService, ResultsService, $http, dialogs, localStorageService) {

    $scope.authService = AuthService;
    $scope.$watch('authService.isLoggedIn()', function(user) {
        $scope.user = user;
    });

    $scope.getResults = function() {
        if ($scope.paramModel.racetype !== '') {
          if(!$scope.paramModel.racetype.hasAgeGradedInfo){
             $scope.paramModel.sortMode = 'time';
          }
            var params = {
                "filters": {
                    "sex": $scope.paramModel.sex,
                    "category": $scope.paramModel.category,
                    "mode": $scope.paramModel.mode,
                    "racetype": $scope.paramModel.racetype
                },
                "limit": $scope.paramModel.limit,
                "sort": $scope.paramModel.sortMode
            };


            ResultsService.getResults(params).then(function(results) {
                $scope.resultsList = results;
            });
        }

        //save selection in storage
        localStorageService.set('recordsParams', $scope.paramModel);

        $analytics.eventTrack('viewRecords', {
            category: 'Records',
            label: 'viewing record for ' + $scope.paramModel.racetype.name + ' (' + $scope.paramModel.racetype.surface + ') sex= ' + $scope.paramModel.sex + ' category= ' + $scope.paramModel.category + ' mode= ' + $scope.paramModel.mode
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

    $scope.getRaceTypeClass = function(s){
        if (s !== undefined){
            return s.replace(/ /g, '')+'-col';
        }
    };

    $scope.showRaceModal = function(result) {
        ResultsService.showRaceFromResultModal(result).then(function(result) {
        });
    };

    // =====================================
    // FILTER PARAMS CONFIG ================
    // =====================================
    $scope.resultSize = [3, 5, 10, 20];
    $scope.paramModel = {};
    //load storage params and records if existing, if not set defaults
    if (localStorageService.get('recordsParams')){
        $scope.paramModel = localStorageService.get('recordsParams');
        $scope.getResults();
    }else{
        $scope.paramModel.sex = '.*';
        $scope.paramModel.category = '.*';
        $scope.paramModel.mode = 'All';
        $scope.paramModel.racetype = "";
        $scope.paramModel.limit = 5;
        $scope.paramModel.sortMode = 'time';
    }


    ResultsService.getRaceTypes({
        sort: 'meters',
        isVariable: 'false'
    }).then(function(racetypes) {
        $scope.racetypesList =racetypes;
    });







}]);
