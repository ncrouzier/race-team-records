angular.module('mcrrcApp.members').controller('MemberVolunteerJobsController', ['$scope', '$state', '$stateParams', 'AuthService', 'MembersService', 'Restangular', function($scope, $state, $stateParams, AuthService, MembersService, Restangular) {

    $scope.authService = AuthService;
    $scope.$watch('authService.isLoggedIn()', function(user) {
        $scope.user = user;
    });

    $scope.currentMember = null;
    $scope.volunteerJobsList = [];
    $scope.loading = true;
    $scope.authorized = false;

    // Year filter setup
    $scope.yearsList = ['All'];
    $scope.selectedYear = new Date().getFullYear();
    $scope.searchQuery = '';

    function buildYearsList(jobs) {
        var yearsSet = {};
        jobs.forEach(function(job) {
            var year = new Date(job.jobDate).getUTCFullYear();
            yearsSet[year] = true;
        });
        var years = Object.keys(yearsSet).map(Number).sort(function(a, b) { return b - a; });
        $scope.yearsList = ['All'].concat(years);
        if (years.indexOf($scope.selectedYear) === -1) {
            $scope.selectedYear = years.length > 0 ? years[0] : 'All';
        }
    }

    // Filter function for volunteer jobs
    $scope.volunteerJobFilter = function(job) {
        // Year filter
        if ($scope.selectedYear !== 'All') {
            var jobDate = new Date(job.jobDate);
            if (jobDate.getUTCFullYear() !== $scope.selectedYear) {
                return false;
            }
        }
        // Search filter - event name and description
        if ($scope.searchQuery) {
            var q = $scope.searchQuery.toLowerCase();
            var eventName = (job.eventName || '').toLowerCase();
            var description = (job.description || '').toLowerCase();
            if (eventName.indexOf(q) === -1 && description.indexOf(q) === -1) {
                return false;
            }
        }
        return true;
    };

    // Count filtered jobs
    $scope.getFilteredCount = function() {
        if (!$scope.volunteerJobsList) return 0;
        return $scope.volunteerJobsList.filter($scope.volunteerJobFilter).length;
    };

    // Check if user is authorized to view this page
    function isAuthorized(user, member) {
        if (!user) return false;
        if (user.role === 'admin' || user.role === 'captain') return true;
        if (user.member && user.member._id && member && user.member._id === member._id) return true;
        return false;
    }

    // Navigate back to member list
    $scope.goToMemberList = function() {
        $state.go('/members');
    };

    // Admin functions
    $scope.retrieveMemberForEdit = function(member) {
        MembersService.retrieveMemberForEdit(member).then(function() {});
    };

    $scope.removeMember = function(member) {};

    // Initial load
    async function initialLoad() {
        if (!$stateParams.member) return;

        try {
            var allMembers = await MembersService.getMembersWithCacheSupport();
            var member = allMembers.find(function(m) { return m.username === $stateParams.member; });

            if (!member) {
                $state.go('/members');
                return;
            }

            // Get full member details
            var fullMember = await MembersService.getMember(member._id);
            $scope.currentMember = fullMember;

            // Check authorization
            var user = AuthService.isLoggedIn();
            if (!isAuthorized(user, fullMember)) {
                $scope.authorized = false;
                $scope.loading = false;
                if (!$scope.$$phase) {
                    $scope.$apply();
                }
                return;
            }

            $scope.authorized = true;

            // Load volunteer jobs for this member
            Restangular.one('members', fullMember._id).getList('volunteerjobs').then(function(jobs) {
                $scope.volunteerJobsList = jobs;
                buildYearsList(jobs);
                $scope.loading = false;
                if (!$scope.$$phase) {
                    $scope.$apply();
                }
            });

        } catch (error) {
            console.error('Error loading member volunteer jobs:', error);
            $state.go('/members');
        }
    }

    initialLoad();
}]);

