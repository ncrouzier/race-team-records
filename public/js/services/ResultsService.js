angular.module('mcrrcApp.results').factory('ResultsService', ['Restangular', 'SystemService', '$uibModal', '$q', 'localStorageService', '$state', 'NotificationService', 'DexieService', 'MemoryCacheService', function (Restangular, SystemService, $uibModal, $q, localStorageService, $state, NotificationService, DexieService, MemoryCacheService) {

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
    factory.getResultById = function (resultId) {
        if (resultId) {
            return Restangular.one("results", resultId).get().then(
                function (result) {
                    return result;
                },
                function (res) {
                    NotificationService.showNotifiction(false, "Error while retrieving result.");
                    console.log('Error: ' + res.status);
                    return null;
                }
            );
        } else {
            return null;
        }

    };

    async function getKey(db, key) {
        var results = await db.get(key);
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
    factory.getResults = function (params) {
        return results.getList(params).then(function (results) {
            return results;
        });
    };

    /**
     * Create a result by id
     * @param {Object} result - the result to create
     * @param {Array} resultsList - the list of results to add the new result to
     * @return {Promise} - the promise of the created result
     */
    factory.createResult = async function (result) {
        //post the result to the database
        return results.post(result).then(
            function (r) {
                //simple success notification
                NotificationService.showNotifiction(true, "Result created successfully!");

                //return the created result
                return r;
            },
            function (res) {
                NotificationService.showNotifiction(false, "Error while creating result.");
                console.log('Error: ' + res.status);
            }
        );
    };

    /**
     * Save a single result
     * @param {Object} result - Result to save
     * @return {Promise} - Promise that resolves with the saved result
     */
    factory.saveSingleResult = function (result) {
        return results.post(result);
    };

    /**
     * Save multiple results in bulk
     * @param {Array} resultsToSave - Array of results to save
     * @param {Object} race - Race information
     * @return {Promise} - Promise that resolves with the saved results
     */
    factory.saveResultsBulk = function (resultsToSave, race) {
        return Restangular.all('results/bulk').post({
            results: resultsToSave,
            race: race
        });
    };

    /**
     * Update multiple existing results in bulk
     * @param {Array} resultsToUpdate - Array of results to update
     * @return {Promise} - Promise that resolves with the updated results
     */
    factory.updateResultsBulk = function (resultsToUpdate) {
        return Restangular.all('results/bulk').customPUT({
            results: resultsToUpdate
        });
    };

    /**
     * Save multiple results with bulk endpoint
     * @param {Array} resultsToSave - Array of results to save
     * @return {Promise} - Promise that resolves when all results are saved
     */
    factory.saveResults = function (resultsToSave) {
        // Extract race information from the first result
        var race = null;
        if (resultsToSave.length > 0 && resultsToSave[0].race) {
            race = resultsToSave[0].race;
        }

        if (!race) {
            NotificationService.showNotifiction(false, "No race information found in results");
            return $q.reject(new Error("No race information found"));
        }

        // Save all results in one bulk request
        return factory.saveResultsBulk(resultsToSave, race).then(
            function (response) {
                if (response.success) {
                    NotificationService.showNotifiction(true, response.message || response.createdCount + " results saved successfully!");
                    return resultsToSave; // Return the original results array
                } else {
                    NotificationService.showNotifiction(false, response.message || "Bulk save failed");
                    return $q.reject(new Error(response.message || "Bulk save failed"));
                }
            },
            function (error) {
                var errorMessage = "Failed to save results";
                if (error.data && error.data.error) {
                    errorMessage = error.data.error;
                } else if (error.data && error.data.details) {
                    errorMessage = error.data.details;
                }
                NotificationService.showNotifiction(false, errorMessage);
                return $q.reject(error);
            }
        );
    };

    //edit a result
    factory.editResult = function (result) {
        return result.save().then(
            function (r) {
                NotificationService.showNotifiction(true, "Result edited successfully!");
                return r;
            },
            function (res) {
                NotificationService.showNotifiction(false, "Error while editing result.");
                console.log('Error: ' + res.status);
            }
        );
    };

    ///delete a result
    factory.deleteResult = function (result) {
        if (!isRestangularized(result)) {
            result = Restangular.restangularizeElement(null, result, 'results');
        }
        return result.remove().then(
            function () {
                NotificationService.showNotifiction(true, "Result deleted successfully!");
            },
            function (res) {
                NotificationService.showNotifiction(false, "Error while deleting result!");
                console.log('Error: ' + res.status);
            });
    };

    // =====================================
    // RESULTS MODALS ======================
    // =====================================

    factory.showAddResultModal = function (resultParam, onResultCreatedCallback) {
        var modalPromise;
        if (resultParam && resultParam._id) {
            // This is for duplicating. It gets a result first.
            modalPromise = factory.getResultById(resultParam._id).then(function (result) {
                return $uibModal.open({
                    templateUrl: 'views/modals/resultModal.html',
                    controller: 'ResultModalInstanceController',
                    windowClass: 'result-modal-class',
                    backdrop: 'static',
                    resolve: {
                        editmode: false,
                        result: function () {
                            return result;
                        },
                        onResultCreated: function () {
                            return onResultCreatedCallback;
                        }
                    }
                }).result; // .result is the promise we want
            });
        } else {
            // This is for a new result.
            modalPromise = $uibModal.open({
                templateUrl: 'views/modals/resultModal.html',
                controller: 'ResultModalInstanceController',
                windowClass: 'result-modal-class',
                backdrop: 'static',
                resolve: {
                    editmode: false,
                    result: function () {
                        return null;
                    },
                    onResultCreated: function () {
                        return onResultCreatedCallback;
                    }
                }
            }).result;
        }
        return modalPromise;
    };

    factory.retrieveResultForEdit = function (resultParam) {
        return factory.getResultById(resultParam._id).then(
            function (result) {
                return $uibModal.open({
                    templateUrl: 'views/modals/resultModal.html',
                    controller: 'ResultModalInstanceController',
                    windowClass: 'result-modal-class',
                    backdrop: 'static',
                    resolve: {
                        editmode: true,
                        result: function () {
                            return result;
                        },
                        onResultCreated: function () {
                            return null;
                        }
                    }
                }).result;
            });
    };

    factory.showResultDetailsModal = function (result, race) {
        var modalInstance = $uibModal.open({
            templateUrl: 'views/modals/resultDetailsModal.html',
            controller: 'ResultDetailslInstanceController',
            size: 'lg',
            resolve: {
                result: result,
                race: race
            }
        });
        return modalInstance.result.then(function () {
            return null;
        }, function () {
            return null;
        });
    };

    // =====================================
    // RACE MODALS =========================
    // =====================================


    factory.getRaces = function (params) {
        return races.getList(params).then(function (races) {
            return races;
        });
    };

    factory.getRacesInfos = function (params) {
        return Restangular.one('raceinfos').get(params).then(
            function (races) {
                return races;
            },
            function (res) {
                console.error('Error in getRacesInfos:', res.status);
                throw res; // Re-throw the error to ensure the promise is rejected
            });
    };

    factory.deleteRace = function (raceinfo) {
        return Restangular.one('raceinfos', raceinfo._id).remove().then(
            function () {
                NotificationService.showNotifiction(true, "Race deleted successfully!");
            },
            function (res) {
                NotificationService.showNotifiction(false, "Error while deleting race!");
                console.log('Error: ' + res.status);
            });
    };

    factory.getRaceResultsWithCacheSupport = async function (params) {
        try {
            var sysinfo = await SystemService.getSystemInfo('mcrrc').then(function (sysinfo) {
                return sysinfo;
            }).catch(function (error) {
                console.log("error", error);
                throw error;
            });
            var date = new Date(sysinfo.overallUpdate);

            var db = DexieService;

            // console.log("date++", date,sysinfo.overallUpdate);
            try {
                await db.open();
            } catch (error) {
                throw error;
            }

            var cache, key;
            if (params.type === "last30") {
                key = "last30";
            } else if (params.type === "last60") {
                key = "last60";
            } else {
                key = "current";
            }
            // Use params as part of the memory cache key for more granularity
            var memKey = key + ':' + JSON.stringify(params || {});

            // Check in-memory cache first using MemoryCacheService

            // console.log("memKey", memKey);  
            var memCacheEntry = MemoryCacheService.get(CACHE_NAMES.RACE_RESULTS, memKey);
            // console.log("memCacheEntry", memCacheEntry);
            if (memCacheEntry && memCacheEntry.date && date.getTime() === new Date(memCacheEntry.date).getTime()) {
                // console.log("using cache");
                return $q.resolve(memCacheEntry.data);
            }

            //try to get the data from the database
            try {
                cache = await getKey(db.races, key);
            } catch (error) {
                // Continue to API call even if IndexedDB fails
                cache = undefined;
            }

            // Parse the cache date properly since it's stored as a JSON string
            let cacheDate;
            if (cache && cache.date) {
                try {
                    // Parse the stringified date back to a Date object
                    cacheDate = new Date(JSON.parse(cache.date));
                } catch (e) {
                    console.error("Error parsing cache date:", e);
                    cacheDate = null;
                }
            }
            // console.log("cache", cache === undefined,date.getTime(), cacheDate);
            if (cache === undefined || !cacheDate || date.getTime() > cacheDate.getTime()) {
                return Restangular.one('raceinfos').get(params).then(function (resultsFromDatabase) {
                    // console.log("using database");
                    if (!params.preload) {
                        try {
                            // console.log("date--", date);
                            var jsonDate = JSON.stringify(date);
                            db.races.put({ instance: key, date: jsonDate, data: JSON.stringify(resultsFromDatabase) }).then(function () {
                                // IndexedDB saved successfully
                            }).catch(function (error) {
                                // Don't throw here, just log the error
                            });
                        } catch (error) {
                            // Don't throw here, just log the error
                        }
                    }

                    // Update memory cache via MemoryCacheService
                    var cacheData = { date: date, data: resultsFromDatabase };
                    // console.log("setting memcache after database call", memKey, cacheData);
                    MemoryCacheService.set(CACHE_NAMES.RACE_RESULTS, memKey, cacheData);
                    return resultsFromDatabase;
                }).catch(function (error) {
                    throw error;
                });
            } else {
                // console.log("using indexedb cache");
                var res = $q(function (resolve, reject) {
                    try {
                        var data = Restangular.restangularizeCollection(null, JSON.parse(cache.data), 'races', true);
                        // Update memory cache via MemoryCacheService
                        var cacheData = { date: date, data: data };
                        // console.log("setting memcache after indexedb call", memKey, cacheData);
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


    factory.showRaceFromResultModal = function (raceId, fromStateParams) {
        return Restangular.one('raceinfos').get({
            limit: 1,
            raceId: raceId
        }).then(
            function (races) {
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
                    modalInstance.result.then(function () {
                    }, function () {
                        //  if ($state.current.url === '/races/:raceId'){
                        //     $state.go('^');
                        //  }

                    });
                }
            },
            function (res) {
                console.log('Error: ' + res.status);
            }
        );
    };

    factory.showRaceFromRaceIdModal = function (raceId, fromStateParams) {
        return Restangular.one('raceinfos').get({
            limit: 1,
            raceId: raceId
        }).then(
            function (races) {
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
                    modalInstance.result.then(function () {
                    }, function () { });
                }
            },
            function (res) {
                console.log('Error: ' + res.status);
            });
    };


    factory.showRaceModal = function (raceinfo, fromStateParams) {
        modalInstance = $uibModal.open({
            templateUrl: 'views/modals/raceModal.html',
            controller: 'RaceModalInstanceController',
            size: 'lg',
            resolve: {
                raceinfo: raceinfo,
                fromStateParams: fromStateParams
            }
        });

        return modalInstance.result.then(function () {
            return null;
        }, function () {
            return null;
        });
    };





    // =====================================
    // RACETYPE API CALLS ==================
    // =====================================

    //retrieve racetypes
    factory.getRaceTypes = function (params) {
        return racetypes.getList(params).then(function (racetypes) {
            return racetypes;
        });
    };

    //retrieve a racetype by id
    factory.createRaceType = function (racetype) {
        return racetypes.post(racetype).then(
            function (racetypes) { },
            function (res) {
                console.log('Error: ' + res.status);
            });
    };

    //edit a racetype
    factory.editRaceType = function (racetype) {
        racetype.save();
    };

    //delete a racetype
    factory.deleteRaceType = function (racetype) {
        return racetype.remove().then(
            function () { },
            function (res) {
                console.log('Error: ' + res.status);
            });
    };

    // =====================================
    // RACETYPE MODALS =====================
    // =====================================

    factory.showAddRaceTypeModal = function () {
        var modalInstance = $uibModal.open({
            templateUrl: 'views/modals/raceTypeModal.html',
            controller: 'RaceTypeModalInstanceController',
            size: 'lg',
            resolve: {
                racetype: false
            }
        });

        return modalInstance.result.then(function (racetype) {
            factory.createRaceType(racetype);
            return racetype;
        }, function () {
            return null;
        });
    };

    factory.retrieveRaceTypeForEdit = function (racetype) {
        if (racetype) {
            var modalInstance = $uibModal.open({
                templateUrl: 'views/modals/raceTypeModal.html',
                controller: 'RaceTypeModalInstanceController',
                size: 'lg',
                resolve: {
                    racetype: function () {
                        return racetype;
                    }
                }
            });

            return modalInstance.result.then(function (racetype) {
                factory.editRaceType(racetype);
            }, function () {
                return null;
            });
        }
    };



    // =====================================
    // PDF API =====================
    // =====================================
    factory.getResultsForPdf = function (params) {

        return Restangular.one('pdfreport').get(params).then(
            function (results) {
                return results;
            },
            function (res) {
                console.log('Error: ' + res.status);
            });

    };


    // =====================================
    // STATS API =====================
    // =====================================
    factory.getMilesRaced = function (params) {
        return Restangular.one('milesraced').get(params).then(
            function (sum) {
                return sum;
            },
            function (res) {
                console.log('Error: ' + res.status);
            });

    };

    // =====================================
    // RACE API =====================
    // =====================================

    // Get a single race by ID
    factory.getRaceById = function (raceId) {
        if (raceId) {
            return Restangular.one("races", raceId).get().then(
                function (race) {
                    return race;
                },
                function (res) {
                    NotificationService.showNotifiction(false, "Error while retrieving race.");
                    console.log('Error: ' + res.status);
                    return null;
                }
            );
        } else {
            return null;
        }
    };

    // Update a race
    factory.updateRace = function (race) {
        if (race && race._id) {
            return Restangular.one("races", race._id).customPUT(race).then(
                function (updatedRace) {
                    NotificationService.showNotifiction(true, "Race updated successfully.");
                    // System info will be updated by backend, triggering automatic cache invalidation
                    return updatedRace;
                },
                function (res) {
                    NotificationService.showNotifiction(false, "Error while updating race.");
                    console.log('Error: ' + res.status);
                    return null;
                }
            );
        } else {
            NotificationService.showNotifiction(false, "Invalid race data.");
            return $q.reject("Invalid race data");
        }
    };

    // =====================================
    // RACE MODALS =====================
    // =====================================

    factory.showEditRaceModal = function (raceInput) {
        return factory.getRaceById(raceInput._id).then(
            function (race) {
                var modalInstance = $uibModal.open({
                    templateUrl: 'views/modals/raceEditModal.html',
                    controller: 'RaceEditModalInstanceController',
                    size: 'lg',
                    windowClass: 'race-edit-modal-class',
                    backdrop: 'static',
                    resolve: {
                        race: function () {
                            return race;
                        }
                    }

                });

                return modalInstance.result.then(function (updatedRace) {
                    return updatedRace;
                    // return factory.updateRace(updatedRace);
                }, function () {
                    return null;
                });
            });
    };
    // Get race types for dropdown
    factory.getRaceTypes = function () {
        return racetypes.getList().then(function (racetypes) {
            return racetypes;
        });
    };






    return factory;

}]);

