angular.module('mcrrcApp.results').controller('RaceDetailController', ['$scope', '$state', '$stateParams', '$timeout', '$filter', 'AuthService', 'ResultsService', 'UtilsService', 'PageTitleService', 'VolunteerJobsService', 'dialogs', 'Analytics', function ($scope, $state, $stateParams, $timeout, $filter, AuthService, ResultsService, UtilsService, PageTitleService, VolunteerJobsService, dialogs, Analytics) {

    $scope.authService = AuthService;
    $scope.$watch('authService.isLoggedIn()', function (user) {
        $scope.user = user;
        // Volunteer jobs are for logged-in eyes only, so they load (or clear)
        // as the login state settles or changes
        loadVolunteerJobs();
    });

    $scope.loading = true;
    $scope.notFound = false;
    $scope.raceinfo = null;
    $scope.avg = null;
    $scope.fastestMaleResult = null;
    $scope.fastestFemaleResult = null;
    $scope.bestAgeGradeResult = null;
    // Podiums, personal bests and top finishes the team took in this race
    $scope.highlights = null;
    // Every achievement earned here, flattened for <achievement-feed>
    $scope.achievementEntries = [];
    // Volunteer jobs linked to this race; empty for logged-out visitors
    $scope.volunteerJobs = [];

    $scope.genderFilter = null;
    $scope.sortCriteria = 'time';
    $scope.sortDirection = true;

    var timesChart = null;

    // The gender tints used across the site
    var GENDER_COLORS = {
        Male: '#31708f',
        Female: '#8E3163',
        Unknown: '#6f6f6f'
    };

    $scope.getSurfaceClass = function (surfaceName) {
        if (!surfaceName) return '';
        return 'surface-' + surfaceName.toLowerCase().replace(/\s+/g, '-');
    };

    $scope.getStateFlag = function (stateCode) {
        return UtilsService.getStateFlag(stateCode);
    };

    $scope.getCountryFlag = function (countryCode) {
        return UtilsService.getCountryFlag(countryCode);
    };

    // Photo albums shown as links in the meta line; blank entries left over
    // from the edit form are skipped, as the <race-photos> icon does.
    $scope.getPhotoLinks = function () {
        if (!$scope.raceinfo || !angular.isArray($scope.raceinfo.photoLinks)) return [];
        return $scope.raceinfo.photoLinks.filter(function (link) {
            return link.url && link.url.trim() !== '';
        });
    };

    // A result's gender comes from its runner; relay entries take the first.
    function sexOf(result) {
        var member = result.members && result.members[0];
        return member && member.sex ? member.sex : 'Unknown';
    }

    function countAchievement(results, name) {
        return results.reduce(function (count, result) {
            if (!angular.isArray(result.achievements)) return count;
            return count + result.achievements.filter(function (achievement) {
                return achievement.name && achievement.name.toLowerCase() === name;
            }).length;
        }, 0);
    }

    // Summary figures across the team's entries in this race
    function summarise(results) {
        var sum = 0;
        var count = 0;
        var fastest = { Male: Infinity, Female: Infinity };
        var bestAgeGrade = 0;

        $scope.fastestMaleResult = null;
        $scope.fastestFemaleResult = null;
        $scope.bestAgeGradeResult = null;

        results.forEach(function (result) {
            if (result.time) {
                sum += result.time;
                count++;

                var sex = sexOf(result);
                if (result.time < fastest[sex]) {
                    fastest[sex] = result.time;
                    if (sex === 'Female') {
                        $scope.fastestFemaleResult = result;
                    } else if (sex === 'Male') {
                        $scope.fastestMaleResult = result;
                    }
                }
            }
            if (result.agegrade && result.agegrade > bestAgeGrade) {
                bestAgeGrade = result.agegrade;
                $scope.bestAgeGradeResult = result;
            }
        });

        // Rounded to the second — an average of several runners carrying
        // hundredths reads like false precision.
        $scope.avg = count ? Math.round(sum / count / 100) * 100 : null;

        $scope.highlights = buildHighlights(results);
        $scope.achievementEntries = buildAchievementEntries(results);
    }

    // One row per achievement, in finish order, each carrying the runner who
    // earned it so the feed can attribute the ones whose text does not.
    function buildAchievementEntries(results) {
        var entries = [];
        // Race-level achievements first — "First team race in CAN!" belongs to
        // the day rather than to any one runner.
        ($scope.raceinfo.achievements || []).forEach(function (achievement) {
            entries.push(angular.extend({}, achievement));
        });
        results.forEach(function (result) {
            (result.achievements || []).forEach(function (achievement) {
                entries.push(angular.extend({}, achievement, { member: result.members[0] }));
            });
        });
        return entries;
    }

    // Everything worth calling out about the team's day, counted from the
    // rankings and achievements already stored on each result.
    function buildHighlights(results) {
        var onPodium = function (rank) {
            return rank >= 1 && rank <= 3;
        };

        var ranked = results.filter(function (result) {
            return result.ranking && result.ranking.overallrank > 0 && result.ranking.overalltotal > 0;
        });

        return {
            overallPodiums: results.filter(function (r) {
                return r.ranking && onPodium(r.ranking.overallrank);
            }).length,
            genderPodiums: results.filter(function (r) {
                return r.ranking && onPodium(r.ranking.genderrank);
            }).length,
            agePodiums: results.filter(function (r) {
                return r.ranking && onPodium(r.ranking.agerank);
            }).length,
            // Top tenth of the whole field, not just of the team
            topTenPercent: ranked.filter(function (r) {
                return r.ranking.overallrank / r.ranking.overalltotal <= 0.1;
            }).length,
            rankedCount: ranked.length,
            personalBests: countAchievement(results, 'pb'),
            teamRecords: countAchievement(results, 'teamrecord')
        };
    }

    $scope.hasHighlights = function () {
        var h = $scope.highlights;
        return !!(h && (h.overallPodiums || h.genderPodiums || h.agePodiums ||
            h.topTenPercent || h.personalBests || h.teamRecords));
    };

    // Every team finish time as a dot on one axis. Dots that would overlap
    // are stacked upwards rather than hidden behind each other, so a tight
    // pack reads as a tall column instead of a single dot.
    function layOutDots(results) {
        var sorted = results.slice().sort(function (a, b) { return a.time - b.time; });
        var span = sorted[sorted.length - 1].time - sorted[0].time;
        // Dots within this much of each other collide; with everyone on the
        // same time it is a flat span, so fall back to stacking them all.
        var threshold = span > 0 ? span / 30 : Infinity;
        var lastAtLevel = [];

        return sorted.map(function (result) {
            var level = 0;
            while (lastAtLevel[level] !== undefined && result.time - lastAtLevel[level] < threshold) {
                level++;
            }
            lastAtLevel[level] = result.time;
            return { x: result.time, y: level, result: result };
        });
    }

    // Room for the legend and the time axis, plus a band per stacked level.
    // Dots carrying initials are wider than plain dots were, so a crowded
    // race needs the strip to grow rather than overlap them.
    function stripHeightFor(maxLevel) {
        return Math.min(340, 95 + (maxLevel + 1) * 26);
    }

    // First + last initial of the dot's own runner — relay legs and
    // multisport entries still show one name in the tooltip, so the dot only
    // needs to identify the entry, not every member on it.
    function initialsOf(result) {
        var member = result.members && result.members[0];
        if (!member) return '';
        var first = (member.firstname || '').charAt(0);
        var last = (member.lastname || '').charAt(0);
        return (first + last).toUpperCase();
    }

    // Draws each racer's initials centered on their own dot. A Chart.js
    // plugin local to this chart instance, rather than a registered global
    // one, so it has no effect on the other charts on the page.
    var pointInitialsPlugin = {
        id: 'pointInitials',
        afterDatasetsDraw: function (chart) {
            var ctx = chart.ctx;
            chart.data.datasets.forEach(function (dataset, datasetIndex) {
                var meta = chart.getDatasetMeta(datasetIndex);
                if (meta.hidden) return;
                meta.data.forEach(function (element, index) {
                    var text = initialsOf(dataset.data[index].result);
                    if (!text) return;
                    ctx.save();
                    ctx.font = 'bold 9px sans-serif';
                    ctx.fillStyle = '#fff';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(text, element.x, element.y + 0.5);
                    ctx.restore();
                });
            });
        }
    };

    function buildTimesChart() {
        var canvas = document.getElementById('raceTimesChart');
        if (!canvas || !$scope.raceinfo) return;

        var results = $scope.raceinfo.results.filter(function (result) {
            return result.time > 0;
        });
        if (results.length < 2) return;

        if (timesChart) {
            timesChart.destroy();
            timesChart = null;
        }

        var formatTime = $filter('secondsToTimeString');
        var points = layOutDots(results);
        var maxLevel = points.reduce(function (max, p) { return Math.max(max, p.y); }, 0);

        // Sized before the chart is created, so Chart.js picks it up from the
        // parent on first layout.
        var container = canvas.parentElement;
        if (container) {
            container.style.height = stripHeightFor(maxLevel) + 'px';
        }

        // Chart.js would round the axis out to tidy tick values and leave the
        // team stranded in the middle of a mostly empty strip. Pin it to the
        // times actually run, with just enough padding that the outermost
        // dots are not clipped by the edge. points comes back sorted.
        var fastest = points[0].x;
        var slowest = points[points.length - 1].x;
        // 10s floor keeps the axis sane when everyone ran the same time
        var pad = Math.max((slowest - fastest) * 0.04, 1000);
        // Ends land on whole 10 seconds, so the axis does not label itself
        // with the hundredths off someone's chip time
        var axisMin = Math.floor((fastest - pad) / 1000) * 1000;
        var axisMax = Math.ceil((slowest + pad) / 1000) * 1000;

        // One dataset per gender present, so the legend doubles as a key
        var datasets = ['Female', 'Male', 'Unknown'].map(function (sex) {
            var forSex = points.filter(function (p) { return sexOf(p.result) === sex; });
            if (!forSex.length) return null;
            return {
                label: sex === 'Female' ? 'Women' : (sex === 'Male' ? 'Men' : 'Unspecified'),
                data: forSex,
                backgroundColor: GENDER_COLORS[sex],
                borderColor: '#fff',
                borderWidth: 1.5,
                // Sized to fit two initials rather than the plain 8px dot
                pointRadius: 10,
                pointHoverRadius: 12
            };
        }).filter(Boolean);

        timesChart = new Chart(canvas.getContext('2d'), {
            type: 'scatter',
            data: { datasets: datasets },
            plugins: [pointInitialsPlugin],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                onHover: function (event, elements) {
                    event.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
                },
                onClick: function (event, elements) {
                    if (!elements.length) return;
                    var element = elements[0];
                    var point = datasets[element.datasetIndex].data[element.index];
                    $scope.$apply(function () {
                        $state.go('/results/result', { resultId: point.result._id });
                    });
                },
                plugins: {
                    legend: {
                        position: 'top',
                        // Dots in the legend, matching the dots on the strip
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        displayColors: false,
                        callbacks: {
                            title: function (items) {
                                var result = items[0].raw.result;
                                return $filter('membersNamesFilter')(result.members);
                            },
                            label: function (item) {
                                var result = item.raw.result;
                                var lines = [formatTime(result.time)];
                                if (!$scope.raceinfo.isMultisport) {
                                    lines.push($filter('resultToPace')(result, $scope.raceinfo) + ' min/mi');
                                }
                                if (result.agegrade) {
                                    lines.push('Age grade ' + result.agegrade + '%');
                                }
                                if (result.ranking && result.ranking.overallrank) {
                                    lines.push(result.ranking.overallrank + ' of ' +
                                        result.ranking.overalltotal + ' overall');
                                }
                                return lines;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        min: axisMin,
                        max: axisMax,
                        title: {
                            display: true,
                            text: 'Finish time'
                        },
                        ticks: {
                            autoSkip: true,
                            maxTicksLimit: 10,
                            callback: function (value) {
                                // Whole seconds only — a tick reading
                                // "58:20.33" is noise on a time axis
                                return formatTime(Math.round(value / 100) * 100);
                            }
                        },
                        grid: {
                            color: '#f0f0f0'
                        }
                    },
                    y: {
                        display: false,
                        min: -0.6,
                        max: maxLevel + 0.6
                    }
                }
            }
        });
    }

    $scope.setGenderFilter = function (gender) {
        $scope.genderFilter = gender;
    };

    $scope.getFilteredResults = function () {
        if (!$scope.raceinfo) return [];
        if (!$scope.genderFilter) {
            return $scope.raceinfo.results;
        }
        return $scope.raceinfo.results.filter(function (result) {
            return result.members && result.members.some(function (member) {
                return member.sex === $scope.genderFilter;
            });
        });
    };

    // Everyone here ran the same distance, so pace and time are the same
    // order — only time and age grade are worth sorting on.
    function compareResults(field, ascending) {
        return function (a, b) {
            var left = field === 'agegrade' ? a.agegrade : a.time;
            var right = field === 'agegrade' ? b.agegrade : b.time;

            // Results with nothing to compare go last whichever way it is sorted
            if (left === undefined || left === null) return 1;
            if (right === undefined || right === null) return -1;

            if (left < right) return ascending ? -1 : 1;
            if (left > right) return ascending ? 1 : -1;
            return 0;
        };
    }

    $scope.sortBy = function (criteria) {
        if ($scope.sortCriteria === criteria) {
            $scope.sortDirection = !$scope.sortDirection;
        } else {
            $scope.sortCriteria = criteria;
            // Fastest first for times, best first for age grades
            $scope.sortDirection = criteria !== 'agegrade';
        }
        $scope.raceinfo.results.sort(compareResults($scope.sortCriteria, $scope.sortDirection));
    };

    $scope.isMyResult = function (result) {
        return !!($scope.user && $scope.user.member && $scope.user.member._id &&
            result.members && result.members.some(function (member) {
                return member._id === $scope.user.member._id;
            }));
    };

    // Clicking anywhere on a result row opens that result's own page; the
    // runner's name inside it still goes to the member, so it stops the click
    // from reaching here.
    $scope.goToResult = function (result) {
        if (result && result._id) {
            Analytics.event('select_content', { content_type: 'result', item_id: result._id, source: 'race_page_row' });
            $state.go('/results/result', { resultId: result._id });
        }
    };

    $scope.showResultDetailsModal = function (result) {
        ResultsService.showResultDetailsModal(result, $scope.raceinfo).then(function () { });
    };

    // Saving can move a result's rankings, achievements and the race's own
    // figures, so the page reloads rather than patching the one row.
    $scope.editResult = function (result) {
        if (!$scope.user || $scope.user.role !== 'admin') return;
        ResultsService.retrieveResultForEdit(result).then(function (saved) {
            if (saved) {
                load({ fresh: true });
            }
        }, angular.noop);
    };

    // A new result for this race: the form opens with the race's shared
    // details (race, date, location, type, result link, field size) filled
    // in from one of its results, leaving the runner, time and places.
    // "Save and add another" keeps the modal open, so the page reloads once
    // it closes, however it closes, if anything was added.
    $scope.addResult = function () {
        if (!$scope.user || $scope.user.role !== 'admin') return;
        var results = $scope.raceinfo && $scope.raceinfo.results;
        if (!results || !results.length) return;
        var added = false;
        var onCreated = function (saved) {
            if (saved) added = true;
        };
        var reloadIfAdded = function () {
            if (added) load({ fresh: true });
        };
        ResultsService.showAddResultModal(results[0], onCreated).then(function (saved) {
            onCreated(saved);
            reloadIfAdded();
        }, reloadIfAdded);
    };

    // Like editing, deleting can move other results' rankings and the race's
    // figures, so the page reloads. The server drops a race left with no
    // results, so deleting the last one leaves for the results list.
    $scope.deleteResult = function (result) {
        if (!$scope.user || $scope.user.role !== 'admin') return;
        var names = (result.members || []).map(function (m) {
            return m.firstname + ' ' + m.lastname;
        }).join(', ');
        var dlg = dialogs.confirm('Delete result?',
            'Delete ' + (names || 'this result') + "'s result at " + $scope.raceinfo.racename + '? This cannot be undone.');
        dlg.result.then(function () {
            var wasLast = $scope.raceinfo.results.length === 1;
            ResultsService.deleteResult(result).then(function () {
                if (wasLast) {
                    $state.go('/results');
                } else {
                    load({ fresh: true });
                }
            });
        }, angular.noop);
    };

    $scope.editRace = function () {
        if (!$scope.user || $scope.user.role !== 'admin') return;
        ResultsService.showEditRaceModal($scope.raceinfo).then(function (updatedRace) {
            if (updatedRace) {
                $scope.raceinfo = updatedRace;
            }
        });
    };

    function loadVolunteerJobs() {
        if (!$scope.user || !$scope.raceinfo) {
            $scope.volunteerJobs = [];
            return;
        }
        var raceId = $scope.raceinfo._id;
        VolunteerJobsService.getRaceVolunteerJobs(raceId).then(function (jobs) {
            // Ignore a late answer for a race we have since left
            if ($scope.raceinfo && $scope.raceinfo._id === raceId) {
                $scope.volunteerJobs = jobs || [];
            }
        });
    }

    $scope.volunteerCount = function () {
        var ids = {};
        $scope.volunteerJobs.forEach(function (job) {
            if (job.member) ids[job.member._id] = true;
        });
        return Object.keys(ids).length;
    };

    $scope.goToResults = function () {
        $state.go('/results');
    };

    function load(options) {
        var raceId = $stateParams.raceId;
        if (!raceId) {
            $scope.loading = false;
            $scope.notFound = true;
            return;
        }

        ResultsService.getRaceInfoById(raceId, options).then(function (raceinfo) {
            $scope.loading = false;
            if (!raceinfo) {
                $scope.notFound = true;
                return;
            }
            raceinfo.results = raceinfo.results || [];
            $scope.raceinfo = raceinfo;
            summarise(raceinfo.results);
            loadVolunteerJobs();
            // The year tells apart the same race run in different years
            PageTitleService.set($scope, raceinfo.racename + ' (' + new Date(raceinfo.racedate).getUTCFullYear() + ')');

            // The canvas only exists once the view has rendered the race.
            $timeout(buildTimesChart);
        });
    }

    $scope.$on('$destroy', function () {
        if (timesChart) {
            timesChart.destroy();
            timesChart = null;
        }
    });

    load();

}]);
