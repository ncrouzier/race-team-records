angular.module('mcrrcApp.results').factory('ResultsService', ['Restangular', 'UtilsService', '$modal', '$q', function(Restangular, UtilsService, $modal, $q) {

    var factory = {};
    var results = Restangular.all('results');
    var racetypes = Restangular.all('racetypes');
    var systeminfos = Restangular.all('systeminfos');
    var cachedResults;
    var cachedResultsDate;
    // =====================================
    // RESULTS API CALLS ===================
    // =====================================




    //retrieve results
    factory.getResultsWithCacheSupport = function(params) {
        return UtilsService.getSystemInfo('mcrrc').then(function(sysinfo) {
            var date = new Date(sysinfo.resultUpdate);
            if (cachedResults === undefined || date > cachedResultsDate) {
                return results.getList(params).then(function(results) {
                    cachedResultsDate = date;
                    cachedResults = results;
                    return results;
                });
            } else {
                return $q(function(resolve, reject) {
                    resolve(cachedResults);
                });
            }
        });
    };


    //retrieve results
    factory.getResults = function(params) {
        return results.getList(params).then(function(results) {
            return results;
        });
    };

    //retrieve a result by id
    factory.createResult = function(result) {
        return results.post(result).then(
            function(results) {},
            function(res) {
                console.log('Error: ' + res.status);
            });
    };

    //edit a member
    factory.editResult = function(result) {
        result.save();
    };

    ///delete a member
    factory.deleteResult = function(result) {
        return result.remove().then(
            function() {},
            function(res) {
                console.log('Error: ' + res.status);
            });
    };

    // =====================================
    // RESULTS MODALS ======================
    // =====================================

    factory.showAddResultModal = function() {
        var modalInstance = $modal.open({
            templateUrl: 'views/modals/resultModal.html',
            controller: 'ResultModalInstanceController',
            size: 'lg',
            resolve: {
                result: false
            }
        });

        return modalInstance.result.then(function(result) {
            factory.createResult(result);
            return result;
        }, function() {
            return null;
        });
    };

    factory.retrieveResultForEdit = function(result) {
        if (result) {
            var modalInstance = $modal.open({
                templateUrl: 'views/modals/resultModal.html',
                controller: 'ResultModalInstanceController',
                size: 'lg',
                resolve: {
                    result: function() {
                        return result;
                    }
                }
            });

            return modalInstance.result.then(function(result) {
                factory.editResult(result);
            }, function() {
                return null;
            });
        }
    };


    // =====================================
    // RACETYPE API CALLS ==================
    // =====================================

    //retrieve racetypes
    factory.getRaceTypes = function(params) {
        return racetypes.getList(params).then(function(racetypes) {
            return racetypes;
        });
    };

    //retrieve a racetype by id
    factory.createRaceType = function(racetype) {
        return racetypes.post(racetype).then(
            function(racetypes) {},
            function(res) {
                console.log('Error: ' + res.status);
            });
    };

    //edit a racetype
    factory.editRaceType = function(racetype) {
        racetype.save();
    };

    //delete a racetype
    factory.deleteRaceType = function(racetype) {
        return racetype.remove().then(
            function() {},
            function(res) {
                console.log('Error: ' + res.status);
            });
    };

    // =====================================
    // RACETYPE MODALS =====================
    // =====================================

    factory.showAddRaceTypeModal = function() {
        var modalInstance = $modal.open({
            templateUrl: 'views/modals/raceTypeModal.html',
            controller: 'RaceTypeModalInstanceController',
            size: 'lg',
            resolve: {
                racetype: false
            }
        });

        return modalInstance.result.then(function(racetype) {
            factory.createRaceType(racetype);
            return racetype;
        }, function() {
            return null;
        });
    };

    factory.retrieveRaceTypeForEdit = function(racetype) {
        if (racetype) {
            var modalInstance = $modal.open({
                templateUrl: 'views/modals/raceTypeModal.html',
                controller: 'RaceTypeModalInstanceController',
                size: 'lg',
                resolve: {
                    racetype: function() {
                        return racetype;
                    }
                }
            });

            return modalInstance.result.then(function(racetype) {
                factory.editRaceType(racetype);
            }, function() {
                return null;
            });
        }
    };



    // =====================================
    // PDF API =====================
    // =====================================
    factory.getResultsForPdf = function(params) {

        return Restangular.one('pdfreport').get(params).then(
            function(results) {
                return results;
            },
            function(res) {
                console.log('Error: ' + res.status);
            });

    };


    // =====================================
    // STATS API =====================
    // =====================================
    factory.getMilesRaced = function(params) {
        return Restangular.one('milesraced').get(params).then(
            function(sum) {
                return sum;
            },
            function(res) {
                console.log('Error: ' + res.status);
            });

    };

    return factory;

}]);
