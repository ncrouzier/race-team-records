// The member's correction form (views/modals/correctionRequestModal.html).
// It starts from the result as stored (status.values, from the server), or
// from the member's pending request, and highlights every change as the
// server will record it (window.CorrectionRequests, app/correctionRequests.js).
angular.module('mcrrcApp.results').controller('CorrectionRequestModalController', ['$scope', '$uibModalInstance', 'status', 'CorrectionService', 'UtilsService', 'Analytics',
    function ($scope, $uibModalInstance, status, CorrectionService, UtilsService, Analytics) {

    var rules = window.CorrectionRequests;
    var current = status.values;
    var pending = status.request;

    $scope.runners = status.runners || [];
    $scope.isMultisport = status.isMultisport;
    $scope.pending = pending;
    $scope.surfaces = rules.SURFACES;
    $scope.maxText = rules.MAX_TEXT;
    $scope.placements = [
        { name: 'Overall', rank: 'overallrank', total: 'overalltotal' },
        { name: 'Gender', rank: 'genderrank', total: 'gendertotal' },
        { name: 'Age group', rank: 'agerank', total: 'agetotal' }
    ];
    $scope.note = pending && pending.note || '';
    $scope.sending = false;
    $scope.error = null;
    $scope.blocked = null;      // { by }: a teammate's request got there first

    UtilsService.getCountries().then(function (countries) { $scope.countries = countries; });
    UtilsService.getStates().then(function (states) { $scope.states = states; });

    // Times are typed as hours / minutes / seconds / hundredths, like the
    // admin's result form
    function splitTime(cs) {
        if (cs === null || cs === undefined) return { hours: null, minutes: null, seconds: null, centiseconds: null };
        return {
            hours: Math.floor(cs / 360000),
            minutes: Math.floor((cs % 360000) / 6000),
            seconds: Math.floor((cs % 6000) / 100),
            centiseconds: Math.round(cs % 100)
        };
    }
    function joinTime(t) {
        var parts = [t.hours, t.minutes, t.seconds, t.centiseconds];
        if (parts.every(function (p) { return p === null || p === undefined || p === ''; })) return null;
        return (Number(t.hours) || 0) * 360000 + (Number(t.minutes) || 0) * 6000 +
            (Number(t.seconds) || 0) * 100 + (Number(t.centiseconds) || 0);
    }
    // The date input wants a Date at local midnight; the rules a 'YYYY-MM-DD'
    function toDate(day) {
        if (!day) return null;
        var p = day.split('-');
        return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    }
    function toDay(date) {
        if (!date) return null;
        var pad = function (n) { return n < 10 ? '0' + n : String(n); };
        return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
    }

    // The form: the stored values, with the pending request's suggestions on top
    var start = pending ? rules.applyChanges(current, pending.changes) : angular.copy(current);
    $scope.form = angular.copy(start);
    $scope.form.racedate = toDate(start.racedate);
    $scope.time = splitTime(start.time);
    $scope.legTimes = start.legs.map(function (leg) { return splitTime(leg.time); });

    // The values as the rules read them
    function suggested() {
        var values = angular.copy($scope.form);
        values.racedate = toDay($scope.form.racedate);
        values.time = joinTime($scope.time);
        values.legs.forEach(function (leg, i) { leg.time = joinTime($scope.legTimes[i]); });
        return values;
    }

    // What changed, by key ('time', 'leg:0:time'), for the highlight and the count
    $scope.changes = [];
    $scope.changed = {};
    $scope.$watch(function () { return angular.toJson(suggested()); }, function () {
        $scope.changes = rules.changesBetween(current, suggested());
        $scope.changed = {};
        $scope.changes.forEach(function (change) {
            $scope.changed[rules.changeKey(change)] = change;
        });
    });

    // "was 15:57" under a changed field
    $scope.was = function (change) {
        if (!change) return '';
        var text = rules.describeChange(change);
        return 'was ' + text.slice(text.indexOf(': ') + 2, text.lastIndexOf(' → '));
    };

    // Nothing out of range (a minute over 59, a place of 0), and something to say
    $scope.canSend = function () {
        return !$scope.sending && !$scope.blocked && !($scope.crqForm && $scope.crqForm.$invalid) &&
            ($scope.changes.length > 0 || ($scope.note || '').trim() !== '');
    };

    $scope.send = function () {
        if (!$scope.canSend()) return;
        $scope.sending = true;
        $scope.error = null;
        // Only the changes: the server puts them on the result as stored, so a
        // field the member left alone never undoes an edit made meanwhile
        CorrectionService.send(status.resultId, rules.changedValues($scope.changes), $scope.note).then(function () {
            Analytics.event('correction_send', {
                update: !!pending,
                changes: $scope.changes.length,
                race_wide: $scope.changes.filter(function (c) { return c.raceWide; }).length,
                with_note: ($scope.note || '').trim() !== ''
            });
            $uibModalInstance.close('sent');
        }, function (res) {
            $scope.sending = false;
            // A teammate's request got there first (their page was newer):
            // not an error; what was typed stays until the form is closed
            if (res.status === 409) {
                $scope.blocked = { by: res.data && res.data.by || 'A teammate' };
                return;
            }
            $scope.error = 'Your suggestion could not be sent. Please try again.';
        });
    };

    $scope.withdraw = function () {
        if (!pending) return;
        $scope.sending = true;
        CorrectionService.withdraw(pending._id).then(function () {
            Analytics.event('correction_withdraw');
            $uibModalInstance.close('withdrawn');
        }, function (res) {
            // Closed meanwhile (an admin handled or declined it): nothing to
            // withdraw; the result page reloads to show where things stand
            if (res.status === 409 || res.status === 404) {
                $uibModalInstance.close('stale');
                return;
            }
            $scope.sending = false;
            $scope.error = 'Your request could not be withdrawn. Please try again.';
        });
    };

    // Closing after a teammate got there first: the result page reloads to
    // show their pending request
    $scope.cancel = function () {
        if ($scope.blocked) {
            $uibModalInstance.close('stale');
            return;
        }
        $uibModalInstance.dismiss('cancel');
    };
}]);

// One suggested change as text: "Time: 15:57 → 15:47"
angular.module('mcrrcApp').filter('correctionChange', function () {
    return function (change) {
        return change ? window.CorrectionRequests.describeChange(change) : '';
    };
});

// Admins: members' correction requests (views/corrections.html). Each opens
// the usual result or race edit modal with the request shown above it; saving
// from it closes the request, unless kept open for a second edit.
angular.module('mcrrcApp.results').controller('CorrectionsController', ['$scope', '$rootScope', '$state', '$stateParams', 'AuthService', 'CorrectionService', 'ResultsService', 'PageTitleService', 'Analytics',
    function ($scope, $rootScope, $state, $stateParams, AuthService, CorrectionService, ResultsService, PageTitleService, Analytics) {

    var rules = window.CorrectionRequests;
    PageTitleService.set($scope, 'Correction Requests');

    // Admins only: anyone else goes home once we know who is signed in
    $scope.$watch(function () {
        if (!$rootScope.authResolved) return null;
        var user = AuthService.isLoggedIn();
        return user && user.role === 'admin' ? 'allowed' : 'denied';
    }, function (access) {
        if (access === 'denied') $state.go('/', {}, { location: 'replace' });
        if (access === 'allowed') load();
    });

    $scope.tab = $stateParams.tab === 'done' ? 'done' : 'open';
    $scope.requests = null;
    $scope.dismissing = null;   // { id, reason }: the request being dismissed

    function load() {
        $scope.loadError = false;
        CorrectionService.list($scope.tab).then(function (requests) {
            $scope.requests = requests;
        }, function () {
            $scope.loadError = true;
        });
    }

    $scope.showTab = function (tab) {
        Analytics.event('view_switch', { from: 'corrections_' + $scope.tab, to: 'corrections_' + tab });
        $scope.tab = tab;
        $scope.requests = null;
        $state.go('.', { tab: tab });
        load();
    };

    // Which edit the request mostly needs gets the primary button
    $scope.kinds = function (request) {
        return rules.editKinds(request.changes);
    };

    // Saved from the modal: the request closes (or stays open when ticked).
    // Closed meanwhile (409): the list just catches up.
    function saved(request, kind) {
        Analytics.event('admin_action', { action: 'correction_saved', kind: kind, kept_open: !!request.keepOpen });
        CorrectionService.markSaved(request._id, kind, request.keepOpen).then(load, load);
    }

    $scope.editResult = function (request) {
        Analytics.event('admin_action', { action: 'correction_edit_open', kind: 'result' });
        request.keepOpen = rules.keepOpenDefault(request, 'result');
        ResultsService.retrieveResultForEdit({ _id: request.result }, { request: request }).then(function (result) {
            if (result) saved(request, 'result');
        }, angular.noop);
    };

    $scope.editRace = function (request) {
        Analytics.event('admin_action', { action: 'correction_edit_open', kind: 'race' });
        request.keepOpen = rules.keepOpenDefault(request, 'race');
        ResultsService.showEditRaceModal({ _id: request.race._id }, { request: request }).then(function (race) {
            if (race) saved(request, 'race');
        }, angular.noop);
    };

    $scope.startDismiss = function (request) {
        $scope.dismissing = { id: request._id, reason: '' };
    };

    $scope.cancelDismiss = function () {
        $scope.dismissing = null;
    };

    $scope.confirmDismiss = function () {
        var d = $scope.dismissing;
        $scope.dismissing = null;
        Analytics.event('admin_action', { action: 'correction_dismiss', with_reason: !!(d.reason || '').trim() });
        CorrectionService.dismiss(d.id, d.reason).then(load, load);
    };

    $scope.outcome = function (request) {
        return { handled: 'Handled', declined: 'Declined', withdrawn: 'Withdrawn by the member' }[request.status] || request.status;
    };
}]);

// One side of a suggested change: {{ change | correctionValue:'from' }}
angular.module('mcrrcApp').filter('correctionValue', function () {
    return function (change, side) {
        return change ? window.CorrectionRequests.changeValue(change, side) : '';
    };
});
