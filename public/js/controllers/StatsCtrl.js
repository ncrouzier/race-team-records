angular.module('mcrrcApp.results').controller('StatsController', ['$scope', 'AuthService', 'ResultsService', 'MembersService','UtilsService', 'dialogs','$filter', function($scope, AuthService, ResultsService, MembersService, UtilsService, dialogs,$filter) {

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

    $scope.current = {memberStatus:"current"};
    $scope.past = {memberStatus:"past"};
    $scope.none = {};

    $scope.statusChoice =$scope.current;
    $scope.reverseSort = false; 
    $scope.reverseSortParticipation = false;

    var currentYear = new Date().getFullYear();
    $scope.yearsList = ['All Time'];
    for (i = currentYear; i >= 2013; i--) {
        $scope.yearsList.push(i);
    }

    $scope.participationStats = {};

    $scope.getMapStats = function() {

    };


    $scope.partdates = {};
    var start = new Date(Date.UTC(new Date().getFullYear(),0,1,0,0,0,0));
    // start.setFullYear(new Date().getFullYear(), 0, 1);
    // start.setHours(0, 0, 0, 0);
    var end = new Date(Date.UTC(new Date().getFullYear(),new Date().getMonth(),new Date().getDate(),0,0,0,0));
    // end.setUTCFullYear(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
    // end.setUTCHours(0, 0, 0, 0);    
    $scope.partdates.participationStatsStart =  start;
    $scope.partdates.participationStatsEnd = end;
    // make sure dates are always UTC
    // $scope.$watch('partdates.participationStatsStart ', function (date) {
    //     $scope.partdates.participationStatsStart = $filter('date')($scope.partdates.participationStatsStart, 'yyyy-MM-dd', 'UTC');
    // });
    // $scope.$watch('partdates.participationStatsEnd ', function (date) {
    //     $scope.partdates.participationStatsEnd = $filter('date')($scope.partdates.participationStatsEnd, 'yyyy-MM-dd', 'UTC');        
    // });

    $scope.participationStatsStartPicker = {};
    $scope.openParticipationStatsStartPicker = function($event) {
        $event.preventDefault();
        $event.stopPropagation();
        $scope.participationStatsStartPicker.opened = true;
    };

    
    $scope.participationStatsEndPicker = {};
    $scope.openParticipationStatsEndPicker = function($event) {
        $event.preventDefault();
        $event.stopPropagation();
        $scope.participationStatsEndPicker.opened = true;
    };
    
    $scope.selectDate= function () {
       $scope.getParticipationStats();
    };

    $scope.getParticipationStats = function () {
        MembersService.getParticipation({
            "startdate": new Date($scope.partdates.participationStatsStart).getTime(),
            "enddate": new Date($scope.partdates.participationStatsEnd).getTime()
        }).then(function (stats) {
            $scope.participationStats = stats;
        });
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
            $scope.miscStats.raceWon = parseInt(result.raceWon);
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
            sort: 'firstname',
            select: '-bio -personalBests',
        }).then(function(members) {
          var now = new Date();
          var nowUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),0,0,0);
          var nowUTCDate = new Date(nowUTC);
          members.forEach(function(m){
            var date = new Date($filter('date')(m.dateofbirth, 'yyyy-MM-dd', 'UTC'));
            var currentYear = new Date().getUTCFullYear();
            var birthdayDate =  new Date(Date.UTC(currentYear, date.getUTCMonth(), date.getUTCDate(),0,0,0));

             if (birthdayDate.getTime() < nowUTCDate.getTime()){
                 birthdayDate.setUTCFullYear(currentYear+1);
             }
             m.fromNow = birthdayDate.getTime() - nowUTCDate.getTime();
          });

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

    $scope.showRaceFromRaceIdModal = function(raceId) {
        if (raceId) {
            ResultsService.showRaceFromRaceIdModal(raceId).then(function() {});
        }
    };

    

    $scope.getRacesStats();
    $scope.getMiscStats();
    $scope.getAttendanceStats();
    $scope.getParticipationStats();
  



}]);
