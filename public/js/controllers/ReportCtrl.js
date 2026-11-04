// Create Report (admin): the team's results between two dates, in three forms —
// a JSON document for an LLM (a Claude skill writes the team highlights from
// it), an inline-styled HTML table for email, and plain text.
angular.module('mcrrcApp.results').controller('ReportController', ['$scope', '$filter', '$timeout', '$window', 'AuthService', 'ResultsService', 'NotificationService', function($scope, $filter, $timeout, $window, AuthService, ResultsService, NotificationService) {

    var SITE_URL = 'https://raceteam.mcrrc.org';
    var AG_LEVELS = [
        { min: 90, label: 'World class' },
        { min: 80, label: 'National class' },
        { min: 70, label: 'Regional class' },
        { min: 0, label: 'Local class' }
    ];

    $scope.authService = AuthService;
    $scope.$watch('authService.isLoggedIn()', function(user) {
        $scope.user = user;
    });

    var weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 6);
    $scope.datefrom = weekAgo;
    $scope.dateto = new Date();
    $scope.loading = false;
    $scope.copied = {};

    $scope.open = function($event, opened) {
        $event.preventDefault();
        $event.stopPropagation();
        $scope[opened] = true;
    };

    function utcDay(d) {
        return new Date($filter('date')(d, 'yyyy-MM-dd', 'UTC')).getTime();
    }
    function ymd(d) {
        return $filter('date')(d, 'yyyy-MM-dd', 'UTC');
    }
    function fullName(m) {
        return m.firstname + ' ' + m.lastname;
    }
    function runnerNames(result) {
        return result.members.map(fullName).join(' & ');
    }
    function ageAt(dob, date) {
        if (!dob || !date) return null;
        var b = new Date(dob), d = new Date(date);
        var age = d.getUTCFullYear() - b.getUTCFullYear();
        if (d.getUTCMonth() < b.getUTCMonth() ||
            (d.getUTCMonth() === b.getUTCMonth() && d.getUTCDate() < b.getUTCDate())) age--;
        return age;
    }
    function agLevel(ag) {
        if (!ag) return null;
        for (var i = 0; i < AG_LEVELS.length; i++) {
            if (ag >= AG_LEVELS[i].min) return AG_LEVELS[i].label;
        }
    }
    function place(rank, total) {
        if (!rank) return null;
        return { rank: rank, total: total || null };
    }
    function miles(race, result) {
        var mi = result.miles || (race.racetype && race.racetype.miles);
        return mi ? Math.round(mi * 100) / 100 : null;
    }

    $scope.getReports = function() {
        $scope.loading = true;
        ResultsService.getRacesInfos({
            filters: { dateFrom: utcDay($scope.datefrom), dateTo: utcDay($scope.dateto) },
            sort: '-race.racedate -race.order race.racename'
        }).then(function(raceInfosList) {
            $scope.raceInfosList = raceInfosList;
            $scope.numberOfResults = raceInfosList.reduce(function(n, r) { return n + r.results.length; }, 0);
            $scope.llmReport = JSON.stringify(buildLlmReport(raceInfosList), null, 2);
            $scope.report = buildText(raceInfosList);
            $scope.reportHTLM = buildHtml(raceInfosList);
        }).finally(function() {
            $scope.loading = false;
        });
    };

    // ---------- LLM document ----------

    function buildLlmReport(raceInfosList) {
        var runners = {};
        var highlights = {
            podiums: [],
            personalBests: [],
            teamRecords: [],
            raceCountMilestones: [],
            birthdayRaces: [],
            firstTeamRaceInLocation: [],
            topAgeGrades: [],
            mostActiveMembers: []
        };
        var totalMiles = 0;
        var gradedResults = [];
        var locations = {};

        var races = raceInfosList.map(function(race) {
            var raceUrl = SITE_URL + '/races/' + race._id;
            var loc = race.location || {};
            var locName = [loc.state, loc.country].filter(Boolean).join(', ') || null;
            if (locName) locations[locName] = true;

            (race.achievements || []).forEach(function(a) {
                if (a.name === 'newLocation') {
                    highlights.firstTeamRaceInLocation.push({ race: race.racename, date: ymd(race.racedate), location: (a.value && a.value.locationName) || locName, text: a.text });
                }
            });

            var results = (race.results || []).map(function(result) {
                var names = runnerNames(result);
                var mi = miles(race, result);
                var seconds = result.time / 100;
                if (mi) totalMiles += mi * result.members.length;
                var r = result.ranking || {};
                var entry = {
                    runners: result.members.map(function(m) {
                        return {
                            name: fullName(m),
                            sex: m.sex || null,
                            ageOnRaceDay: ageAt(m.dateofbirth, race.racedate),
                            profileUrl: m.username ? SITE_URL + '/members/' + m.username : null
                        };
                    }),
                    isTeamOrRelayResult: result.members.length > 1,
                    category: result.category || null,
                    time: $filter('secondsToTimeString')(result.time),
                    timeSeconds: Math.round(seconds * 100) / 100,
                    pacePerMile: mi && !race.isMultisport ? $filter('resultToPace')(result, race) : null,
                    miles: mi,
                    placing: {
                        overall: place(r.overallrank, r.overalltotal),
                        gender: place(r.genderrank, r.gendertotal),
                        ageGroup: place(r.agerank, r.agetotal)
                    },
                    overallTopPercent: r.overallrank && r.overalltotal ? Math.max(1, Math.round(100 * r.overallrank / r.overalltotal)) : null,
                    ageGradePercent: result.agegrade || null,
                    ageGradeLevel: agLevel(result.agegrade),
                    achievements: (result.achievements || []).map(function(a) { return { type: a.name, text: a.text }; }),
                    legs: result.legs && result.legs.length ? result.legs : undefined,
                    comments: result.comments || undefined,
                    officialResultsLink: result.resultlink || undefined,
                    resultUrl: SITE_URL + '/results/' + result._id
                };

                result.members.forEach(function(m) {
                    var k = m._id;
                    if (!runners[k]) runners[k] = { name: fullName(m), races: 0, miles: 0 };
                    runners[k].races++;
                    if (mi) runners[k].miles += mi;
                });

                var where = { runner: names, race: race.racename, date: ymd(race.racedate), time: entry.time, resultUrl: entry.resultUrl };
                [['overall', r.overallrank, r.overalltotal], ['gender', r.genderrank, r.gendertotal], ['age group', r.agerank, r.agetotal]].forEach(function(p) {
                    if (p[1] && p[1] <= 3) highlights.podiums.push(angular.extend({ placing: p[0], rank: p[1], of: p[2] || null }, where));
                });
                (result.achievements || []).forEach(function(a) {
                    var h = angular.extend({ text: a.text }, where);
                    if (a.name === 'pb') highlights.personalBests.push(angular.extend({ distance: race.racetype && race.racetype.name, surface: race.racetype && race.racetype.surface }, h));
                    else if (a.name === 'teamRecord') highlights.teamRecords.push(angular.extend({ distance: a.value && a.value.racetypeName, category: a.value && a.value.category, sex: a.value && a.value.sex }, h));
                    else if (a.name === 'raceCount') highlights.raceCountMilestones.push(angular.extend({ teamRaceNumber: a.value && a.value.raceCount }, h));
                    else if (a.name === 'birthday') highlights.birthdayRaces.push(h);
                });
                if (result.agegrade) gradedResults.push(angular.extend({ ageGradePercent: result.agegrade, level: agLevel(result.agegrade), distance: race.racetype && race.racetype.name }, where));

                return entry;
            });

            return {
                name: race.racename,
                date: ymd(race.racedate),
                location: locName,
                distance: race.distanceName || (race.racetype && race.racetype.name) || null,
                miles: race.racetype && race.racetype.miles ? Math.round(race.racetype.miles * 100) / 100 : null,
                surface: race.racetype && race.racetype.surface,
                isMultisport: !!race.isMultisport,
                isClubRace: !!race.clubRace,
                teamResultCount: results.length,
                raceUrl: raceUrl,
                photoLinks: (race.photoLinks || []).map(function(p) { return { label: p.label || null, url: p.url }; }),
                raceAchievements: (race.achievements || []).map(function(a) { return { type: a.name, text: a.text }; }),
                results: results
            };
        });

        gradedResults.sort(function(a, b) { return b.ageGradePercent - a.ageGradePercent; });
        highlights.topAgeGrades = gradedResults.slice(0, 10);
        highlights.mostActiveMembers = Object.keys(runners).map(function(k) {
            var r = runners[k];
            return { name: r.name, races: r.races, miles: Math.round(r.miles * 10) / 10 };
        }).filter(function(r) { return r.races > 1; })
          .sort(function(a, b) { return b.races - a.races || b.miles - a.miles; })
          .slice(0, 10);

        return {
            about: 'Race results of the MCRRC Racing Team (Montgomery County Road Runners Club, Maryland, USA) for the period below, exported from the team records site to write a team highlights summary. Races are newest first. Use only what is here; do not invent times, placings or names.',
            team: 'MCRRC Racing Team',
            site: SITE_URL,
            period: { from: ymd($scope.datefrom), to: ymd($scope.dateto) },
            generatedAt: new Date().toISOString(),
            totals: {
                races: races.length,
                results: races.reduce(function(n, r) { return n + r.results.length; }, 0),
                distinctRunners: Object.keys(runners).length,
                totalMilesRaced: Math.round(totalMiles * 10) / 10,
                locations: Object.keys(locations)
            },
            definitions: {
                time: 'Finish time, h:mm:ss (hundredths when recorded). timeSeconds is the same in seconds.',
                placing: 'rank out of total finishers in the whole race (overall), the runner\'s gender, and their age group. Missing when the race did not publish it.',
                overallTopPercent: 'Overall rank as a percentile of the field: 5 means top 5%.',
                ageGradePercent: 'Performance against the world best for the runner\'s age and sex (WMA/Alan Jones tables). 100 = world-record level.',
                ageGradeLevel: 'World class >= 90%, National class >= 80%, Regional class >= 70%, Local class below 70%.',
                category: 'Open (under 40) or Master (40 and over) on race day.',
                achievementTypes: {
                    pb: 'Personal best at that distance and surface, among the runner\'s team races.',
                    teamRecord: 'New all-time team record for that distance, category and sex.',
                    raceCount: 'Milestone count of races run with the team (e.g. 50th race).',
                    agegrade: 'The runner\'s best age grade ever with the team.',
                    birthday: 'Raced on their birthday.',
                    newLocation: 'First team race ever in that state or country.'
                },
                isTeamOrRelayResult: 'One result shared by several runners (relay or team event).'
            },
            highlights: highlights,
            races: races
        };
    }

    // ---------- Plain text ----------

    function buildText(raceInfosList) {
        var out = '';
        raceInfosList.forEach(function(raceinfo) {
            out += raceinfo.racename + ' -- ' + ymd(raceinfo.racedate) + '\n';
            raceinfo.results.forEach(function(result) {
                out += runnerNames(result) + ' ' + $filter('secondsToTimeString')(result.time);
                if (result.ranking && $filter('rankTooltipOneLine')(result.ranking) !== '') {
                    out += ' (' + $filter('rankTooltipOneLine')(result.ranking) + ')';
                }
                out += '\n';
            });
            out += '\n';
        });
        return out;
    }

    // ---------- Email HTML ----------

    function buildHtml(raceInfosList) {
        var html = '<table style="width:400px;border:1px;border-collapse: collapse;color:#646464;">';
        raceInfosList.forEach(function(raceinfo) {
            html += '<thead><tr style="color: #FA4D19; font-size: 18px;border-bottom-width: 1px;border-bottom-style: dashed;"><th style="text-align:center;" colspan="5">' + raceinfo.racename + ' - ' + ymd(raceinfo.racedate) + '</th></tr><tr style="color: #19c6fa; font-weight:bold"><th style="text-align:center;border-bottom: 1px solid #E6E6E6;font-size: 16px;" rowspan="2">Racer</th><th style="text-align:center;font-size: 14px;" colspan="3">Finish Place</th><th style="text-align:center;border-bottom: 1px solid #E6E6E6;font-size: 16px;" rowspan="2">Time</th></tr><tr style="border-bottom: 1px solid #E6E6E6;" ><th style="text-align:center;font-weight:normal;font-size:12px;">Age</th><th style="text-align:center;font-weight:normal;font-size:12px;">Gender</th><th style="text-align:center;font-weight:normal;font-size:12px;">Overall</th></tr></thead>';
            raceinfo.results.forEach(function(result) {
                html += '<tr><td style="font-weight:bold;">' + runnerNames(result) + '</td>' + $filter('rankTooltipTd')(result.ranking) + '<td style="text-align: center;"><span style="cursor:pointer;" title="pace: ' + $filter('resultToPace')(result, raceinfo) + '">' + $filter('secondsToTimeString')(result.time) + '</span></td></tr>';
            });
        });
        html += '</table><span style="color:#646464;font-size:12px;">See all results from the MCRRC racing team at <a href="http://raceteam.mcrrc.org" target="_blank">raceteam.mcrrc.org</a></span>';
        return html;
    }

    // ---------- Clipboard ----------

    function flash(key) {
        $scope.copied[key] = true;
        $timeout(function() { $scope.copied[key] = false; }, 1600);
    }

    function legacyCopy(text) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        document.body.removeChild(ta);
        return ok;
    }

    // html: also put it on the clipboard as rich text, so the rendered table
    // pastes as a table into an email
    $scope.copy = function(key, text, html) {
        if (!text) return;
        var nav = $window.navigator;
        var done = function() { $scope.$applyAsync(function() { flash(key); }); };
        var fail = function() {
            if (legacyCopy(text)) done();
            else NotificationService.showNotifiction(false, 'Could not copy to the clipboard');
        };
        if (html && nav.clipboard && $window.ClipboardItem) {
            nav.clipboard.write([new $window.ClipboardItem({
                'text/html': new Blob([html], { type: 'text/html' }),
                'text/plain': new Blob([text], { type: 'text/plain' })
            })]).then(done, fail);
        } else if (nav.clipboard && nav.clipboard.writeText) {
            nav.clipboard.writeText(text).then(done, fail);
        } else {
            fail();
        }
    };

    // The rendered table's text, for a plain-text paste of the rich copy
    $scope.copyRendered = function() {
        var el = document.querySelector('.report-rendered');
        $scope.copy('rendered', el ? el.innerText : $scope.reportHTLM, $scope.reportHTLM);
    };
}]);

angular.module('mcrrcApp.results').controller('TableReportController', ['$scope', '$stateParams', 'Analytics', '$filter', 'AuthService', 'ResultsService', function($scope, $stateParams, Analytics, $filter, AuthService, ResultsService) {

    if ($stateParams.from && $stateParams.to) {
        ResultsService.getResults({
            "filters": {
                "datefrom": $filter('date')($stateParams.from, "yyyy-MM-dd", 'UTC'),
                "dateto": $filter('date')($stateParams.to, "yyyy-MM-dd", 'UTC')
            },
            "sort": '-race.racedate -race.order race.racename time ranking.overallrank members.firstname '
        }).then(function(results) {
            $scope.reportHTLM = '<table style="width:400px;border:1px;border-collapse: collapse;color:#646464;">';

            var lastEvent = "";
            var lastDate = "";
            results.forEach(function(result) {
                var members = '';
                result.members.forEach(function(m) {
                    members += m.firstname + ' ' + m.lastname + ' & ';
                });
                members = members.slice(0, -3);
                if (result.race.racename !== lastEvent || result.race.racedate !== lastDate) {
                    if ($scope.reportHTLM !== '<table style="width:400px;border:1px;border-collapse: collapse;color:#646464;">') {
                        $scope.reportHTLM += '<tr style="height: 30px;"></tr>';
                    }
                    $scope.reportHTLM += '<thead><tr style="color: #FA4D19; font-size: 18px;border-bottom-width: 1px;border-bottom-style: dashed;"><th style="text-align:center;" colspan="5">' + result.race.racename + ' - ' + $filter('date')(result.race.racedate, "yyyy-MM-dd", 'UTC') + '</th></tr><tr style="color: #19c6fa; font-weight:bold"><th style="text-align:center;border-bottom: 1px solid #E6E6E6;font-size: 16px;" rowspan="2">Racer</th><th style="text-align:center;font-size: 14px;" colspan="3">Finish Place</th><th style="text-align:center;border-bottom: 1px solid #E6E6E6;font-size: 16px;" rowspan="2">Time</th></tr><tr style="border-bottom: 1px solid #E6E6E6;" ><th style="text-align:center;font-weight:normal;font-size:12px;">Age</th><th style="text-align:center;font-weight:normal;font-size:12px;">Gender</th><th style="text-align:center;font-weight:normal;font-size:12px;">Overall</th></tr></thead>';
                    $scope.reportHTLM += '<tr><td style="font-weight:bold;">' + members + '</td>' + $filter('rankTooltipTd')(result.ranking) + '<td style="text-align: center;"><span style="cursor:pointer;" title="pace: ' + $filter('resultToPace')(result) + '">' + $filter('secondsToTimeString')(result.time) + '</span></td></tr>';

                } else {

                    $scope.reportHTLM += '<tr><td style="font-weight:bold;">' + members + '</td>' + $filter('rankTooltipTd')(result.ranking) + '<td style="text-align: center;"><span style="cursor:pointer;" title="pace: ' + $filter('resultToPace')(result) + '">' + $filter('secondsToTimeString')(result.time) + '</span></td></tr>';

                }

                lastEvent = result.race.racename;
                lastDate = result.race.racedate;
            });
            $scope.reportHTLM += '</table><span style="color:#646464;font-size:12px;">See all results from the MCRRC racing team at <a href="http://raceteam.mcrrc.org" target="_blank">raceteam.mcrrc.org</a></span>';
        });
    }



}]);
