angular.module('mcrrcApp.results').factory('ResultsService', ['Restangular', 'UtilsService', '$uibModal', '$q','localStorageService','$state','NotificationService', function(Restangular, UtilsService, $uibModal, $q, localStorageService, $state,NotificationService) {

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


    async function getCurrent(db) {
        var  results = await db.results.get("current");            
        return results;
      }

    //retrieve results
    factory.getResultsWithCacheSupport = async function (params) {
        var sysinfo = await UtilsService.getSystemInfo('mcrrc').then(function (sysinfo) {
            return sysinfo;
        });

        var db = new Dexie("mcrrcAppDatabase");
        db.version(1).stores({
            results: 'instance,date,data'
        });
        var date = new Date(sysinfo.resultUpdate);

        await db.open();
        var currentCache = await getCurrent(db);
        // console.log("current database", currentCache);
        if (currentCache === undefined || date > new Date(currentCache.date)) {
            // console.log("cache is undefined or out of date so we retrieve from the database",params);
            return results.getList(params).then(function (resultsFromDatabase) {
                if (!params.preload) {
                    // console.log("result retrieved preload == false so we save cache ",resultsFromDatabase);
                    db.results.put({ instance: "current", date: date, data: JSON.stringify(resultsFromDatabase) }).then(function (tata) {
                        // console.log("Done inserting data in cache");        
                    });
                }
                // console.log("done retrieved function");  
                return resultsFromDatabase;
            });
        } else {
            // console.log("using cache");                        
            var res = $q(function (resolve, reject) {
                resolve(Restangular.restangularizeCollection(null, JSON.parse(currentCache.data), 'results', true));
                // console.log("done restangularizeCollection");
            });
            // console.log("done retrieve cache");
            return res;
        }
    };



    //retrieve results
    factory.getResults = function(params) {
        return results.getList(params).then(function(results) {
            return results;
        });
    };

    /**
     * Create a result by id
     * @param {Object} result - the result to create
     * @param {Array} resultsList - the list of results to add the new result to
     * @return {Promise} - the promise of the created result
     */
    factory.createResult = async function(result,resultsList) {
        //post the result to the database
        return results.post(result).then(
            function(r) {
                //simple success notification
                NotificationService.showNotifiction(true,"Result created successfully!");
                //if the list of results is provided, add the new result to the beginning of the list
                if(resultsList){
                    resultsList.unshift(r);
                }
                //return the created result
                return r;
            },
            function(res) {
                NotificationService.showNotifiction(false,"Error while creating result.");
                console.log('Error: ' + res.status);
            }
        );
    };

    /**
     * Save multiple results at once
     * @param {Array} resultsToSave - Array of results to save
     * @return {Promise} - Promise that resolves when all results are saved
     */
    factory.saveResults = function(resultsToSave) {
        // Helper function to save results sequentially
        function saveSequentially(resultsToSave, index = 0, savedResults = []) {
            if (index >= resultsToSave.length) {
                return $q.resolve(savedResults);
            }

            return results.post(resultsToSave[index]).then(
                function(r) {
                    savedResults.push(r);
                    return saveSequentially(resultsToSave, index + 1, savedResults);
                },
                function(error) {
                    console.error('Error saving result:', error);
                    return $q.reject(error);
                }
            );
        }

        // Start sequential saving
        return saveSequentially(resultsToSave).then(
            function(savedResults) {
                NotificationService.showNotifiction(true, savedResults.length + " results saved successfully!");
                return savedResults;
            },
            function(error) {
                NotificationService.showNotifiction(false, "Error while saving results.");
                throw error;
            }
        );
    };

    //edit a result
    factory.editResult = function(result) {
        return result.save().then(
            function(r) {
                NotificationService.showNotifiction(true,"Result edited successfully!");                
                return r;                
            },
            function(res) {
                NotificationService.showNotifiction(false,"Error while editing result.");
                console.log('Error: ' + res.status);
            }
        );
    };

    ///delete a result
    factory.deleteResult = function(result) {
        return result.remove().then(
            function() {
                NotificationService.showNotifiction(true,"Result deleted successfully!");
            },
            function(res) {
                NotificationService.showNotifiction(false,"Result while deleting result!");
                console.log('Error: ' + res.status);
            });
    };

    // =====================================
    // RESULTS MODALS ======================
    // =====================================

    factory.showAddResultModal = function(result,resultsList) {
        var modalInstance = $uibModal.open({
            templateUrl: 'views/modals/resultModal.html',
            controller: 'ResultModalInstanceController',
            size: 'lg',
            backdrop: 'static',
            resolve: {
                editmode: false,
                resultsList: function() {
                    return resultsList;
                },
                result: function() {
                    return result;
                }
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
                backdrop: 'static',
                resolve: {
                    editmode: true,
                    resultsList: function() {
                        return null;
                    },
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

    factory.showResultDetailsModal = function(result,race) {
            var modalInstance = $uibModal.open({
                templateUrl: 'views/modals/resultDetailsModal.html',
                controller: 'ResultDetailslInstanceController',
                size: 'lg',
                resolve: {
                    result: result,
                    race: race
                }
            });
            return modalInstance.result.then(function() {
                return null;
            }, function() {
                return null;
            });
    };

    // =====================================
    // RACE MODALS =========================
    // =====================================


    factory.getRaces = function(params) {
        return races.getList(params).then(function(races) {
            return races;
        });
    };

    factory.getRacesInfos = function(params) {
        return Restangular.one('raceinfos').get(params).then(
            function(races) {
                return races;
            },
            function(res) {
                console.log('Error: ' + res.status);
            });
    };

    factory.showRaceFromResultModal = function(raceId,fromStateParams) {
        return Restangular.one('raceinfos').get({
            limit: 1,
            raceId: raceId
        }).then(
            function(races) {
                if (races.length === 1) {
                    var modalInstance = $uibModal.open({
                        templateUrl: 'views/modals/raceModal.html',
                        controller: 'RaceModalInstanceController',
                        size: 'lg',
                        resolve: {
                            raceinfo: races[0],
                            fromStateParams: fromStateParams
                        }
                    });
                    modalInstance.result.then(function() {
                    }, function() {
                        //  if ($state.current.url === '/races/:raceId'){
                        //     $state.go('^');
                        //  }
                        
                    });
                }
            },
            function(res) {
                console.log('Error: ' + res.status);
            });
    };

    factory.showRaceFromRaceIdModal = function(raceId,fromStateParams) {
        return Restangular.one('raceinfos').get({
            limit: 1,
            raceId: raceId
        }).then(
            function(races) {
                if (races.length === 1) {
                    var modalInstance = $uibModal.open({
                        templateUrl: 'views/modals/raceModal.html',
                        controller: 'RaceModalInstanceController',
                        size: 'lg',
                        resolve: {
                            raceinfo: races[0],
                            fromStateParams: fromStateParams
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


    factory.showRaceModal = function(raceinfo,fromStateParams) {
            modalInstance = $uibModal.open({
                templateUrl: 'views/modals/raceModal.html',
                controller: 'RaceModalInstanceController',
                size: 'lg',
                resolve: {
                    raceinfo: raceinfo,
                    fromStateParams: fromStateParams
                }
            });
            
            return modalInstance.result.then(function() {
                return null;
            }, function() {
                return null;
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






    return factory;

}]);
