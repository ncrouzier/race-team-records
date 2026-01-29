angular.module('mcrrcApp.results').factory('VolunteerJobsService', ['Restangular', '$uibModal', '$q', function(Restangular, $uibModal, $q) {

    var factory = {};
    var volunteerjobs = Restangular.all('volunteerjobs');

    // =====================================
    // API CALLS ============================

    // Get all volunteer jobs
    factory.getVolunteerJobs = function(params) {
        return volunteerjobs.getList(params).then(function(jobs) {
            return jobs;
        }, function(res) {
            console.log('Error: ' + res.status);
        });
    };

    // Get single volunteer job
    factory.getVolunteerJob = function(id) {
        return Restangular.one('volunteerjobs', id).get().then(
            function(job) {
                return job;
            },
            function(res) {
                console.log('Error: ' + res.status);
            });
    };

    // Create volunteer job
    factory.createVolunteerJob = function(job) {
        return volunteerjobs.post(job).then(
            function(response) {
                return response;
            },
            function(res) {
                console.log('Error: ' + res.status);
            });
    };

    // Edit volunteer job
    factory.editVolunteerJob = function(job) {
        return job.save().then(
            function(response) {
                return response;
            },
            function(res) {
                console.log('Error: ' + res.status);
            });
    };

    // Delete volunteer job
    factory.deleteVolunteerJob = function(job) {
        return job.remove().then(
            function() {},
            function(res) {
                console.log('Error: ' + res.status);
            });
    };

    // =====================================
    // MODALS ================================

    factory.showAddVolunteerJobModal = function(membersList) {
        var modalInstance = $uibModal.open({
            templateUrl: 'views/modals/volunteerJobModal.html',
            controller: 'VolunteerJobModalInstanceController',
            size: 'lg',
            backdrop: 'static',
            resolve: {
                job: function() {
                    return null;
                },
                membersList: function() {
                    return membersList;
                }
            }
        });

        return modalInstance.result.then(function(jobData) {
            return factory.createVolunteerJob(jobData).then(function(response) {
                return response.job;
            });
        }, function() {
            return null;
        });
    };

    factory.retrieveVolunteerJobForEdit = function(job, membersList) {
        var modalInstance = $uibModal.open({
            templateUrl: 'views/modals/volunteerJobModal.html',
            controller: 'VolunteerJobModalInstanceController',
            size: 'lg',
            backdrop: 'static',
            resolve: {
                job: function() {
                    return job;
                },
                membersList: function() {
                    return membersList;
                }
            }
        });

        return modalInstance.result.then(function(updatedJob) {
            return factory.editVolunteerJob(updatedJob);
        }, function() {
            return null;
        });
    };

    return factory;
}]);
