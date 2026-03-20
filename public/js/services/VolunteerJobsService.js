angular.module('mcrrcApp.results').factory('VolunteerJobsService', ['Restangular', '$uibModal', '$q', 'SystemService', 'DexieService', 'MemoryCacheService', function (Restangular, $uibModal, $q, SystemService, DexieService, MemoryCacheService) {

    var factory = {};
    var volunteerjobs = Restangular.all('volunteerjobs');

    var CACHE_NAMES = {
        VOLUNTEER_JOBS: 'volunteerJobs'
    };

    async function getKey(store, key) {
        return await store.get(key);
    }

    // =====================================
    // API CALLS ============================

    // Get all volunteer jobs
    factory.getVolunteerJobs = function (params) {
        return volunteerjobs.getList(params).then(function (jobs) {
            return jobs;
        }, function (res) {
            console.log('Error: ' + res.status);
        });
    };

    // Get all volunteer jobs with cache support (memory -> IndexedDB -> API)
    // Wrapped in $q.resolve() so the returned promise is always digest-aware
    factory.getVolunteerJobsWithCacheSupport = function (params) {
        return $q.resolve().then(async function () {
            var sysinfo = await SystemService.getSystemInfo('mcrrc');
            var date = new Date(sysinfo.volunteerJobUpdate);

            var db = DexieService;
            await db.open();

            var key = 'all';
            var memKey = key + ':' + JSON.stringify(params || {});

            // Check in-memory cache first
            var memCacheEntry = MemoryCacheService.get(CACHE_NAMES.VOLUNTEER_JOBS, memKey);
            if (memCacheEntry && memCacheEntry.date && date.getTime() === new Date(memCacheEntry.date).getTime()) {
                return memCacheEntry.data;
            }

            // Try IndexedDB
            var cache;
            try {
                cache = await getKey(db.volunteerjobs, key);
            } catch (error) {
                cache = undefined;
            }

            var cacheDate;
            if (cache && cache.date) {
                try {
                    cacheDate = new Date(JSON.parse(cache.date));
                } catch (e) {
                    cacheDate = null;
                }
            }

            var cacheData;
            if (cache === undefined || !cacheDate || date.getTime() > cacheDate.getTime()) {
                // Fetch from API
                var jobsFromDatabase = await volunteerjobs.getList(params);
                try {
                    var jsonDate = JSON.stringify(date);
                    db.volunteerjobs.put({ instance: key, date: jsonDate, data: JSON.stringify(jobsFromDatabase) }).catch(function () { });
                } catch (error) {
                    // Don't throw, just log
                }

                cacheData = { date: date, data: jobsFromDatabase };
                MemoryCacheService.set(CACHE_NAMES.VOLUNTEER_JOBS, memKey, cacheData);
                return jobsFromDatabase;
            } else {
                // Use IndexedDB cache
                var data = Restangular.restangularizeCollection(null, JSON.parse(cache.data), 'volunteerjobs', true);
                cacheData = { date: date, data: data };
                MemoryCacheService.set(CACHE_NAMES.VOLUNTEER_JOBS, memKey, cacheData);
                return data;
            }
        });
    };

    // Get single volunteer job
    factory.getVolunteerJob = function (id) {
        return Restangular.one('volunteerjobs', id).get().then(
            function (job) {
                return job;
            },
            function (res) {
                console.log('Error: ' + res.status);
            });
    };

    // Create volunteer job
    factory.createVolunteerJob = function (job) {
        return volunteerjobs.post(job).then(
            function (response) {
                return response;
            },
            function (res) {
                console.log('Error: ' + res.status);
            });
    };

    // Batch create volunteer jobs
    factory.createVolunteerJobsBatch = function (batchData) {
        return Restangular.all('volunteerjobs').customPOST(batchData, 'batch').then(
            function (response) {
                return response;
            },
            function (res) {
                console.log('Error: ' + res.status);
            });
    };

    // Edit volunteer job
    factory.editVolunteerJob = function (job) {
        return job.save().then(
            function (response) {
                return response;
            },
            function (res) {
                console.log('Error: ' + res.status);
            });
    };

    // Delete volunteer job
    factory.deleteVolunteerJob = function (job) {
        return job.remove().then(
            function () { },
            function (res) {
                console.log('Error: ' + res.status);
            });
    };

    // =====================================
    // MODALS ================================

    // Add volunteer jobs (supports multiple members)
    factory.showAddVolunteerJobModal = function (membersList, prefillData) {
        var modalInstance = $uibModal.open({
            templateUrl: 'views/modals/volunteerJobBatchModal.html',
            controller: 'VolunteerJobAddModalInstanceController',
            size: 'lg',
            backdrop: 'static',
            resolve: {
                membersList: function () {
                    return membersList;
                },
                prefillData: function () {
                    return prefillData || null;
                }
            }
        });

        return modalInstance.result.then(function (batchData) {
            return factory.createVolunteerJobsBatch(batchData).then(function (response) {
                return response.jobs;
            });
        }, function () {
            return null;
        });
    };

    // Edit a single volunteer job
    factory.retrieveVolunteerJobForEdit = function (job, membersList) {
        var modalInstance = $uibModal.open({
            templateUrl: 'views/modals/volunteerJobModal.html',
            controller: 'VolunteerJobEditModalInstanceController',
            size: 'lg',
            backdrop: 'static',
            resolve: {
                job: function () {
                    return job;
                },
                membersList: function () {
                    return membersList;
                }
            }
        });

        return modalInstance.result.then(function (updatedJob) {
            return factory.editVolunteerJob(updatedJob);
        }, function () {
            return null;
        });
    };

    return factory;
}]);
