// Members report a race result (views/submitResult.html); admins add it from
// the Result Submissions page (ResultSubmissionsCtrl.js). The rules are
// window.ResultSubmissions (app/resultSubmissions.js), shared with the server.
angular.module('mcrrcApp.results').controller('SubmitResultController', ['$scope', '$http', '$timeout', 'SubmitPagesService', 'UtilsService', 'PageTitleService', 'Analytics', 'AuthService', 'CorrectionService',
    function ($scope, $http, $timeout, SubmitPagesService, UtilsService, PageTitleService, Analytics, AuthService, CorrectionService) {

    var rules = window.ResultSubmissions;
    var pages = SubmitPagesService;
    PageTitleService.set($scope, 'Submit a Result');

    var SURFACES = [
        { surface: 'road', label: 'Road' },
        { surface: 'track', label: 'Track' },
        { surface: 'trail', label: 'Trail' },
        { surface: 'ultra', label: 'Ultra' }
    ];

    $scope.QUICK_STATES = ['MD', 'DC', 'VA', 'PA', 'DE'];
    $scope.PLACES = rules.PLACES;
    $scope.states = UtilsService.states;
    $scope.otherCountries = UtilsService.countries.filter(function (c) { return c.code !== 'USA'; });
    $scope.todayStr = pages.day(new Date());
    $scope.dayLabel = pages.dayLabel;

    function emptyErrors() {
        return {
            runner: '', racename: '', racedate: '', country: '', state: '', distance: '', time: '',
            agerank: '', genderrank: '', overallrank: '', resultlink: '', photoLink: ''
        };
    }

    function emptyForm() {
        return {
            // raceId: a race on the site picked from the list (raceDate: its day)
            racename: '', raceId: '', raceDate: '', racedate: null, country: 'USA', state: 'MD',
            racetypeId: '', distanceText: '', timeStr: '', splits: '', ranking: {},
            resultlink: '', noResultLink: false, photoLink: '', comments: '', highlight: ''
        };
    }

    $scope.form = emptyForm();
    $scope.errors = emptyErrors();
    $scope.existing = { results: [], inRace: [], pending: 0 };
    $scope.dist = { open: false, search: '', highlighted: 0 };
    $scope.raceUi = { open: false, highlighted: 0 };
    $scope.loading = true;

    $http.get('/api/result-submissions/form').then(function (res) {
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

    // A field's message goes as soon as the field changes
    angular.forEach({
        racename: 'racename', racedate: 'racedate', country: 'country', state: 'state',
        racetypeId: 'distance', distanceText: 'distance', timeStr: 'time',
        resultlink: 'resultlink', photoLink: 'photoLink'
    }, function (error, field) {
        $scope.$watch('form.' + field, function (now, before) {
            if (now !== before) $scope.errors[error] = '';
        });
    });
    $scope.$watch('form.ranking', function (now, before) {
        if (now !== before) rules.PLACES.forEach(function (p) { $scope.errors[p.rank] = ''; });
    }, true);

    $scope.setToday = function () {
        $scope.form.racedate = pages.date($scope.todayStr);
        $scope.dateChanged();
    };

    // A race on another day is another race: the picked one no longer applies
    $scope.dateChanged = function () {
        if ($scope.form.raceId && pages.day($scope.form.racedate) !== $scope.form.raceDate) {
            $scope.form.raceId = '';
            $scope.form.raceDate = '';
        }
        $scope.check();
    };

    $scope.isToday = function () {
        return pages.day($scope.form.racedate) === $scope.todayStr;
    };

    // Typing the digits: 3554 reads 35:54 (a phone's keypad has no colon)
    $scope.timeTyped = function () {
        $scope.form.timeStr = rules.formatTimeDigits($scope.form.timeStr);
    };

    // =====================================
    // RACE NAME: the recent races, searched as they type

    // Nothing typed: the latest races run. Typing: the races whose name has
    // every word typed, anywhere. Kept between digests (ng-repeat).
    var raceCache = { key: null, races: [] };
    $scope.raceMatches = function () {
        if (!$scope.data || $scope.form.raceId) return [];
        var key = $scope.form.racename;
        if (raceCache.key === key) return raceCache.races;
        var words = key.toLowerCase().split(/\s+/).filter(Boolean);
        var today = $scope.todayStr;
        var races = ($scope.data.races || []).filter(function (r) {
            if (!words.length) return r.racedate <= today;
            var name = r.racename.toLowerCase();
            return words.every(function (w) { return name.indexOf(w) !== -1; });
        }).slice(0, 8);
        raceCache = { key: key, races: races };
        return races;
    };

    // Typing again unlinks the race: it is now a race by name
    $scope.raceTyped = function () {
        $scope.raceUi.open = true;
        $scope.raceUi.highlighted = 0;
        if ($scope.form.raceId) {
            $scope.form.raceId = '';
            $scope.form.raceDate = '';
            $scope.check();
        }
    };

    $scope.raceKeydown = function ($event) {
        var races = $scope.raceMatches();
        if ($event.keyCode === 40 || $event.keyCode === 38) {
            $event.preventDefault();
            $scope.raceUi.open = true;
            if (races.length) $scope.raceUi.highlighted = ($scope.raceUi.highlighted + ($event.keyCode === 40 ? 1 : -1) + races.length) % races.length;
        } else if ($event.keyCode === 13) {
            $event.preventDefault();
            if ($scope.raceUi.open && races[$scope.raceUi.highlighted]) $scope.pickRace(races[$scope.raceUi.highlighted]);
            else $scope.raceUi.open = false;
        } else if ($event.keyCode === 27) {
            $scope.raceUi.open = false;
        }
    };

    $scope.raceBlurred = function () {
        $timeout(function () { $scope.raceUi.open = false; }, 150);
    };

    // The race's date, place and distance come with it
    $scope.pickRace = function (race) {
        var f = $scope.form;
        f.racename = race.racename;
        f.raceId = race._id;
        f.raceDate = race.racedate;
        f.racedate = pages.date(race.racedate);
        if (race.location && race.location.country) {
            f.country = race.location.country;
            f.state = race.location.country === 'USA' ? race.location.state || '' : '';
        }
        if (race.racetypeId && racetype(race.racetypeId)) {
            f.racetypeId = race.racetypeId;
        } else if (race.distance) {
            // A distance the list does not offer (multisport, an odd one)
            f.racetypeId = 'other';
            f.distanceText = race.distance;
        }
        $scope.raceUi.open = false;
        $scope.check();
    };

    // =====================================
    // DISTANCE: a list with a search box, the most raced first

    function racetype(id) {
        return ($scope.data && $scope.data.racetypes || []).find(function (rt) { return rt._id === id; });
    }

    $scope.distanceName = function (id) {
        if (id === 'other') return 'Other';
        var rt = racetype(id);
        return rt ? rt.name : '';
    };

    $scope.distanceSurface = function (id) {
        var rt = racetype(id);
        return rt ? rt.surface : '';
    };

    // 'open water' → 'open-water', for the tag's colour
    $scope.surfaceClass = function (surface) {
        return 'srf-surface-' + String(surface || '').replace(/\s+/g, '-');
    };

    // The list's rows: headings, and options numbered (n) in order for the
    // arrow keys. Not searching: the most raced, "Other", then every distance
    // by surface. Searching: the matches (spaces don't count: "50m" finds
    // 50 miles), then "Other". Kept between digests: ng-repeat wants the same
    // rows back while nothing changed.
    var itemsCache = { key: null, items: [] };
    $scope.distanceItems = function () {
        if (!$scope.data) return [];
        if (itemsCache.key === $scope.dist.search) return itemsCache.items;
        var items = [];
        var n = 0;
        function heading(label) { items.push({ key: 'h-' + label, header: true, label: label }); }
        function option(rt, group) {
            items.push({ key: group + '-' + rt._id, id: rt._id, label: rt.name, surface: rt.surface, n: n++ });
        }
        function other() {
            items.push({ key: 'other', id: 'other', label: 'Other', n: n++, other: true });
        }
        var types = $scope.data.racetypes;
        var popularIds = $scope.data.popularRacetypeIds;
        var words = $scope.dist.search.toLowerCase().split(/\s+/).filter(Boolean);
        var squashed = words.join('');
        if (words.length) {
            var whole = function (rt) {
                return (rt.name + rt.surface).toLowerCase().replace(/\s+/g, '').indexOf(squashed) !== -1;
            };
            var byWords = function (rt) {
                var text = (rt.name + ' ' + rt.surface).toLowerCase();
                return words.every(function (w) { return text.indexOf(w) !== -1; });
            };
            // Whole matches first, then the most raced, then by distance
            var rank = function (rt) {
                var i = popularIds.indexOf(rt._id);
                return (whole(rt) ? 0 : 1000) + (i === -1 ? popularIds.length : i);
            };
            types.filter(function (rt) { return whole(rt) || byWords(rt); })
                .map(function (rt, i) { return { rt: rt, i: i }; })
                .sort(function (a, b) { return rank(a.rt) - rank(b.rt) || a.i - b.i; })
                .forEach(function (x) { option(x.rt, 'match'); });
            other();
        } else {
            var popular = popularIds.map(racetype).filter(Boolean);
            if (popular.length) {
                heading('Most raced');
                popular.forEach(function (rt) { option(rt, 'popular'); });
            }
            other();
            var known = SURFACES.map(function (x) { return x.surface; });
            SURFACES.concat([{ surface: null, label: 'More' }]).forEach(function (group) {
                var inGroup = types.filter(function (rt) {
                    return group.surface ? rt.surface === group.surface : known.indexOf(rt.surface) === -1;
                });
                if (!inGroup.length) return;
                heading(group.label);
                inGroup.forEach(function (rt) { option(rt, group.label); });
            });
        }
        itemsCache = { key: $scope.dist.search, items: items };
        return items;
    };

    function focusLater(selector) {
        $timeout(function () {
            var el = document.querySelector(selector);
            if (el) el.focus();
        });
    }

    function scrollToHighlighted() {
        $timeout(function () {
            var row = document.querySelector('.srf-dist-list [data-n="' + $scope.dist.highlighted + '"]');
            if (row) row.scrollIntoView({ block: 'nearest' });
        });
    }

    $scope.toggleDistance = function () {
        if ($scope.dist.open) {
            $scope.dist.open = false;
            return;
        }
        $scope.dist.open = true;
        $scope.dist.search = '';
        var current = $scope.distanceItems().find(function (x) { return !x.header && x.id === $scope.form.racetypeId; });
        $scope.dist.highlighted = current ? current.n : 0;
        focusLater('.srf-dist-search');
        scrollToHighlighted();
    };

    $scope.distanceSearched = function () {
        $scope.dist.highlighted = 0;
    };

    $scope.distanceKeydown = function ($event) {
        var count = $scope.distanceItems().filter(function (x) { return !x.header; }).length;
        if ($event.keyCode === 40 || $event.keyCode === 38) {
            $event.preventDefault();
            $scope.dist.highlighted = ($scope.dist.highlighted + ($event.keyCode === 40 ? 1 : -1) + count) % count;
            scrollToHighlighted();
        } else if ($event.keyCode === 13) {
            $event.preventDefault();
            var item = $scope.distanceItems().find(function (x) { return x.n === $scope.dist.highlighted; });
            if (item) $scope.pickDistance(item.id);
        } else if ($event.keyCode === 27) {
            $scope.dist.open = false;
            focusLater('#distance');
        }
    };

    // Leaving the search box closes the list (picking a row lands first: the
    // rows take the mousedown, which keeps the focus in the box)
    $scope.distanceBlurred = function () {
        $timeout(function () { $scope.dist.open = false; }, 150);
    };

    $scope.pickDistance = function (id) {
        $scope.form.racetypeId = id;
        $scope.dist.open = false;
        focusLater(id === 'other' ? '#distance-text' : '#distance');
    };

    // =====================================
    // ALREADY ON THE SITE?

    $scope.runnerChanged = function () {
        $scope.check();
    };

    // Said before they send it again: a result that day, or one already sent
    // With a race picked from the list, their result in it, if it is in
    // already (inRace): no need to send it, a correction instead if it is wrong
    $scope.check = function () {
        $scope.existing = { results: [], inRace: [], pending: 0 };
        $scope.correction = null;
        var runner = $scope.runner;
        var day = pages.day($scope.form.racedate);
        if (!runner || runner.notListed || !runner.memberId || !day) return;
        var raceId = $scope.form.raceId;
        var asked = [runner.memberId, day, raceId].join('|');
        $http.get('/api/result-submissions/check', { params: { memberId: runner.memberId, racedate: day, raceId: raceId || undefined } }).then(function (res) {
            if (asked !== [runner.memberId, pages.day($scope.form.racedate), $scope.form.raceId].join('|')) return;
            $scope.existing = res.data;
            if (res.data.inRace && res.data.inRace.length) loadCorrection(res.data.inRace[0]._id);
        }, angular.noop);
    };

    // What the visitor may do about the result already in: suggest a
    // correction (a signed-in member), see one pending, or sign in first
    function loadCorrection(resultId) {
        if (!AuthService.isLoggedIn()) {
            $scope.correction = { role: 'signed-out', resultId: resultId };
            return;
        }
        CorrectionService.forResult(resultId).then(function (status) {
            status.resultId = resultId;
            $scope.correction = status;
        }, angular.noop);
    }

    $scope.suggestCorrection = function () {
        var resultId = $scope.correction && $scope.correction.resultId;
        if (!resultId) return;
        CorrectionService.forResult(resultId).then(function (status) {
            status.resultId = resultId;
            $scope.correction = status;
            if (status.role !== 'can-send' && status.role !== 'own-pending') return;
            Analytics.event('correction_form_open', { pending: status.role === 'own-pending', from: 'submit_result' });
            CorrectionService.openRequestModal(status).then(function () {
                loadCorrection(resultId);
            }, function () {
                loadCorrection(resultId);
            });
        }, angular.noop);
    };

    // =====================================
    // SENDING

    // One message per field, beside it; the server says the same things
    function validate() {
        var e = emptyErrors();
        var ok = true;
        var f = $scope.form;
        function bad(field, msg) { e[field] = msg; ok = false; }

        if (pages.error($scope.runner)) bad('runner', pages.error($scope.runner));
        if (!f.racename.trim()) bad('racename', 'Please enter the race name.');
        var day = pages.day(f.racedate);
        if (!day) bad('racedate', 'Please enter the race date.');
        else if (day > $scope.todayStr) bad('racedate', 'The race date can\'t be in the future.');
        else if (day < $scope.EARLIEST) bad('racedate', 'Results go back to 2013 on this site.');
        if (f.country === 'USA' && !f.state) bad('state', 'Please pick the state the race was in.');
        if (!f.racetypeId) bad('distance', 'Please pick the distance.');
        else if (f.racetypeId === 'other' && !f.distanceText.trim()) bad('distance', 'Please describe the distance.');
        if (!rules.parseTime(f.timeStr)) bad('time', 'Please enter your finish time, e.g. 35:54 or 1:25:00 (minutes and seconds under 60).');
        rules.PLACES.forEach(function (p) {
            var rank = f.ranking[p.rank];
            var total = f.ranking[p.total];
            var isBad = function (v) { return v !== undefined && v !== null && v !== '' && !(Number.isInteger(Number(v)) && Number(v) >= 1); };
            if (isBad(rank) || isBad(total)) bad(p.rank, 'Whole numbers only.');
            else if (rank && total && Number(rank) > Number(total)) bad(p.rank, 'Your place can\'t be more than the number of finishers.');
        });
        if (!f.noResultLink) {
            var link = rules.normalizeLink(f.resultlink);
            if (!link.ok) bad('resultlink', 'That doesn\'t look like a web address.');
            else if (!link.url) bad('resultlink', 'Please paste the link to the official results, or tick "No results online".');
        }
        if (!rules.normalizeLink(f.photoLink).ok) bad('photoLink', 'That doesn\'t look like a web address.');

        $scope.errors = e;
        return ok;
    }

    $scope.noResultLinkChanged = function () {
        if ($scope.form.noResultLink) {
            $scope.form.resultlink = '';
            $scope.errors.resultlink = '';
        }
    };

    $scope.submit = function () {
        $scope.error = '';
        if (!validate()) return pages.focusFirstError();

        var f = $scope.form;
        var other = f.racetypeId === 'other';
        var payload = angular.extend(pages.payload($scope.runner), {
            racename: f.racename.trim(),
            raceId: f.raceId,
            racedate: pages.day(f.racedate),
            country: f.country,
            state: f.country === 'USA' ? f.state : '',
            racetypeId: f.racetypeId,
            distanceText: other ? f.distanceText.trim() : '',
            splits: other ? f.splits.trim() : '',
            time: f.timeStr,
            resultlink: f.noResultLink ? '' : f.resultlink.trim(),
            noResultLink: f.noResultLink,
            photoLink: f.photoLink.trim(),
            comments: f.comments,
            highlight: f.highlight
        });
        rules.PLACES.forEach(function (p) {
            payload[p.rank] = f.ranking[p.rank];
            payload[p.total] = f.ranking[p.total];
        });

        $scope.submitting = true;
        $http.post('/api/result-submissions', payload).then(function () {
            pages.remember($scope.runner);
            $scope.firstName = pages.name($scope.runner, $scope.members.concat($scope.pastMembers)).split(' ')[0];
            $scope.submitted = true;
            Analytics.event('result_submit', { distance: other ? 'other' : 'listed', on_roster: !$scope.runner.notListed });
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, function (res) {
            var data = res.data || {};
            if (data.field && $scope.errors[data.field] !== undefined) {
                $scope.errors[data.field] = data.error;
                pages.focusFirstError();
            } else {
                $scope.error = data.error || 'Your result could not be sent. Please try again.';
            }
        }).finally(function () {
            $scope.submitting = false;
        });
    };

    // The same runner, a fresh form (the location stays: often the same area)
    $scope.another = function () {
        var keep = { country: $scope.form.country, state: $scope.form.state };
        $scope.form = angular.extend(emptyForm(), keep);
        $scope.errors = emptyErrors();
        $scope.existing = { results: [], inRace: [], pending: 0 };
        $scope.correction = null;
        $scope.submitted = false;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
}]);
