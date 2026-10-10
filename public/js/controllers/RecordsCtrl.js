angular.module('mcrrcApp.results').controller('RecordsController', ['$scope', '$rootScope', 'Analytics', 'AuthService', 'ResultsService', '$http', 'dialogs', 'localStorageService', '$state', function($scope, $rootScope, Analytics, AuthService, ResultsService, $http, dialogs, localStorageService, $state) {

    // Admins can also pick "All": every result of the race type, not just
    // the top few — for checking the data rather than reading the records.
    var SIZES = [3, 5, 10, 20];
    var ALL = 'All';
    var DEFAULT_SIZE = 5;
    // "All" can be a couple of thousand rows, which take seconds to draw, so
    // it is shown a page at a time
    var PAGE_SIZE = 100;
    $scope.pagination = { current: 1 };

    function isAdmin() {
        return !!($scope.user && $scope.user.role === 'admin');
    }

    $scope.authService = AuthService;
    $scope.$watch('authService.isLoggedIn()', function(user) {
        $scope.user = user;
    });

    // Once the login is known: offer "All" to admins only, and take it back
    // from anyone else who still has it saved (an admin who logged out).
    // A saved "All" waits for this before loading anything, see getResults.
    $scope.$watch(function() {
        return $rootScope.authResolved + '|' + ($scope.user ? $scope.user.role : '');
    }, function() {
        $scope.resultSize = isAdmin() ? SIZES.concat([ALL]) : SIZES;
        if (!$rootScope.authResolved || $scope.paramModel.limit !== ALL) return;
        if (!isAdmin()) {
            $scope.paramModel.limit = DEFAULT_SIZE;
        }
        $scope.getResults();
    });

    $scope.getResults = function() {
        // "All" is admin-only; until the login is known, hold off rather than
        // fetch every result for someone who may not be allowed it
        if ($scope.paramModel.limit === ALL && (!$rootScope.authResolved || !isAdmin())) {
            return;
        }
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
                // No limit is how the API returns everything. Otherwise one
                // more than shown, so a tie on the last place is still seen.
                "limit": $scope.paramModel.limit === ALL ? undefined : Number($scope.paramModel.limit) + 1,
                "sort": $scope.paramModel.sortMode
            };


            var shown = $scope.paramModel.limit === ALL ? ALL : Number($scope.paramModel.limit);
            ResultsService.getResults(params).then(function(results) {
                assignRanks(results, $scope.paramModel.sortMode);
                $scope.pagination.current = 1;
                $scope.resultsList = shown === ALL ? results : results.slice(0, shown);
            });
        }

        //save selection in storage
        localStorageService.set('records.options', $scope.paramModel);

        Analytics.event('view_records', {
            race_type: $scope.paramModel.racetype.name,
            surface: $scope.paramModel.racetype.surface,
            // '.*' is the query's wildcard: "All"
            sex: $scope.paramModel.sex === '.*' ? 'All' : $scope.paramModel.sex,
            category: $scope.paramModel.category === '.*' ? 'All' : $scope.paramModel.category,
            mode: $scope.paramModel.mode
        });

    };

    // Competition ranking on whatever the list is sorted by: two results tied
    // for 1st are both 1st, and the next is 3rd. The list arrives sorted.
    function assignRanks(list, sortMode) {
        var valueOf = sortMode === '-agegrade' ?
            function(r) { return r.agegrade; } :
            function(r) { return r.time; };
        list.forEach(function(r, i) {
            r.rank = i > 0 && valueOf(r) === valueOf(list[i - 1]) ? list[i - 1].rank : i + 1;
        });
        list.forEach(function(r, i) {
            r.tied = (i > 0 && valueOf(list[i - 1]) === valueOf(r)) ||
                (i < list.length - 1 && valueOf(list[i + 1]) === valueOf(r));
            // Time behind the row above, worked out here rather than in the
            // template because the template's $index restarts on every page
            r.gap = sortMode === 'time' && i > 0 && r.time !== list[i - 1].time ? r.time - list[i - 1].time : null;
        });
    }

    // Rows per page: a page of 100 for "All", otherwise the whole list
    $scope.pageSize = function() {
        if ($scope.paramModel.limit === ALL) return PAGE_SIZE;
        return Math.max(1, ($scope.resultsList || []).length);
    };

    // Back to the top of the list, not wherever the pager left the page
    $scope.pageChanged = function() {
        var list = document.querySelector('.records-list');
        if (list && list.getBoundingClientRect().top < 0) {
            list.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    $scope.rankLabel = function(result) {
        return (result.tied ? 'T' : '') + result.rank;
    };

    // A click anywhere on a record row opens that result's own page
    $scope.goToResult = function(result) {
        if (result && result._id) {
            Analytics.event('select_content', { content_type: 'result', item_id: result._id, source: 'records_row' });
            $state.go('/results/result', { resultId: result._id });
        }
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

    $scope.showRaceModal = function(race) {
        if(race){
            ResultsService.showRaceFromResultModal(race._id).then(function(result) {                
            });
        }
    };  

    // =====================================
    // FILTER PARAMS CONFIG ================
    // =====================================
    $scope.resultSize = SIZES;
    $scope.paramModel = {};
    //load storage params and records if existing, if not set defaults
    if (localStorageService.get('records.options')){
        $scope.paramModel = localStorageService.get('records.options');
        $scope.getResults();
    }else{
        $scope.paramModel.sex = '.*';
        $scope.paramModel.category = '.*'; // Open (all ages)
        $scope.paramModel.mode = 'All';
        $scope.paramModel.racetype = "";
        $scope.paramModel.limit = DEFAULT_SIZE;
        $scope.paramModel.sortMode = 'time';
    }


    ResultsService.getRaceTypes({
        sort: 'meters',
        isVariable: 'false'
    }).then(function(racetypes) {
        $scope.racetypesList =racetypes;
    });





}]);
