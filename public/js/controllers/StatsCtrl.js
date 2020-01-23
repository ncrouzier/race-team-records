angular.module('mcrrcApp.results').controller('StatsController', ['$scope', 'AuthService', 'ResultsService', 'MembersService','UtilsService', 'dialogs', function($scope, AuthService, ResultsService, MembersService, UtilsService, dialogs) {

    $scope.authService = AuthService;
    $scope.$watch('authService.isLoggedIn()', function(user) {
        $scope.user = user;
    });

    $scope.raceStats = {};
    $scope.raceStats.year = "All Time";

    $scope.miscStats = {};
    $scope.miscStats.year = "All Time";

    $scope.attendanceStats = {};
    $scope.attendanceStats.selectedAttendanceRaces = [];
    $scope.attendanceStats.year = "All Time";

    $scope.field = 'firstname';
    $scope.reverseSort = false;

    var currentYear = new Date().getFullYear();
    $scope.yearsList = ['All Time'];
    for (i = currentYear; i >= 2013; i--) {
        $scope.yearsList.push(i);
    }

    $scope.getMapStats = function() {

    };




    $scope.getRacesStats = function() {



        var fromDate = new Date(Date.UTC(2013, 0, 1)).getTime();
        var toDate = new Date().getTime();
        if ($scope.raceStats.year !== "All Time") {
            fromDate = new Date(Date.UTC($scope.raceStats.year, 0, 1)).getTime();
            toDate = new Date(Date.UTC($scope.raceStats.year + 1, 0, 1)).getTime();
        }

        ResultsService.getRacesInfos({
            "limit": 10,
            "sort": '-count',
            "filters": {
                "dateFrom": fromDate,
                "dateTo": toDate-1
            }
        }).then(function(races) {
            $scope.racesList = races;
        });
    };

    $scope.getMiscStats = function() {
        var fromDate = new Date(Date.UTC(2013, 0, 1)).getTime();
        var toDate = new Date().getTime();
        if ($scope.miscStats.year !== "All Time") {
            fromDate = new Date(Date.UTC($scope.miscStats.year, 0, 1)).getTime();
            toDate = new Date(Date.UTC($scope.miscStats.year + 1, 0, 1)).getTime();
        }
        ResultsService.getMilesRaced({
            "filters": {
                "dateFrom": fromDate,
                "dateTo": toDate-1
            }
        }).then(function(result) {
            $scope.miscStats.milesRaced = parseFloat(result.milesRaced).toFixed(2);
            $scope.miscStats.resultsCount = parseFloat(result.resultsCount);
        });
    };

    $scope.getAttendanceStats = function() {
        ResultsService.getRaces({
            sort: '-racedate'
        }).then(function(races) {
            $scope.attendanceRacesList = races;
        });


        MembersService.getMembers({
            // "filters[memberStatus]": "current",
            sort: 'firstname'
        }).then(function(members) {
            $scope.membersList = members;
        });
    };


    $scope.getAttendanceStatsByYear = function(){
        var fromDate = new Date(Date.UTC(2013, 0, 1)).getTime();
        var toDate = new Date().getTime();
        if ($scope.attendanceStats.year !== "All Time") {
            fromDate = new Date(Date.UTC($scope.attendanceStats.year, 0, 1)).getTime();
            toDate = new Date(Date.UTC($scope.attendanceStats.year + 1, 0, 1)).getTime();
        }

        ResultsService.getRaces({
            sort: '-racedate',
            "filters": {
                "dateFrom": fromDate,
                "dateTo": toDate-1
            }
        }).then(function(races) {
            if (races !== undefined && races.length >0){
                $scope.attendanceStats.selectedAttendanceRaces = [];
                $scope.attendanceStats.racedRaces = new Array($scope.membersList.length).fill(0);
                for (i =0;i<races.length;i++){
                    $scope.onSelectRace(races[i]);
                }
            }

        });


    };

    $scope.onSelectRace = function(item, model) {
        ResultsService.getResults({
                "sort": 'members.firstname',
                "filters": {
                    "raceid": item._id
                }
            }).then(function(results) {
                resultarray = [];
                numberOfRacer = new Array($scope.membersList.length).fill(0);
                if($scope.attendanceStats.selectedAttendanceRaces.length===0){
                    $scope.attendanceStats.racedRaces = new Array($scope.membersList.length).fill(0);
                }
                foundRunners = 0;
                for (i =0;i<$scope.membersList.length;i++){
                    found =false;
                    for (j =0;j<results.length;j++){
                        for(k=0;k<results[j].members.length;k++){

                            if($scope.membersList[i]._id === results[j].members[k]._id){
                                found = results[j];
                            }
                        }
                    }
                    if(found){
                        found.text = "y";
                        foundRunners++;
                        $scope.attendanceStats.racedRaces[i]++;
                        numberOfRacer[i]++;
                        resultarray.push(found);
                    }else{
                        found = {};
                        found.text = "n";
                        resultarray.push(found);
                    }
                }
                $scope.attendanceStats.selectedAttendanceRaces.push([item.racename,resultarray,foundRunners,numberOfRacer]);

            });
    };
    $scope.getRaceTypeClass = function(s) {
        if (s !== undefined) {
            return s.replace(/ /g, '') + '-col';
        }
    };

    $scope.removeRace = function(index){
        for (i =0;i<$scope.attendanceStats.selectedAttendanceRaces[index][3].length;i++){
            $scope.attendanceStats.racedRaces[i] = $scope.attendanceStats.racedRaces[i]-$scope.attendanceStats.selectedAttendanceRaces[index][3][i];
        }
        $scope.attendanceStats.selectedAttendanceRaces.splice(index, 1);
    };


    $scope.showRaceModal = function(raceinfo) {
        if (raceinfo) {
            ResultsService.showRaceModal(raceinfo).then(function() {});
        }
    };


    $scope.getRacesStats();
    $scope.getMiscStats();
    $scope.getAttendanceStats();




}]);
