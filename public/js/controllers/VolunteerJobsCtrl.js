angular.module('mcrrcApp.results').controller('VolunteerJobsController', ['$scope', 'AuthService', 'VolunteerJobsService', 'MembersService', 'dialogs', function($scope, AuthService, VolunteerJobsService, MembersService, dialogs) {

    // =====================================
    // AUTHENTICATION SETUP ================
    $scope.authService = AuthService;
    $scope.$watch('authService.isLoggedIn()', function(user) {
        $scope.user = user;
    });

    // =====================================
    // LOAD DATA ===========================

    // Load volunteer jobs
    VolunteerJobsService.getVolunteerJobs({
        sort: '-jobDate'
    }).then(function(jobs) {
        $scope.volunteerJobsList = jobs;
    });

    // Load members list (needed for modal member selection)
    MembersService.getMembersWithCacheSupport({}).then(function(members) {
        // Sort members: current members first, then past members
        $scope.membersList = members.sort(function(a, b) {
            // Current members (no status or 'current') come before past members
            var aStatus = a.memberStatus === 'past' ? 1 : 0;
            var bStatus = b.memberStatus === 'past' ? 1 : 0;

            if (aStatus !== bStatus) {
                return aStatus - bStatus; // Current first (0 before 1)
            }

            // Within same status, sort by lastname then firstname
            var lastNameCompare = (a.lastname || '').localeCompare(b.lastname || '');
            if (lastNameCompare !== 0) {
                return lastNameCompare;
            }
            return (a.firstname || '').localeCompare(b.firstname || '');
        });
    });

    // =====================================
    // CRUD OPERATIONS =====================

    // Show add modal (supports multiple members)
    $scope.showAddVolunteerJobModal = function() {
        VolunteerJobsService.showAddVolunteerJobModal($scope.membersList).then(function(jobs) {
            if (jobs !== null && Array.isArray(jobs)) {
                jobs.forEach(function(job) {
                    $scope.volunteerJobsList.push(job);
                });
            }
        });
    };

    // Duplicate a volunteer job (opens add modal pre-filled with event name and date)
    $scope.duplicateVolunteerJob = function(job) {
        var prefillData = {
            eventName: job.eventName,
            jobDate: job.jobDate
        };
        VolunteerJobsService.showAddVolunteerJobModal($scope.membersList, prefillData).then(function(jobs) {
            if (jobs !== null && Array.isArray(jobs)) {
                jobs.forEach(function(j) {
                    $scope.volunteerJobsList.push(j);
                });
            }
        });
    };

    // Show edit modal
    $scope.retrieveVolunteerJobForEdit = function(job) {
        VolunteerJobsService.retrieveVolunteerJobForEdit(job, $scope.membersList).then(function() {
            // Job is already updated via Restangular reference
        });
    };

    // Delete job
    $scope.removeVolunteerJob = function(job) {
        var dlg = dialogs.confirm("Remove Volunteer Job?", "Are you sure you want to remove this volunteer job?");
        dlg.result.then(function(btn) {
            VolunteerJobsService.deleteVolunteerJob(job).then(function() {
                var index = $scope.volunteerJobsList.indexOf(job);
                if (index > -1) {
                    $scope.volunteerJobsList.splice(index, 1);
                }
            });
        }, function(btn) {
            // User cancelled
        });
    };

}]);

// =====================================
// ADD MODAL INSTANCE CONTROLLER ========
// Used for both "Add" and "Duplicate" - supports multiple member rows
angular.module('mcrrcApp.results').controller('VolunteerJobAddModalInstanceController', ['$scope', '$uibModalInstance', 'membersList', 'prefillData', function($scope, $uibModalInstance, membersList, prefillData) {

    $scope.membersList = membersList;

    // Shared fields
    $scope.formData = {
        eventName: prefillData && prefillData.eventName ? prefillData.eventName : '',
        jobDate: prefillData && prefillData.jobDate ? new Date(prefillData.jobDate) : new Date()
    };

    // Dynamic rows
    $scope.rows = [
        { member: null, description: '' }
    ];

    // Date picker controls
    $scope.opened = false;
    $scope.open = function($event) {
        $event.preventDefault();
        $event.stopPropagation();
        $scope.opened = true;
    };

    $scope.addRow = function() {
        $scope.rows.push({ member: null, description: '' });
    };

    $scope.removeRow = function(index) {
        if ($scope.rows.length > 1) {
            $scope.rows.splice(index, 1);
        }
    };

    $scope.isFormValid = function() {
        if (!$scope.formData.eventName || !$scope.formData.jobDate) {
            return false;
        }
        for (var i = 0; i < $scope.rows.length; i++) {
            if (!$scope.rows[i].member || !$scope.rows[i].description) {
                return false;
            }
        }
        return true;
    };

    $scope.saveBatch = function() {
        var batchData = {
            eventName: $scope.formData.eventName,
            jobDate: $scope.formData.jobDate,
            jobs: $scope.rows.map(function(row) {
                return {
                    memberId: row.member._id,
                    description: row.description
                };
            })
        };
        $uibModalInstance.close(batchData);
    };

    $scope.cancel = function() {
        $uibModalInstance.dismiss('cancel');
    };

}]);

// =====================================
// EDIT MODAL INSTANCE CONTROLLER =======
// Used only for editing a single existing volunteer job
angular.module('mcrrcApp.results').controller('VolunteerJobEditModalInstanceController', ['$scope', '$uibModalInstance', 'job', 'membersList', function($scope, $uibModalInstance, job, membersList) {

    $scope.membersList = membersList;

    // Copy the job data
    $scope.formData = angular.copy(job);

    // Find the member object from membersList that matches the job's member
    if (job.member && job.member._id) {
        $scope.formData.member = membersList.find(function(m) {
            return m._id === job.member._id;
        }) || job.member;
    }

    // Convert date string to Date object for datepicker
    if ($scope.formData.jobDate) {
        $scope.formData.jobDate = new Date($scope.formData.jobDate);
    }

    // Date picker controls
    $scope.opened = false;
    $scope.open = function($event) {
        $event.preventDefault();
        $event.stopPropagation();
        $scope.opened = true;
    };

    $scope.editVolunteerJob = function() {
        // Update the original job object with new data
        job.member = $scope.formData.member;
        job.eventName = $scope.formData.eventName;
        job.jobDate = $scope.formData.jobDate;
        job.description = $scope.formData.description;
        $uibModalInstance.close(job);
    };

    $scope.cancel = function() {
        $uibModalInstance.dismiss('cancel');
    };

}]);
