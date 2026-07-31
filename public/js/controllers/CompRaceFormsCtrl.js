// Comp race form deadlines are always Washington DC (Eastern) time, regardless of
// which timezone the captain's or member's browser happens to be in. Native
// <input type="datetime-local"> always parses/formats using the browser's own
// local timezone, so we can't bind it directly to a real UTC Date — instead we
// convert to/from a "fake local" Date whose getFullYear/getMonth/.../getMinutes
// hold the Eastern wall-clock digits, and let the input read/write those.
angular.module('mcrrcApp.results').factory('DcTime', [function () {
    var ZONE = 'America/New_York';

    function easternOffsetMillisForInstant(instantMillis) {
        var parts = new Intl.DateTimeFormat('en-US', {
            timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        }).formatToParts(new Date(instantMillis));
        var get = function (type) { return parseInt(parts.find(function (p) { return p.type === type; }).value, 10); };
        var asIfUtcMillis = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
        return asIfUtcMillis - instantMillis;
    }

    return {
        // Real UTC Date -> "fake local" Date holding Eastern wall-clock digits.
        // Use this to populate a datetime-local ng-model from a stored value.
        toWallClock: function (utcDate) {
            if (!utcDate) return null;
            var parts = new Intl.DateTimeFormat('en-US', {
                timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', hour12: false
            }).formatToParts(new Date(utcDate));
            var get = function (type) { return parseInt(parts.find(function (p) { return p.type === type; }).value, 10); };
            return new Date(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'));
        },
        // "Fake local" Date (as produced above, or as typed into the datetime-local
        // input) -> the real UTC Date it represents, accounting for EST/EDT.
        fromWallClock: function (wallClockDate) {
            if (!wallClockDate) return null;
            var naiveUtc = Date.UTC(
                wallClockDate.getFullYear(), wallClockDate.getMonth(), wallClockDate.getDate(),
                wallClockDate.getHours(), wallClockDate.getMinutes()
            );
            return new Date(naiveUtc - easternOffsetMillisForInstant(naiveUtc));
        }
    };
}]);

angular.module('mcrrcApp.results').controller('CompRaceFormsController', ['$scope', '$rootScope', '$http', '$uibModal', '$state', 'AuthService', function ($scope, $rootScope, $http, $uibModal, $state, AuthService) {

    $scope.authService = AuthService;
    $scope.$watch('authService.isLoggedIn()', function (user) {
        $scope.user = user;
    });

    $scope.forms = [];
    $scope.loading = true;
    $scope.error = null;
    $scope.copyFeedback = {};

    function loadForms() {
        $scope.loading = true;
        $scope.error = null;
        $http.get('/api/comprace-forms', { params: { _: Date.now() } }).then(function (res) {
            $scope.forms = res.data;
        }, function () {
            $scope.error = 'Failed to load forms.';
        }).finally(function () {
            $scope.loading = false;
        });
    }

    loadForms();

    // Refresh the list when returning from the detail view after a save.
    // We use $stateChangeSuccess but the real safety net is that the list
    // controller always calls loadForms() on init — goBack() forces reload:true.
    $rootScope.$on('$stateChangeSuccess', function (event, toState) {
        if (toState.name === '/comp-race-forms' && $rootScope.compRaceFormDirty) {
            $rootScope.compRaceFormDirty = false;
            loadForms();
        }
    });

    $scope.createForm = function () {
        var modalInstance = $uibModal.open({
            templateUrl: 'views/modals/compRaceFormCreateModal.html',
            controller: 'CompRaceFormCreateModalController',
            size: 'lg'
        });
        modalInstance.result.then(function (newForm) {
            $scope.forms.unshift(newForm);
        });
    };

    $scope.toggleOpen = function (form) {
        $http.put('/api/comprace-forms/' + form._id, { isOpen: !form.isOpen }).then(function (res) {
            form.isOpen = res.data.isOpen;
        });
    };

    $scope.deleteForm = function (form) {
        if (!confirm('Delete "' + form.title + '" and all its responses? This cannot be undone.')) return;
        $http.delete('/api/comprace-forms/' + form._id).then(function () {
            $scope.forms = $scope.forms.filter(function (f) { return f._id !== form._id; });
        }, function () {
            alert('Failed to delete form.');
        });
    };

    $scope.getFormUrl = function (form) {
        return window.location.origin + '/form/' + form.uniqueId;
    };

    $scope.copyLink = function (form) {
        var url = $scope.getFormUrl(form);
        navigator.clipboard.writeText(url).then(function () {
            $scope.copyFeedback[form._id] = true;
            setTimeout(function () {
                $scope.$apply(function () { $scope.copyFeedback[form._id] = false; });
            }, 2000);
        });
    };

    $scope.viewResponses = function (form) {
        $state.go('/comp-race-forms/detail', { formId: form._id });
    };

    $scope.editForm = function (form) {
        $state.go('/comp-race-forms/detail', { formId: form._id }, { custom: { edit: true } });
    };

    $scope.centisToString = function (cs, abs = false) {
        if (!cs) return '—';
        if (abs) cs = Math.abs(cs);
        var totalSec = Math.floor(cs / 100);
        var h = Math.floor(totalSec / 3600);
        var m = Math.floor((totalSec % 3600) / 60);
        var s = totalSec % 60;
        function pad(n) { return String(n).padStart(2, '0'); }
        if (h > 0) return h + ':' + pad(m) + ':' + pad(s);
        return m + ':' + pad(s);
    };

}]);

angular.module('mcrrcApp.results').controller('CompRaceFormCreateModalController', ['$scope', '$http', '$uibModalInstance', 'ResultsService', 'DcTime', function ($scope, $http, $uibModalInstance, ResultsService, DcTime) {

    $scope.form = {
        title: '', description: '', racename: '', racedate: null, racetype: '', uniqueId: '',
        numComps: 0, numDiscounts: 0,
        splitCompsByGender: false, splitDiscountsByGender: false,
        numCompsMale: 0, numCompsFemale: 0, numDiscountsMale: 0, numDiscountsFemale: 0,
        closesAt: null, isOpen: true, bannerImageUrl: ''
    };
    $scope.raceTypes = [];
    $scope.loadingRaceTypes = true;
    $scope.saving = false;
    $scope.error = null;
    $scope.uniqueIdManuallyEdited = false;

    $http.get('/api/racetypes?sort=name').then(function (res) {
        $scope.raceTypes = res.data;
    }).finally(function () {
        $scope.loadingRaceTypes = false;
    });

    function toSlug(str) {
        return (str || '').toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .substring(0, 60);
    }

    function toSlugLive(str) {
        return (str || '').toLowerCase()
            .replace(/[^a-z0-9-]+/g, '')
            .replace(/^-+/, '')
            .replace(/-{2,}/g, '-')
            .substring(0, 60);
    }

    $scope.allRaces = [];
    ResultsService.getRaceResultsWithCacheSupport().then(function (races) {
        // Sort newest-first once; filtering is done client-side
        $scope.allRaces = races.slice().sort(function (a, b) {
            return new Date(b.racedate) - new Date(a.racedate);
        });
    });

    // Client-side filter used by ui-select repeat expression.
    // Default (< 3 chars): show 20 newest. With 3+ chars: show all matches.
    $scope.filterRaces = function (search) {
        if (!search || search.length < 3) return $scope.allRaces.slice(0, 20);
        var q = search.toLowerCase();
        return $scope.allRaces.filter(function (r) {
            return r.racename && r.racename.toLowerCase().indexOf(q) !== -1;
        });
    };

    $scope.onRaceSelect = function ($item) {
        $scope.form.racename = $item.racename;
        if ($item.racedate) {
            $scope.form.racedate = new Date($item.racedate);
        }
        if ($item.racetype && $item.racetype._id) {
            var match = $scope.raceTypes.find(function (rt) { return String(rt._id) === String($item.racetype._id); });
            if (match) $scope.form.racetype = match;
        }
    };

    $scope.$watch('form.racename', function (val) {
        if (!$scope.uniqueIdManuallyEdited) {
            $scope.form.uniqueId = toSlug(val);
        }
    });

    $scope.onUniqueIdInput = function () {
        $scope.uniqueIdManuallyEdited = !!$scope.form.uniqueId;
        $scope.form.uniqueId = toSlugLive($scope.form.uniqueId);
    };

    $scope.submit = function () {
        if (!$scope.form.title) { $scope.error = 'Title is required.'; return; }
        if (!$scope.form.racename) { $scope.error = 'Race name is required.'; return; }
        $scope.error = null;
        $scope.saving = true;

        var payload = {
            title: $scope.form.title,
            description: $scope.form.description,
            race: {
                linkedRace: $scope.form.linkedRace ? $scope.form.linkedRace._id : null,
                racename: $scope.form.racename,
                racedate: $scope.form.racedate || null,
                racetype: $scope.form.racetype || null
            },
            uniqueId: $scope.form.uniqueId || undefined,
            numComps: $scope.form.numComps || 0,
            numDiscounts: $scope.form.numDiscounts || 0,
            splitCompsByGender: !!$scope.form.splitCompsByGender,
            splitDiscountsByGender: !!$scope.form.splitDiscountsByGender,
            numCompsMale: $scope.form.numCompsMale || 0,
            numCompsFemale: $scope.form.numCompsFemale || 0,
            numDiscountsMale: $scope.form.numDiscountsMale || 0,
            numDiscountsFemale: $scope.form.numDiscountsFemale || 0,
            closesAt: $scope.form.closesAt ? DcTime.fromWallClock($scope.form.closesAt) : null,
            isOpen: $scope.form.isOpen,
            bannerImageUrl: $scope.form.bannerImageUrl || null
        };

        $http.post('/api/comprace-forms', payload).then(function (res) {
            $uibModalInstance.close(res.data);
        }, function (res) {
            $scope.error = (res.data && res.data.error) || 'Failed to create form.';
        }).finally(function () {
            $scope.saving = false;
        });
    };

    $scope.cancel = function () {
        $uibModalInstance.dismiss('cancel');
    };

}]);

angular.module('mcrrcApp.results').controller('CompRaceFormDetailController', ['$scope', '$rootScope', '$http', '$stateParams', '$state', '$transition$', 'ResultsService', 'DcTime', function ($scope, $rootScope, $http, $stateParams, $state, $transition$, ResultsService, DcTime) {

    $scope.formData = null;
    $scope.responses = [];
    $scope.loading = true;
    $scope.error = null;

    $scope.showRaceModal = function (race) {
        if (race && race._id) {
            ResultsService.showRaceFromResultModal(race._id);
        }
    };
    $scope.filter = {
        searchQuery: '',
        sortMethod: 'recentAg'
    };


    // Column sort: when active, takes over as primary sort and sets dropdown to 'custom'
    $scope.colSort = { col: null, dir: 1 };

    $scope.setColSort = function (col) {
        if ($scope.colSort.col === col) {
            $scope.colSort.dir = -$scope.colSort.dir;
        } else {
            $scope.colSort.col = col;
            $scope.colSort.dir = 1;
        }
        $scope.filter.sortMethod = 'custom';
        rebuildDisplay();
    };

    $scope.colSortIcon = function (col) {
        if ($scope.colSort.col !== col) return 'fa-sort';
        return $scope.colSort.dir === 1 ? 'fa-sort-asc' : 'fa-sort-desc';
    };

    function getColValue(r, col) {
        switch (col) {
            case 'member': return $scope.getMemberName(r).toLowerCase();
            case 'race': return r.recentResult && r.recentResult.race ? r.recentResult.race.racename.toLowerCase() : '';
            case 'recentTime': return r.recentResult ? (r.recentResult.time || 0) : 0;
            case 'recentAg': return r.recentResult ? (r.recentResult.agegrade || 0) : 0;
            case 'projTime': return r.projectedTimeCentiseconds || 0;
            case 'projAg': return r.projectedAgeGrade || 0;
            case 'submitted': return r.submittedAt ? new Date(r.submittedAt).getTime() : 0;
            default: return '';
        }
    }

    $scope.sortMethods = [
        { id: 'recentAg', label: 'Recent race age grade' },
        { id: 'recentTime', label: 'Recent race time' },
        { id: 'projTime', label: 'Projected time' },
        { id: 'projAg', label: 'Projected age grade' },
        { id: 'blendEqual', label: 'Recent AG + Projected AG (equal)' },
        { id: 'blendWeighted', label: 'Recent AG (×2) + Projected AG (×1)' },
        { id: 'random', label: 'Random' },
        { id: 'seniority', label: 'Seniority on team' },
        { id: 'submitted', label: 'First come, first served' },
        { id: 'name', label: 'Name (alphabetical)' },
        { id: 'custom', label: 'Custom' }
    ];

    // Stable random seed per page load — re-roll with $scope.rerollRandom()
    var _randomSeed = Math.random();
    $scope.rerollRandom = function () {
        _randomSeed = Math.random();
        rebuildDisplay();
    };

    // Seeded pseudo-random so order stays stable through filter changes
    function seededRandom(str) {
        var h = _randomSeed;
        for (var i = 0; i < str.length; i++) {
            h = Math.sin(h * 9301 + str.charCodeAt(i) * 49297) * 233280;
        }
        return h - Math.floor(h);
    }

    // Earliest membership start date (epoch ms), or Infinity if unknown
    function memberSeniority(r) {
        var dates = r.member && r.member.membershipDates;
        if (!dates || !dates.length) return Infinity;
        var earliest = Infinity;
        for (var i = 0; i < dates.length; i++) {
            if (dates[i].start) {
                var t = new Date(dates[i].start).getTime();
                if (t < earliest) earliest = t;
            }
        }
        return earliest;
    }

    // Normalize an array of responses by field to [0,100]; missing = null
    function normalize(responses, getter) {
        var vals = responses.map(getter);
        var defined = vals.filter(function (v) { return v != null; });
        if (!defined.length) return responses.map(function () { return null; });
        var min = Math.min.apply(null, defined);
        var max = Math.max.apply(null, defined);
        var range = max - min || 1;
        return vals.map(function (v) { return v == null ? null : (v - min) / range * 100; });
    }

    function getSortScore(responses, method) {
        switch (method) {
            case 'recentAg':
                return responses.map(function (r) {
                    return { r: r, v: r.recentResult ? (r.recentResult.agegrade || 0) : 0 };
                });
            case 'recentTime':
                return responses.map(function (r) {
                    var t = r.recentResult ? r.recentResult.time : null;
                    return { r: r, v: t ? -t : -Infinity };
                });
            case 'projTime':
                return responses.map(function (r) {
                    return { r: r, v: r.projectedTimeCentiseconds ? -r.projectedTimeCentiseconds : -Infinity };
                });
            case 'projAg':
                return responses.map(function (r) {
                    return { r: r, v: r.projectedAgeGrade || 0 };
                });
            case 'blendEqual': {
                var normRecent = normalize(responses, function (r) { return r.recentResult ? r.recentResult.agegrade : null; });
                var normProj = normalize(responses, function (r) { return r.projectedAgeGrade != null ? r.projectedAgeGrade : null; });
                return responses.map(function (r, i) {
                    var a = normRecent[i], b = normProj[i];
                    var v = (a != null && b != null) ? (a + b) / 2
                        : (a != null) ? a
                            : (b != null) ? b : 0;
                    return { r: r, v: v };
                });
            }
            case 'blendWeighted': {
                var normRecent2 = normalize(responses, function (r) { return r.recentResult ? r.recentResult.agegrade : null; });
                var normProj2 = normalize(responses, function (r) { return r.projectedAgeGrade != null ? r.projectedAgeGrade : null; });
                return responses.map(function (r, i) {
                    var a = normRecent2[i], b = normProj2[i];
                    var v = (a != null && b != null) ? (2 * a + b) / 3
                        : (a != null) ? a
                            : (b != null) ? b : 0;
                    return { r: r, v: v };
                });
            }
            case 'random':
                return responses.map(function (r) {
                    var key = (r._id || '') + _randomSeed;
                    return { r: r, v: seededRandom(key) };
                });
            case 'seniority':
                return responses.map(function (r) {
                    return { r: r, v: -memberSeniority(r) };
                });
            case 'submitted':
                return responses.map(function (r) {
                    return { r: r, v: r.submittedAt ? -new Date(r.submittedAt).getTime() : 0 };
                });
            case 'name':
                return responses.map(function (r) {
                    return { r: r, v: $scope.getMemberName(r).toLowerCase() };
                });
            default:
                return responses.map(function (r, i) { return { r: r, v: i }; });
        }
    }

    $scope.displayedResponses = [];

    function rebuildDisplay() {
        var filtered = $scope.responses.filter($scope.responseFilter);
        var method = $scope.filter.sortMethod;

        if (method === 'custom' && $scope.colSort.col) {
            // Column sort is primary: clear method scores, sort purely by column value
            var col = $scope.colSort.col;
            var dir = $scope.colSort.dir;
            $scope.displayedResponses = filtered.slice().sort(function (a, b) {
                var av = getColValue(a, col);
                var bv = getColValue(b, col);
                if (av < bv) return -dir;
                if (av > bv) return dir;
                return 0;
            });
        } else {
            // Named method: clear column sort indicator and sort by method
            $scope.colSort.col = null;
            var scored = getSortScore(filtered, method);
            var nameSort = method === 'name';
            scored.sort(function (a, b) {
                if (a.v < b.v) return nameSort ? -1 : 1;
                if (a.v > b.v) return nameSort ? 1 : -1;
                return 0;
            });
            $scope.displayedResponses = scored.map(function (s) { return s.r; });
        }
    }

    // Called by the crfDraggableRow directive after a successful drop
    $scope.reorderRow = function (fromIdx, toIdx) {
        if (fromIdx === toIdx) return;
        var arr = $scope.displayedResponses;
        var row = arr.splice(fromIdx, 1)[0];
        arr.splice(toIdx, 0, row);
        // Stay in custom mode; displayedResponses is already mutated
        $scope.filter.sortMethod = 'custom';
    };

    $scope.$watch('responses', rebuildDisplay, true);
    $scope.$watch('filter', rebuildDisplay, true);

    // Navigate back to the list. If form was saved, force UI-Router to
    // re-create the list state so loadForms() runs fresh (reload:true).
    $scope.goBack = function () {
        var opts = $rootScope.compRaceFormDirty ? { reload: true } : {};
        $rootScope.compRaceFormDirty = false;
        $state.go('/comp-race-forms', {}, opts);
    };

    var formId = $stateParams.formId;

    if (!formId) {
        $scope.error = 'No form selected.';
        $scope.loading = false;
    } else {
        $http.get('/api/comprace-forms/' + formId + '/responses').then(function (res) {
            $scope.formData = res.data.form;
            $scope.responses = res.data.responses;
            if ($transition$.options().custom && $transition$.options().custom.edit) $scope.startEdit();
        }, function () {
            $scope.error = 'Failed to load responses.';
        }).finally(function () {
            $scope.loading = false;
        });
    }

    $scope.responseFilter = function (response) {
        if (!$scope.filter.searchQuery) return true;
        var q = $scope.filter.searchQuery.toLowerCase();
        var name = response.member
            ? ((response.member.firstname || '') + ' ' + (response.member.lastname || '')).toLowerCase()
            : (response.user ? (response.user.username || '').toLowerCase() : '');
        var race = (response.recentResult && response.recentResult.race)
            ? (response.recentResult.race.racename || '').toLowerCase()
            : '';
        return name.indexOf(q) !== -1 || race.indexOf(q) !== -1;
    };

    $scope.centisToString = function (cs, abs = false) {

        if (cs == null) return '—';
        if (abs) cs = Math.abs(cs);
        var totalSec = Math.floor(cs / 100);
        var h = Math.floor(totalSec / 3600);
        var m = Math.floor((totalSec % 3600) / 60);
        var s = totalSec % 60;
        function pad(n) { return String(n).padStart(2, '0'); }
        if (h > 0) return h + ':' + pad(m) + ':' + pad(s);
        return m + ':' + pad(s);
    };

    $scope.formatAg = function (val) {
        if (val == null) return '—';
        return parseFloat(val).toFixed(1) + '%';
    };

    $scope.agDiff = function (r) {
        if (r.recentResult == null || r.recentResult.agegrade == null || r.projectedAgeGrade == null) return null;
        return parseFloat((r.projectedAgeGrade - r.recentResult.agegrade).toFixed(1));
    };

    $scope.getMemberName = function (response) {
        if (response.member) {
            return response.member.firstname + ' ' + response.member.lastname;
        }
        return response.user ? response.user.username : '—';
    };

    $scope.deleteResponse = function (response) {
        const name = $scope.getMemberName(response);
        if (!confirm('Delete response from ' + name + '? This cannot be undone.')) return;
        $http.delete('/api/comprace-forms/' + formId + '/responses/' + response._id).then(function () {
            $scope.responses = $scope.responses.filter(function (r) { return r._id !== response._id; });
        }, function () {
            alert('Failed to delete response.');
        });
    };

    // Normalized 'male' / 'female' / null (unknown) from the linked member's sex.
    function memberGender(response) {
        var sex = response.member && response.member.sex;
        if (!sex) return null;
        sex = sex.toLowerCase();
        if (sex === 'male' || sex === 'm') return 'male';
        if (sex === 'female' || sex === 'f') return 'female';
        return null;
    }
    $scope.memberGender = memberGender;

    function hasCompsConfigured() {
        if (!$scope.formData) return false;
        return $scope.formData.splitCompsByGender
            ? !!(($scope.formData.numCompsMale || 0) + ($scope.formData.numCompsFemale || 0))
            : !!($scope.formData.numComps || 0);
    }

    function hasDiscountsConfigured() {
        if (!$scope.formData) return false;
        return $scope.formData.splitDiscountsByGender
            ? !!(($scope.formData.numDiscountsMale || 0) + ($scope.formData.numDiscountsFemale || 0))
            : !!($scope.formData.numDiscounts || 0);
    }

    // Picks the top `n` responses (in displayedResponses order) from a candidate
    // list, either as one combined pool or as separate per-gender pools — used
    // identically for comp and discount allocation so each can be split
    // independently.
    function pickTopN(candidates, byGender, nMale, nFemale, nCombined) {
        var winners = new Set();
        if (byGender) {
            ['male', 'female'].forEach(function (gender) {
                var n = gender === 'male' ? (nMale || 0) : (nFemale || 0);
                if (!n) return;
                candidates
                    .filter(function (r) { return memberGender(r) === gender; })
                    .slice(0, n)
                    .forEach(function (r) { winners.add(r); });
            });
        } else {
            candidates.slice(0, nCombined || 0).forEach(function (r) { winners.add(r); });
        }
        return winners;
    }

    // Comp winners are picked first (from the full displayed list), then discount
    // winners are picked from whoever is left — so a form can independently split
    // comps by gender while pooling discounts (or vice versa) and still never
    // double-allocate a response.
    function compWinners() {
        return pickTopN(
            $scope.displayedResponses, $scope.formData.splitCompsByGender,
            $scope.formData.numCompsMale, $scope.formData.numCompsFemale, $scope.formData.numComps
        );
    }

    function discountWinners(comps) {
        var remaining = $scope.displayedResponses.filter(function (r) { return !comps.has(r); });
        return pickTopN(
            remaining, $scope.formData.splitDiscountsByGender,
            $scope.formData.numDiscountsMale, $scope.formData.numDiscountsFemale, $scope.formData.numDiscounts
        );
    }

    // Returns 'comp', 'discount', or 'cut' for a response, or null if neither
    // comps nor discounts are configured on this form at all.
    $scope.rowSlot = function (response) {
        if (!$scope.formData) return 'cut';
        if (!hasCompsConfigured() && !hasDiscountsConfigured()) return null;

        var comps = compWinners();
        if (comps.has(response)) return 'comp';
        if (discountWinners(comps).has(response)) return 'discount';
        return 'cut';
    };

    // True if this row is the first row of a "cut"/"discount" block (i.e. the
    // row above it, if any, belongs to a different slot) — used to draw a
    // section-boundary line. Works uniformly whether comps/discounts are split
    // by gender or pooled, since it just looks at rowSlot() transitions.
    function isSlotLine(response, slot) {
        if (!$scope.formData) return false;
        var idx = $scope.displayedResponses.indexOf(response);
        if (idx <= 0 || $scope.rowSlot(response) !== slot) return false;
        return $scope.rowSlot($scope.displayedResponses[idx - 1]) !== slot;
    }

    $scope.isCutLine = function (response) {
        return isSlotLine(response, 'cut');
    };

    $scope.isDiscountLine = function (response) {
        return isSlotLine(response, 'discount');
    };

    // Inline form editing
    $scope.editing = false;
    $scope.editFields = {};
    $scope.savingForm = false;
    $scope.editError = null;

    $scope.raceTypes = [];
    $scope.loadingRaceTypes = false;

    function toSlugDetailLive(str) {
        return (str || '').toLowerCase()
            .replace(/[^a-z0-9-]+/g, '')
            .replace(/^-+/, '')
            .replace(/-{2,}/g, '-')
            .substring(0, 60);
    }

    $scope.allRacesDetail = [];
    ResultsService.getRaceResultsWithCacheSupport().then(function (races) {
        // Sort newest-first once; filtering is done client-side
        $scope.allRacesDetail = races.slice().sort(function (a, b) {
            return new Date(b.racedate) - new Date(a.racedate);
        });
        // If editing is already open, try to resolve the linkedRace object
        _resolveLinkedRace();
    });

    // Client-side filter used by ui-select repeat expression.
    // Default (< 3 chars): show 20 newest. With 3+ chars: show all matches.
    $scope.filterRacesDetail = function (search) {
        if (!search || search.length < 3) return $scope.allRacesDetail.slice(0, 20);
        var q = search.toLowerCase();
        return $scope.allRacesDetail.filter(function (r) {
            return r.racename && r.racename.toLowerCase().indexOf(q) !== -1;
        });
    };

    // Resolve editFields.linkedRace from cache by _id so ui-select shows the name+date
    function _resolveLinkedRace() {
        if (!$scope.editing || !$scope.editFields.linkedRace || !$scope.allRacesDetail.length) return;
        var linkedId = $scope.editFields.linkedRace && ($scope.editFields.linkedRace._id || $scope.editFields.linkedRace);
        if (!linkedId) return;
        // Already a full object with racename — no need to resolve
        if ($scope.editFields.linkedRace.racename) return;
        var match = $scope.allRacesDetail.find(function (r) { return String(r._id) === String(linkedId); });
        if (match) $scope.editFields.linkedRace = match;
    }

    $scope.onRaceSelect = function ($item) {
        $scope.editFields.racename = $item.racename;
        if ($item.racedate) {
            $scope.editFields.racedate = new Date($item.racedate);
        }
        if ($item.racetype && $item.racetype._id) {
            var match = $scope.raceTypes.find(function (rt) { return String(rt._id) === String($item.racetype._id); });
            if (match) $scope.editFields.racetype = match;
        }
    };

    $scope.startEdit = function () {
        var r = $scope.formData;
        $scope.editFields = {
            title: r.title || '',
            description: r.description || '',
            linkedRace: r.race && r.race.linkedRace ? r.race.linkedRace : null,
            racename: r.race ? r.race.racename : '',
            racedate: r.race && r.race.racedate ? new Date(r.race.racedate) : null,
            racetype: r.race ? (r.race.racetype || null) : null,
            uniqueId: r.uniqueId || '',
            isOpen: r.isOpen,
            closesAt: r.closesAt ? DcTime.toWallClock(r.closesAt) : null,
            numComps: r.numComps || 0,
            numDiscounts: r.numDiscounts || 0,
            splitCompsByGender: !!r.splitCompsByGender,
            splitDiscountsByGender: !!r.splitDiscountsByGender,
            numCompsMale: r.numCompsMale || 0,
            numCompsFemale: r.numCompsFemale || 0,
            numDiscountsMale: r.numDiscountsMale || 0,
            numDiscountsFemale: r.numDiscountsFemale || 0,
            bannerImageUrl: r.bannerImageUrl || ''
        };
        if (!$scope.raceTypes.length) {
            $scope.loadingRaceTypes = true;
            $http.get('/api/racetypes?sort=name').then(function (res) {
                $scope.raceTypes = res.data;
                // Re-select the matching racetype object by _id so ng-options binding works
                if ($scope.editFields.racetype && $scope.editFields.racetype._id) {
                    var match = $scope.raceTypes.find(function (rt) { return String(rt._id) === String($scope.editFields.racetype._id); });
                    if (match) $scope.editFields.racetype = match;
                }
            }).finally(function () {
                $scope.loadingRaceTypes = false;
            });
        }
        $scope.editing = true;
        // Try to resolve the linked race immediately if cache already loaded
        _resolveLinkedRace();
    };

    $scope.onEditUniqueIdInput = function () {
        $scope.editFields.uniqueId = toSlugDetailLive($scope.editFields.uniqueId);
    };

    $scope.cancelEdit = function () {
        $scope.editing = false;
        $scope.editError = null;
    };


    $scope.saveForm = function () {
        if (!$scope.editFields.title) return;
        $scope.savingForm = true;
        $scope.editError = null;
        var payload = {
            title: $scope.editFields.title,
            description: $scope.editFields.description,
            isOpen: $scope.editFields.isOpen,
            closesAt: $scope.editFields.closesAt ? DcTime.fromWallClock($scope.editFields.closesAt) : null,
            numComps: $scope.editFields.numComps || 0,
            numDiscounts: $scope.editFields.numDiscounts || 0,
            splitCompsByGender: !!$scope.editFields.splitCompsByGender,
            splitDiscountsByGender: !!$scope.editFields.splitDiscountsByGender,
            numCompsMale: $scope.editFields.numCompsMale || 0,
            numCompsFemale: $scope.editFields.numCompsFemale || 0,
            numDiscountsMale: $scope.editFields.numDiscountsMale || 0,
            numDiscountsFemale: $scope.editFields.numDiscountsFemale || 0,
            uniqueId: $scope.editFields.uniqueId || undefined,
            bannerImageUrl: $scope.editFields.bannerImageUrl || null,
            race: {
                linkedRace: $scope.editFields.linkedRace ? ($scope.editFields.linkedRace._id || $scope.editFields.linkedRace) : null,
                racename: $scope.editFields.racename,
                racedate: $scope.editFields.racedate || null,
                racetype: $scope.editFields.racetype || null
            }
        };
        var oldRaceTypeId = $scope.formData.race && $scope.formData.race.racetype && $scope.formData.race.racetype._id;
        var newRaceTypeId = payload.race && payload.race.racetype && payload.race.racetype._id;
        var raceTypeChanged = String(oldRaceTypeId || '') !== String(newRaceTypeId || '');

        var oldLinkedRace = String($scope.formData.race && $scope.formData.race.linkedRace || '');
        var newLinkedRace = String(payload.race.linkedRace || '');
        var linkedRaceChanged = oldLinkedRace !== newLinkedRace;

        $http.put('/api/comprace-forms/' + formId, payload).then(function (res) {
            $scope.formData.title = res.data.title;
            $scope.formData.description = res.data.description;
            $scope.formData.isOpen = res.data.isOpen;
            $scope.formData.closesAt = res.data.closesAt;
            $scope.formData.numComps = res.data.numComps;
            $scope.formData.numDiscounts = res.data.numDiscounts;
            $scope.formData.splitCompsByGender = res.data.splitCompsByGender;
            $scope.formData.splitDiscountsByGender = res.data.splitDiscountsByGender;
            $scope.formData.numCompsMale = res.data.numCompsMale;
            $scope.formData.numCompsFemale = res.data.numCompsFemale;
            $scope.formData.numDiscountsMale = res.data.numDiscountsMale;
            $scope.formData.numDiscountsFemale = res.data.numDiscountsFemale;
            $scope.formData.race = res.data.race;
            $scope.formData.uniqueId = res.data.uniqueId;
            $scope.formData.bannerImageUrl = res.data.bannerImageUrl;
            $scope.editing = false;
            // Signal the list controller to reload when the user navigates back
            $rootScope.compRaceFormDirty = true;
            if (raceTypeChanged || linkedRaceChanged) {
                $http.get('/api/comprace-forms/' + formId + '/responses').then(function (r) {
                    $scope.responses = r.data.responses;
                });
            }
        }, function (res) {
            $scope.editError = (res.data && res.data.error) || 'Failed to save form.';
        }).finally(function () {
            $scope.savingForm = false;
        });
    };

    $scope.emailCopyFeedback = {};

    $scope.copyEmails = function (slot) {
        var numComps = $scope.formData.numComps || 0;
        var half = Math.ceil(numComps / 2);
        var t1 = Math.ceil(numComps / 3);
        var t2 = Math.ceil(numComps * 2 / 3);
        var emails = $scope.displayedResponses
            .filter(function (r, idx) {
                var pos = idx + 1;
                if (slot === 'comp') return $scope.rowSlot(r) === 'comp';
                if (slot === 'discount') return $scope.rowSlot(r) === 'discount';
                if (slot === 'cut') return $scope.rowSlot(r) === 'cut';
                if (slot === 'comp-male') return $scope.rowSlot(r) === 'comp' && $scope.memberGender(r) === 'male';
                if (slot === 'comp-female') return $scope.rowSlot(r) === 'comp' && $scope.memberGender(r) === 'female';
                if (slot === 'discount-male') return $scope.rowSlot(r) === 'discount' && $scope.memberGender(r) === 'male';
                if (slot === 'discount-female') return $scope.rowSlot(r) === 'discount' && $scope.memberGender(r) === 'female';
                if (slot === 'comp-first') return pos <= half;
                if (slot === 'comp-second') return pos > half && pos <= numComps;
                if (slot === 'comp-third1') return pos <= t1;
                if (slot === 'comp-third2') return pos > t1 && pos <= t2;
                if (slot === 'comp-third3') return pos > t2 && pos <= numComps;
                return false;
            })
            .map(function (r) { return r.user && r.user.email ? r.user.email : null; })
            .filter(Boolean);

        if (!emails.length) { alert('No email addresses found for this group.'); return; }

        navigator.clipboard.writeText(emails.join(', ')).then(function () {
            $scope.$apply(function () { $scope.emailCopyFeedback[slot] = true; });
            setTimeout(function () {
                $scope.$apply(function () { $scope.emailCopyFeedback[slot] = false; });
            }, 2500);
        });
    };

    $scope.calculateTimeDiff = function (r) {
        if (r.actualResult && r.actualResult.time != null && r.projectedTimeCentiseconds != null) {
            var diff = (r.actualResult.time - r.projectedTimeCentiseconds);
            return diff;
        }
        return null;
    };

    $scope.calculateAGDiff = function (r) {
        if (r.actualResult && r.actualResult.agegrade != null && r.projectedAgeGrade != null) {
            var diff = r.actualResult.agegrade - r.projectedAgeGrade;
            return parseFloat(diff.toFixed(1));
        }
        return null;
    };


}]);

// Drag-and-drop reordering for the responses table.
// Usage: add crf-draggable-row to each <tr ng-repeat>, and crf-drag-handle to the handle element.
// Only active when the controller's filter.sortMethod === 'custom'.
angular.module('mcrrcApp.results').directive('crfDraggableRow', [function () {
    var dragSrcIdx = null;

    return {
        restrict: 'A',
        link: function (scope, el) {
            var tr = el[0];

            function isCustom() {
                return scope.filter && scope.filter.sortMethod === 'custom';
            }

            // Update draggable attr reactively
            scope.$watch('filter.sortMethod', function (method) {
                tr.draggable = method === 'custom';
            });

            tr.addEventListener('dragstart', function (e) {
                if (!isCustom()) return;
                dragSrcIdx = scope.$index;
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', dragSrcIdx);
                tr.classList.add('crf-row-dragging');
            });

            tr.addEventListener('dragend', function () {
                tr.classList.remove('crf-row-dragging');
                document.querySelectorAll('.crf-row-drag-over').forEach(function (el) {
                    el.classList.remove('crf-row-drag-over');
                });
            });

            tr.addEventListener('dragover', function (e) {
                if (!isCustom() || dragSrcIdx === null) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                document.querySelectorAll('.crf-row-drag-over').forEach(function (el) {
                    el.classList.remove('crf-row-drag-over');
                });
                tr.classList.add('crf-row-drag-over');
            });

            tr.addEventListener('dragleave', function () {
                tr.classList.remove('crf-row-drag-over');
            });

            tr.addEventListener('drop', function (e) {
                e.preventDefault();
                tr.classList.remove('crf-row-drag-over');
                var toIdx = scope.$index;
                if (dragSrcIdx === null || dragSrcIdx === toIdx) return;
                var from = dragSrcIdx;
                dragSrcIdx = null;
                scope.$apply(function () {
                    scope.reorderRow(from, toIdx);
                });
            });
        }
    };
}]);
