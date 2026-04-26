angular.module('mcrrcApp.results').controller('RequirementsController',
    ['$scope', 'AuthService', 'MembersService', 'ResultsService', 'VolunteerJobsService', '$state', '$uibModal', '$q', 'TeamRequirementsConfig',
        function ($scope, AuthService, MembersService, ResultsService, VolunteerJobsService, $state, $uibModal, $q, TeamRequirementsConfig) {

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
            $scope.reqConfig = TeamRequirementsConfig.getForYear(currentYear);

            // =====================================
            // LOAD REQUIREMENTS DATA ==============
            $scope.loadRequirements = function () {
                $scope.loading = true;
                var year = $scope.selectedYear;
                $scope.reqConfig = TeamRequirementsConfig.getForYear(year);

                $q.all([
                    MembersService.getMembersWithCacheSupport({ select: '-bio -personalBests' }),
                    ResultsService.getRaceResultsWithCacheSupport({ sort: '-racedate -order racename', preload: false }),
                    VolunteerJobsService.getVolunteerJobsWithCacheSupport({ sort: '-jobDate' })
                ]).then(function (results) {
                    var members = results[0];
                    var races = results[1];
                    var volunteerJobs = results[2];
                    var data = $scope.buildRequirementsFromCachedData(members, races, volunteerJobs, year);
                    $scope.processRequirementsData(data);
                });
            };

            // Build requirements data from cached race results, volunteer jobs, and members
            $scope.buildRequirementsFromCachedData = function (members, races, volunteerJobs, year) {
                var yearStart = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
                var yearEnd = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0));

                // Build per-member race count and max age grade from race results
                var memberRaceStats = {}; // keyed by member _id
                races.forEach(function (race) {
                    var raceDate = new Date(race.racedate);
                    if (raceDate < yearStart || raceDate >= yearEnd) return;

                    (race.results || []).forEach(function (result) {
                        (result.members || []).forEach(function (m) {
                            var id = m._id.toString();
                            if (!memberRaceStats[id]) {
                                memberRaceStats[id] = { raceCount: 0, maxAgeGrade: 0 };
                            }
                            memberRaceStats[id].raceCount++;
                            var ag = result.agegrade || 0;
                            if (ag > memberRaceStats[id].maxAgeGrade) {
                                memberRaceStats[id].maxAgeGrade = ag;
                            }
                        });
                    });
                });

                // Build per-member volunteer job count
                var memberVolunteerCount = {}; // keyed by member _id
                (volunteerJobs || []).forEach(function (job) {
                    var jobDate = new Date(job.jobDate);
                    if (jobDate < yearStart || jobDate >= yearEnd) return;
                    var id = (job.member && job.member._id) ? job.member._id.toString() : null;
                    if (!id) return;
                    memberVolunteerCount[id] = (memberVolunteerCount[id] || 0) + 1;
                });

                // Build requirements for each active member
                var data = [];
                members.forEach(function (member) {
                    if (!member.membershipDates || member.membershipDates.length === 0) return;

                    var isActive = member.membershipDates.some(function (period) {
                        var periodStart = new Date(period.start);
                        var periodEnd = period.end ? new Date(period.end) : new Date(9999, 11, 31);
                        return periodStart < yearEnd && periodEnd >= yearStart;
                    });
                    if (!isActive) return;

                    var id = member._id.toString();
                    var stats = memberRaceStats[id] || { raceCount: 0, maxAgeGrade: 0 };
                    var volunteerJobCount = memberVolunteerCount[id] || 0;

                    var reqConfig = TeamRequirementsConfig.getForYear(year);
                    var meetsRaceRequirement = stats.raceCount >= reqConfig.minRaceCount;
                    var meetsAgeGradeRequirement = stats.maxAgeGrade >= reqConfig.minAgeGrade;
                    var meetsAllRequirements = meetsRaceRequirement && meetsAgeGradeRequirement;

                    var joinedDuringYear = member.membershipDates.some(function (period) {
                        var periodStart = new Date(period.start);
                        return periodStart >= yearStart && periodStart < yearEnd;
                    });
                    var leftDuringYear = member.membershipDates.some(function (period) {
                        if (!period.end) return false;
                        var periodEnd = new Date(period.end);
                        return periodEnd >= yearStart && periodEnd < yearEnd;
                    });

                    data.push({
                        member: {
                            _id: member._id,
                            firstname: member.firstname,
                            lastname: member.lastname,
                            username: member.username
                        },
                        raceCount: stats.raceCount,
                        maxAgeGrade: stats.maxAgeGrade,
                        volunteerJobCount: volunteerJobCount,
                        meetsRaceRequirement: meetsRaceRequirement,
                        meetsAgeGradeRequirement: meetsAgeGradeRequirement,
                        meetsAllRequirements: meetsAllRequirements,
                        volunteerRequirementApplies: true,
                        joinedDuringYear: joinedDuringYear,
                        leftDuringYear: leftDuringYear
                    });
                });

                return data;
            };

            // Process requirements data
            $scope.processRequirementsData = function (data) {
                data.forEach(function (req) {
                    req.statusValue = $scope.calculateStatusValue(req);
                });
                $scope.requirementsList = data;
                $scope.volunteerRequirementApplies = true;
                $scope.calculateSummaryStats();
                $scope.loading = false;
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

                // Count which requirements are met (race count and age grade)
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

                // Count which requirements are met (race count and age grade)
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

                // Count which requirements are met (race count and age grade)
                var requirementsToCheck = [
                    requirement.meetsRaceRequirement,
                    requirement.meetsAgeGradeRequirement
                ];

                const metCount = requirementsToCheck.filter(Boolean).length;
                const totalRequired = 2; // Always 2 requirements: race count and age grade

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
                } else if (field === 'volunteerJobCount') {
                    // Special handling for volunteer jobs sorting with secondary criteria
                    var currentlySortingByVolunteer = Array.isArray($scope.sortBy) &&
                        ($scope.sortBy[0] === '-volunteerJobCount' ||
                            $scope.sortBy[0] === 'volunteerJobCount');

                    if (currentlySortingByVolunteer) {
                        // Toggle between most-first and least-first
                        if ($scope.sortBy[0] === '-volunteerJobCount') {
                            // Currently most-first, switch to least-first
                            // Sort by least volunteer jobs, then least races, then lowest age grade
                            $scope.sortBy = ['volunteerJobCount', 'raceCount', 'maxAgeGrade'];
                        } else {
                            // Currently least-first, switch to most-first
                            // Sort by most volunteer jobs, then most races, then highest age grade
                            $scope.sortBy = ['-volunteerJobCount', '-raceCount', '-maxAgeGrade'];
                        }
                    } else {
                        // First time sorting by volunteer jobs, default to most-first
                        $scope.sortBy = ['-volunteerJobCount', '-raceCount', '-maxAgeGrade'];
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
    ['$scope', '$uibModalInstance', 'member', 'year', 'Restangular',
        function ($scope, $uibModalInstance, member, year, Restangular) {

            $scope.member = member;
            $scope.year = year;
            $scope.loading = true;
            $scope.volunteerJobs = [];

            // Calculate date range for the year
            var dateFrom = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
            var dateTo = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0));

            // Load volunteer jobs for this member using member-specific endpoint
            Restangular.one('members', member._id).getList('volunteerjobs', { sort: '-jobDate' }).then(function (jobs) {
                $scope.volunteerJobs = jobs.filter(function (job) {
                    var jobDate = new Date(job.jobDate);
                    return jobDate >= dateFrom && jobDate < dateTo;
                });
                $scope.loading = false;
            });

            $scope.close = function () {
                $uibModalInstance.close();
            };

        }]);
