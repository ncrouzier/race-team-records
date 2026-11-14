// Members report a volunteer job (views/submitVolunteer.html); admins add it
// from the Volunteer Submissions page (VolunteerSubmissionsCtrl.js). Built
// like the result submission page (SubmitResultCtrl.js).
angular.module('mcrrcApp.results').controller('SubmitVolunteerController', ['$scope', '$http', '$timeout', 'SubmitPagesService', 'PageTitleService', 'Analytics',
    function ($scope, $http, $timeout, SubmitPagesService, PageTitleService, Analytics) {

    var pages = SubmitPagesService;
    PageTitleService.set($scope, 'Report a Volunteer Job');

    $scope.todayStr = pages.day(new Date());
    $scope.dayLabel = pages.dayLabel;

    function emptyErrors() {
        return { runner: '', event: '', jobDate: '', description: '' };
    }

    // The event: a race on the site (raceId, raceDate) or any name typed
    $scope.form = { eventName: '', raceId: '', raceDate: '', jobDate: null, description: '' };
    $scope.errors = emptyErrors();
    $scope.existing = { jobs: [], pending: 0 };
    $scope.event = { open: false, highlighted: 0 };
    $scope.loading = true;

    $http.get('/api/volunteer-submissions/form').then(function (res) {
        $scope.data = res.data;
        $scope.members = res.data.members;
        $scope.pastMembers = res.data.pastMembers || [];
        $scope.EARLIEST = res.data.earliestDate;
        $scope.runner = pages.startingRunner($scope.members.concat($scope.pastMembers), res.data.myMemberId);
        $scope.loading = false;
    }, function () {
        $scope.loadError = true;
        $scope.loading = false;
    });

    angular.forEach({ eventName: 'event', jobDate: 'jobDate', description: 'description' }, function (error, field) {
        $scope.$watch('form.' + field, function (now, before) {
            if (now !== before) $scope.errors[error] = '';
        });
    });

    // =====================================
    // EVENT: the recent races, searched as they type

    // Nothing typed: the latest races run. Typing: the races whose name has
    // every word typed, anywhere ("henson" finds Matthew Henson 5K). Kept
    // between digests: ng-repeat wants the same rows back.
    var matchesCache = { key: null, races: [] };
    $scope.raceMatches = function () {
        if (!$scope.data || $scope.form.raceId) return [];
        var key = $scope.form.eventName;
        if (matchesCache.key === key) return matchesCache.races;
        var words = key.toLowerCase().split(/\s+/).filter(Boolean);
        var today = $scope.todayStr;
        var races = $scope.data.races.filter(function (r) {
            if (!words.length) return r.racedate <= today;
            var name = r.racename.toLowerCase();
            return words.every(function (w) { return name.indexOf(w) !== -1; });
        }).slice(0, 8);
        matchesCache = { key: key, races: races };
        return races;
    };

    // Typing again unlinks the race: it is now an event by name
    $scope.eventTyped = function () {
        $scope.event.open = true;
        $scope.event.highlighted = 0;
        $scope.form.raceId = '';
        $scope.form.raceDate = '';
    };

    $scope.eventKeydown = function ($event) {
        var races = $scope.raceMatches();
        if ($event.keyCode === 40 || $event.keyCode === 38) {
            $event.preventDefault();
            $scope.event.open = true;
            if (races.length) $scope.event.highlighted = ($scope.event.highlighted + ($event.keyCode === 40 ? 1 : -1) + races.length) % races.length;
        } else if ($event.keyCode === 13) {
            $event.preventDefault();
            if ($scope.event.open && races[$scope.event.highlighted]) $scope.pickRace(races[$scope.event.highlighted]);
            else $scope.event.open = false;
        } else if ($event.keyCode === 27) {
            $scope.event.open = false;
        }
    };

    $scope.eventBlurred = function () {
        $timeout(function () { $scope.event.open = false; }, 150);
    };

    // The race's day is the job's day, unless they say otherwise
    $scope.pickRace = function (race) {
        $scope.form.eventName = race.racename;
        $scope.form.raceId = race._id;
        $scope.form.raceDate = race.racedate;
        $scope.form.jobDate = pages.date(race.racedate);
        $scope.event.open = false;
        $scope.check();
    };

    $scope.setToday = function () {
        $scope.form.jobDate = pages.date($scope.todayStr);
        $scope.check();
    };

    $scope.isToday = function () {
        return pages.day($scope.form.jobDate) === $scope.todayStr;
    };

    $scope.notRaceDay = function () {
        var day = pages.day($scope.form.jobDate);
        return !!($scope.form.raceId && day && day !== $scope.form.raceDate);
    };

    $scope.useRaceDay = function () {
        $scope.form.jobDate = pages.date($scope.form.raceDate);
        $scope.check();
    };

    // =====================================
    // JOB: the common ones as one-tap choices

    function parts() {
        return $scope.form.description.split(/\s*,\s*/).map(function (p) { return p.trim(); }).filter(Boolean);
    }

    $scope.hasJob = function (job) {
        return parts().map(function (p) { return p.toLowerCase(); }).indexOf(job.toLowerCase()) !== -1;
    };

    // A tap adds the job to the description, a second tap takes it out
    $scope.toggleJob = function (job) {
        var list = parts();
        var i = list.map(function (p) { return p.toLowerCase(); }).indexOf(job.toLowerCase());
        if (i === -1) list.push(job);
        else list.splice(i, 1);
        $scope.form.description = list.join(', ');
    };

    // =====================================
    // ALREADY ON THE SITE?

    $scope.check = function () {
        $scope.existing = { jobs: [], pending: 0 };
        var runner = $scope.runner;
        var day = pages.day($scope.form.jobDate);
        if (!runner || runner.notListed || !runner.memberId || !day) return;
        var asked = runner.memberId + '|' + day;
        $http.get('/api/volunteer-submissions/check', { params: { memberId: runner.memberId, jobDate: day } }).then(function (res) {
            if (asked === runner.memberId + '|' + pages.day($scope.form.jobDate)) $scope.existing = res.data;
        }, angular.noop);
    };

    // =====================================
    // SENDING

    function validate() {
        var e = emptyErrors();
        var ok = true;
        var f = $scope.form;
        function bad(field, msg) { e[field] = msg; ok = false; }
        if (pages.error($scope.runner)) bad('runner', pages.error($scope.runner));
        if (!f.eventName.trim()) bad('event', 'Please enter the race or event.');
        var day = pages.day(f.jobDate);
        if (!day) bad('jobDate', 'Please enter the date.');
        else if (day > $scope.todayStr) bad('jobDate', 'The date can\'t be in the future.');
        else if (day < $scope.EARLIEST) bad('jobDate', 'Volunteer jobs go back to 2013 on this site.');
        if (!f.description.trim()) bad('description', 'Please say what you did.');
        $scope.errors = e;
        return ok;
    }

    $scope.submit = function () {
        $scope.error = '';
        if (!validate()) return pages.focusFirstError();

        var f = $scope.form;
        var payload = angular.extend(pages.payload($scope.runner), {
            raceId: f.raceId,
            eventName: f.eventName.trim(),
            jobDate: pages.day(f.jobDate),
            description: f.description.trim()
        });
        $scope.submitting = true;
        $http.post('/api/volunteer-submissions', payload).then(function () {
            pages.remember($scope.runner);
            $scope.firstName = pages.name($scope.runner, $scope.members.concat($scope.pastMembers)).split(' ')[0];
            $scope.submitted = true;
            Analytics.event('volunteer_submit', { at_race: !!f.raceId, on_roster: !$scope.runner.notListed });
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, function (res) {
            var data = res.data || {};
            if (data.field && $scope.errors[data.field] !== undefined) {
                $scope.errors[data.field] = data.error;
                pages.focusFirstError();
            } else {
                $scope.error = data.error || 'Your volunteer job could not be sent. Please try again.';
            }
        }).finally(function () {
            $scope.submitting = false;
        });
    };

    // The same volunteer and event (often several jobs there), a new job
    $scope.another = function () {
        $scope.form.description = '';
        $scope.errors = emptyErrors();
        $scope.submitted = false;
        $scope.check();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
}]);
