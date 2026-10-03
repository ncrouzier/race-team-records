angular.module('mcrrcApp.results').controller('ResultDetailController', ['$scope', '$state', '$stateParams', '$timeout', '$filter', 'AuthService', 'ResultsService', 'PageTitleService', function ($scope, $state, $stateParams, $timeout, $filter, AuthService, ResultsService, PageTitleService) {

    $scope.authService = AuthService;
    $scope.$watch('authService.isLoggedIn()', function (user) {
        $scope.user = user;
    });

    $scope.loading = true;
    $scope.notFound = false;
    $scope.result = null;
    $scope.race = null;
    $scope.stats = null;
    // Achievements earned by this run, fed to <achievement-feed>
    $scope.achievementEntries = [];
    // Histograms of the team's times at this distance, keyed 'all' and
    // 'gender'; distributionScope says which one the chart is showing.
    $scope.distributions = null;
    $scope.distributionScope = 'all';
    // Which populations the toggle can offer, built once the data lands
    $scope.distributionOptions = [];
    // The three placement bars, built from whichever rankings the result has
    $scope.placements = [];

    var distributionChart = null;

    // Colours match the rest of the site: the success green for overall
    // (the brand blue sat too close to the men's tint), the gender tints
    // (@male-color / @female-color, also used for the race page's dots), and
    // the warning orange for age group.
    var PLACEMENT_COLORS = {
        overall: '#43ac6a',
        Male: '#31708f',
        Female: '#8E3163',
        age: '#E99002'
    };

    // The histogram stays deliberately quiet so the highlighted bucket — the
    // only thing the chart is really saying — carries all the contrast.
    var DISTRIBUTION_BAR_COLOR = '#BFD9E2';
    var DISTRIBUTION_MARK_COLOR = '#E99002';

    $scope.getSurfaceClass = function (surfaceName) {
        if (!surfaceName) return '';
        return 'surface-' + surfaceName.toLowerCase().replace(/\s+/g, '-');
    };

    // "top 13.5%" — the share of the field this runner finished ahead of or
    // level with. Lower is better.
    function topPercent(rank, total) {
        if (!rank || !total) return null;
        return (rank / total) * 100;
    }

    // Share of the rest of the field this runner beat. Measured against the
    // other finishers rather than the whole field, so a win is 100% however
    // small the race — 1st of 20 is not "95%", there was nobody left to beat.
    function beatPercent(rank, total) {
        if (!rank || !total) return null;
        if (total <= 1) return 100;
        return ((total - rank) / (total - 1)) * 100;
    }

    // Both figures round away from flattering: 3rd of 429 beat 99.53% of the
    // field and must not display as "100%", which only a win earns.
    function formatBeat(rank, total) {
        var beat = beatPercent(rank, total);
        if (beat === null) return '';
        return (Math.floor(beat * 10) / 10).toFixed(1) + '%';
    }

    // Same idea the other way: top 0.699% rounds to "0.7%", never "0.6%".
    function formatTop(rank, total) {
        var top = topPercent(rank, total);
        if (top === null) return '';
        if (top < 0.1) return '<0.1%';
        return (Math.ceil(top * 10) / 10).toFixed(1) + '%';
    }

    function buildPlacements(result) {
        var ranking = result.ranking || {};
        var isFemale = result.members[0] && result.members[0].sex === 'Female';
        var rows = [
            { key: 'overall', label: 'Overall', rank: ranking.overallrank, total: ranking.overalltotal },
            { key: isFemale ? 'Female' : 'Male', label: isFemale ? 'Women' : 'Men', rank: ranking.genderrank, total: ranking.gendertotal },
            { key: 'age', label: 'Age group', rank: ranking.agerank, total: ranking.agetotal }
        ];

        return rows.filter(function (row) {
            return row.rank > 0 && row.total > 0;
        }).map(function (row) {
            var beat = beatPercent(row.rank, row.total);
            return {
                key: row.key,
                label: row.label,
                rank: row.rank,
                total: row.total,
                topText: formatTop(row.rank, row.total),
                beatText: formatBeat(row.rank, row.total),
                // The bar fills with the part of the field left behind, so a
                // win fills it completely and last place still shows a sliver.
                fillPercent: Math.max(2, beat),
                color: PLACEMENT_COLORS[row.key]
            };
        });
    }

    // The histogram currently on screen: this runner's times, their gender's,
    // or the whole team's
    $scope.currentDistribution = function () {
        if (!$scope.distributions) return null;
        return $scope.distributions[$scope.distributionScope];
    };

    $scope.showsDistributionToggle = function () {
        return $scope.distributionOptions.length > 1;
    };

    // Narrowest population first. A scope only appears when there were enough
    // results to bucket into a shape — a runner with three 10ks gets no
    // histogram of their own, and no button offering one.
    function buildDistributionOptions(result) {
        var options = [];
        if (!$scope.distributions) return options;

        var runner = result.members[0];
        if ($scope.distributions.member && runner) {
            options.push({ key: 'member', label: runner.firstname });
        }
        // A man's times and the team's are nearly the same set, so the gender
        // split is only worth a button for women.
        if ($scope.distributions.gender && $scope.stats && $scope.stats.sex === 'Female') {
            options.push({ key: 'gender', label: 'women' });
        }
        if ($scope.distributions.all) {
            options.push({ key: 'all', label: 'all members' });
        }
        return options;
    }

    function runnerName() {
        var runner = $scope.result && $scope.result.members[0];
        return runner ? runner.firstname + ' ' + runner.lastname : 'this runner';
    }

    // What the chart is showing, for the panel heading
    $scope.distributionHeading = function () {
        var distance = $scope.stats ? $scope.stats.distanceLabel : '';
        if ($scope.distributionScope === 'member') {
            return 'Every ' + distance + ' run by ' + runnerName();
        }
        if ($scope.distributionScope === 'gender') {
            return 'Every ' + distance + ' run by ' + $scope.genderLabel() + ' on the team';
        }
        return 'Every team ' + distance + ' ever run';
    };

    // The y axis counts whatever population is on screen, so it only says
    // "team" when the whole team is what is being counted — a runner's own
    // history is not team results.
    $scope.distributionCountLabel = function () {
        if ($scope.distributionScope !== 'member') {
            return 'Team results';
        }
        var runner = $scope.result && $scope.result.members[0];
        if (!runner || !runner.firstname) {
            return 'Results';
        }
        var name = runner.firstname;
        return name + (name.slice(-1).toLowerCase() === 's' ? "'" : "'s") + ' results';
    };

    // …and the same population spelled out for the caption under it
    $scope.distributionSubject = function () {
        var distance = $scope.stats ? $scope.stats.distanceLabel : '';
        if ($scope.distributionScope === 'member') {
            return 'every ' + distance + ' run by ' + runnerName();
        }
        if ($scope.distributionScope === 'gender') {
            return 'every ' + distance + ' run by ' + $scope.genderLabel() + ' on the team';
        }
        return 'every ' + distance + ' the team has recorded';
    };

    $scope.genderLabel = function () {
        return $scope.stats && $scope.stats.sex === 'Female' ? 'women' : 'men';
    };

    $scope.genderNoun = function () {
        return $scope.stats && $scope.stats.sex === 'Female' ? 'woman' : 'man';
    };

    // Share of the population on screen that this time beat
    // Measured against the other results and rounded down, the same way the
    // placement bars are: only the genuinely fastest run may read as 100%.
    $scope.fasterThanText = function () {
        var dist = $scope.currentDistribution();
        if (!dist || !dist.total) return '0%';
        return Math.floor(beatPercent(dist.rank, dist.total)) + '%';
    };

    $scope.setDistributionScope = function (scope) {
        if ($scope.distributionScope === scope || !$scope.distributions[scope]) return;
        $scope.distributionScope = scope;
        buildDistributionChart();
    };

    // Where this time sits among the team's times at the same distance
    function buildDistributionChart() {
        var canvas = document.getElementById('timeDistributionChart');
        var dist = $scope.currentDistribution();
        if (!canvas || !dist) return;

        if (distributionChart) {
            distributionChart.destroy();
            distributionChart = null;
        }

        var formatTime = $filter('secondsToTimeString');

        var labels = dist.buckets.map(function (bucket) {
            // The last bar collects everyone slower than the cutoff, so it is
            // an open-ended range rather than a point on the axis.
            if (bucket.overflow) {
                return '≥ ' + formatTime(bucket.start);
            }
            return formatTime(bucket.start);
        });

        // Everything is the muted team blue except the bucket this result
        // falls in, which takes the highlight colour.
        var colors = dist.buckets.map(function (bucket, i) {
            return i === dist.markIndex ? DISTRIBUTION_MARK_COLOR : DISTRIBUTION_BAR_COLOR;
        });

        distributionChart = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: $scope.distributionCountLabel(),
                    data: dist.buckets.map(function (bucket) { return bucket.count; }),
                    backgroundColor: colors,
                    borderWidth: 0,
                    // Touching bars, so it reads as a distribution rather than
                    // a set of separate categories.
                    categoryPercentage: 1,
                    barPercentage: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            title: function (items) {
                                var bucket = dist.buckets[items[0].dataIndex];
                                if (bucket.overflow) {
                                    return 'Slower than ' + formatTime(bucket.start);
                                }
                                return formatTime(bucket.start) + ' – ' + formatTime(bucket.end);
                            },
                            label: function (item) {
                                var bucket = dist.buckets[item.dataIndex];
                                var share = dist.total ? (bucket.count / dist.total) * 100 : 0;
                                var text = bucket.count + ' result' + (bucket.count === 1 ? '' : 's') +
                                    ' (' + share.toFixed(1) + '%)';
                                if (item.dataIndex === dist.markIndex) {
                                    return [text, 'This result: ' + formatTime(dist.markTime)];
                                }
                                return text;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Finish time'
                        },
                        ticks: {
                            autoSkip: true,
                            maxTicksLimit: 14,
                            maxRotation: 45
                        },
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: $scope.distributionCountLabel()
                        },
                        ticks: {
                            precision: 0
                        }
                    }
                }
            }
        });
    }

    $scope.goToRace = function () {
        if (!$scope.race) return;
        $state.go('/races', { raceId: $scope.race._id });
    };

    $scope.goToResults = function () {
        $state.go('/results');
    };

    function load() {
        var resultId = $stateParams.resultId;
        if (!resultId) {
            $scope.loading = false;
            $scope.notFound = true;
            return;
        }

        ResultsService.getResultDetail(resultId).then(function (detail) {
            $scope.loading = false;
            if (!detail || !detail.result) {
                $scope.notFound = true;
                return;
            }
            $scope.result = detail.result;
            $scope.race = detail.result.race;
            PageTitleService.set($scope, $filter('membersNamesFilter')(detail.result.members) + ' – ' +
                $scope.race.racename + ' (' + new Date($scope.race.racedate).getUTCFullYear() + ')');
            $scope.stats = detail.stats;
            $scope.distributions = detail.distributions || null;
            // Fall back to the whole team if the gender-scoped set was too
            // small to bucket.
            $scope.distributionScope =
                $scope.distributions && $scope.distributions[detail.defaultDistribution] ?
                    detail.defaultDistribution : 'all';
            $scope.distributionOptions = buildDistributionOptions(detail.result);
            $scope.placements = buildPlacements(detail.result);
            $scope.achievementEntries = (detail.result.achievements || []).map(function (achievement) {
                return angular.extend({}, achievement, { member: detail.result.members[0] });
            });

            // The canvas only exists once the view has rendered the result.
            $timeout(buildDistributionChart);
        });
    }

    $scope.$on('$destroy', function () {
        if (distributionChart) {
            distributionChart.destroy();
            distributionChart = null;
        }
    });

    load();

}]);
