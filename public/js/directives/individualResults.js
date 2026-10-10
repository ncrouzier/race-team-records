// Team Results "By result" view: one compact row per result, for everyone.
//
// Reads the same cached race list as "By race" (ResultsService
// .getRaceResultsWithCacheSupport: memory, then IndexedDB, then the API), so
// it usually costs no download at all. That list is flattened once into one
// row per result, then filtered, searched and sorted here in plain JS — a few
// milliseconds for ~8.5k rows. Angular only ever renders the current page of
// 100, with one-time bindings, so drawing does not grow with the data.
//
// Filtering uses the same Advanced Filters panel as "By race"
// (<advanced-filter-panel>, AdvancedFiltersService), plus filters that only
// arrive by link (race, age, cutoffs, highlight...), shown as chips.
angular.module('mcrrcApp').directive('individualResults', ['ResultsService', 'MembersService', 'AuthService', 'AdvancedFiltersService', 'UtilsService', '$filter', '$state', '$q', '$transitions', '$timeout', 'dialogs', '$rootScope', '$document', 'Analytics', function (ResultsService, MembersService, AuthService, AdvancedFiltersService, UtilsService, $filter, $state, $q, $transitions, $timeout, dialogs, $rootScope, $document, Analytics) {

    var PAGE_SIZE = 100;
    var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
        'September', 'October', 'November', 'December'];
    // Exactly the params "By race" uses for the full list: the cache is keyed
    // on them, so anything else would be a second copy
    var RACE_LIST_PARAMS = { "sort": '-racedate -order racename', "preload": false };

    // Kept between visits in the same session: the rows built from the race
    // list, rebuilt only when the cache hands back a different list. Filters
    // are not kept: coming back to /individualresults starts clean, and only
    // a link (or Back) brings filters with it, in its URL.
    var decoded = null;

    var formatTime = $filter('secondsToTimeString');

    // Same arithmetic as the resultToPace filter
    function paceOf(time, miles) {
        if (!time || !miles) return null;
        var perMile = Math.ceil(time / 100) / 60 / miles;
        var m = Math.floor(perMile);
        var s = Math.round((perMile % 1) * 60);
        if (s === 60) { m += 1; s = 0; }
        return { value: perMile, text: m + ':' + (s < 10 ? '0' + s : s) };
    }

    function ageAt(dob, date) {
        var b = new Date(dob), d = new Date(date);
        var age = d.getUTCFullYear() - b.getUTCFullYear();
        if (d.getUTCMonth() < b.getUTCMonth() || (d.getUTCMonth() === b.getUTCMonth() && d.getUTCDate() < b.getUTCDate())) age--;
        return age;
    }

    function hasAchievement(result, name) {
        return (result.achievements || []).some(function (a) { return (a.name || '').toLowerCase() === name; });
    }

    // Races with their results -> one row per result
    function decode(raceList) {
        var rows = [];
        var rowById = {};
        var raceById = {};
        var runnerByUsername = {};
        var typeSeen = {};
        var typeOptions = [];
        var yearSeen = {};

        raceList.forEach(function (r) {
            var type = r.racetype || {};
            var location = r.location || {};
            var date = r.racedate ? new Date(r.racedate).toISOString().slice(0, 10) : '';
            var race = {
                _id: r._id, name: r.racename || '', date: date, year: date.slice(0, 4),
                month: date ? String(parseInt(date.slice(5, 7), 10)) : '', day: date ? String(parseInt(date.slice(8, 10), 10)) : '',
                typeKey: (type.name || '') + '|' + (type.surface || ''), typeName: type.name || '', surface: type.surface || '',
                distance: r.isMultisport ? 'Multisport' : (r.distanceName || type.name || ''),
                location: location.state || location.country || '', multisport: !!r.isMultisport,
                variable: !!type.isVariable, miles: type.miles,
                typeId: (type.name || '').toLowerCase() + '|' + (type.surface || '').toLowerCase(),
                state: (location.state || '').toUpperCase(), country: (location.country || '').toUpperCase()
            };
            if (!typeSeen[race.typeKey]) {
                typeSeen[race.typeKey] = true;
                typeOptions.push({ key: race.typeKey.toLowerCase(), label: race.typeName + (race.surface ? ' (' + race.surface + ')' : ''), miles: type.miles });
            }
            if (race.year) yearSeen[race.year] = true;
            raceById[race._id] = race;

            (r.results || []).forEach(function (res) {
                var runners = res.members || [];
                if (!runners.length) return;
                var names = runners.map(function (m) { return m.firstname + ' ' + m.lastname; }).join(', ');
                runners.forEach(function (m) {
                    if (m.username) runnerByUsername[m.username.toLowerCase()] = m;
                });
                // Age on race day; relay entries have no single age
                var age = runners.length === 1 && runners[0].dateofbirth && r.racedate ?
                    ageAt(runners[0].dateofbirth, r.racedate) : null;
                var pace = race.multisport ? null : paceOf(res.time, res.miles || type.miles);
                var ranking = res.ranking || {};
                // Lists cached before the API sent category: Master is 40+ on race day
                var category = res.category ||
                    (runners[0].dateofbirth && r.racedate ? (ageAt(runners[0].dateofbirth, r.racedate) >= 40 ? 'Master' : 'Open') : '');
                rows.push({
                    _id: res._id, race: race, runners: runners, names: names, age: age,
                    runnerIds: runners.map(function (m) { return String(m._id); }),
                    ranking: ranking,
                    usernames: runners.map(function (m) { return (m.username || '').toLowerCase(); }),
                    time: res.time, timeText: res.time ? formatTime(res.time) : '',
                    pace: pace ? pace.value : null, paceText: pace ? pace.text : '',
                    agegrade: res.agegrade || null, category: category,
                    // What the result page's "How this time stands" ranks
                    // against: record eligible, one runner, a recorded time
                    eligible: res.isRecordEligible === true && runners.length === 1 && res.time > 0,
                    overallrank: ranking.overallrank || null, overalltotal: ranking.overalltotal || null,
                    genderrank: ranking.genderrank || null, agerank: ranking.agerank || null,
                    pb: hasAchievement(res, 'pb'), record: hasAchievement(res, 'teamrecord'), agBest: hasAchievement(res, 'agegrade'),
                    sexes: runners.map(function (m) { return m.sex; }),
                    // Lower-cased once, so search is a plain indexOf per word
                    haystack: (names + ' ' + race.name + ' ' + race.location + ' ' + race.distance + ' ' + race.date).toLowerCase()
                });
            });
        });

        typeOptions.sort(function (a, b) { return (a.miles || 9999) - (b.miles || 9999) || a.label.localeCompare(b.label); });
        return {
            source: raceList, rows: rows, rowById: rows.reduce(function (acc, row) { acc[row._id] = row; return acc; }, rowById),
            typeOptions: typeOptions, years: Object.keys(yearSeen).sort().reverse(),
            raceById: raceById, runnerByUsername: runnerByUsername
        };
    }

    // Each column sorts in its natural direction first: newest, fastest,
    // highest age grade, best place, youngest. Missing values always go last.
    var SORTS = {
        date: { field: function (r) { return r.race.date; }, desc: true },
        time: { field: function (r) { return r.time || null; }, desc: false },
        pace: { field: function (r) { return r.pace; }, desc: false },
        agegrade: { field: function (r) { return r.agegrade; }, desc: true },
        place: { field: function (r) { return r.overallrank; }, desc: false },
        age: { field: function (r) { return r.age; }, desc: false },
        name: { field: function (r) { return r.names.toLowerCase(); }, desc: false },
        race: { field: function (r) { return r.race.name.toLowerCase(); }, desc: false }
    };
    var DEFAULT_SORT = 'date';

    // One filters object for everything. The first group is the shared
    // Advanced Filters panel's model, the rest only arrives by link.
    function emptyFilters() {
        return {
            // Advanced Filters panel
            dateFrom: '', dateTo: '', distanceMin: 0, distanceMax: null, agMin: 0, agMax: null,
            raceTypes: [], countries: [], states: [], selectedMembers: [], missingRanking: null,
            // search box and links
            search: '', year: '', month: '', day: '', sex: '', division: '',
            race: '', age: null, agemin: null, agemax: null, eligible: false, win: false,
            under: null, variable: false,
            highlight: '',
            sort: DEFAULT_SORT, desc: SORTS[DEFAULT_SORT].desc
        };
    }

    // ---- URL <-> filters --------------------------------------------------
    // The URL is the source of truth: everything that shapes the list is a
    // query param, so any view can be linked to and lands exactly as shared.

    // "16:00" / "1:30:00" <-> hundredths of a second, as times are stored
    function parseTime(text) {
        if (!text || !/^\d+(:\d{1,2}){1,2}$/.test(text)) return null;
        var parts = text.split(':').map(Number);
        var seconds = parts.reduce(function (acc, n) { return acc * 60 + n; }, 0);
        return seconds * 100;
    }

    function formatTime(hundredths) {
        var seconds = Math.round(hundredths / 100);
        var h = Math.floor(seconds / 3600), m = Math.floor(seconds % 3600 / 60), s = seconds % 60;
        var pad = function (n) { return (n < 10 ? '0' : '') + n; };
        return h ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s);
    }

    function toInt(value) {
        var n = parseInt(value, 10);
        return isNaN(n) ? null : n;
    }

    function list(text, upper) {
        return (text || '').split(',').map(function (x) {
            x = x.trim();
            return upper ? x.toUpperCase() : x.toLowerCase();
        }).filter(Boolean);
    }

    // The date inputs work in Date objects; the URL in YYYY-MM-DD
    function toDay(date) {
        if (!date) return '';
        var d = new Date(date);
        if (isNaN(d.getTime())) return '';
        var pad = function (n) { return (n < 10 ? '0' : '') + n; };
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }

    function fromDay(text) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(text || '')) return '';
        var parts = text.split('-').map(Number);
        return new Date(parts[0], parts[1] - 1, parts[2]);
    }

    // Read the URL. The panel's list filters (race types, runners, states,
    // countries) need the options to turn codes into entries, so they come
    // back separately as "pending" and are resolved once the data is in.
    function fromParams(p) {
        var f = emptyFilters();
        f.search = p.q || '';
        f.year = p.year ? String(p.year) : '';
        // Month and day are separate from the year and from each other, so
        // month=1&day=1 is every January 1 and year=2024&month=3 is March 2024
        var month = toInt(p.month), day = toInt(p.day);
        f.month = month >= 1 && month <= 12 ? String(month) : '';
        f.day = day >= 1 && day <= 31 ? String(day) : '';
        var sex = (p.sex || '').toLowerCase();
        f.sex = /^(m|male|men|man)$/.test(sex) ? 'Male' : (/^(f|female|women|woman|w)$/.test(sex) ? 'Female' : '');
        var division = (p.division || '').toLowerCase();
        f.division = /^masters?$/.test(division) ? 'Master' : (division === 'open' ? 'Open' : '');
        f.race = p.race || '';
        f.age = toInt(p.age);
        f.agemin = toInt(p.agemin);
        f.agemax = toInt(p.agemax);
        f.eligible = p.eligible === '1' || p.eligible === 'true';
        f.win = p.win === '1' || p.win === 'true';
        f.under = parseTime(p.under);
        f.variable = p.variable === '1' || p.variable === 'true';
        f.highlight = p.highlight || '';
        if (p.sort && SORTS[p.sort]) f.sort = p.sort;
        f.desc = p.dir ? p.dir === 'desc' : SORTS[f.sort].desc;

        // Advanced Filters panel
        f.dateFrom = fromDay(p.from);
        f.dateTo = fromDay(p.to);
        var minmi = parseFloat(p.minmi), maxmi = parseFloat(p.maxmi);
        f.distanceMin = isNaN(minmi) ? 0 : minmi;
        f.distanceMax = isNaN(maxmi) ? null : maxmi;
        // Age grade range (agmin alone is also what milestone links send)
        var agmin = parseFloat(p.agmin), agmax = parseFloat(p.agmax);
        f.agMin = isNaN(agmin) ? 0 : agmin;
        f.agMax = isNaN(agmax) ? null : agmax;
        f.missingRanking = AdvancedFiltersService.MISSING_RANKING_OPTIONS.filter(function (o) {
            return o.key === p.missing;
        })[0] || null;

        return {
            filters: f,
            pending: {
                // types=5k|road,1 mile|track, or the older distance=5k,5000m
                // with an optional surface=road,track
                types: list(p.types),
                distances: list(p.distance),
                surfaces: list(p.surface),
                runners: list(p.runner),
                states: list(p.state, true),
                countries: list(p.country, true)
            }
        };
    }

    // Defaults are left out, so a plain visit stays /individualresults
    function toParams(f, page, maxDistance, maxAgeGrade) {
        return {
            q: f.search || null,
            types: f.raceTypes.length ? f.raceTypes.map(function (t) {
                return (t.name + '|' + t.surface).toLowerCase();
            }).join(',') : null,
            from: toDay(f.dateFrom) || null,
            to: toDay(f.dateTo) || null,
            minmi: f.distanceMin > 0 ? String(f.distanceMin) : null,
            maxmi: f.distanceMax !== null && maxDistance && f.distanceMax < maxDistance ? String(f.distanceMax) : null,
            year: f.year || null,
            month: f.month || null,
            day: f.day || null,
            state: f.states.length ? f.states.map(function (x) { return x.code; }).join(',') : null,
            country: f.countries.length ? f.countries.map(function (x) { return x.code; }).join(',') : null,
            runner: f.selectedMembers.length ? f.selectedMembers.map(function (m) { return m.username; }).join(',') : null,
            missing: f.missingRanking ? f.missingRanking.key : null,
            sex: f.sex === 'Male' ? 'm' : (f.sex === 'Female' ? 'f' : null),
            division: f.division ? f.division.toLowerCase() : null,
            race: f.race || null,
            age: f.age !== null && f.age !== undefined ? String(f.age) : null,
            agemin: f.agemin !== null && f.agemin !== undefined ? String(f.agemin) : null,
            agemax: f.agemax !== null && f.agemax !== undefined ? String(f.agemax) : null,
            eligible: f.eligible ? '1' : null,
            win: f.win ? '1' : null,
            under: f.under ? formatTime(f.under) : null,
            variable: f.variable ? '1' : null,
            agmin: f.agMin > 0 ? String(f.agMin) : null,
            agmax: f.agMax !== null && maxAgeGrade && f.agMax < maxAgeGrade ? String(f.agMax) : null,
            highlight: f.highlight || null,
            sort: f.sort !== DEFAULT_SORT ? f.sort : null,
            dir: f.desc !== SORTS[f.sort].desc ? (f.desc ? 'desc' : 'asc') : null,
            page: page > 1 ? String(page) : null,
            // Only ever read: these become "types"
            distance: null,
            surface: null
        };
    }

    var PARAM_KEYS = Object.keys(toParams(emptyFilters(), 1, 0));

    function sameParams(a, b) {
        return PARAM_KEYS.every(function (k) {
            return (a[k] || null) === (b[k] || null);
        });
    }

    var MONTH_LABEL = function (month) { return MONTH_NAMES[parseInt(month, 10) - 1]; };

    return {
        restrict: 'E',
        scope: {},
        templateUrl: 'views/directives/individualResults.html',
        link: function (scope, element) {
            scope.PAGE_SIZE = PAGE_SIZE;
            scope.loading = !decoded;
            scope.error = false;
            scope.rows = [];
            scope.pagination = { current: 1 };

            // ---- The shared Advanced Filters panel ----
            // Its handlers and options come from AdvancedFiltersService, as for
            // "By race"; the slider follows distanceRange once it is known.
            AdvancedFiltersService.attach(scope);
            // Analytics: this list's name on its filter, sort and search events
            scope.analyticsList = 'individual_results';
            scope.distanceRange = { min: 0, max: 0 };
            scope.ageGradeRange = { min: 0, max: 0 };
            scope.availableRaceTypes = [];
            scope.availableCountries = [];
            scope.availableStates = [];
            scope.allMembers = [];
            scope.missingRankingOptions = AdvancedFiltersService.MISSING_RANKING_OPTIONS;
            scope.filterPanelExpanded = true;

            scope.authService = AuthService;
            scope.$watch('authService.isLoggedIn()', function (user) { scope.user = user; });

            $q.when(MembersService.getMembersWithCacheSupport({
                sort: 'memberStatus firstname',
                select: '-bio -personalBests -teamRequirementStats'
            })).then(function (members) { scope.allMembers = members || []; });

            // What the URL asks for — nothing, on a plain visit
            var read = fromParams($state.params);
            var pending = read.pending;
            var startPage = toInt($state.params.page) || 1;
            scope.filters = read.filters;

            // The panel's own filters, to open it when a link set some and to
            // count them on its badge
            function panelFilterCount() {
                var f = scope.filters;
                return (f.dateFrom ? 1 : 0) + (f.dateTo ? 1 : 0) +
                    (f.distanceMin > 0 || (f.distanceMax !== null && f.distanceMax < scope.distanceRange.max) ? 1 : 0) +
                    (f.agMin > 0 || (f.agMax !== null && f.agMax < scope.ageGradeRange.max) ? 1 : 0) +
                    f.raceTypes.length + f.countries.length + f.states.length + f.selectedMembers.length +
                    (f.missingRanking ? 1 : 0);
            }

            // Codes from a link -> the panel's entries, once the options exist
            function resolvePending() {
                if (!pending || !decoded) return;
                var f = scope.filters;
                var types = scope.availableRaceTypes;
                if (pending.types.length) {
                    f.raceTypes = types.filter(function (t) {
                        return pending.types.indexOf((t.name + '|' + t.surface).toLowerCase()) !== -1;
                    });
                } else if (pending.distances.length) {
                    f.raceTypes = types.filter(function (t) {
                        return pending.distances.indexOf(t.name.toLowerCase()) !== -1 &&
                            (!pending.surfaces.length || pending.surfaces.indexOf((t.surface || '').toLowerCase()) !== -1);
                    });
                }
                f.selectedMembers = pending.runners.map(function (username) {
                    // "By race" links may carry a ranking (username:1-3); not used here
                    return decoded.runnerByUsername[username.split(':')[0]];
                }).filter(Boolean).map(function (m) {
                    return { _id: m._id, firstname: m.firstname, lastname: m.lastname, username: m.username };
                });
                f.states = pending.states.map(function (code) {
                    return scope.availableStates.filter(function (x) { return x.code === code; })[0] ||
                        { code: code, name: UtilsService.getStateNameFromCode(code) || code };
                });
                f.countries = pending.countries.map(function (code) {
                    return scope.availableCountries.filter(function (x) { return x.code === code; })[0] ||
                        { code: code, name: UtilsService.getCountryNameFromCode(code) || code };
                });
                pending = null;
                // The panel stays closed: the active-filter tags above the
                // list already show what the URL set
            }

            // Everything that reaches the URL, bar the page
            var appliedSignature = null;
            function filterSignature() {
                var params = toParams(scope.filters, 1, scope.distanceRange.max, scope.ageGradeRange.max);
                delete params.page;
                return JSON.stringify(params);
            }

            function apply(page) {
                if (!decoded) return;
                resolvePending();
                var f = scope.filters;
                if (f.distanceMax === null) f.distanceMax = scope.distanceRange.max;
                if (f.agMax === null) f.agMax = scope.ageGradeRange.max;
                appliedSignature = filterSignature();
                var words = (f.search || '').toLowerCase().split(/\s+/).filter(Boolean);
                var typeIds = f.raceTypes.map(function (t) { return (t.name + '|' + t.surface).toLowerCase(); });
                var memberIds = f.selectedMembers.map(function (m) { return String(m._id); });
                var countryCodes = f.countries.map(function (x) { return x.code; });
                var stateCodes = f.states.map(function (x) { return x.code; });
                var from = toDay(f.dateFrom), to = toDay(f.dateTo);
                var distanceOn = f.distanceMin > 0 || f.distanceMax < scope.distanceRange.max;
                // A result without an age grade is out once the range is set
                var ageGradeOn = f.agMin > 0 || f.agMax < scope.ageGradeRange.max;

                var list = decoded.rows.filter(function (r) {
                    // Advanced Filters panel, as "By race" applies them
                    if (from && r.race.date < from) return false;
                    if (to && r.race.date > to) return false;
                    if (distanceOn && (r.race.miles < f.distanceMin || r.race.miles > f.distanceMax)) return false;
                    if (typeIds.length && typeIds.indexOf(r.race.typeId) === -1) return false;
                    if (countryCodes.length || stateCodes.length) {
                        var inCountry = countryCodes.indexOf(r.race.country) !== -1;
                        var inState = r.race.country === 'USA' && stateCodes.indexOf(r.race.state) !== -1;
                        if (!inCountry && !inState) return false;
                    }
                    // Results of any of the selected members (a race is kept
                    // when all of them ran it; a result belongs to one of them)
                    if (memberIds.length && !r.runnerIds.some(function (id) { return memberIds.indexOf(id) !== -1; })) return false;
                    if (f.missingRanking && !AdvancedFiltersService.resultMissing(r, f.missingRanking)) return false;
                    // From links
                    if (f.variable && !r.race.variable) return false;
                    if (f.year && r.race.year !== f.year) return false;
                    if (f.month && r.race.month !== f.month) return false;
                    if (f.day && r.race.day !== f.day) return false;
                    if (f.sex && r.sexes.indexOf(f.sex) === -1) return false;
                    if (f.division && r.category !== f.division) return false;
                    if (f.race && r.race._id !== f.race) return false;
                    if (f.age !== null && r.age !== f.age) return false;
                    if (f.agemin !== null && (r.age === null || r.age < f.agemin)) return false;
                    if (f.agemax !== null && (r.age === null || r.age > f.agemax)) return false;
                    if (f.eligible && !r.eligible) return false;
                    // Wins, as the team stats count them: first overall or first
                    // of the runner's gender
                    if (f.win && !(r.overallrank === 1 || r.genderrank === 1)) return false;
                    // Milestone cutoff: strictly under a time
                    if (f.under && !(r.time > 0 && r.time < f.under)) return false;
                    if (ageGradeOn && !(r.agegrade >= f.agMin && r.agegrade <= f.agMax)) return false;
                    for (var i = 0; i < words.length; i++) {
                        if (r.haystack.indexOf(words[i]) === -1) return false;
                    }
                    return true;
                });
                var sort = SORTS[f.sort] || SORTS[DEFAULT_SORT];
                var dir = f.desc ? -1 : 1;
                list.sort(function (a, b) {
                    var x = sort.field(a), y = sort.field(b);
                    if (x === y) return b.race.date < a.race.date ? -1 : (b.race.date > a.race.date ? 1 : 0);
                    if (x === null || x === undefined) return 1;
                    if (y === null || y === undefined) return -1;
                    return (x < y ? -1 : 1) * dir;
                });
                scope.rows = list;
                scope.chipList = buildChips();
                var pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
                scope.pagination.current = Math.min(Math.max(1, page || 1), pages);
                // Who and where the highlighted result is, and its position in
                // this list (none when the filters leave it out)
                scope.highlightPosition = null;
                var highlighted = f.highlight && decoded.rowById[f.highlight];
                scope.highlightLabel = highlighted ? highlighted.names + ' at ' + highlighted.race.name : '';
                if (f.highlight) {
                    for (var i = 0; i < list.length; i++) {
                        if (list[i]._id === f.highlight) { scope.highlightPosition = i + 1; break; }
                    }
                }
                if (jumpToHighlight) {
                    jumpToHighlight = false;
                    scope.goToHighlight();
                }
                syncUrl();
            }

            // The panel's handlers call this after each change; the deep watch
            // on filters below already re-applies, so there is nothing to add
            scope.applyFilters = function () { };

            // Arriving with ?highlight=: open on the page holding that result
            // and bring its row into view. Only on arrival — afterwards the
            // reader pages and filters freely, the row just stays marked, and
            // goToHighlight() takes them back to it.
            var jumpToHighlight = !!scope.filters.highlight;
            scope.goToHighlight = function () {
                if (!scope.highlightPosition) return;
                scope.pagination.current = Math.floor((scope.highlightPosition - 1) / PAGE_SIZE) + 1;
                syncUrl();
                $timeout(function () {
                    var row = document.querySelector('.ir-list .ir-highlight');
                    if (row) row.scrollIntoView({ block: 'center' });
                });
            };

            // Filters/page -> URL. Replaces the history entry: Back leaves the
            // page rather than stepping through every keystroke.
            // The URL is written a cycle later, never in the same digest as
            // the page's arrival: Angular writes the browser URL once per
            // digest, so a replace there would merge with the push of the link
            // that opened the page, and Back would skip the page it came from.
            // Once per cycle, too. And not mid-transition, for the same reason.
            var syncPending = null;
            var destroyed = false;
            function syncUrl() {
                if (syncPending) return;
                syncPending = $timeout(function () {
                    syncPending = null;
                    if ($state.transition) {
                        $state.transition.promise.then(syncUrl, angular.noop);
                        return;
                    }
                    if (destroyed || $state.current.name !== '/individualresults') return;
                    writeUrl();
                });
            }

            function writeUrl() {
                var params = toParams(scope.filters, scope.pagination.current, scope.distanceRange.max, scope.ageGradeRange.max);
                if (!sameParams(params, $state.params)) {
                    $state.go('/individualresults', params, { location: 'replace', inherit: false });
                }
            }

            // Re-filter when something that reaches the URL changes, and only
            // then: the slider's display values, the distance range arriving
            // or a list entry being swapped for an equal one must not send the
            // reader back to page 1 (or away from a highlighted result's page).
            // Cheaper than a deep watch on objects holding whole members, too.
            // Compared with what apply() last used, not with the watch's own
            // previous value: the first apply (after the data arrives)
            // resolves the link's filters and must not be undone.
            scope.$watch(filterSignature, function (now) {
                if (decoded && now !== appliedSignature) apply(1);
            });

            // URL -> filters, for a link to this page followed while already
            // on it (the params are dynamic, so the page is not rebuilt)
            var stopListening = $transitions.onSuccess({ to: '/individualresults' }, function (trans) {
                var params = trans.params();
                if (sameParams(params, toParams(scope.filters, scope.pagination.current, scope.distanceRange.max, scope.ageGradeRange.max))) return;
                var read = fromParams(params);
                scope.filters = read.filters;
                pending = read.pending;
                jumpToHighlight = !!scope.filters.highlight;
                apply(toInt(params.page) || 1);
            });
            scope.$on('$destroy', function () { destroyed = true; });
            scope.$on('$destroy', stopListening);

            scope.sortBy = function (column) {
                if (scope.filters.sort === column) {
                    scope.filters.desc = !scope.filters.desc;
                } else {
                    scope.filters.sort = column;
                    scope.filters.desc = SORTS[column].desc;
                }
                Analytics.event('sort_list', { list: 'individual_results', column: column,
                    direction: scope.filters.desc ? 'desc' : 'asc' });
            };

            // One search event once the typing stops, with how many results
            // it found. The term is sent as typed (it may be a runner's name;
            // member page URLs carry usernames anyway).
            scope.$watch('filters.search', function (term, old) {
                if (term === old) return;
                Analytics.eventSoon('search:individual_results', 'search', function () {
                    var text = (scope.filters.search || '').trim();
                    if (text.length < 2) return null;
                    return { list: 'individual_results', search_term: text, result_count: scope.rows.length };
                });
            });

            scope.sortIcon = function (column) {
                if (scope.filters.sort !== column) return 'fa-sort ir-sort-idle';
                return scope.filters.desc ? 'fa-sort-desc' : 'fa-sort-asc';
            };

            // Every active filter, panel ones included, as a removable chip.
            // Built once per apply(), not in a getter: a fresh array on every
            // read never settles in ng-repeat.
            scope.chipList = [];
            function buildChips() {
                var f = scope.filters;
                var chips = [];
                var shortDate = function (d) { return $filter('date')(d, 'MMM d, y'); };
                // Advanced Filters panel
                if (f.dateFrom) chips.push({ key: 'dateFrom', label: 'From ' + shortDate(f.dateFrom) });
                if (f.dateTo) chips.push({ key: 'dateTo', label: 'To ' + shortDate(f.dateTo) });
                if (f.distanceMin > 0 || f.distanceMax < scope.distanceRange.max) {
                    chips.push({ key: 'distanceRange', label: 'Distance: ' + f.distanceMin + '–' + f.distanceMax + ' mi' });
                }
                if (scope.ageGradeFilterOn()) chips.push({ key: 'agRange', label: scope.ageGradeFilterLabel() });
                f.raceTypes.forEach(function (t) {
                    chips.push({ key: 'type:' + t.name + '|' + t.surface, label: t.name + ' (' + t.surface + ')', item: t });
                });
                f.countries.forEach(function (c) {
                    chips.push({ key: 'country:' + c.code, label: c.name, item: c });
                });
                f.states.forEach(function (st) {
                    chips.push({ key: 'state:' + st.code, label: st.name, item: st });
                });
                f.selectedMembers.forEach(function (m) {
                    chips.push({ key: 'member:' + m._id, label: m.firstname + ' ' + m.lastname, item: m });
                });
                if (f.missingRanking) chips.push({ key: 'missing', label: 'Missing: ' + f.missingRanking.label });
                // From links
                if (f.race) {
                    var race = decoded && decoded.raceById[f.race];
                    chips.push({ key: 'race', label: 'Race: ' + (race ? race.name + ' (' + race.year + ')' : f.race) });
                }
                // Year, month and day read as one date
                if (f.year || f.month || f.day) {
                    var label;
                    if (f.day && f.month) label = (f.year ? '' : 'Every ') + MONTH_LABEL(f.month) + ' ' + f.day + (f.year ? ', ' + f.year : '');
                    else if (f.day) label = 'Day ' + f.day + ' of the month' + (f.year ? ' in ' + f.year : '');
                    else if (f.month) label = f.year ? MONTH_LABEL(f.month) + ' ' + f.year : 'Every ' + MONTH_LABEL(f.month);
                    else label = 'Year ' + f.year;
                    chips.push({ key: 'date', label: label });
                }
                if (f.sex) chips.push({ key: 'sex', label: f.sex === 'Female' ? 'Women' : 'Men' });
                if (f.division) chips.push({ key: 'division', label: f.division === 'Master' ? 'Masters' : 'Open (under 40)' });
                if (f.age !== null) chips.push({ key: 'age', label: 'Age ' + f.age });
                if (f.agemin !== null || f.agemax !== null) {
                    chips.push({
                        key: 'agerange', label: f.agemin !== null && f.agemax !== null ? 'Age ' + f.agemin + '–' + f.agemax :
                            (f.agemin !== null ? 'Age ' + f.agemin + '+' : 'Age up to ' + f.agemax)
                    });
                }
                if (f.variable) chips.push({ key: 'variable', label: 'Other distances (odd, multisport, swim)' });
                if (f.under) chips.push({ key: 'under', label: 'Under ' + formatTime(f.under) });
                if (f.eligible) chips.push({ key: 'eligible', label: 'Counted for team standings' });
                if (f.win) chips.push({ key: 'win', label: 'Wins (1st overall or gender)' });
                return chips;
            }

            // Tags the shared handlers (race type, country, state, member, the
            // two ranges) do not already report
            var SHARED_CHIPS = { type: true, country: true, state: true, member: true, distanceRange: true, agRange: true };
            scope.removeChip = function (chip) {
                var f = scope.filters;
                var kind = chip.key.split(':')[0];
                if (!SHARED_CHIPS[kind]) scope.trackFilterClear(kind);
                if (kind === 'dateFrom') f.dateFrom = '';
                if (kind === 'dateTo') f.dateTo = '';
                if (kind === 'distanceRange') scope.clearDistanceFilter();
                if (kind === 'type') scope.removeRaceTypeFromFilter(chip.item);
                if (kind === 'country') scope.removeCountryFromFilter(chip.item.code);
                if (kind === 'state') scope.removeStateFromFilter(chip.item.code);
                if (kind === 'member') scope.removeMemberFromFilter(chip.item._id);
                if (kind === 'missing') f.missingRanking = null;
                if (kind === 'race') f.race = '';
                if (kind === 'date') { f.year = ''; f.month = ''; f.day = ''; }
                if (kind === 'sex') f.sex = '';
                if (kind === 'division') f.division = '';
                if (kind === 'age') f.age = null;
                if (kind === 'agerange') { f.agemin = null; f.agemax = null; }
                if (kind === 'eligible') f.eligible = false;
                if (kind === 'win') f.win = false;
                if (kind === 'under') f.under = null;
                if (kind === 'variable') f.variable = false;
                if (kind === 'agRange') scope.clearAgeGradeFilter();
            };

            // Badge on the panel: its own filters
            scope.getActiveFilterCount = panelFilterCount;
            scope.hasActiveFilters = function () { return panelFilterCount() > 0; };

            // Anything Clear would undo: filters, a non-default sort, a highlight
            scope.activeFilterCount = function () {
                return scope.chipList.length + (scope.filters.search ? 1 : 0) + (scope.filters.highlight ? 1 : 0) +
                    (scope.filters.sort !== DEFAULT_SORT || scope.filters.desc !== SORTS[DEFAULT_SORT].desc ? 1 : 0);
            };

            // Back to a plain /individualresults: no filters, default sort,
            // nothing highlighted. The panel's "Clear All" does the same.
            scope.clearFilters = function () {
                scope.filters = emptyFilters();
                scope.filters.distanceMax = scope.distanceRange.max;
                scope.filters.agMax = scope.ageGradeRange.max;
                scope.updateSliderFromInputs();
                scope.updateAgeGradeSliderFromInputs();
                scope.trackFilterClear('all');
            };
            scope.clearAllFilters = scope.clearFilters;

            // The # column fits its header, "# (8,555)", and no more, at any
            // count. In the header's 11px bold type a digit is about 7px, a
            // comma 3px and "# ()" 20px; 2px more to spare.
            scope.numColumnWidth = function () {
                var count = $filter('number')(scope.rows.length);
                var digits = count.replace(/[^0-9]/g, '').length;
                var commas = count.length - digits;
                return (digits * 7 + commas * 3 + 22) + 'px';
            };

            // ---- Tooltips in the list ------------------------------------
            // Two kinds: the full text of a cell cut off with "…", and the
            // meaning of anything carrying a data-tip (the icons, the place).
            // Rather than a tooltip on each of hundreds of cells, one shared
            // tooltip is moved over the one in question. With a mouse it
            // follows hovering; on a touch screen a tap on a data-tip opens it
            // (and does not open the result), a tap anywhere else in the row
            // opens the result as usual.
            scope.cellTip = { text: '', open: false };
            var tipEl = null;

            // What, under this element, has a tooltip to show, and its text
            function tipFor(target, tipsOnly) {
                if (!target.closest) return null;
                var tagged = target.closest('.resultlistrow.ir-row [data-tip]');
                if (tagged && tagged.getAttribute('data-tip')) {
                    return { el: tagged, text: tagged.getAttribute('data-tip') };
                }
                if (tipsOnly) return null;
                var cell = target.closest('.resultlistrow.ir-row > span');
                if (!cell || cell.scrollWidth <= cell.clientWidth) return null;
                // The flags are icons: say what they mean instead
                var meanings = Array.prototype.map.call(cell.querySelectorAll('[data-tip]'), function (el) {
                    return el.getAttribute('data-tip');
                });
                return {
                    el: cell,
                    text: cell.classList.contains('ir-flags') && meanings.length ? meanings.join(' · ') :
                        cell.innerText.replace(/\s+/g, ' ').trim()
                };
            }

            function hideTip() {
                tipEl = null;
                if (!scope.cellTip.open) return;
                if (scope.$root.$$phase) {
                    scope.cellTip.open = false;
                } else {
                    scope.$apply(function () { scope.cellTip.open = false; });
                }
            }

            function showTip(tip) {
                hideTip();
                tipEl = tip.el;
                var anchor = element[0].querySelector('.ir-tip-anchor');
                var box = tip.el.getBoundingClientRect();
                var host = element[0].querySelector('.individual-results').getBoundingClientRect();
                anchor.style.left = (box.left - host.left) + 'px';
                anchor.style.top = (box.top - host.top) + 'px';
                anchor.style.width = box.width + 'px';
                anchor.style.height = box.height + 'px';
                // Opened a digest after the close, so the tooltip is placed
                // afresh over this one rather than left on the last
                $timeout(function () {
                    if (tipEl !== tip.el) return;
                    scope.cellTip.text = tip.text;
                    scope.cellTip.open = true;
                });
            }

            function onMouseOver(event) {
                var tip = tipFor(event.target);
                if (tip && tip.el === tipEl) return;
                if (tip) showTip(tip); else hideTip();
            }

            // Capture phase: ahead of the row's own click, which opens the result
            function onTap(event) {
                var tip = tipFor(event.target, true);
                if (!tip) {
                    hideTip();
                    return;
                }
                event.stopPropagation();
                if (tip.el === tipEl) {
                    hideTip();
                } else {
                    showTip(tip);
                    Analytics.event('tooltip_open', { element: tip.el.classList.contains('ir-place') ? 'place' : 'flag',
                        list: 'individual_results' });
                }
            }

            if ($rootScope.noHover) {
                element[0].addEventListener('click', onTap, true);
                // A tap outside the list closes it too
                $document.on('click', hideTip);
            } else {
                element.on('mouseover', onMouseOver);
                element.on('mouseleave', hideTip);
            }
            scope.$on('$destroy', function () {
                element.off('mouseover mouseleave');
                element[0].removeEventListener('click', onTap, true);
                $document.off('click', hideTip);
            });

            scope.pageEnd = function () {
                return Math.min(scope.pagination.current * PAGE_SIZE, scope.rows.length);
            };

            // The logged-in member's own results stand out, as in the race
            // list and on race pages
            scope.isMine = function (row) {
                var me = scope.user && scope.user.member && scope.user.member._id;
                return !!me && row.runnerIds.indexOf(String(me)) !== -1;
            };

            scope.openResult = function (row) {
                Analytics.event('select_content', { content_type: 'result', item_id: row._id,
                    source: 'individual_results_row' });
                $state.go('/results/result', { resultId: row._id });
            };

            scope.pageChanged = function () {
                syncUrl();
                var list = document.querySelector('.ir-list');
                if (list && list.getBoundingClientRect().top < 0) {
                    list.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            };

            function useData() {
                var options = decoded.options;
                scope.availableRaceTypes = options.raceTypes;
                scope.availableCountries = options.countries;
                scope.availableStates = options.states;
                scope.distanceRange.max = options.maxDistance;
                scope.ageGradeRange.max = options.maxAgeGrade;
            }

            if (decoded) {
                useData();
                apply(startPage);
            }

            // Usually answered from memory; a fresh list (the data changed)
            // is a different array, and only then are the rows rebuilt.
            // $q.when: the service returns a native promise, whose callback
            // would otherwise run outside a digest and sit unrendered until
            // something else happened to trigger one (~0.5s).
            function fetchList() {
                return $q.when(ResultsService.getRaceResultsWithCacheSupport(RACE_LIST_PARAMS)).then(function (raceList) {
                    if (!decoded || decoded.source !== raceList) {
                        var firstLoad = !decoded;
                        decoded = decode(raceList || []);
                        decoded.options = AdvancedFiltersService.buildOptions(raceList || []);
                        useData();
                        apply(!firstLoad && scope.rows.length ? scope.pagination.current : startPage);
                    }
                    scope.loading = false;
                }, function () {
                    scope.loading = false;
                    scope.error = !decoded;
                });
            }
            fetchList();

            // ---- Admin: edit / delete a row ----------------------------
            // A save or delete marks the data as changed on the server, so
            // the race list is fetched again and the rows rebuilt: rankings,
            // PBs and records can move with it, not just the one row.
            scope.editRow = function (row) {
                if (!scope.user || scope.user.role !== 'admin') return;
                ResultsService.retrieveResultForEdit({ _id: row._id }).then(function (saved) {
                    if (saved) fetchList();
                }, angular.noop);
            };

            scope.deleteRow = function (row) {
                if (!scope.user || scope.user.role !== 'admin') return;
                var dlg = dialogs.confirm('Delete result?',
                    'Delete ' + row.names + "'s result at " + row.race.name + '? This cannot be undone.');
                dlg.result.then(function () {
                    $q.when(ResultsService.deleteResult({ _id: row._id })).then(function () {
                        // Gone from view at once, whatever the refetch takes
                        var i = scope.rows.indexOf(row);
                        if (i > -1) scope.rows.splice(i, 1);
                        fetchList();
                    });
                }, angular.noop);
            };
        }
    };
}]);
