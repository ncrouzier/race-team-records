angular.module('mcrrcApp.results').factory('VolunteerJobsService', ['Restangular', '$uibModal', '$q', 'DexieService', 'DataCacheService', function (Restangular, $uibModal, $q, DexieService, DataCacheService) {

    var factory = {};
    var volunteerjobs = Restangular.all('volunteerjobs');

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

    // Volunteer jobs at one race, for the race page.
    // Resolves with [] rather than failing, so the page just omits the section.
    // Picked from the full list this browser keeps (allJobs, below): the race's
    // jobs with the fields the page shows, by date, last name, then id.
    function jobsForRace(jobs, raceId) {
        return jobs.filter(function (job) {
            return job.race && String(job.race._id) === String(raceId);
        }).map(function (job) {
            var m = job.member || {};
            return {
                _id: job._id,
                member: { _id: m._id, firstname: m.firstname, lastname: m.lastname, username: m.username },
                jobDate: job.jobDate,
                description: job.description
            };
        }).sort(function (a, b) {
            var byDate = new Date(a.jobDate) - new Date(b.jobDate);
            if (byDate) return byDate;
            var la = a.member.lastname || '', lb = b.member.lastname || '';
            if (la !== lb) return la < lb ? -1 : 1;
            return String(a._id) < String(b._id) ? -1 : 1;
        });
    }

    factory.getRaceVolunteerJobs = function (raceId) {
        if (!raceId) return $q.resolve([]);
        return allJobs.get().then(function (jobs) {
            return angular.isArray(jobs) ? jobsForRace(jobs, raceId) : [];
        }).catch(function () {
            return [];
        });
    };

    // Every volunteer job, newest first (public, like the volunteering stats):
    // answered at once from the copy this browser keeps, which is replaced in
    // the background when the jobs change (DataCacheService)
    var allJobs = DataCacheService.create({
        name: 'volunteerjobs',
        stampFields: ['volunteerJobUpdate'],
        readStore: function () {
            return $q.when(DexieService.open()).then(function () {
                return DexieService.volunteerjobs.get('all');
            }).then(function (stored) {
                if (!stored || !stored.data) return null;
                return {
                    stamp: DataCacheService.stampOf(JSON.parse(stored.date)),
                    data: Restangular.restangularizeCollection(null, JSON.parse(stored.data), 'volunteerjobs', true)
                };
            });
        },
        writeStore: function (entry) {
            return $q.when(DexieService.volunteerjobs.put({
                instance: 'all', date: JSON.stringify(entry.stamp), data: JSON.stringify(entry.data)
            }));
        },
        fetchFresh: function () {
            return volunteerjobs.getList({ sort: '-jobDate' });
        }
    });

    factory.getVolunteerJobsWithCacheSupport = function () {
        return allJobs.get();
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
