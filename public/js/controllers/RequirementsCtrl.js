angular.module('mcrrcApp.results').controller('RequirementsController',
    ['$scope', 'AuthService', 'RequirementsService', '$state', '$uibModal',
        function ($scope, AuthService, RequirementsService, $state, $uibModal) {

            // =====================================
            // AUTHENTICATION SETUP ================
            $scope.authService = AuthService;
            $scope.$watch('authService.isLoggedIn()', function (user) {
                $scope.user = user;
            });

            // =====================================
            // YEAR SELECTOR SETUP =================
            var currentYear = new Date().getFullYear();
            $scope.yearsList = [];
            for (var i = currentYear; i >= 2013; i--) {
                $scope.yearsList.push(i);
            }
            $scope.selectedYear = currentYear;

            // =====================================
            // LOAD REQUIREMENTS DATA ==============
            $scope.loadRequirements = function () {
                $scope.loading = true;
                RequirementsService.getRequirements($scope.selectedYear).then(function (data) {
                    // Add status value for sorting (0 = incomplete, 1 = partial, 2 = complete)
                    data.forEach(function (req) {
                        req.statusValue = $scope.calculateStatusValue(req);
                    });
                    $scope.requirementsList = data;
                    // Get volunteer requirement flag from first item (same for all members in a year)
                    $scope.volunteerRequirementApplies = data.length > 0 ? data[0].volunteerRequirementApplies : true;
                    $scope.calculateSummaryStats();
                    $scope.loading = false;
                });
            };

            // =====================================
            // CALCULATE SUMMARY STATISTICS =========
            $scope.calculateSummaryStats = function () {
                if (!$scope.requirementsList || $scope.requirementsList.length === 0) {
                    $scope.summaryStats = {
                        total: 0,
                        complete: 0,
                        percentage: 0,
                        avgRaces: 0,
                        avgVolunteer: 0
                    };
                    return;
                }

                const total = $scope.requirementsList.length;
                const complete = $scope.requirementsList.filter(function (r) {
                    return r.meetsAllRequirements;
                }).length;

                const totalRaces = $scope.requirementsList.reduce(function (sum, r) {
                    return sum + r.raceCount;
                }, 0);

                const totalVolunteer = $scope.requirementsList.reduce(function (sum, r) {
                    return sum + r.volunteerJobCount;
                }, 0);

                const avgRaces = totalRaces / total;
                const avgVolunteer = totalVolunteer / total;

                $scope.summaryStats = {
                    total: total,
                    complete: complete,
                    percentage: ((complete / total) * 100).toFixed(1),
                    avgRaces: avgRaces.toFixed(1),
                    avgVolunteer: avgVolunteer.toFixed(1)
                };
            };

            // Navigation functions for stats links
            $scope.goToResultsWithQuery = function (query) {
                if (query && (query.members || query.distance || query.year)) {
                    $state.go('/results', { search: JSON.stringify(query) });
                }
            };

            // Show volunteer jobs modal
            $scope.showVolunteerJobsModal = function (member, volunteerJobCount) {
                if (volunteerJobCount === 0) return; // Don't open modal if no jobs

                $uibModal.open({
                    templateUrl: 'views/modals/volunteerJobListModal.html',
                    controller: 'VolunteerJobListModalInstanceController',
                    size: 'lg',
                    resolve: {
                        member: function () { return member; },
                        year: function () { return $scope.selectedYear; }
                    }
                });
            };

            // =====================================
            // WATCH FOR YEAR CHANGES ==============
            $scope.$watch('selectedYear', function (newYear, oldYear) {
                if (newYear !== oldYear) {
                    $scope.loadRequirements();
                }
            });

            // =====================================
            // HELPER FUNCTIONS ====================

            // Calculate status value for sorting (0 = incomplete, 1 = partial, 2 = complete)
            $scope.calculateStatusValue = function (requirement) {
                if (requirement.meetsAllRequirements) return 2; // Complete

                // Count which requirements are met (race+volunteer count and age grade)
                var requirementsToCheck = [
                    requirement.meetsRaceRequirement,
                    requirement.meetsAgeGradeRequirement
                ];

                const metCount = requirementsToCheck.filter(Boolean).length;

                if (metCount >= 1) return 1; // Partial
                return 0; // Incomplete
            };

            // Get status class for row background color
            $scope.getStatusClass = function (requirement) {
                if (requirement.meetsAllRequirements) return 'status-complete';

                // Count which requirements are met (race+volunteer count and age grade)
                var requirementsToCheck = [
                    requirement.meetsRaceRequirement,
                    requirement.meetsAgeGradeRequirement
                ];

                const metCount = requirementsToCheck.filter(Boolean).length;

                // Partial: at least one requirement met, but not all
                if (metCount >= 1) return 'status-partial';

                // Incomplete: no requirements met
                return 'status-incomplete';
            };

            // Get status text
            $scope.getStatusText = function (requirement) {
                if (requirement.meetsAllRequirements) return 'Complete';

                // Count which requirements are met (race+volunteer count and age grade)
                var requirementsToCheck = [
                    requirement.meetsRaceRequirement,
                    requirement.meetsAgeGradeRequirement
                ];

                const metCount = requirementsToCheck.filter(Boolean).length;
                const totalRequired = 2; // Always 2 requirements: race+volunteer count and age grade

                if (metCount === 0) return 'Incomplete (0/' + totalRequired + ')';

                return 'Partial (' + metCount + '/' + totalRequired + ')';
            };

            // =====================================
            // SORTING =============================
            // Default sort: complete members first, then by races, age grade, volunteer jobs
            $scope.sortBy = ['-statusValue', '-raceCount', '-maxAgeGrade', '-volunteerJobCount'];
            $scope.sortReverse = false;

            $scope.setSortBy = function (field) {
                if (field === 'meetsAllRequirements') {
                    // Special handling for status sorting with secondary criteria
                    var currentlySortingByStatus = Array.isArray($scope.sortBy) &&
                        ($scope.sortBy[0] === '-statusValue' ||
                            $scope.sortBy[0] === 'statusValue');

                    if (currentlySortingByStatus) {
                        // Toggle between complete-first and incomplete-first
                        if ($scope.sortBy[0] === '-statusValue') {
                            // Currently complete-first, switch to incomplete-first
                            // Sort by lowest status (0=incomplete, 1=partial, 2=complete), then least races, lowest age grade, lowest volunteer jobs
                            $scope.sortBy = ['statusValue', 'raceCount', 'maxAgeGrade', 'volunteerJobCount'];
                        } else {
                            // Currently incomplete-first, switch to complete-first
                            // Sort by highest status (2=complete, 1=partial, 0=incomplete), then most races, highest age grade, most volunteer jobs
                            $scope.sortBy = ['-statusValue', '-raceCount', '-maxAgeGrade', '-volunteerJobCount'];
                        }
                    } else {
                        // First time sorting by status, default to complete-first
                        $scope.sortBy = ['-statusValue', '-raceCount', '-maxAgeGrade', '-volunteerJobCount'];
                    }
                    $scope.sortReverse = false; // Don't use reverse flag with array sort
                } else {
                    // Standard single-field sorting
                    if ($scope.sortBy === field) {
                        $scope.sortReverse = !$scope.sortReverse;
                    } else {
                        $scope.sortBy = field;
                        $scope.sortReverse = false;
                    }
                }
            };

            // =====================================
            // INITIAL LOAD ========================
            $scope.loadRequirements();

        }]);

// =====================================
// MODAL INSTANCE CONTROLLER ============
angular.module('mcrrcApp.results').controller('VolunteerJobListModalInstanceController',
    ['$scope', '$uibModalInstance', 'member', 'year', 'VolunteerJobsService',
        function ($scope, $uibModalInstance, member, year, VolunteerJobsService) {

            $scope.member = member;
            $scope.year = year;
            $scope.loading = true;
            $scope.volunteerJobs = [];

            // Calculate date range for the year
            var dateFrom = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
            var dateTo = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0));

            // Load volunteer jobs for this member and year
            VolunteerJobsService.getVolunteerJobs({}).then(function (allJobs) {
                // Filter jobs by member and year
                $scope.volunteerJobs = allJobs.filter(function (job) {
                    var jobDate = new Date(job.jobDate);
                    return job.member._id === member._id &&
                        jobDate >= dateFrom &&
                        jobDate < dateTo;
                });
                $scope.loading = false;
            });

            $scope.close = function () {
                $uibModalInstance.close();
            };

        }]);
