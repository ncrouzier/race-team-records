// Stats page tab: who volunteered, where and doing what. Logged-in users only
// — the API refuses anyone else, and the tab is hidden from them.
angular.module('mcrrcApp.results').controller('VolunteerStatsController', ['$scope', '$timeout', 'AuthService', 'MembersService', function ($scope, $timeout, AuthService, MembersService) {

    var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    $scope.stats = null;
    $scope.loading = false;
    $scope.error = false;
    $scope.filter = { year: String(new Date().getFullYear()) };
    $scope.yearsList = ['All Time', String(new Date().getFullYear())];
    // Which volunteer rows are expanded to list their jobs, by member id
    $scope.expanded = {};
    // Events show the top few until asked for the rest
    $scope.LIST_LIMIT = 10;
    $scope.showAll = { events: false };

    var timelineChart = null;

    $scope.authService = AuthService;
    $scope.$watch('authService.isLoggedIn()', function (user) {
        var hadUser = !!$scope.user;
        $scope.user = user;
        // Load on arrival, and again if they log in while on the page
        if (user && (!hadUser || !$scope.stats)) {
            load();
        }
    });

    $scope.toggle = function (row) {
        var id = row.member._id;
        $scope.expanded[id] = !$scope.expanded[id];
    };

    $scope.yearLabel = function () {
        return $scope.filter.year === 'All Time' ? 'all time' : $scope.filter.year;
    };

    // Share of the current team that volunteered in the period
    $scope.currentShare = function () {
        var totals = $scope.stats && $scope.stats.totals;
        if (!totals || !totals.currentMembers) return 0;
        return Math.round(totals.currentVolunteers / totals.currentMembers * 100);
    };

    // Bar widths in the tables, relative to the busiest row
    $scope.barWidth = function (value, rows, field) {
        var max = (rows || []).reduce(function (m, row) { return Math.max(m, row[field]); }, 0);
        return max ? Math.max(4, value / max * 100) : 0;
    };

    $scope.changeYear = function () {
        load();
    };

    function load() {
        if (!$scope.user) return;
        $scope.loading = true;
        $scope.error = false;
        var year = $scope.filter.year === 'All Time' ? 'all' : $scope.filter.year;
        MembersService.getVolunteeringStats(year).then(function (stats) {
            $scope.stats = stats;
            $scope.expanded = {};
            $scope.showAll = { events: false };
            // Years with any jobs, plus the current one so a quiet January
            // still offers it
            var years = (stats.years || []).map(String);
            var thisYear = String(new Date().getFullYear());
            if (years.indexOf(thisYear) === -1) years.unshift(thisYear);
            $scope.yearsList = ['All Time'].concat(years);
            $scope.loading = false;
            // The canvas renders with the data
            $timeout(buildTimelineChart);
        }, function () {
            $scope.loading = false;
            $scope.error = true;
        });
    }

    function buildTimelineChart() {
        var canvas = document.getElementById('volunteerTimelineChart');
        if (!canvas || !$scope.stats) return;
        if (timelineChart) {
            timelineChart.destroy();
            timelineChart = null;
        }
        var byMonth = $scope.stats.year !== null;
        var timeline = $scope.stats.timeline || [];

        timelineChart = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: timeline.map(function (point) {
                    return byMonth ? MONTHS[point.label] : String(point.label);
                }),
                datasets: [{
                    label: 'Jobs',
                    data: timeline.map(function (point) { return point.jobs; }),
                    backgroundColor: '#008cba',
                    borderRadius: 3,
                    maxBarThickness: 36
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (item) {
                                return item.raw + ' job' + (item.raw === 1 ? '' : 's');
                            }
                        }
                    }
                },
                scales: {
                    x: { grid: { display: false } },
                    y: { beginAtZero: true, ticks: { precision: 0 } }
                }
            }
        });
    }

    $scope.$on('$destroy', function () {
        if (timelineChart) {
            timelineChart.destroy();
            timelineChart = null;
        }
    });
}]);
