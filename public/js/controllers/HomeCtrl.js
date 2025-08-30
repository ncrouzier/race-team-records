angular.module('mcrrcApp.results').controller('HomeController', ['$scope', 'AuthService', 'ResultsService', 'dialogs', 'MembersService', function($scope, AuthService, ResultsService, dialogs, MembersService) {

    $scope.authService = AuthService;
    $scope.$watch('authService.isLoggedIn()', function(user) {
        $scope.user = user;
    });

    $scope.expandedRaces = {};  // Object to track expanded races by ID

    ResultsService.getRaceResultsWithCacheSupport({
        "filters": {
            "dateFrom": (function() {
                // Calculate 31 days ago at UTC midnight for consistent cache keys
                var now = new Date();
                var thirtyOneDaysAgo = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);
                // Set to UTC midnight (00:00:00.000)
                thirtyOneDaysAgo.setUTCHours(0, 0, 0, 0);
                return thirtyOneDaysAgo.getTime();
            })()
        },
        "sort": '-racedate -order racename',
        "type": 'last30'
    }).then(function(races) {
        $scope.racesList = races;
        $scope.recentRaces = races.slice(0, 5);
        $scope.recentAchievementsRaces = races.slice(0, 25);
        // Gather recent achievements from the first 10 races
        $scope.recentAchievements = [];
        $scope.recentAchievementsRaces.forEach(function(race) {
            if (race.results && race.results.length > 0) {
                race.results.forEach(function(result) {
                    if (result.achievements && result.members.length === 1 && result.achievements.length > 0) { // don't deal with multi user races
                        $scope.recentAchievements.push({
                            race: race,
                            result: result,
                            achievements: result.achievements
                        });
                    }
                });
            }
        });
        //now load the whole thing unless the initial call return the cache version (>200 res). Usefull for other pages.
        if (races.length < 200){
            ResultsService.getRaceResultsWithCacheSupport({
                "sort": '-racedate -order racename',
                "preload":false
            }).then(function(races) {
                $scope.racesList = races;
            });
        }
    });

    // Fetch recent team member status changes (entry or exit)
    if (typeof MembersService !== 'undefined') {
        // Get all members with membershipDates
        MembersService.getMembersWithCacheSupport({
            sort: '-membershipDates.start',
            select: '-bio -personalBests',
        }).then(function(members) {
            var now = new Date();
            var thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            var statusChanges = [];
            members.forEach(function(member) {
                if (Array.isArray(member.membershipDates)) {
                    member.membershipDates.forEach(function(md) {
                        if (md.start) {
                            var startDate = new Date(md.start);
                            statusChanges.push({
                                member: member,
                                type: 'entry',
                                date: startDate
                            });
                        }
                        if (md.end) {
                            var endDate = new Date(md.end);
                            statusChanges.push({
                                member: member,
                                type: 'exit',
                                date: endDate
                            });
                        }
                    });
                }
            });
            // Sort by date descending
            statusChanges.sort(function(a, b) { return b.date - a.date; });
            // Find all changes in the last 30 days
            var last30Days = statusChanges.filter(function(sc) { return sc.date >= thirtyDaysAgo; });
            if (last30Days.length >= 5) {
                $scope.recentStatusChanges = last30Days;
            } else {
                $scope.recentStatusChanges = statusChanges.slice(0, 5);
            }
        });
    }

    $scope.expand = function(raceinfo) {
        if (raceinfo) {
            // Toggle the expanded state for this race
            $scope.expandedRaces[raceinfo._id] = !$scope.expandedRaces[raceinfo._id];
        }
    };

    $scope.showRaceModal = function(raceinfo) {
        if (raceinfo) {
            ResultsService.showRaceModal(raceinfo).then(function() {});           
        }
    };


    $scope.isRaceExpanded = function(raceId) {
        return $scope.expandedRaces[raceId] === true;
    };

    $scope.expandAll = function() {
        $scope.racesList.forEach(function(race) {
            $scope.expandedRaces[race._id] = true;
        });
    };

    $scope.collapseAll = function() {
        $scope.expandedRaces = {};
    };

    $scope.getRaceTypeClass = function(surface) {
        switch(surface) {
            case 'track': return 'tracksurface';
            case 'trail': return 'trailsurface';
            case 'road': return 'roadsurface';
            case 'ultra': return 'ultrasurface';
            case 'other': return 'othersurface';
            default: return '';
        }
    };

}]);
