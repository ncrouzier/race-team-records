angular.module('mcrrcApp').directive('raceList', function() {
    return {
        restrict: 'E',
        scope: {
            racesList: '=',
            searchQuery: '=',
            resultsTableProperties: '=',
            user: '='
        },
        templateUrl: 'views/directives/raceList.html',
        controller: function($scope,dialogs,ResultsService) {
            $scope.expand = function(raceinfo) {
                if (raceinfo) {
                    // Toggle the expanded state for this race
                    $scope.expandedRaces[raceinfo._id] = !$scope.expandedRaces[raceinfo._id];
                }
            };

            $scope.isRaceExpanded = function(raceId) {
                return $scope.expandedRaces[raceId] === true;
            };

            $scope.getRaceTypeClass = function(s) {
                if (s !== undefined) {
                    return s.replace(/ /g, '') + '-col';
                }
            };

            $scope.expandAll = function() {
                $scope.racesList.forEach(function(race) {
                    $scope.expandedRaces[race._id] = true;
                });
            };

            $scope.collapseAll = function() {
                $scope.expandedRaces = {};
            };

            $scope.sortRaceBy = function(criteria) {
                if ($scope.sortCriteria === criteria) {
                    $scope.sortDirection = $scope.sortDirection === true ? false : true;
                } else {
                    $scope.sortCriteria = criteria;
                    $scope.sortDirection = true;
                }
                //sortDirection true = asc, false = desc
                $scope.racesList.sort(customRaceSort($scope.racesList, $scope.sortCriteria, $scope.sortDirection));
            };

            $scope.showAddResultModal = function(raceInfo) {
                var onResultCreated = function(result) {
                    if (result !== null) {
                        var existingRaceIndex = $scope.racesList.findIndex(function(race) {
                            return race._id === result.race._id;
                        });
        
                        if (existingRaceIndex === -1) {
                            var newRace = JSON.parse(JSON.stringify(result.race));
                            newRace.results = [result];
                            $scope.racesList.unshift(newRace);
                        } else {
                            $scope.racesList[existingRaceIndex].results.unshift(result);
                        }
                    }
                };


                ResultsService.showAddResultModal(raceInfo.results[0]).then(function(result) {                    
                    // This will only be called when the modal is finally closed with the "Save and Close" button
                    onResultCreated(result);
                }, function() {});
            };

            $scope.retrieveResultForEdit = function(raceInfo,resultSource) {
                ResultsService.retrieveResultForEdit(resultSource).then(function(result) {
                    if (result) {
                        var index = raceInfo.results.findIndex(function (r) {
                            return r._id === resultSource._id;
                        });                    
                        raceInfo.results[index] =result;
                    }
                });
            };

            $scope.removeResult = function(raceinfo, resultSource) {
                var dlg = dialogs.confirm("Remove Result?", "Are you sure you want to remove this result?");
                dlg.result.then(function(btn) {
                    ResultsService.deleteResult(resultSource).then(function() {
                        var index = raceinfo.results.indexOf(resultSource);
                        if (index > -1) raceinfo.results.splice(index, 1);
                    });
                }, function(btn) {});
            };

            $scope.removeRace = function (raceInfo) {
                var dlg = dialogs.confirm("Remove Result?", "Are you sure you want to remove this race?");
                dlg.result.then(function (btn) {
                    ResultsService.deleteRace(raceInfo).then(function () {
                        // Remove the race from the list
                        var index = $scope.racesList.findIndex(function (r) {
                            return r._id === raceInfo._id;
                        });
                        if (index > -1) {
                            $scope.racesList.splice(index, 1);
                        }
                    });
                }, function (btn) { });
            };

            $scope.showResultDetailsModal = function(result, raceinfo) {
                ResultsService.showResultDetailsModal(result, raceinfo).then(function(result) {});
            };

            $scope.sortResultsBy = function(raceinfo, criteria) {
                if (!raceinfo._sortCriteria) raceinfo._sortCriteria = 'time';
                if (!raceinfo._sortDirection) raceinfo._sortDirection = true;
                if (raceinfo._sortCriteria === criteria) {
                    raceinfo._sortDirection = raceinfo._sortDirection === true ? false : true;
                } else {
                    raceinfo._sortCriteria = criteria;
                    raceinfo._sortDirection = true;
                }
                raceinfo.results.sort(customResultSort(raceinfo, raceinfo._sortCriteria, raceinfo._sortDirection));
            };

           

            

            $scope.getSelectedResults = function(raceinfo){
                return raceinfo.results.filter(function(result) { return result.selected; });
            };

            $scope.deleteSelectedResults = function(raceinfo) {
                var selectedResults = $scope.getSelectedResults(raceinfo);//raceinfo.results.filter(function(result) { return result.selected; });
                if (!selectedResults.length) return;
                var dlg = dialogs.confirm("Delete Selected Results", "Are you sure you want to delete all selected results?");
                dlg.result.then(function() {
                    var deletePromises = selectedResults.map(function(result) {
                        return ResultsService.deleteResult(result).then(function() {
                            var idx = raceinfo.results.indexOf(result);
                            if (idx > -1) raceinfo.results.splice(idx, 1);
                        });
                    });
                });
            };

            $scope.showRaceModal = function(race,fromStateParams) {
                if(race){
                    ResultsService.showRaceFromResultModal(race._id,fromStateParams).then(function(result) {                
                    });
                }
            };

            $scope.toggleSelectAllResults = function(raceinfo) {
                if (!raceinfo.results || raceinfo.results.length === 0) return;
                var allSelected = $scope.getSelectedResults(raceinfo).length === raceinfo.results.length;
                raceinfo.results.forEach(function(result) {
                    result.selected = !allSelected;
                });
            };

            function customRaceSort(arr, field, order) {
                return (race1, race2) => {
                    if (field === 'racedate') {
                        if (race1.racedate < race2.racedate) {
                            return order === true ? -1 : 1;
                        } else if (race1.racedate > race2.racedate) {
                            return order === true ? 1 : -1;
                        }

                        if (race1.order < race2.order) {
                            return order === true ? -1 : 1;
                        } else if (race1.order > race2.order) {
                            return order === true ? 1 : -1;
                        }

                        if (race1.racename < race2.racename) {
                            return order === true ? -1 : 1;
                        } else if (race1.racename > race2.racename) {
                            return order === true ? 1 : -1;
                        }                                
                        return 0;
                    }

                    if (field === 'distance') {
                        if (race1.racetype.miles > race2.racetype.miles) {
                            return order === true ? -1 : 1;
                        } else if (race1.racetype.miles < race2.racetype.miles) {
                            return order === true ? 1 : -1;
                        }
                        return 0;
                    }

                    if (field === 'participation') {
                        if (race1.results.length > race2.results.length) {
                            return order === true ? -1 : 1;
                        } else if (race1.results.length < race2.results.length) {
                            return order === true ? 1 : -1;
                        }
                        return 0;
                    }
                };
            }

            function customResultSort(raceinfo, field, order) {
                return (result1, result2) => {
                    if (field === 'pace') {
                        if (result1.race.isMultisport) {
                            return 1;
                        }
                        if (result2.race.isMultisport) {
                            return -1;
                        }
                        if (result1.time / raceinfo.racetype.miles < result2.time / raceinfo.racetype.miles) {
                            return order === true ? -1 : 1;
                        } else if (result1.time / raceinfo.racetype.miles > result2.time / raceinfo.racetype.miles) {
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

            $scope.expandedRaces = {};
            $scope.sortCriteria = 'racedate';
            $scope.sortDirection = false;

            $scope.allRacesExpanded = function() {
                if (!$scope.racesList || $scope.racesList.length === 0) return false;
                return $scope.racesList.every(function(race) {
                    return $scope.expandedRaces[race._id];
                });
            };

            $scope.toggleExpandAll = function() {
                if ($scope.allRacesExpanded()) {
                    $scope.collapseAll();
                } else {
                    $scope.expandAll();
                }
            };
        }
    };
}); 