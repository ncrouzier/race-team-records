angular.module('mcrrcApp.results').controller('ResultsController', ['$scope', '$analytics', 'AuthService', 'ResultsService', 'dialogs', 'localStorageService', function($scope, $analytics, AuthService, ResultsService, dialogs, localStorageService) {

    $scope.authService = AuthService;
    $scope.$watch('authService.isLoggedIn()', function(user) {
        $scope.user = user;
    });

    $scope.$watch('resultsTableProperties.pageSize', function(newVal, oldVal) {
        localStorageService.set('resultsPageSize', $scope.resultsTableProperties);
    });

    if (localStorageService.get('resultsPageSize')) {
        $scope.resultsTableProperties = localStorageService.get('resultsPageSize');
    } else {
        $scope.resultsTableProperties = {};
        $scope.resultsTableProperties.pageSize = 10;
    }

    $scope.resultSize = [5, 10, 25, 50, 100];
    $scope.resultsList = [];


    ResultsService.getResultsWithCacheSupport({
        "sort": '-race.racedate race.racename time'
    }).then(function(results) {
        $scope.resultsList = results;
    });




    $scope.showAddResultModal = function() {
        ResultsService.showAddResultModal().then(function(result) {
            if (result !== null) {
                $scope.resultsList.unshift(result);
            }
        }, function() {});
    };

    $scope.retrieveResultForEdit = function(result) {
        ResultsService.retrieveResultForEdit(result).then(function() {});
    };

    $scope.removeResult = function(result) {
        var dlg = dialogs.confirm("Remove Result?", "Are you sure you want to remove this result?");
        dlg.result.then(function(btn) {
            ResultsService.deleteResult(result).then(function() {
                var index = $scope.resultsList.indexOf(result);
                if (index > -1) $scope.resultsList.splice(index, 1);
            });
        }, function(btn) {});
    };

    $scope.showRaceModal = function(result) {
        ResultsService.showRaceFromResultModal(result).then(function(result) {});
    };


}]);

angular.module('mcrrcApp.results').controller('ResultModalInstanceController', ['$scope', '$uibModalInstance', '$filter', 'result', 'MembersService', 'ResultsService', 'localStorageService', function($scope, $uibModalInstance, $filter, result, MembersService, ResultsService, localStorageService) {


    $scope.autoconvert = true;
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


    // make sure dates are always UTC
    $scope.$watch('formData.race.racedate ', function(date) {
        $scope.formData.race.racedate = $filter('date')($scope.formData.race.racedate, 'yyyy-MM-dd', 'UTC');
    });


    $scope.editmode = false;
    if (result) {
        $scope.formData = result;
        $scope.editmode = true;
        $scope.formData.dateofbirth = new Date();
        $scope.nbOfMembers = result.members.length;
        $scope.time = {};

        $scope.time.hours = Math.floor(($scope.formData.time % 8640000) / 360000);
        $scope.time.minutes = Math.floor((($scope.formData.time % 8640000) % 360000) / 6000);
        $scope.time.seconds = Math.floor(((($scope.formData.time % 8640000) % 360000) % 6000) / 100);
        $scope.time.centiseconds = Math.floor(((($scope.formData.time % 8640000) % 360000) % 6000) % 100);


    } else {
        $scope.formData = {};
        $scope.formData.race.nameDistance = null;
        $scope.formData.race = localStorageService.get('race');
        $scope.formData.resultlink = localStorageService.get('resultLink');
        $scope.formData.ranking = {};
        $scope.formData.ranking.agetotal = localStorageService.get('agetotal');
        $scope.formData.ranking.gendertotal = localStorageService.get('gendertotal');
        $scope.formData.ranking.overalltotal = localStorageService.get('overalltotal');


        $scope.formData.members = [];
        $scope.formData.members[0] = {};
        $scope.nbOfMembers = 1;
        $scope.time = {};
        $scope.editmode = false;

    }



    $scope.addResult = function() {
        if ($scope.time.hours === null || $scope.time.hours === undefined || $scope.time.hours === "") $scope.time.hours = 0;
        if ($scope.time.minutes === null || $scope.time.minutes === undefined || $scope.time.minutes === "") $scope.time.minutes = 0;
        if ($scope.time.seconds === null || $scope.time.seconds === undefined || $scope.time.seconds === "") $scope.time.seconds = 0;
        if ($scope.time.centiseconds === null || $scope.time.centiseconds === undefined || $scope.time.centiseconds === "") $scope.time.centiseconds = 0;

        $scope.formData.time = $scope.time.hours * 360000 + $scope.time.minutes * 6000 + $scope.time.seconds * 100 + $scope.time.centiseconds;

        var r = $scope.formData.ranking;
        if ((r === null || r === undefined || r === "") || (r.agerank === null || r.agerank === undefined || r.agerank === "") && (r.agetotal === null || r.agetotal === undefined || r.agetotal === "") && (r.genderrank === null || r.genderrank === undefined || r.genderrank === "") && (r.gendertotal === null || r.gendertotal === undefined || r.gendertotal === "") && (r.overallrank === null || r.overallrank === undefined || r.overallrank === "") && (r.overalltotal === null || r.overalltotal === undefined || r.overalltotal === "")) {
            $scope.formData.ranking = {};
        }

        var members = $.map($scope.formData.members, function(value, index) {
            return [value];
        });
        $scope.formData.members = members;

        //save race related info for futur addition
        localStorageService.set('race', $scope.formData.race);
        // localStorageService.set('raceDate', $filter('date')($scope.formData.racedate, "yyyy-MM-dd"));
        // localStorageService.set('raceType', $scope.formData.racetype);
        localStorageService.set('resultLink', $scope.formData.resultlink);
        localStorageService.set('agetotal', $scope.formData.ranking.agetotal);
        localStorageService.set('gendertotal', $scope.formData.ranking.gendertotal);
        localStorageService.set('overalltotal', $scope.formData.ranking.overalltotal);

        if ($scope.formData.race.racetype.isVariable === false){
            $scope.formData.race.distanceName = undefined;
        }

        $uibModalInstance.close($scope.formData);
    };

    $scope.clearForm = function() {
        $scope.formData = {};
        $scope.formData.members = [{}];
        $scope.nbOfMembers = 1;
        localStorageService.remove('race');
        localStorageService.remove('resultLink');
        localStorageService.remove('agetotal');
        localStorageService.remove('gendertotal');
        localStorageService.remove('overalltotal');

    };

    $scope.editResult = function() {
        if ($scope.time.hours === null || $scope.time.hours === undefined || $scope.time.hours === "") $scope.time.hours = 0;
        if ($scope.time.minutes === null || $scope.time.minutes === undefined || $scope.time.minutes === "") $scope.time.minutes = 0;
        if ($scope.time.seconds === null || $scope.time.seconds === undefined || $scope.time.seconds === "") $scope.time.seconds = 0;
        if ($scope.time.centiseconds === null || $scope.time.centiseconds === undefined || $scope.time.centiseconds === "") $scope.time.centiseconds = 0;

        $scope.formData.time = $scope.time.hours * 360000 + $scope.time.minutes * 6000 + $scope.time.seconds * 100 + $scope.time.centiseconds;
        var r = $scope.formData.ranking;
        if ((r === null || r === undefined || r === "") || (r.agerank === null || r.agerank === undefined || r.agerank === "") && (r.agetotal === null || r.agetotal === undefined || r.agetotal === "") && (r.genderrank === null || r.genderrank === undefined || r.genderrank === "") && (r.gendertotal === null || r.gendertotal === undefined || r.gendertotal === "") && (r.overallrank === null || r.overallrank === undefined || r.overallrank === "") && (r.overalltotal === null || r.overalltotal === undefined || r.overalltotal === "")) {
            $scope.formData.ranking = undefined;
        }

        if ($scope.formData.race.racetype.isVariable === false){
            console.log("in");
            $scope.formData.race.distanceName = undefined;
        }

        $uibModalInstance.close($scope.formData);
    };

    $scope.cancel = function() {
        $uibModalInstance.dismiss('cancel');
    };

    $scope.addNbMembers = function() {
        $scope.nbOfMembers = $scope.formData.members.length + 1;
        $scope.updateNbMembers();
    };

    $scope.updateNbMembers = function() {
        var num = $scope.nbOfMembers;
        var size = $scope.formData.members.length;
        if (num > size) {
            for (i = 0; i < num - size; i++) {
                $scope.formData.members.push({});
            }
        } else {
            $scope.formData.members.splice($scope.nbOfMembers, size - $scope.nbOfMembers);
        }
    };

    $scope.checkMembers = function() {
        var res = true;
        $scope.formData.members.forEach(function(m) {
            if (m._id === undefined) {
                res = false;
            }
        });
        return res;
    };

    $scope.getRaceTypeClass = function(s) {
        if (s !== undefined) {
            return s.replace(/ /g, '') + '-col';
        }
    };

    $scope.onMetersChange = function() {
        if ($scope.autoconvert) {
            $scope.formData.race.racetype.miles = parseFloat($scope.formData.race.racetype.meters) * 0.000621371;
        }
    };

    $scope.onMilesChange = function() {
        if ($scope.autoconvert) {
            $scope.formData.race.racetype.meters = parseFloat($scope.formData.race.racetype.miles) * 1609.3440;
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

    $scope.open = function($event) {
        $event.preventDefault();
        $event.stopPropagation();

        $scope.opened = true;
    };


}]);


angular.module('mcrrcApp.results').controller('RaceModalInstanceController', ['$scope', '$uibModalInstance', '$filter', 'race', 'MembersService', 'ResultsService', 'localStorageService', function($scope, $uibModalInstance, $filter, race, MembersService, ResultsService, localStorageService) {

    $scope.race = race;
    var sum = 0;
    var count = 0;
    for (i = 0; i < $scope.race.results.length; i++) {
        if ($scope.race.results[i].time !== 'undefined') {
            sum += $scope.race.results[i].time;
            count++;
        }
    }
    if (count !== 0) {
        $scope.avg = Math.ceil(sum / count);
    }

    $scope.cancel = function() {
        $uibModalInstance.dismiss('cancel');
    };

    $scope.getRaceTypeClass = function(s) {
        if (s !== undefined) {
            return s.replace(/ /g, '') + '-col';
        }
    };
}]);
