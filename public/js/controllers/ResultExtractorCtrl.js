angular.module('mcrrcApp.tools').controller('ResultExtractorController', [
    '$scope', '$http', '$q', '$timeout', 'Analytics', 'AuthService', 'ResultsService', 'MembersService', 'NotificationService', 'UtilsService', 'ResultExtractionService',
    function ($scope, $http, $q, $timeout, Analytics, AuthService, ResultsService, MembersService, NotificationService, UtilsService, ResultExtractionService) {

        $scope.authService = AuthService;
        $scope.$watch('authService.isLoggedIn()', function (user) {
            $scope.user = user;
        });

        // Initialize scope variables
        $scope.formData = {};
        $scope.tableData = null;
        $scope.tableHeaders = null;
        $scope.columnMapping = {};
        $scope.hiddenColumns = {};
        $scope.processedResults = [];
        $scope.currentTeamMembers = [];
        $scope.isLoading = false;
        $scope.formData.raceDate  = null;//new Date(Date.UTC(new Date().getFullYear(),new Date().getMonth(),new Date().getDate(),0,0,0,0)); // Set today's date
        $scope.url = '';   
        $scope.htmlSource = '';  // Add htmlSource variable
        $scope.raceType = null;        
        $scope.formData.location = {
            country: 'USA',
            state: null
        };
        $scope.formData.isRecordEligible = true;
        $scope.distanceName = '';
        $scope.meters = '';
        $scope.miles = '';
        $scope.states = UtilsService.states;
        $scope.countries = UtilsService.countries;
        $scope.resultlink = '';

        // Race metadata is copied onto every processed result, but none of it
        // affects which rows are produced or which member they match. Patching
        // it in place keeps the per-row selections and any manual corrections
        // that a full reprocess would throw away.
        function applyRaceMetadata() {
            $scope.processedResults.forEach(function(result) {
                result.race.racename = $scope.formData.raceName;
                result.race.racedate = $scope.formData.raceDate
                    ? new Date($scope.formData.raceDate).getTime()
                    : null;
                result.race.racetype = $scope.formData.raceType;
                result.race.location = $scope.formData.location;
                result.race.distanceName = $scope.formData.distanceName;
                result.resultlink = $scope.formData.resultlink;
                result.isRecordEligible = $scope.formData.isRecordEligible || false;
            });
        }

        // Watch for any form input changes and reprocess results
        $scope.$watch('formData', function() {
            if (!$scope.tableData || !$scope.canProcess().canProcess) {
                $scope.processedResults = [];
                return;
            }
            if ($scope.processedResults.length) {
                applyRaceMetadata();
            } else {
                $scope.processResults();
            }
        }, true);

        $scope.$watch('columnMapping', function(newMapping, oldMapping) {
            // Check if any mapping changed
            for (var header in newMapping) {
                if (newMapping[header] !== oldMapping[header]) {
                    // If a new mapping was selected
                    if (newMapping[header]) {
                        // Find any other headers that were mapped to the same field
                        for (var otherHeader in newMapping) {
                            if (otherHeader !== header && newMapping[otherHeader] === newMapping[header]) {
                                // Unmap the previous column
                                newMapping[otherHeader] = '';
                                NotificationService.showNotifiction(false, 'Field "' + newMapping[header] + '" was unmapped from previous column');
                            }
                        }
                    }
                }
            }

            if ($scope.tableData && $scope.canProcess().canProcess) {
                $scope.processResults();
            }else{
                $scope.processedResults = [];
            }
        }, true);

        // The fields a column can be mapped to, and those still free for a
        // column: shared with the race edit modal
        $scope.mappableFields = ResultExtractionService.mappableFields;
        $scope.getAvailableOptions = function(header) {
            return ResultExtractionService.availableFieldsFor($scope.columnMapping, header);
        };

        // Every member, past and present. Which of them count is decided by the
        // race date, not by who is on the team today: a 2014 race must match the
        // 2014 roster, including people who have since left.
        $scope.allTeamMembers = [];
        var membersLoaded = MembersService.getMembers({
            "filters[memberStatus]": "all",
            "sort": "firstname lastname"
        }).then(function(members) {
            $scope.allTeamMembers = members;
            $scope.currentTeamMembers = membersOnRaceDay();
        });

        function membersOnRaceDay() {
            if (!$scope.formData.raceDate) return [];
            return ResultExtractionService.membersActiveOn(
                $scope.allTeamMembers, $scope.formData.raceDate);
        }

        // Shown next to the date field, so it is obvious which roster is in play
        $scope.$watch('formData.raceDate', function() {
            $scope.currentTeamMembers = membersOnRaceDay();
        });

        $scope.$watch('formData.location.country', function(country) {
            if(country !== 'USA'){
                $scope.formData.location.state = null;
            }
        });

        // The server's fetchedVia, for the "loaded" notification
        var FETCHED_VIA = {
            'pasted': 'from the pasted page source',
            'direct': 'directly from the site',
            'proxy': 'through the proxy (the site blocked a direct request)',
            'jina': 'through r.jina.ai (the site blocked a direct request)',
            'runsignup-api': 'from the RunSignUp API',
            'parkrun-proxy': 'from parkrun through the proxy',
            'parkrun-direct': 'from parkrun directly (the proxy was unavailable)',
            'athlinks-api': 'from the Athlinks API',
            'athlinks-bookmarklet': 'from the bookmark\'s copy of the Athlinks race',
            'runsignup-bookmarklet': 'from the bookmark\'s copy of the RunSignUp results',
            'page-bookmarklet': 'from the bookmark\'s copy of the page'
        };

        // No race date needed to load: many pages give theirs (parkrun,
        // RunSignUp, Athlinks), and the rest wait for it before matching
        // (canProcess), since the date decides who was on the team
        var LOAD_TIMEOUT_MS = 120000;

        // A big paste goes gzipped (the server's JSON reader inflates it):
        // Firefox now and then stops sending a large upload about 1 KB short
        // of its end, and the server waits for the rest until it gives up (a
        // 502 after 60 s; seen with a 158 KB RunSignUp copy, never in Chrome
        // or Safari). Under a third of the size (158 KB -> 45 KB) gets through,
        // and sooner. Without CompressionStream, or if it fails, the paste
        // goes as it is.
        var GZIP_FROM_CHARS = 20000;
        function postExtractTable(data) {
            var config = { timeout: LOAD_TIMEOUT_MS };
            if (!data.htmlSource || data.htmlSource.length < GZIP_FROM_CHARS || !window.CompressionStream) {
                return $http.post('/api/extract-table', data, config);
            }
            var gzipped;
            try {
                gzipped = new window.Response(new window.Blob([JSON.stringify(data)]).stream()
                    .pipeThrough(new window.CompressionStream('gzip'))).blob();
            } catch (e) {
                return $http.post('/api/extract-table', data, config);
            }
            return $q.when(gzipped).then(function (blob) {
                return $http.post('/api/extract-table', blob, angular.extend(config, {
                    headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' }
                }));
            }, function () {
                return $http.post('/api/extract-table', data, config);
            });
        }

        $scope.loadTable = function() {
            $scope.isLoading = true;
            $scope.distanceSuggestions = [];

            // Pasted source and a URL go to the same endpoint: it finds the
            // results table generically and tells us whether the page was a
            // parkrun one, rather than us assuming every paste is.
            let data = $scope.htmlSource
                ? { htmlSource: $scope.htmlSource }
                : { url: $scope.url };

            $scope.resultSetChoice = null;
            // Never a spinner for ever: a request that gets nowhere is given
            // up after LOAD_TIMEOUT_MS. Its size and time go to the browser's
            // console, to put next to the server's log when DEBUG_TRACE is on
            var startedAt = Date.now();
            var sentKb = data.htmlSource ? Math.round(data.htmlSource.length / 1024) : 0;
            postExtractTable(data)
                .then(function(response) {
                    if (response.data.success) {
                        applyExtraction(response.data);
                    } else if (response.data.needsChoice && response.data.resultSets.length) {
                        // A RunSignUp race with several result sets and none
                        // in the address: listed for the admin to pick
                        $scope.resultSetChoice = {
                            pageTitle: response.data.pageTitle,
                            sets: response.data.resultSets
                        };
                    } else {
                        NotificationService.showNotifiction(false,'Failed to load table data: ' + response.data.error);
                    }
                    $scope.isLoading = false;
                })
                .catch(function(response) {
                    console.warn('[extract-table] failed after ' + (Date.now() - startedAt) + 'ms, HTTP ' +
                        (response && response.status) + (sentKb ? ', ' + sentKb + ' KB pasted' : ''), response && response.data);
                    // No answer at all (status -1: the upload cut off, the
                    // connection dropped) has no data: say so, and stop the
                    // spinner rather than throw here and leave it turning
                    var error = response && response.data && response.data.error;
                    NotificationService.showNotifiction(false, error ||
                        (response && response.status > 0 ? 'The server answered HTTP ' + response.status + '.'
                            : (Date.now() - startedAt >= LOAD_TIMEOUT_MS ? 'No answer from the server in ' + LOAD_TIMEOUT_MS / 1000 + ' seconds.'
                            : 'The request did not reach the server, or its answer never came back.') + ' Try again.'));
                    $scope.tableData = null;
                    $scope.processedResults = null;
                    $scope.isLoading = false;
                });
        };

        // A bookmark copy pasted into the box replaces what is there: pasted
        // onto an earlier copy, the two run together and neither reads
        $scope.onSourcePaste = function(event) {
            var clipboard = (event.originalEvent || event).clipboardData;
            var text = clipboard && clipboard.getData('text');
            if (!text || !/^\s*\{\s*"mcrrc/.test(text)) return;
            event.preventDefault();
            $scope.htmlSource = text;
        };

        // Empty the paste box (a whole page source is long to select by hand)
        $scope.clearHtmlSource = function() {
            $scope.htmlSource = '';
        };

        // A RunSignUp result set picked from the list: its address, loaded
        $scope.pickResultSet = function(set) {
            $scope.url = $scope.url.replace(/#.*$/, '').replace(/[?&]resultSetId=\d+/i, '') + '#resultSetId-' + set.id;
            $scope.loadTable();
        };

        // A results table loaded: the server's /api/extract-table answer, or
        // the parkrun check's (which has the same shape)
        function applyExtraction(data) {
            $scope.formData.raceType = null;
            $scope.hiddenColumns = {};
            $scope.tableHeaders = data.headers;
            $scope.tableData = data.data;
            $scope.pageTitle = data.pageTitle;
            NotificationService.showNotifiction(true,
                'Loaded ' + data.data.length + ' rows ' +
                (FETCHED_VIA[data.fetchedVia] || 'from the page') + '.');

            // Pasted source: the server says what it recognised.
            // A URL: the host name still tells us.
            $scope.isParkrunSource = $scope.htmlSource
                ? data.source === 'parkrun'
                : $scope.url.includes('parkrun.');

            // The page may carry its own date (parkrun does). Take it
            // only if the admin left the field empty; if it disagrees
            // with what they set, say so rather than overruling them.
            if (data.raceDate || data.raceDay) {
                // The day as the page writes it (parkrun), which no time zone
                // can move; else the server's date
                var pageDate = data.raceDay ? utcDay(data.raceDay) : new Date(data.raceDate);
                if (!$scope.formData.raceDate) {
                    $scope.formData.raceDate = pageDate;
                } else if (pageDate.toDateString() !== new Date($scope.formData.raceDate).toDateString()) {
                    NotificationService.showNotifiction(false,
                        'The results page says ' + pageDate.toDateString() +
                        ', but the race date is set to ' +
                        new Date($scope.formData.raceDate).toDateString() + '.');
                }
            }

            if (!$scope.formData.raceDate) {
                NotificationService.showNotifiction(false,
                    'The page gives no race date: set it to match the results to the team as it was that day.');
            }

            // Where the race was, when the results site says (RunSignUp):
            // only into an empty state, never over the admin's choice
            if (data.location && data.location.state && !$scope.formData.location.state) {
                $scope.formData.location = angular.copy(data.location);
            }

            // More runners than were fetched: say so rather than save a
            // part of the race as if it were all of it
            if (data.truncated) {
                NotificationService.showNotifiction(false,
                    'Only ' + data.data.length + ' of the ' + data.total + ' runners could be fetched.');
            }

            // Set race type to road 5K for Parkrun
            if ($scope.isParkrunSource) {
                $scope.racetypesList.forEach(function(racetype) {
                    if (racetype.name === '5k' && racetype.surface === 'road') {
                        $scope.raceType = racetype;
                        $scope.formData.raceType = racetype;
                    }
                });
            }
            
            // Filter out the first row if it appears to be headers
            $scope.tableData = data.data.filter(function(row, index) {
                if (index === 0) {
                    // Check if the first row looks like headers
                    var isHeaderRow = true;
                    for (var header in row) {
                        // If any value is not a string or contains numbers, it's probably not a header row
                        if (typeof row[header] !== 'string' || /\d/.test(row[header])) {
                            isHeaderRow = false;
                            break;
                        }
                    }
                    return !isHeaderRow;
                }
                return true;
            });

            // Site-specific column mapping, shared with the race edit
            // modal's "retrieve from a link" flow. A paste the server
            // recognised (parkrun's page, the bookmarklet's copy of an
            // Athlinks or RunSignUp race) maps as that site's address would.
            var SITE_ADDRESS = { parkrun: 'parkrun.', athlinks: 'athlinks.com', runsignup: 'runsignup.com' };
            var siteAddress = $scope.isParkrunSource ? SITE_ADDRESS.parkrun
                : ($scope.htmlSource && SITE_ADDRESS[data.source]) || null;
            // The bookmark's copy of a page carries its address (mcrrc.org's
            // column names are known)
            var mappingAddress = siteAddress || data.sourceUrl || $scope.url;
            $scope.columnMapping = ResultExtractionService.guessColumnMapping(
                mappingAddress,
                $scope.tableHeaders,
                // Pasted source from a site we cannot identify has no
                // URL to match on, so fall back to header names. The
                // mapping dropdowns are still there to correct it.
                { fallbackToGenericHeaders: !!$scope.htmlSource && !siteAddress }
            );

            
            $scope.distanceSuggestions = ResultExtractionService.guessRaceDistance($scope.racetypesList, {
                pageTitle: data.pageTitle,
                url: data.sourceUrl || $scope.url,
                distance: data.distance,
                headers: $scope.tableHeaders,
                rows: $scope.tableData,
                columnMapping: $scope.columnMapping
            });

            // Try to extract race name from the page title or content
            if (data.pageTitle) {
                // Remove common suffixes and clean up the title
                var title = data.pageTitle
                    .replace(/results?/i, '')
                    .replace(/race/i, '')
                    .replace(/202[0-9]/g, '') // Remove years
                    .trim();
                
                if (title) {
                    $scope.formData.raceName = title;
                }
            }
            // Set the result link to the URL being processed, or the page
            // the pasted results came from (the Athlinks bookmarklet's)
            $scope.formData.resultlink = data.resultUrl || $scope.url;
        }

        // ---- The parkrun check (app/parkrunCheck.js) ----
        // A panel behind the "Parkrun check" button: the parkruns the team runs
        // most or ran lately; for each, its results of the latest event or of a
        // date picked, fetched on demand, and the team members in them. "Open
        // in extractor" loads one into this page as if its address had been
        // entered (the event's own page, .../results/388/), from the results
        // already fetched.
        var prc = $scope.parkrunCheck = { open: false, list: [], loaded: false, error: null, running: false, current: null, date: null };

        function loadParkruns() {
            if (prc.requested) return;
            prc.requested = true;
            $http.get('/api/parkrun-check').then(function (res) {
                prc.list = res.data.parkruns.map(function (p) {
                    return angular.extend(p, { status: p.latestUrl ? 'idle' : 'nolink' });
                });
                prc.minRuns = res.data.minRuns;
                prc.recentMonths = Math.round(res.data.recentDays / 30);
                prc.loaded = true;
            }, function (res) {
                prc.error = (res.data && res.data.error) || 'Could not list the parkruns';
                prc.loaded = true;
            });
        }

        $scope.toggleParkrunCheck = function () {
            prc.open = !prc.open;
            if (prc.open) loadParkruns();
        };

        // Another date: what was checked was for the one before
        $scope.$watch('parkrunCheck.date', function (date, before) {
            if (date === before) return;
            prc.list.forEach(function (item) {
                if (item.status === 'checking') return;
                item.status = item.latestUrl ? 'idle' : 'nolink';
                item.results = null;
                item.found = null;
                item.requests = null;
            });
            prc.allRequests = null;
        });

        // The date picked, as "2026-11-14" (the picker's dates are UTC midnight)
        function pickedDay() {
            return prc.date ? new Date(prc.date).toISOString().slice(0, 10) : null;
        }

        // "2026-11-21" -> that day at UTC midnight, as the date picker has it
        function utcDay(day) {
            var p = String(day || '').split('-');
            return p.length === 3 ? new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])) : null;
        }

        // The team members in a parkrun's results (members on the team that
        // day, alternate names included): the extractor's own matching
        function membersIn(results) {
            var mapping = ResultExtractionService.guessColumnMapping('parkrun.', results.headers);
            var members = ResultExtractionService.membersActiveOn($scope.allTeamMembers, utcDay(results.raceDay));
            var found = [];
            results.data.forEach(function (row) {
                var parsed = ResultExtractionService.parseRow(row, mapping, results.data,
                    { stripPersonalBest: true, stripDigitsFromGender: true });
                var member = parsed && ResultExtractionService.matchMember(parsed.firstname, parsed.lastname, members);
                if (member && !found.some(function (f) { return f.member._id === member._id; })) {
                    found.push({ member: member, time: parsed.time });
                }
            });
            return found;
        }

        $scope.checkParkrun = function (item) {
            var day = pickedDay();
            item.status = 'checking';
            item.error = null;
            item.requests = null;
            item.via = null;
            var body = { url: item.latestUrl };
            if (day) body.date = day;
            return $q.all([$http.post('/api/parkrun-check/latest', body), membersLoaded])
                .then(function (out) {
                    var results = out[0].data;
                    // Pages fetched from parkrun for this check
                    item.requests = results.requests;
                    // How the page came: through the proxy, or directly
                    // when the proxy was down (app/parkrunFetch.js)
                    item.via = results.fetchedVia || null;
                    if (results.noEvent) {
                        item.results = null;
                        item.status = 'noevent';
                        return;
                    }
                    item.results = results;
                    item.found = membersIn(results);
                    item.status = results.alreadyAdded ? 'added' : item.found.length ? 'found' : 'none';
                }, function (res) {
                    item.requests = res && res.data ? res.data.requests : null;
                    item.status = 'error';
                    item.error = (res && res.data && res.data.error) || 'Could not fetch the results';
                });
        };

        // Every parkrun on the list, one after the other (gentle on parkrun
        // and the proxy)
        $scope.checkAllParkruns = function () {
            prc.running = true;
            prc.allRequests = null;
            Analytics.event('admin_action', { action: 'parkrun_check_all' });
            var chain = $q.when();
            prc.list.forEach(function (item) {
                if (item.latestUrl) chain = chain.then(function () { return $scope.checkParkrun(item); });
            });
            chain.finally(function () {
                prc.running = false;
                // All the pages fetched from parkrun for it
                prc.allRequests = prc.list.reduce(function (sum, item) { return sum + (item.requests || 0); }, 0);
            });
        };

        $scope.openParkrun = function (item) {
            var results = item.results;
            prc.current = item;
            $scope.htmlSource = '';
            $scope.url = results.resultUrl;
            $scope.processedResults = [];
            $scope.formData.raceDate = utcDay(results.raceDay);
            // Where it is: as the last time the team ran it
            $scope.formData.location = angular.copy(item.location || { country: 'USA', state: null });
            applyExtraction(results);
            $timeout(function () {
                var card = document.getElementById('rx-map-card');
                if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        };

        $scope.hasRequiredFields = function() {
            // Check if we have either a name column or both firstname and lastname columns
            var hasName = false;
            var hasFirstName = false;
            var hasLastName = false;
            var hasTime = false;
            
            for (var header in $scope.columnMapping) {
                if ($scope.columnMapping[header] === 'name') {
                    hasName = true;
                }
                if ($scope.columnMapping[header] === 'firstname') {
                    hasFirstName = true;
                }
                if ($scope.columnMapping[header] === 'lastname') {
                    hasLastName = true;
                }
                if ($scope.columnMapping[header] === 'time') {
                    hasTime = true;
                }
            }
            
            // We need either name or both firstname and lastname
            var hasValidNameMapping = hasName || (hasFirstName && hasLastName);
            return hasValidNameMapping && hasTime;
        };

        $scope.getRaceTypeClass = function(s) {
            if (s !== undefined) {
                return s.replace(/ /g, '') + '-col';
            }
        };

        ResultsService.getRaceTypes({
            sort: 'meters'
        }).then(function(racetypes) {
            $scope.racetypesList = racetypes;
            racetypes.forEach(function(r) {
                if (r.name === 'Multisport'){//this needs to be added to racetypes
                    $scope.multisportRacetype = r;
                }
            });
        });

        // A guessed distance: select its race type, and for an "Odd ...
        // distance" one fill in the measured length
        $scope.applyDistanceSuggestion = function(s) {
            $scope.formData.raceType = s.racetype;
            $scope.onRaceTypeSelect(s.racetype);
            if (s.miles) {
                $scope.formData.miles = s.miles;
                $scope.formData.meters = Math.round(s.miles * 1609.344);
                if (!$scope.formData.distanceName) $scope.formData.distanceName = s.miles + ' miles';
            }
        };

        $scope.isSuggestionApplied = function(s) {
            return !!$scope.formData.raceType && $scope.formData.raceType._id === s.racetype._id;
        };

        $scope.onRaceTypeSelect = function(selected) {
            $scope.raceType = selected;
            if (selected.isVariable && selected.surface !== 'multiple') {
                $scope.meters = selected.meters;
                $scope.miles = selected.miles;
            } else {
                $scope.meters = '';
                $scope.miles = '';
            }
        };

        $scope.onMetersChange = function() {
            if ($scope.formData.meters && !isNaN($scope.formData.meters)) {
                $scope.formData.miles = ($scope.formData.meters * 0.000621371).toFixed(2);
                // Update the race type's attributes if it's variable
                if ($scope.formData.raceType && $scope.formData.raceType.isVariable) {
                    $scope.formData.raceType.meters = parseInt($scope.formData.meters);
                    $scope.formData.raceType.miles = parseFloat($scope.formData.miles);
                }
            }
        };

        $scope.onMilesChange = function() {
            if ($scope.formData.miles && !isNaN($scope.formData.miles)) {
                $scope.formData.meters = Math.round($scope.formData.miles * 1609.34);
                // Update the race type's attributes if it's variable
                if ($scope.formData.raceType && $scope.formData.raceType.isVariable) {
                    $scope.formData.raceType.meters = parseInt($scope.formData.meters);
                    $scope.formData.raceType.miles = parseFloat($scope.formData.miles);
                }
            }
        };

        $scope.canProcess = function() {
            const missingRequirements = [];
            
            if (!$scope.hasRequiredFields()) {
                missingRequirements.push('Name and Time fields are required');
            }
            
            if (!$scope.formData.raceType) {
                missingRequirements.push('Please select a race type');
            }

            if (!$scope.formData.raceName) {
                missingRequirements.push('Please select a race Name');
            }

            if (!$scope.formData.raceDate) {
                missingRequirements.push('Please select a race Date');
            }
            
            if (!$scope.formData.location.country) {
                missingRequirements.push('Please select a country');
            }
            
            if ($scope.formData.location.country === 'USA' && !$scope.formData.location.state) {
                missingRequirements.push('Please select a state for USA');
            }
            
            return { 
                canProcess: missingRequirements.length === 0,
                message: missingRequirements.length > 0 ? missingRequirements.join('<br>') : ''
            };
        };

        // The team members' rows of the table, ready to save. The name is
        // matched first and the rest of a row worked out only for members (a
        // 17,000-runner race has a few dozen), with the parsing and matching
        // the parkrun check and the race edit modal use too
        // (ResultExtractionService).
        $scope.processResults = function() {
            if (!$scope.canProcess().canProcess) return;

            // Recomputed here rather than read from the cached list: the
            // date watcher and this run can land in the same digest, and
            // the roster must never lag the date the admin just set.
            var members = membersOnRaceDay();
            var mapping = $scope.columnMapping;
            var options = {
                stripPersonalBest: !!$scope.isParkrunSource,
                stripDigitsFromGender: !!$scope.isParkrunSource
            };
            var processed = [];

            $scope.tableData.forEach(function(row) {
                var name = ResultExtractionService.parseName(row, mapping);
                var member = name && ResultExtractionService.matchMember(name.firstname, name.lastname, members);
                if (!member) return;
                var parsed = ResultExtractionService.parseRow(row, mapping, $scope.tableData, options);
                if (!parsed) return;

                var time = Math.round(parsed.time); // centiseconds
                processed.push({
                    selected: true,
                    members: [member],
                    time: time,
                    timeExp: {
                        hours: Math.floor(time / 360000),
                        minutes: Math.floor((time % 360000) / 6000),
                        seconds: Math.floor((time % 6000) / 100),
                        centiseconds: time % 100
                    },
                    race: {
                        racename: $scope.formData.raceName,
                        racedate: $scope.formData.raceDate ? new Date($scope.formData.raceDate).getTime() : null,
                        racetype: $scope.formData.raceType,
                        location: $scope.formData.location,
                        isMultisport: false,
                        distanceName: $scope.formData.distanceName
                    },
                    ranking: parsed.ranking,
                    resultlink: $scope.formData.resultlink,
                    isRecordEligible: $scope.formData.isRecordEligible || false
                });
            });

            $scope.processedResults = processed;
        };

        $scope.selectAll = function() {
            $scope.processedResults.forEach(function(result) {
                result.selected = true;
            });
        };

        $scope.deselectAll = function() {
            $scope.processedResults.forEach(function(result) {
                result.selected = false;
            });
        };

        $scope.hasSelectedResults = function() {
            return $scope.processedResults.some(function(result) {
                return result.selected;
            });
        };

        // The race as <race-series-picker> sees it: one stable object, kept in step
        // with the form, in the shape each saved result's race will have
        $scope.seriesRace = {};
        $scope.seriesPick = { choice: null };
        $scope.$watch(function () {
            var fd = $scope.formData || {};
            var loc = fd.location || {};
            return [fd.raceName, fd.raceDate, fd.raceType && fd.raceType._id, loc.country, loc.state, fd.distanceName].join('|');
        }, function () {
            var fd = $scope.formData || {};
            angular.copy({
                racename: fd.raceName,
                racedate: fd.raceDate ? new Date(fd.raceDate).getTime() : null,
                racetype: fd.raceType,
                location: fd.location,
                isMultisport: false,
                distanceName: fd.distanceName
            }, $scope.seriesRace);
        });

        $scope.saveResults = function() {
            if (!$scope.processedResults.length) {
                NotificationService.showNotifiction(false,'No results to save');
                return;
            }

            var resultsToSave = $scope.processedResults.filter(function(result) {
                return result.selected;
            });

            if (!resultsToSave.length) {
                NotificationService.showNotifiction(false,'Please select at least one result to save');
                return;
            }

            // Process each result before saving
            resultsToSave = resultsToSave.map(function(result) {
                // Update time from timeExp components
                if (result.timeExp) {
                    result.time = (result.timeExp.hours * 3600 + 
                                 result.timeExp.minutes * 60 + 
                                 result.timeExp.seconds) * 100 + 
                                 result.timeExp.centiseconds;
                }

                // Ensure all ranking numbers are integers
                if (result.ranking) {
                    result.ranking.overallrank = parseInt(result.ranking.overallrank) || undefined;
                    result.ranking.overalltotal = parseInt(result.ranking.overalltotal) || undefined;
                    result.ranking.genderrank = parseInt(result.ranking.genderrank) || undefined;
                    result.ranking.gendertotal = parseInt(result.ranking.gendertotal) || undefined;
                    result.ranking.agerank = parseInt(result.ranking.agerank) || undefined;
                    result.ranking.agetotal = parseInt(result.ranking.agetotal) || undefined;                    
                }

                // Clean up the result object
                var res = JSON.parse(JSON.stringify(result));
                delete res.timeExp;
                delete res.selected;
                delete res.member;

                return res;
            });

            $scope.isLoading = true;
            $scope.savingMessage = 'Saving ' + resultsToSave.length + ' results...';
            
            ResultsService.saveResults(resultsToSave, $scope.seriesPick.choice)
                .then(function(savedResults) {
                    Analytics.event('results_import', { count: savedResults.length });
                    // An event opened from the parkrun check is now added
                    if (prc.current && prc.current.results && prc.current.results.resultUrl === $scope.formData.resultlink) {
                        prc.current.status = 'added';
                    }
                    $scope.processedResults = []; // Clear processed results after successful save
                    $scope.isLoading = false;
                    $scope.savingMessage = '';
                })
                .catch(function(error) {
                    console.error('Error saving results:', error);
                    $scope.isLoading = false;
                    $scope.savingMessage = '';
                });
        };

        $scope.cleanTime = ResultExtractionService.cleanTime;

        $scope.updateTime = function(result) {
            // Ensure all time components are numbers
            result.timeExp.hours = parseInt(result.timeExp.hours) || 0;
            result.timeExp.minutes = parseInt(result.timeExp.minutes) || 0;
            result.timeExp.seconds = parseInt(result.timeExp.seconds) || 0;
            result.timeExp.centiseconds = parseInt(result.timeExp.centiseconds) || 0;

            // Calculate total time in centiseconds
            result.time = (result.timeExp.hours * 3600 + 
                          result.timeExp.minutes * 60 + 
                          result.timeExp.seconds) * 100 + 
                          result.timeExp.centiseconds;
        };

        $scope.debugResult = function(result) {
            console.log('Debug Result:', result);
        };

        $scope.hideColumn = function(header) {
            $scope.hiddenColumns[header] = true;
        };

        $scope.isColumnHidden = function(header) {
            return $scope.hiddenColumns[header] || false;
        };

        $scope.hasHiddenColumns = function() {
            return Object.keys($scope.hiddenColumns || {}).length > 0;
        };

        // Hiding is a single click on a header, so mis-clicks are easy and
        // previously only a reload undid them.
        $scope.restoreHiddenColumns = function() {
            $scope.hiddenColumns = {};
        };

           // =====================================
    // DATE PICKER CONFIG ==================
    // =====================================

    $scope.dateOptions = {
        formatDay: 'dd',
        formatMonth: 'MM',
        formatYear: 'yy',

        startingDay: 1
    };

    // Today's local calendar date, at UTC midnight like the picker's dates
    // (its ng-model-options timezone is utc)
    $scope.setToday = function() {
        var now = new Date();
        $scope.formData.raceDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    };

    $scope.open = function($event) {
        $event.preventDefault();
        $event.stopPropagation();

        $scope.formData.opened = true;
    };
    }
]);

// The bookmarklet link on the extractor page: its address is the script in
// the file named (rx-bookmarklet="/bookmarklets/results.js") as a javascript:
// address, set by hand since Angular will not put one in an href.
angular.module('mcrrcApp.tools').directive('rxBookmarklet', ['$http', function ($http) {
    return {
        restrict: 'A',
        link: function (scope, element, attrs) {
            // Only the script itself: a server without the file answers with
            // the site's page (the "*" route), which as a bookmark fails with
            // "expected expression, got '<'"
            var ready = false;
            $http.get(attrs.rxBookmarklet, { cache: true, transformResponse: [] }).then(function (response) {
                var code = typeof response.data === 'string' ? response.data : '';
                if (code.indexOf('MCRRC result extractor') === -1 || /^\s*</.test(code)) return;
                element[0].setAttribute('href', 'javascript:' + encodeURIComponent(code));
                ready = true;
            });
            // A click here would run it on this page: it is for dragging
            element.on('click', function (event) {
                event.preventDefault();
                alert(ready
                    ? 'Drag this link to your bookmarks bar, then click it on a race\'s results page (mcrrc.org, Athlinks, RunSignUp, parkrun or any other).'
                    : 'The bookmark could not be loaded from ' + attrs.rxBookmarklet + ' (is this version of the site deployed?).');
            });
        }
    };
}]);
