angular.module('mcrrcApp.results').controller('ResultsController', ['$scope', '$analytics', 'AuthService', 'ResultsService', 'dialogs', 'localStorageService','$stateParams','$location', function($scope, $analytics, AuthService, ResultsService, dialogs, localStorageService,$stateParams,$location) {
    
    //  console.log("params",$stateParams);

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


    $scope.sortBy = function (criteria) {
        if ($scope.sortCriteria === criteria) {
            $scope.sortDirection = $scope.sortDirection === true ? false : true;
        } else {
            $scope.sortCriteria = criteria;
            $scope.sortDirection = true;
        }
        //sortDirection true = asc, false = desc
        $scope.resultsList.sort(customResultSort($scope.resultsList, $scope.sortCriteria, $scope.sortDirection));
    };

    function customResultSort(arr, field, order) {
        return (result1, result2) => {
            if (field === 'race.racedate') {
                if (result1.race.racedate < result2.race.racedate) {
                    return order === true ? -1 : 1;
                } else if (result1.race.racedate > result2.race.racedate) {
                    return order === true ? 1 : -1;
                }

                if (result1.race.order < result2.race.order) {
                    return order === true ? -1 : 1;
                } else if (result1.race.order > result2.race.order) {
                    return order === true ? 1 : -1;
                }

                if (result1.race.racename < result2.race.racename) {
                    return order === true ? -1 : 1;
                } else if (result1.race.racename > result2.race.racename) {
                    return order === true ? 1 : -1;
                }

                if (result1.time < result2.time) {
                    return order === true ? -1 : 1;
                } else if (result1.time > result2.time) {
                    return order === true ? 1 : -1;
                }
                
                return 0;
            }

            if (field === 'pace') {
                //if result is multisport, put at the end
                if (result1.race.isMultisport) {
                    return 1;
                }
                if (result2.race.isMultisport) {
                    return -1;
                }
                if (result1.time / result1.race.racetype.miles < result2.time / result2.race.racetype.miles) {
                    return order === true ? -1 : 1;
                } else if (result1.time / result1.race.racetype.miles > result2.time / result2.race.racetype.miles) {
                    return order === true ? 1 : -1;
                }
                return 0;
            }

            if (field === 'time') {
                if (result1.time < result2.time) {
                    return order === true ? -1 : 1;
                } else if (result1.time > result2.time) {
                    return order === true ? 1 : -1;
                }
                return 0;
            }

            if (field === 'agegrade') {
                //if result has no agegrade, put at the end    
                if (result1.agegrade === undefined) {
                    return 1;
                }
                if (result2.agegrade === undefined) {
                    return -1;
                }
                if (result1.agegrade < result2.agegrade) {
                    return order === true ? -1 : 1;
                } else if (result1.agegrade > result2.agegrade) {
                    return order === true ? 1 : -1;
                }
                return 0;
            }
        };
    }

    $scope.resultSize = [5, 10, 25, 50, 100];    

    $scope.resultsList = [];
    ResultsService.getResultsWithCacheSupport({
        "sort": '-race.racedate -race.order race.racename time members.firstname',
        "limit": 200,
        "preload":true
    }).then(function(results) {
        $scope.resultsList = results;
        //now load the whole thing unless the initial call return the cache version (>200 res)
        if (results.length == 200){
            ResultsService.getResultsWithCacheSupport({
                "sort": '-race.racedate -race.order race.racename time members.firstname',
                "preload":false
            }).then(function(results) {
                $scope.resultsList = results;
            });
        }    
        
    }); 
    

    $scope.showAddResultModal = function(resultSource) {
        ResultsService.showAddResultModal(resultSource,$scope.resultsList).then(function(result) {
            if (result !== null) {
                $scope.resultsList.unshift(result);
            }
        }, function() {});
    };

    $scope.retrieveResultForEdit =  function(resultSource) {
        ResultsService.retrieveResultForEdit(resultSource).then(function(result) {
            if (result !== null) {
                $scope.resultsList[$scope.findResultIndexById(resultSource._id)] = result;
            }
        });            
    };

    $scope.findResultIndexById = (id) => $scope.resultsList.findIndex(result => result._id === id);



    $scope.removeResult = function(result) {
        var dlg = dialogs.confirm("Remove Result?", "Are you sure you want to remove this result?");
        dlg.result.then(function(btn) {
            ResultsService.deleteResult(result).then(function() {
                var index = $scope.resultsList.indexOf(result);
                if (index > -1) $scope.resultsList.splice(index, 1);
            });
        }, function(btn) {});
    };

    $scope.showRaceModal = function(race,fromStateParams) {
        if(race){
            ResultsService.showRaceFromResultModal(race._id,fromStateParams).then(function(result) {                
            });
        }
    };


    $scope.showResultDetailsModal = function(result) {
        ResultsService.showResultDetailsModal(result).then(function(result) {});
    };

    // $scope.getResultIcon = function(result){
    //   return result.customOptions[result.customOptions.findIndex(x => x.name == "resultIcon")];
    // };

    if($stateParams.raceId){
        $scope.showRaceModal({_id:$stateParams.raceId},true);
    }

    if($stateParams.search){
        $scope.searchQuery = $stateParams.search;
    }

}]);

angular.module('mcrrcApp.results').controller('ResultModalInstanceController', ['$scope', '$uibModalInstance', '$filter', 'editmode', 'result', 'MembersService', 'ResultsService', 'localStorageService','UtilsService','$timeout','resultsList', function($scope, $uibModalInstance, $filter,editmode, result, MembersService, ResultsService, localStorageService,UtilsService,$timeout,resultsList) {

    
    $scope.isOlderDateCheck = function(date){       
        if (date !== undefined && date !== null){
            var today = new Date();
            var oldDate = new Date().setDate(today.getDate() - 30); 
            var raceDate = new Date(date);
            return raceDate < oldDate;
        }
    };

    var deleteIdFromSubdocs = function (obj, isRoot) {
      for (var key in obj) {
          if (isRoot === false && key === "_id") {
              delete obj[key];
          } else if (typeof obj[key] === "object") {
              deleteIdFromSubdocs(obj[key], false);
          }
      }
      return obj;
    };

    $scope.autoconvert = true;
    MembersService.getMembers({
        sort: 'memberStatus firstname',
        select: '-bio -personalBests -teamRequirementStats'
    }).then(function(members) {
        $scope.membersList = members;

    });

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

    $scope.sportList = ['swim','bike','run'];
    $scope.states = UtilsService.states;
    $scope.countries = UtilsService.countries;





    // make sure dates are always UTC
    // $scope.$watch('formData.race.racedate ', function(date) {
    //   if($scope.formData.race !== undefined){
    //     $scope.formData.race.racedate = $filter('date')($scope.formData.race.racedate, 'yyyy-MM-dd', 'UTC');
    //   }
    // });

    $scope.$watch('formData.race.location.country', function(country) {
      if($scope.formData.race !== undefined && country !== 'USA'){
        $scope.formData.race.location.state = null;
      }
    });


    if (editmode){
      if (result) {
          $scope.editmode = true;

          $scope.formData = result;

          $scope.formData.race.racedate = new Date($scope.formData.race.racedate);
          if ($scope.formData.race.location === undefined){ $scope.formData.race.location = {};}

          $scope.nbOfMembers = result.members.length;
          $scope.time = {};

          $scope.time.hours = Math.floor($scope.formData.time / 360000);
          $scope.time.minutes = Math.floor((($scope.formData.time % 8640000) % 360000) / 6000);
          $scope.time.seconds = Math.floor(((($scope.formData.time % 8640000) % 360000) % 6000) / 100);
          $scope.time.centiseconds = Math.floor(((($scope.formData.time % 8640000) % 360000) % 6000) % 100);

          if( $scope.formData.legs !== null && $scope.formData.legs !== undefined){
              $scope.formData.legs.forEach(function(l) {
                  l.timeExp = {};
                  l.timeExp.hours = Math.floor(l.time / 360000);
                  l.timeExp.minutes = Math.floor(((l.time % 8640000) % 360000) / 6000);
                  l.timeExp.seconds = Math.floor((((l.time % 8640000) % 360000) % 6000) / 100);
                  l.timeExp.centiseconds = Math.floor((((l.time % 8640000) % 360000) % 6000) % 100);
              });
          }

          if (result.customOptions !== undefined){
            $scope.customOptionsString = JSON.stringify(deleteIdFromSubdocs(result.customOptions,true));
          }
          if ($scope.formData.isRecordEligible === false || ($scope.customOptionsString !== undefined && $scope.customOptionsString !== "[]")){
            $scope.showMore = true;
          }

      }else{}
    }else{        
      //new result
      $scope.editmode = false;
      if (result){ //duplicated result
        const originalResult = JSON.parse(JSON.stringify(result));   
        $scope.formData = {};
        $scope.formData.isRecordEligible = originalResult.isRecordEligible;        
        $scope.formData.race = originalResult.race;
        $scope.formData.race.location.country = originalResult.race.location.country;
        $scope.formData.race.location.state = originalResult.race.location.state;
        $scope.formData.race.racedate = new Date(originalResult.race.racedate);
        $scope.formData.race.order = originalResult.race.order;
        $scope.formData.ranking = {};
        $scope.formData.members = [];
        $scope.formData.members[0] = {};        
        $scope.nbOfMembers = 1;
        $scope.formData.legs = originalResult.legs;   
        if( $scope.formData.legs !== null && $scope.formData.legs !== undefined){
            //we clear all the leg times for the new race
            $scope.formData.legs.forEach(function(l) {
                l.timeExp = {};              
            });
        }     
        $scope.time = {};
        if ($scope.formData.isRecordEligible === false || ($scope.customOptionsString !== undefined && $scope.customOptionsString !== "[]")){
            $scope.showMore = true;
        }
      }else{
        
        $scope.formData = {};
        $scope.formData.isRecordEligible = true;
        if(localStorageService.get('race') !== null){
            $scope.formData.race = localStorageService.get('race');
            $scope.formData.race.racedate = new Date($scope.formData.race.racedate);
        }else{
            $scope.formData.race = {};
            // $scope.formData.race.racedate = new Date($filter('date')(new Date().setHours(0,0,0,0), 'yyyy-MM-dd', 'UTC'));
            $scope.formData.race.racedate = new Date(Date.UTC(new Date().getFullYear(),new Date().getMonth(),new Date().getDate(),0,0,0,0));
        }



        $scope.formData.race.location = {};
        if (localStorageService.get('country') !== null){
          $scope.formData.race.location.country=localStorageService.get('country');
        }else{
          //default country
          $scope.formData.race.location.country="USA";
        }
        if(localStorageService.get('state') !== null){
          $scope.formData.race.location.state=localStorageService.get('state');
        }else{
          // default state
          $scope.formData.race.location.state="MD";
        }


        $scope.formData.resultlink = localStorageService.get('resultLink');
        $scope.formData.ranking = {};
        $scope.formData.ranking.agetotal = localStorageService.get('agetotal');
        $scope.formData.ranking.gendertotal = localStorageService.get('gendertotal');
        $scope.formData.ranking.overalltotal = localStorageService.get('overalltotal');


        $scope.formData.members = [];
        $scope.formData.members[0] = {};
        $scope.nbOfMembers = 1;
        $scope.time = {};


        //Multisports
        if ($scope.formData.race.isMultisport){            
            $scope.formData.legs = [];
            $scope.formData.legs[0] = {};
            $scope.formData.legs = localStorageService.get('legs');
            if( $scope.formData.legs !== null && $scope.formData.legs !== undefined){
                //we clear all the leg times for the new race
                $scope.formData.legs.forEach(function(l) {
                    l.timeExp = {};              
                });
            }     
        }
      }


    }




    $scope.addResult = async function(addAnother) {
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

        if( $scope.formData.legs !== null && $scope.formData.legs !== undefined){
            $scope.formData.legs.forEach(function(l,i) {
                l.order = i;
                if (l.timeExp === undefined){l.timeExp ={};}
                if (l.timeExp.hours === null || l.timeExp.hours === undefined || l.timeExp.hours === "") l.timeExp.hours = 0;
                if (l.timeExp.minutes === null || l.timeExp.minutes === undefined || l.timeExp.minutes === "") l.timeExp.minutes = 0;
                if (l.timeExp.seconds === null || l.timeExp.seconds === undefined || l.timeExp.seconds === "") l.timeExp.seconds = 0;
                if (l.timeExp.centiseconds === null || l.timeExp.centiseconds === undefined || l.timeExp.centiseconds === "") l.timeExp.centiseconds = 0;
                l.time = l.timeExp.hours * 360000 + l.timeExp.minutes * 6000 + l.timeExp.seconds * 100 + l.timeExp.centiseconds;
            });
        }



        //save race related info for futur addition
        localStorageService.set('race', $scope.formData.race);
        localStorageService.set('resultLink', $scope.formData.resultlink);
        localStorageService.set('agetotal', $scope.formData.ranking.agetotal);
        localStorageService.set('gendertotal', $scope.formData.ranking.gendertotal);
        localStorageService.set('overalltotal', $scope.formData.ranking.overalltotal);
        localStorageService.set('country',$scope.formData.race.location.country);
        localStorageService.set('state',$scope.formData.race.location.state);
        localStorageService.set('legs', $scope.formData.legs);

        if (!$scope.formData.race.isMultisport && $scope.formData.race.racetype.isVariable === false){
            $scope.formData.race.distanceName = undefined;
        }

        if ($scope.formData.race.racetype.surface === 'multiple'){
            $scope.formData.race.racetype.meters = 0;
            $scope.formData.race.racetype.miles = 0;
        }


        if ($scope.customOptionsString !== undefined){
          $scope.formData.customOptions = JSON.parse($scope.customOptionsString);
        }
        if (addAnother) {
            //save
            $scope.isSaving = true;
            await ResultsService.createResult($scope.formData,resultsList);
            $scope.isSaving = false;
            //clear some field for new result after it was created
            $scope.formData.members = [{}];
            $scope.time = {};
            $scope.formData.ranking.agerank = null;
            $scope.formData.ranking.genderrank = null;
            $scope.formData.ranking.overallrank = null;
            $scope.formData.comments = undefined;                    
        }else{
            //close and save
            $uibModalInstance.close($scope.formData);
        }
        
    };

    $scope.clearForm = function() {
        $scope.formData = {};
        $scope.formData.members = [{}];
        $scope.formData.isRecordEligible = true;
        $scope.nbOfMembers = 1;
        
        localStorageService.remove('race');
        localStorageService.remove('resultLink');
        localStorageService.remove('agetotal');
        localStorageService.remove('gendertotal');
        localStorageService.remove('overalltotal');
        localStorageService.remove('legs');
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

        if( $scope.formData.legs !== null && $scope.formData.legs !== undefined){
            $scope.formData.legs.forEach(function(l,i) {
                l.order = i;
                if (l.timeExp === undefined){l.timeExp ={};}
                if (l.timeExp.hours === null || l.timeExp.hours === undefined || l.timeExp.hours === "") l.timeExp.hours = 0;
                if (l.timeExp.minutes === null || l.timeExp.minutes === undefined || l.timeExp.minutes === "") l.timeExp.minutes = 0;
                if (l.timeExp.seconds === null || l.timeExp.seconds === undefined || l.timeExp.seconds === "") l.timeExp.seconds = 0;
                if (l.timeExp.centiseconds === null || l.timeExp.centiseconds === undefined || l.timeExp.centiseconds === "") l.timeExp.centiseconds = 0;
                l.time = l.timeExp.hours * 360000 + l.timeExp.minutes * 6000 + l.timeExp.seconds * 100 + l.timeExp.centiseconds;
            });
        }

        if (!$scope.formData.race.isMultisport && $scope.formData.race.racetype.isVariable === false){
            $scope.formData.race.distanceName = undefined;
        }

        if ($scope.formData.race.racetype.surface === 'multiple'){
            $scope.formData.race.racetype.meters = 0;
            $scope.formData.race.racetype.miles = 0;
        }

        if ($scope.customOptionsString !== undefined){
          $scope.formData.customOptions = JSON.parse($scope.customOptionsString);
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

    $scope.updateMeters = function(leg){
        leg.meters = leg.miles * 1609.3440;
    };

    $scope.updateMiles = function(leg){
        leg.miles = leg.meters * 0.000621371;
    };

    $scope.toggleIsMultisport = function() {
        if ($scope.formData.race.isMultisport) {
            $scope.formData.legs = [];
            $scope.formData.legs[0] = {};
            $scope.formData.race.racetype = $scope.multisportRacetype;
        }else{
            $scope.formData.legs = null;
        }
    };

    $scope.createTriTemplate = function() {
        if ($scope.formData.race.isMultisport) {
            $scope.formData.race.racetype = $scope.multisportRacetype;
            $scope.formData.legs = [];
            $scope.formData.legs[0] = {};
            $scope.formData.legs[0].order=0;
            $scope.formData.legs[0].legName="Swim";
            $scope.formData.legs[0].legType="swim";
            $scope.formData.legs[1] = {};
            $scope.formData.legs[1].order=1;
            $scope.formData.legs[1].legName="Transition 1";
            $scope.formData.legs[1].isTransition=true;
            $scope.formData.legs[2] = {};
            $scope.formData.legs[2].order=2;
            $scope.formData.legs[2].legName="Bike";
            $scope.formData.legs[2].legType="bike";
            $scope.formData.legs[3] = {};
            $scope.formData.legs[3].order=3;
            $scope.formData.legs[3].legName="Transition 2";
            $scope.formData.legs[3].isTransition=true;
            $scope.formData.legs[4] = {};
            $scope.formData.legs[4].order=4;
            $scope.formData.legs[4].legName="Run";
            $scope.formData.legs[4].legType="run";            
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

    //focus on racer if racename is already populated.
    $timeout(function() {       
        if ($scope.formData.race.racename !== undefined && $scope.formData.race.racename !== "") {
            $scope.$broadcast('memberFocus');
        }
    }, 400); //
    

}]);


angular.module('mcrrcApp.results').controller('RaceModalInstanceController', ['$scope', '$uibModalInstance', '$filter', 'raceinfo','fromStateParams', 'MembersService', 'ResultsService', 'localStorageService','$state','NotificationService', function($scope, $uibModalInstance, $filter, raceinfo, fromStateParams,MembersService, ResultsService, localStorageService,$state,NotificationService) {

    $scope.raceinfo = raceinfo;
    if (fromStateParams){
        $scope.fromStateParams = fromStateParams;
    }else{
        //default
        $scope.fromStateParams = false;
    }
   

    var sum = 0;
    var count = 0;
    for (i = 0; i < $scope.raceinfo.results.length; i++) {
        if ($scope.raceinfo.results[i].time !== 'undefined') {
            sum += $scope.raceinfo.results[i].time;
            count++;
        }
    }
    if (count !== 0) {
        $scope.avg = Math.ceil(sum / count);
    }

    $scope.cancel = function() {
        if($scope.fromStateParams){         
            $state.go('/results');
        }        
        $uibModalInstance.dismiss('cancel');        
    };

    $scope.getRaceTypeClass = function(s) {
        if (s !== undefined) {
            return s.replace(/ /g, '') + '-col';
        }
    };

    $scope.showResultDetailsModal = function(result,race) {
        ResultsService.showResultDetailsModal(result,race).then(function(result) {});
    };

   
    
    $scope.sortBy = function (criteria) {
        if ($scope.sortCriteria === criteria) {
            $scope.sortDirection = $scope.sortDirection === true ? false : true;
        } else {
            $scope.sortCriteria = criteria;
            $scope.sortDirection = true;
        }
        //sortDirection true = asc, false = desc
        $scope.raceinfo.results.sort(customResultSort($scope.raceinfo.results, $scope.sortCriteria, $scope.sortDirection));
    };

    function customResultSort(arr, field, order) {
        return (result1, result2) => {
            if (field === 'race.racedate') {
                if (result1.race.racedate < result2.race.racedate) {
                    return order === true ? -1 : 1;
                } else if (result1.race.racedate > result2.race.racedate) {
                    return order === true ? 1 : -1;
                }

                if (result1.race.order < result2.race.order) {
                    return order === true ? -1 : 1;
                } else if (result1.race.order > result2.race.order) {
                    return order === true ? 1 : -1;
                }

                if (result1.race.racename < result2.race.racename) {
                    return order === true ? -1 : 1;
                } else if (result1.race.racename > result2.race.racename) {
                    return order === true ? 1 : -1;
                }

                if (result1.time < result2.time) {
                    return order === true ? -1 : 1;
                } else if (result1.time > result2.time) {
                    return order === true ? 1 : -1;
                }

                return 0;
            }

            if (field === 'pace') {
                //if result is multisport, put at the end
                if (result1.race.isMultisport) {
                    return 1;
                }
                if (result2.race.isMultisport) {
                    return -1;
                }
                if (result1.time / result1.race.racetype.miles < result2.time / result2.race.racetype.miles) {
                    return order === true ? -1 : 1;
                } else if (result1.time / result1.race.racetype.miles > result2.time / result2.race.racetype.miles) {
                    return order === true ? 1 : -1;
                }
                return 0;
            }

            if (field === 'time') {
                if (result1.time < result2.time) {
                    return order === true ? -1 : 1;
                } else if (result1.time > result2.time) {
                    return order === true ? 1 : -1;
                }
                return 0;
            }

            if (field === 'agegrade') {
                //if result has no agegrade, put at the end    
                if (result1.agegrade === undefined) {
                    return 1;
                }
                if (result2.agegrade === undefined) {
                    return -1;
                }
                if (result1.agegrade < result2.agegrade) {
                    return order === true ? -1 : 1;
                } else if (result1.agegrade > result2.agegrade) {
                    return order === true ? 1 : -1;
                }
                return 0;
            }
        };
    }

    $scope.copyRaceLinkToClipboard = function() {
        navigator.clipboard.writeText(window.location.origin+'/races/' + $scope.raceinfo._id)
          .then(() => {
            NotificationService.clipboardCopyNotifiction(true,window.location.origin+'/races/' + $scope.raceinfo._id);            
          })
          .catch(err => {
            NotificationService.clipboardCopyNotifiction(false,window.location.origin+'/races/' + $scope.raceinfo._id);     
            console.error('Failed to copy text: ', err);
          });
      };



}]);


angular.module('mcrrcApp.results').controller('ResultDetailslInstanceController', ['$scope', '$uibModalInstance', '$filter', 'result','race', 'MembersService', 'ResultsService', 'localStorageService', function($scope, $uibModalInstance, $filter, result, race, MembersService, ResultsService, localStorageService) {

    $scope.result = result;
    if (race !== null && race !== undefined){
        $scope.result.race = race;
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
