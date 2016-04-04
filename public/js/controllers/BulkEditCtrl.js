angular.module('mcrrcApp.results').controller('BulkEditController', ['$scope', 'AuthService', 'ResultsService', 'MembersService', 'dialogs', function($scope, AuthService, ResultsService, MembersService, dialogs) {

    $scope.authService = AuthService;
    $scope.$watch('authService.isLoggedIn()', function(user) {
        $scope.user = user;
    });


    var defaultResult = {
        time: {
            hours:undefined,
            minutes:undefined,
            secondss:undefined,
            centiseconds:undefined
        },
        ranking: {
            agerank: undefined,
            agetotal: undefined,
            genderrank: undefined,
            gendertotal: undefined,
            overallrank: undefined,
            overalltotal: undefined
        },
        members: [{ }],
        race:{
            racedate:new Date() },
        comments: undefined,
        resultlink: undefined
    };

    
    $scope.timeDetails = [{
            hours:undefined,
            minutes:undefined,
            secondss:undefined,
            centiseconds:undefined
        }];

    $scope.results = []; 
    $scope.results.push(angular.copy(defaultResult));

    MembersService.getMembers({
        sort: 'firstname'
    }).then(function(members) {
        $scope.membersList = members;

    });

    ResultsService.getRaceTypes({
        sort: 'meters'
    }).then(function(racetypes) {
        $scope.racetypesList = racetypes;
    });
    

    $scope.addResultEntry = function(index){
        if (index >= 0 && index< $scope.results.length){
            var lastRes = $scope.results[index];
        $scope.results.push({
            time: {
                hours:undefined,
                minutes:undefined,
                secondss:undefined,
                centiseconds:undefined
            },
            ranking: {
                agerank: undefined,
                agetotal: lastRes.ranking.agetotal,
                genderrank: undefined,
                gendertotal: lastRes.ranking.gendertotal,
                overallrank: undefined,
                overalltotal: lastRes.ranking.overalltotal
            },
            members: [{ }],
            race:{
                racename:lastRes.race.racename,
                racedate:lastRes.race.racedate,
                racetype:lastRes.race.racetype,
            },
            comments: undefined,
            resultlink: undefined  
        });
        }
        
    };

    $scope.removeResultEntry = function(index){
        var lastRes = $scope.results[$scope.results.length -1];
        if (index >=0){
            $scope.results.splice(index, 1);
        }
    };


    $scope.saveResults = function(){
        var fct = function(value, index) {
                return [value];
        };

        for (index = 0; index< $scope.results.length; index ++){
            if ($scope.timeDetails[index].hours === null || $scope.timeDetails[index].hours === undefined || $scope.timeDetails[index].hours === "") $scope.timeDetails[index].hours = 0;
            if ($scope.timeDetails[index].minutes === null || $scope.timeDetails[index].minutes === undefined || $scope.timeDetails[index].minutes === "") $scope.timeDetails[index].minutes = 0;
            if ($scope.timeDetails[index].seconds === null || $scope.timeDetails[index].seconds === undefined || $scope.timeDetails[index].seconds === "") $scope.timeDetails[index].seconds = 0;
            if ($scope.timeDetails[index].centiseconds === null || $scope.timeDetails[index].centiseconds === undefined || $scope.timeDetails[index].centiseconds === "") $scope.timeDetails[index].centiseconds = 0;

            $scope.results[index].time = $scope.timeDetails[index].hours * 360000 + $scope.timeDetails[index].minutes * 6000 + $scope.timeDetails[index].seconds * 100 + $scope.timeDetails[index].centiseconds;

            var r = $scope.results[index].ranking;
            if ((r === null || r === undefined || r === "") || (r.agerank === null || r.agerank === undefined || r.agerank === "") && (r.agetotal === null || r.agetotal === undefined || r.agetotal === "") && (r.genderrank === null || r.genderrank === undefined || r.genderrank === "") && (r.gendertotal === null || r.gendertotal === undefined || r.gendertotal === "") && (r.overallrank === null || r.overallrank === undefined || r.overallrank === "") && (r.overalltotal === null || r.overalltotal === undefined || r.overalltotal === "")) {
                $scope.results[index].ranking = {};
            }

            var members = $.map($scope.results[index].members, fct);
            $scope.results[index].members = members;


            console.log($scope.results[index]);
        }

            
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

    $scope.opened = [];
    $scope.openDatePicker = function($event, index) {
        $event.preventDefault();
        $event.stopPropagation();

        for (i=0;i<$scope.opened.length;i++) {
            $scope.opened[i] = false;
        }
        $scope.opened[index] = true;
    };

}]);
