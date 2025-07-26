angular.module('mcrrcApp.results').factory('ResultsService', ['Restangular', 'SystemService', '$uibModal', '$q','localStorageService','$state','NotificationService', 'DexieService', 'MemoryCacheService', function(Restangular, SystemService, $uibModal, $q, localStorageService, $state,NotificationService, DexieService, MemoryCacheService) {

    var factory = {};
    var results = Restangular.all('results');
    var racetypes = Restangular.all('racetypes');
    var races = Restangular.all('races');
    var systeminfos = Restangular.all('systeminfos');

    // Cache names for MemoryCacheService
    var CACHE_NAMES = {
        RACE_RESULTS: 'raceResults'
    };

    // In-memory cache for race results
    var raceResultsMemoryCache = {};

    function isRestangularized(obj) {
        return obj && typeof obj.getRestangularUrl === 'function';
    }



    // =====================================
    // RESULTS API CALLS ===================
    // =====================================

    /**
     * Retrieve a single result by its ID
     * @param {string} resultId - The ID of the result to retrieve
     * @return {Promise} - Promise that resolves with the result object
     */
    factory.getResultById = function(resultId) {
        if (resultId){
            return Restangular.one("results",resultId).get().then(
                function(result) {
                    return result;
                },
                function(res) {
                    NotificationService.showNotifiction(false, "Error while retrieving result.");
                    console.log('Error: ' + res.status);
                    return null;
                }
            );
        }else{
            return null;
        }
        
    };

    async function getKey(db,key) {
        var  results = await db.get(key);            
        return results;
    }

    //retrieve results
    factory.getResultsWithCacheSupport = async function (params) {
        // var sysinfo = await SystemService.getSystemInfo('mcrrc').then(function (sysinfo) {
        //     return sysinfo;
        // });

        // var db = new Dexie("mcrrcAppDatabase");
        // db.version(1).stores({
        //     results: 'instance,date,data'
        // });
        // var date = new Date(sysinfo.resultUpdate);

        // await db.open();
        // var currentCache = await getCurrent(db.results);
        // // console.log("current database", currentCache);
        // if (currentCache === undefined || date > new Date(currentCache.date)) {
        //     // console.log("cache is undefined or out of date so we retrieve from the database",params);
        //     return results.getList(params).then(function (resultsFromDatabase) {
        //         if (!params.preload) {
        //             // console.log("result retrieved preload == false so we save cache ",resultsFromDatabase);
        //             db.results.put({ instance: "current", date: date, data: JSON.stringify(resultsFromDatabase) }).then(function (tata) {
        //                 // console.log("Done inserting data in cache");        
        //             });
        //         }
        //         // console.log("done retrieved function");  
        //         return resultsFromDatabase;
        //     });
        // } else {
        //     // console.log("using cache");                        
        //     var res = $q(function (resolve, reject) {
        //         resolve(Restangular.restangularizeCollection(null, JSON.parse(currentCache.data), 'results', true));
        //         // console.log("done restangularizeCollection");
        //     });
        //     // console.log("done retrieve cache");
        //     return res;
        // }
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
    factory.createResult = async function(result) {
        //post the result to the database
        return results.post(result).then(
            function(r) {
                //simple success notification
                NotificationService.showNotifiction(true,"Result created successfully!");
           
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
     * Save a single result
     * @param {Object} result - Result to save
     * @return {Promise} - Promise that resolves with the saved result
     */
    factory.saveSingleResult = function(result) {
        return results.post(result);
    };

    /**
     * Save multiple results with progress modal
     * @param {Array} resultsToSave - Array of results to save
     * @return {Promise} - Promise that resolves when all results are saved
     */
    factory.saveResults = function(resultsToSave) {
        // Open progress modal
        var modalInstance = $uibModal.open({
            templateUrl: 'views/modals/saveProgressModal.html',
            controller: 'SaveProgressModalController',
            size: 'lg',
            backdrop: 'static',
            keyboard: false,
            resolve: {
                resultsToSave: function() {
                    return resultsToSave;
                }
            }
        });

        return modalInstance.result.then(function(result) {
            var savedCount = result.savedResults.length;
            var errorCount = result.errorResults.length;
            
            if (errorCount === 0) {
                NotificationService.showNotifiction(true, savedCount + " results saved successfully!");
            } else if (savedCount === 0) {
                NotificationService.showNotifiction(false, "Failed to save any results. Please try again.");
            } else {
                NotificationService.showNotifiction(true, savedCount + " results saved successfully, " + errorCount + " failed.");
            }
            
            return result.savedResults;
        }, function() {
            // Modal was dismissed
            NotificationService.showNotifiction(false, "Save operation was cancelled.");
            return $q.reject(new Error("Save operation cancelled"));
        });
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
        if (!isRestangularized(result)){
            result = Restangular.restangularizeElement(null, result, 'results');
        }
        return result.remove().then(
            function() {
                NotificationService.showNotifiction(true,"Result deleted successfully!");
            },
            function(res) {
                NotificationService.showNotifiction(false,"Error while deleting result!");
                console.log('Error: ' + res.status);
            });
    };

    // =====================================
    // RESULTS MODALS ======================
    // =====================================

    factory.showAddResultModal = function(resultParam, onResultCreatedCallback) {
        var modalPromise;
        if (resultParam && resultParam._id){
            // This is for duplicating. It gets a result first.
            modalPromise = factory.getResultById(resultParam._id).then(function(result) {
                return $uibModal.open({
                    templateUrl: 'views/modals/resultModal.html',
                    controller: 'ResultModalInstanceController',
                    windowClass: 'result-modal-class',
                    backdrop: 'static',
                    resolve: {
                        editmode: false,
                        result: function() {
                            return result;
                        },
                        onResultCreated: function() {
                            return onResultCreatedCallback;
                        }
                    }
                }).result; // .result is the promise we want
            });
        }else{
             // This is for a new result.
            modalPromise = $uibModal.open({
                templateUrl: 'views/modals/resultModal.html',
                controller: 'ResultModalInstanceController',
                windowClass: 'result-modal-class',
                backdrop: 'static',
                resolve: {
                    editmode: false,
                    result: function() {
                        return null;
                    },
                    onResultCreated: function() {
                        return onResultCreatedCallback;
                    }
                }
            }).result;
        }
        return modalPromise;
    };

    factory.retrieveResultForEdit = function(resultParam) {
        return factory.getResultById(resultParam._id).then(
            function(result) {
                return $uibModal.open({
                    templateUrl: 'views/modals/resultModal.html',
                    controller: 'ResultModalInstanceController',
                    windowClass: 'result-modal-class',
                    backdrop: 'static',
                    resolve: {
                        editmode: true,
                        result: function() {
                            return result;
                        },
                        onResultCreated: function() {
                            return null;
                        }
                    }
                }).result;
        });
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
                console.error('Error in getRacesInfos:', res.status);
                throw res; // Re-throw the error to ensure the promise is rejected
            });
    };

    factory.deleteRace = function(raceinfo) {
        return Restangular.one('raceinfos',raceinfo._id).remove().then(
            function() {
                NotificationService.showNotifiction(true,"Race deleted successfully!");
            },
            function(res) {
                NotificationService.showNotifiction(false,"Error while deleting race!");
                console.log('Error: ' + res.status);
            });
    };

    factory.getRaceResultsWithCacheSupport = async function (params) {
        try {
            var sysinfo = await SystemService.getSystemInfo('mcrrc').then(function (sysinfo) {
                return sysinfo;
            }).catch(function(error) {
                throw error;
            });
            
            var db = DexieService;
            var date = new Date(sysinfo.overallUpdate);
            
            try {
                await db.open();
            } catch (error) {
                throw error;
            }
            
            var cache, key;
            if (params.type === "last30"){
                key = "last30";
            }else{
                key = "current";
            }
            // Use params as part of the memory cache key for more granularity
            var memKey = key + ':' + JSON.stringify(params || {});
            
            // Check in-memory cache first using MemoryCacheService
            var memCacheEntry = MemoryCacheService.get(CACHE_NAMES.RACE_RESULTS, memKey);
            if (memCacheEntry && memCacheEntry.date && date.getTime() === new Date(memCacheEntry.date).getTime()) {
                return $q.resolve(memCacheEntry.data);
            }
            
            //try to get the data from the database
            try {
                cache = await getKey(db.races,key);
            } catch (error) {
                // Continue to API call even if IndexedDB fails
                cache = undefined;
            }
            
            if (cache === undefined || date > new Date(cache.date)) {
                return Restangular.one('raceinfos').get(params).then(function (resultsFromDatabase) {
                    if (!params.preload) {
                        try {
                            db.races.put({ instance: key, date: date, data: JSON.stringify(resultsFromDatabase) }).then(function () {
                                // IndexedDB saved successfully
                            }).catch(function(error) {
                                // Don't throw here, just log the error
                            });
                        } catch (error) {
                            // Don't throw here, just log the error
                        }
                    }
                    
                    // Update memory cache via MemoryCacheService
                    var cacheData = { date: date, data: resultsFromDatabase };
                    MemoryCacheService.set(CACHE_NAMES.RACE_RESULTS, memKey, cacheData);
                    return resultsFromDatabase;
                }).catch(function(error) {
                    throw error;
                });
            } else {
                var res = $q(function (resolve, reject) {
                    try {
                        var data = Restangular.restangularizeCollection(null, JSON.parse(cache.data), 'races', true);
                        // Update memory cache via MemoryCacheService
                        var cacheData = { date: cache.date, data: data };
                        MemoryCacheService.set(CACHE_NAMES.RACE_RESULTS, memKey, cacheData);
                        resolve(data);
                    } catch (error) {
                        reject(error);
                    }
                });
                return res;
            }
        } catch (error) {
            throw error;
        }
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
            }
        );
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

