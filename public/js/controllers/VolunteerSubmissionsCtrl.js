// Admins: volunteer jobs members reported on /submit-volunteer
// (views/volunteerSubmissions.html). Each opens the usual "Add Volunteer
// Jobs" form filled in from the submission; saving it marks the submission
// added. Built like the Result Submissions page (ResultSubmissionsCtrl.js).
angular.module('mcrrcApp.results').controller('VolunteerSubmissionsController', ['$scope', '$rootScope', '$state', '$stateParams', 'AuthService', 'VolunteerSubmissionService', 'VolunteerJobsService', 'MembersService', 'PageTitleService', 'Analytics',
    function ($scope, $rootScope, $state, $stateParams, AuthService, VolunteerSubmissionService, VolunteerJobsService, MembersService, PageTitleService, Analytics) {

    PageTitleService.set($scope, 'Volunteer Submissions');

    // Admins only: anyone else goes home once we know who is signed in
    $scope.$watch(function () {
        if (!$rootScope.authResolved) return null;
        var user = AuthService.isLoggedIn();
        return user && user.role === 'admin' ? 'allowed' : 'denied';
    }, function (access) {
        if (access === 'denied') $state.go('/', {}, { location: 'replace' });
        if (access === 'allowed') load();
    });

    $scope.tab = $stateParams.tab === 'done' ? 'done' : 'pending';
    $scope.submissions = null;
    $scope.dismissing = null;   // { id, reason }: the submission being dismissed

    // The add form's member list, as on the Volunteer Jobs page
    var membersList = null;
    MembersService.getMembersWithCacheSupport({}).then(function (members) {
        membersList = members;
    });

    function load() {
        $scope.loadError = false;
        VolunteerSubmissionService.list($scope.tab).then(function (submissions) {
            $scope.submissions = submissions;
        }, function () {
            $scope.loadError = true;
        });
    }

    $scope.showTab = function (tab) {
        Analytics.event('view_switch', { from: 'volunteer_submissions_' + $scope.tab, to: 'volunteer_submissions_' + tab });
        $scope.tab = tab;
        $scope.submissions = null;
        $state.go('.', { tab: tab });
        load();
    };

    $scope.membersLoaded = function () {
        return !!membersList;
    };

    $scope.createJob = function (submission) {
        Analytics.event('admin_action', { action: 'volunteer_submission_add_open' });
        var prefill = {
            submission: submission,
            race: submission.race && submission.race._id ? submission.race : null,
            eventName: submission.eventName,
            jobDate: submission.jobDate,
            rows: [{ memberId: submission.member && submission.member._id, description: submission.description }]
        };
        VolunteerJobsService.showAddVolunteerJobModal(membersList, prefill).then(function (jobs) {
            if (!jobs || !jobs.length) return;
            Analytics.event('admin_action', { action: 'volunteer_submission_added', jobs: jobs.length });
            // Closed meanwhile (409): the list just catches up
            VolunteerSubmissionService.markAdded(submission._id, jobs[0]._id).then(load, load);
        });
    };

    // Already on the site (entered by hand, or sent twice): done, not dismissed
    $scope.markAlready = function (submission) {
        Analytics.event('admin_action', { action: 'volunteer_submission_already' });
        VolunteerSubmissionService.markAlready(submission._id).then(load, load);
    };

    $scope.outcome = function (submission) {
        return { added: 'Added', already: 'Already entered', dismissed: 'Dismissed' }[submission.status] || submission.status;
    };

    $scope.startDismiss = function (submission) {
        $scope.dismissing = { id: submission._id, reason: '' };
    };

    $scope.cancelDismiss = function () {
        $scope.dismissing = null;
    };

    $scope.confirmDismiss = function () {
        var d = $scope.dismissing;
        $scope.dismissing = null;
        Analytics.event('admin_action', { action: 'volunteer_submission_dismiss', with_reason: !!(d.reason || '').trim() });
        VolunteerSubmissionService.dismiss(d.id, d.reason).then(load, load);
    };

    $scope.reopen = function (submission) {
        Analytics.event('admin_action', { action: 'volunteer_submission_reopen' });
        VolunteerSubmissionService.reopen(submission._id).then(load, load);
    };
}]);

// {{ submission | volunteerSubmissionRunner }}: the member, or the name they typed
angular.module('mcrrcApp').filter('volunteerSubmissionRunner', function () {
    return function (submission) {
        return submission ? window.ResultSubmissions.runnerName(submission) : '';
    };
});
