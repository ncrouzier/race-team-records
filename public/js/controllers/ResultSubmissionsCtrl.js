// Admins: results runners submitted on /submit-result
// (views/resultSubmissions.html). Each opens the usual "Add result" form filled
// in from the submission, on its own race or one already on the site that
// day; saving it marks the submission added.
angular.module('mcrrcApp.results').controller('ResultSubmissionsController', ['$scope', '$rootScope', '$state', '$stateParams', 'AuthService', 'ResultSubmissionService', 'ResultsService', 'PageTitleService', 'Analytics',
    function ($scope, $rootScope, $state, $stateParams, AuthService, ResultSubmissionService, ResultsService, PageTitleService, Analytics) {

    PageTitleService.set($scope, 'Result Submissions');
    $scope.places = window.ResultSubmissions.PLACES;

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

    function load() {
        $scope.loadError = false;
        ResultSubmissionService.list($scope.tab).then(function (submissions) {
            $scope.submissions = submissions;
        }, function () {
            $scope.loadError = true;
        });
    }

    $scope.showTab = function (tab) {
        Analytics.event('view_switch', { from: 'submissions_' + $scope.tab, to: 'submissions_' + tab });
        $scope.tab = tab;
        $scope.submissions = null;
        $state.go('.', { tab: tab });
        load();
    };

    $scope.hasPlaces = function (s) {
        var r = s.ranking || {};
        return Object.keys(r).some(function (key) { return r[key]; });
    };

    // The race on the site the runner picked, when it is one of that day's
    $scope.linkedRace = function (submission) {
        var id = submission.race && submission.race._id;
        return id ? (submission.sameDayRaces || []).find(function (r) { return r._id === id; }) || null : null;
    };

    // race: one already on the site that day, or nothing for the submission's
    // own (or the one the runner picked, if they did)
    $scope.addResult = function (submission, race) {
        race = race || $scope.linkedRace(submission);
        Analytics.event('admin_action', { action: 'submission_add_open', existing_race: !!race });
        var ref = { submission: submission, race: race || null, addPhotoLink: !!submission.photoLink };
        ResultsService.showAddResultFromSubmission(ref).then(function (saved) {
            if (!saved || !saved._id) return;
            Analytics.event('admin_action', { action: 'submission_added', existing_race: !!race });
            // Closed meanwhile (409): the list just catches up
            ResultSubmissionService.markAdded(submission._id, saved._id, ref.addPhotoLink).then(load, load);
        }, angular.noop);
    };

    // Already on the site (entered by hand, or sent twice): done, not dismissed
    $scope.markAlready = function (submission) {
        Analytics.event('admin_action', { action: 'submission_already' });
        ResultSubmissionService.markAlready(submission._id).then(load, load);
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
        Analytics.event('admin_action', { action: 'submission_dismiss', with_reason: !!(d.reason || '').trim() });
        ResultSubmissionService.dismiss(d.id, d.reason).then(load, load);
    };

    $scope.reopen = function (submission) {
        Analytics.event('admin_action', { action: 'submission_reopen' });
        ResultSubmissionService.reopen(submission._id).then(load, load);
    };
}]);

// {{ submission | submissionRunner }}: the member, or the name they typed
angular.module('mcrrcApp').filter('submissionRunner', function () {
    return function (submission) {
        return submission ? window.ResultSubmissions.runnerName(submission) : '';
    };
});

// {{ submission | submissionDistance }}: "10k (road)", or the runner's words
angular.module('mcrrcApp').filter('submissionDistance', function () {
    return function (submission) {
        return submission ? window.ResultSubmissions.distanceLabel(submission) : '';
    };
});

// {{ centiseconds | submissionTime }}: "35:54", "1:25:00", "4:52.31"
angular.module('mcrrcApp').filter('submissionTime', function () {
    return function (cs) {
        return window.ResultSubmissions.formatTime(cs);
    };
});

// {{ submission.ranking | submissionPlace:'agerank' }}: "3 / 125"
angular.module('mcrrcApp').filter('submissionPlace', function () {
    return function (ranking, which) {
        return window.ResultSubmissions.placeText(ranking, which);
    };
});
