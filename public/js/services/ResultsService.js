angular.module('mcrrcApp.results').factory('ResultsService', ['Restangular', 'SystemService', '$uibModal', '$q', 'localStorageService', '$state', 'NotificationService', 'DexieService', 'DataCacheService', 'Analytics', function (Restangular, SystemService, $uibModal, $q, localStorageService, $state, NotificationService, DexieService, DataCacheService, Analytics) {

    var factory = {};
    var results = Restangular.all('results');
    var racetypes = Restangular.all('racetypes');
    var races = Restangular.all('races');
    var systeminfos = Restangular.all('systeminfos');

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

    /**
     * Retrieve a result together with the team/personal standings and the
     * runner's placement trend, for the single-result page
     * @param {string} resultId - The ID of the result to retrieve
     * @return {Promise} - Promise that resolves with {result, stats, trend}
     */
    factory.getResultDetail = function (resultId) {
        if (!resultId) {
            return $q.when(null);
        }
        return Restangular.one("results", resultId).one("detail").get().then(
            function (detail) {
                return detail;
            },
            function (res) {
                NotificationService.showNotifiction(false, "Error while retrieving result details.");
                console.log('Error: ' + res.status);
                return null;
            }
        );
    };

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
                Analytics.event('admin_action', { action: 'result_create' });

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
    factory.saveResultsBulk = function (resultsToSave, race, seriesChoice) {
        return Restangular.all('results/bulk').post({
            results: resultsToSave,
            race: race,
            seriesChoice: seriesChoice
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
    factory.saveResults = function (resultsToSave, seriesChoice) {
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
        return factory.saveResultsBulk(resultsToSave, race, seriesChoice).then(
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
                Analytics.event('admin_action', { action: 'result_edit' });
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
                Analytics.event('admin_action', { action: 'result_delete' });
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
                Analytics.event('admin_action', { action: 'race_delete' });
            },
            function (res) {
                NotificationService.showNotifiction(false, "Error while deleting race!");
                console.log('Error: ' + res.status);
            });
    };

    // ---- The race list ----------------------------------------------------
    // Every race with its results (raceinfos), kept in this browser and
    // answered from there at once, even when out of date, while a new copy
    // downloads in the background (DataCacheService). "current" is the full
    // list every page shares; "last30" and "last60" are the home page's
    // smaller lists. The IndexedDB records keep their old shape: { instance,
    // date: the stamp as JSON, data: the list as JSON }.
    var FULL_LIST_PARAMS = { sort: '-racedate -order racename', preload: false };
    var raceLists = {};
    var raceListParams = {};

    function raceList(key) {
        if (raceLists[key]) return raceLists[key];
        raceLists[key] = DataCacheService.create({
            name: 'races:' + key,
            stampFields: DataCacheService.RACE_DATA,
            readStore: function () {
                return $q.when(DexieService.open()).then(function () {
                    return DexieService.races.get(key);
                }).then(function (stored) {
                    if (!stored || !stored.data) return null;
                    return {
                        stamp: DataCacheService.stampOf(JSON.parse(stored.date)),
                        data: Restangular.restangularizeCollection(null, JSON.parse(stored.data), 'races', true)
                    };
                });
            },
            writeStore: function (entry) {
                return $q.when(DexieService.races.put({
                    instance: key,
                    date: JSON.stringify(entry.stamp),
                    data: JSON.stringify(entry.data)
                }));
            },
            fetchFresh: function () {
                return Restangular.one('raceinfos').get(raceListParams[key] || FULL_LIST_PARAMS);
            }
        });
        return raceLists[key];
    }

    // A preview (limit, preload: the first races while the full list loads)
    // is the full list itself when this browser has one; otherwise just the
    // preview, from the server, one request at a time per kind
    var previewsInFlight = {};
    function racePreview(params) {
        return raceList('current').cached().then(function (held) {
            if (held) return held.data;
            var key = JSON.stringify(params);
            if (!previewsInFlight[key]) {
                previewsInFlight[key] = Restangular.one('raceinfos').get(params).finally(function () {
                    delete previewsInFlight[key];
                });
            }
            return previewsInFlight[key];
        });
    }

    factory.getRaceResultsWithCacheSupport = function (params) {
        params = params || {};
        if (params.limit || params.preload) return racePreview(params);
        if (params.type === 'last30' || params.type === 'last60') {
            raceListParams[params.type] = params;
            return raceList(params.type).get();
        }
        // Whatever sort or options it was asked with: the full list
        return raceList('current').get();
    };

    // The full list with the stamp it belongs to: what was computed from it
    // (StatsService) can be kept against that stamp
    factory.getRaceListEntry = function () {
        return raceList('current').entry();
    };

    // Race details used to open in a modal; they are a page of their own now,
    // at /races/:raceId. These three keep their old names because a dozen
    // controllers call them — they just navigate instead of opening a modal.

    /**
     * Open the race page for a race id
     * @param {string} raceId
     * @return {Promise} - resolves once the navigation has been started
     */
    factory.showRaceFromResultModal = function (raceId) {
        return factory.goToRacePage(raceId);
    };

    factory.showRaceFromRaceIdModal = function (raceId) {
        return factory.goToRacePage(raceId);
    };

    /**
     * Open the race page for an already-loaded raceinfo
     * @param {Object} raceinfo
     * @return {Promise} - resolves once the navigation has been started
     */
    factory.showRaceModal = function (raceinfo) {
        return factory.goToRacePage(raceinfo && raceinfo._id);
    };

    factory.goToRacePage = function (raceId) {
        if (raceId) {
            $state.go('/races', { raceId: raceId });
        }
        return $q.when(null);
    };

    /**
     * The full race list if this browser already holds a copy, possibly out
     * of date, without ever downloading it: pages that can work from it
     * (result detail, race series) use it when it is there and ask the
     * server otherwise, rather than download the whole list for one page.
     * @return {Promise} - resolves with the list, or null
     */
    factory.peekCachedRaceList = function () {
        return raceList('current').cached().then(function (held) {
            return held && angular.isArray(held.data) ? held.data : null;
        }).catch(function () {
            return null;
        });
    };

    /**
     * Look for a race in the race list this browser holds, without ever
     * going to the network. Navigating in from the results list means the
     * whole list is usually right there; fetching the race again would be a
     * round trip for data we are holding.
     * @param {string} raceId
     * @return {Promise} - resolves with the raceinfo, or null if not held
     */
    factory.peekCachedRaceInfo = function (raceId) {
        return factory.peekCachedRaceList().then(function (races) {
            var lists = [races];
            ['last60', 'last30'].forEach(function (key) {
                var held = raceLists[key] && raceLists[key].peek();
                if (held) lists.push(held.data);
            });
            for (var l = 0; l < lists.length; l++) {
                if (!angular.isArray(lists[l])) continue;
                for (var i = 0; i < lists[l].length; i++) {
                    if (lists[l][i] && String(lists[l][i]._id) === String(raceId)) return lists[l][i];
                }
            }
            return null;
        });
    };

    /**
     * The race page loads itself from a race id — the callers above only ever
     * had one, and the page needs the full result list either way. Cache
     * first, then a targeted fetch: in-app navigation usually costs nothing,
     * and a cold permalink costs one small request rather than the whole
     * several-hundred-KB race list.
     * @param {string} raceId
     * @param {Object} [options] - { fresh: true } skips the cache, for a
     *     reload right after an edit when the cached copy is the old one
     * @return {Promise} - resolves with the raceinfo, or null if not found
     */
    factory.getRaceInfoById = function (raceId, options) {
        if (!raceId) {
            return $q.when(null);
        }
        var fromCache = options && options.fresh ? $q.when(null) : factory.peekCachedRaceInfo(raceId);
        return fromCache.then(function (cached) {
            if (cached) {
                return cached;
            }
            return Restangular.one('raceinfos').get({
                limit: 1,
                raceId: raceId
            }).then(
                function (races) {
                    return races.length === 1 ? races[0] : null;
                },
                function (res) {
                    NotificationService.showNotifiction(false, "Error while retrieving race.");
                    console.log('Error: ' + res.status);
                    return null;
                }
            );
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
                    Analytics.event('admin_action', { action: 'race_edit' });
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






    return factory;

}]);

