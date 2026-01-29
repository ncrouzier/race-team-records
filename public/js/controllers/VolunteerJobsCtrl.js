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

    // Show add modal
    $scope.showAddVolunteerJobModal = function() {
        VolunteerJobsService.showAddVolunteerJobModal($scope.membersList).then(function(job) {
            if (job !== null) {
                $scope.volunteerJobsList.push(job);
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
// MODAL INSTANCE CONTROLLER ============
angular.module('mcrrcApp.results').controller('VolunteerJobModalInstanceController', ['$scope', '$uibModalInstance', 'job', 'membersList', function($scope, $uibModalInstance, job, membersList) {

    $scope.membersList = membersList;
    $scope.editmode = false;

    if (job) {
        // Edit mode - copy the job data
        $scope.formData = angular.copy(job);
        $scope.editmode = true;

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
    } else {
        // Add mode - initialize with defaults
        $scope.formData = {
            jobDate: new Date(),
            member: null,
            eventName: '',
            description: ''
        };
        $scope.editmode = false;
    }

    // Date picker controls
    $scope.opened = false;
    $scope.open = function($event) {
        $event.preventDefault();
        $event.stopPropagation();
        $scope.opened = true;
    };

    $scope.addVolunteerJob = function() {
        $uibModalInstance.close($scope.formData);
    };

    $scope.editVolunteerJob = function() {
        // Update the original job object with new data
        if (job) {
            job.member = $scope.formData.member;
            job.eventName = $scope.formData.eventName;
            job.jobDate = $scope.formData.jobDate;
            job.description = $scope.formData.description;
        }
        $uibModalInstance.close(job);
    };

    $scope.cancel = function() {
        $uibModalInstance.dismiss('cancel');
    };

}]);
