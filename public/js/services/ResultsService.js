angular.module('mcrrcApp.results').factory('ResultsService', ['Restangular', 'UtilsService', '$uibModal', '$q', function(Restangular, UtilsService, $uibModal, $q) {

    var factory = {};
    var results = Restangular.all('results');
    var racetypes = Restangular.all('racetypes');
    var races = Restangular.all('races');
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

    //retrieve results with pagination
    factory.getResultsPagination = function(params) {
        console.log("prout");
        return results.get(params).then(
            function(results) {
                return results;
            },
            function(res) {
                console.log('Error: ' + res.status);
            });
    };
    

    //retrieve a result by id
    factory.createResult = function(result) {
        return results.post(result).then(
            function(r) {
                return r;
            },
            function(res) {
                console.log('Error: ' + res.status);
            }
        );
    };

    //edit a member
    factory.editResult = function(result) {
        return result.save().then(
            function(r) {
                return r;
            },
            function(res) {
                console.log('Error: ' + res.status);
            }
        );
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
        var modalInstance = $uibModal.open({
            templateUrl: 'views/modals/resultModal.html',
            controller: 'ResultModalInstanceController',
            size: 'lg',
            resolve: {
                result: false
            }
        });

        return modalInstance.result.then(function(result) {
            return factory.createResult(result).then(
                function(r) {
                    return r;
                }, function() {
                    return null;
                }
            );
        }, function() {
            return null;
        });
    };

    factory.retrieveResultForEdit = function(result) {
        if (result) {
            var modalInstance = $uibModal.open({
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
                return factory.editResult(result).then(
                    function(r) {
                        return r;
                    }, function() {
                        return null;
                    }
                );
            }, function() {
                return null;
            });
        }
    };



    // =====================================
    // RACE MODALS =========================
    // =====================================    


    factory.getRaces = function(params) {
        return races.getList(params).then(function(races) {
            return races;
        });
    };


    factory.showRaceModal = function(result) {
        return Restangular.one('raceinfos').get({
            limit: 1,
            resultId: result._id
        }).then(
            function(races) {
                if (races.length === 1) {
                    var modalInstance = $uibModal.open({
                        templateUrl: 'views/modals/raceModal.html',
                        controller: 'RaceModalInstanceController',
                        size: 'lg',
                        resolve: {
                            race: races[0]
                        }
                    });
                    modalInstance.result.then(function() {

                    }, function() {});

                }
            },
            function(res) {
                console.log('Error: ' + res.status);
            });





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
        var modalInstance = $uibModal.open({
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
            var modalInstance = $uibModal.open({
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

    factory.getBestRaceShowing = function(params) {
        return Restangular.one('raceinfos').get(params).then(
            function(races) {
                return races;
            },
            function(res) {
                console.log('Error: ' + res.status);
            });
    };




    return factory;

}]);
