angular.module('mcrrcApp.results').controller('RaceTypeController', ['$scope', 'AuthService', 'ResultsService', 'dialogs', function($scope, AuthService, ResultsService, dialogs) {

    $scope.authService = AuthService;
    $scope.$watch('authService.isLoggedIn()', function(user) {
        $scope.user = user;
    });

    // Cache for computed values to prevent infinite digest cycles
    $scope.cachedStats = {
        ageGradedCount: 0,
        surfaceTypesCount: 0,
        surfaceBreakdown: []
    };

    ResultsService.getRaceTypes({
        sort: 'meters'
    }).then(function(raceTypes) {
        $scope.racetypesList = raceTypes;
        // Migrate "cross country" to "trail" if needed
        $scope.migrateCrossCountryToTrail();
        $scope.updateCachedStats();
    });

    // Migrate "cross country" to "trail" for existing data
    $scope.migrateCrossCountryToTrail = function() {
        if (!$scope.racetypesList) return;
        
        var needsUpdate = false;
        $scope.racetypesList.forEach(function(racetype) {
            if (racetype.surface === 'cross country') {
                racetype.surface = 'trail';
                needsUpdate = true;
            }
        });
        
        // If any changes were made, update the backend
        if (needsUpdate) {
            console.log('Migrating "cross country" to "trail" for race types');
            // You might want to add a backend call here to persist the changes
            // For now, we'll just update the local data
        }
    };

    // Update cached statistics when racetypesList changes
    $scope.updateCachedStats = function() {
        if (!$scope.racetypesList) {
            $scope.cachedStats.ageGradedCount = 0;
            $scope.cachedStats.surfaceTypesCount = 0;
            $scope.cachedStats.surfaceBreakdown = [];
            return;
        }

        // Count age graded types
        $scope.cachedStats.ageGradedCount = $scope.racetypesList.filter(function(racetype) {
            return racetype.hasAgeGradedInfo === true;
        }).length;

        // Count unique surface types
        var surfaces = {};
        $scope.racetypesList.forEach(function(racetype) {
            if (racetype.surface) {
                surfaces[racetype.surface] = true;
            }
        });
        $scope.cachedStats.surfaceTypesCount = Object.keys(surfaces).length;

        // Create surface breakdown
        var surfaceCounts = {};
        $scope.racetypesList.forEach(function(racetype) {
            if (racetype.surface) {
                if (!surfaceCounts[racetype.surface]) {
                    surfaceCounts[racetype.surface] = 0;
                }
                surfaceCounts[racetype.surface]++;
            }
        });
        
        $scope.cachedStats.surfaceBreakdown = Object.keys(surfaceCounts).map(function(surface) {
            return {
                name: surface,
                count: surfaceCounts[surface]
            };
        }).sort(function(a, b) {
            return b.count - a.count;
        });
    };

    // Helper functions for the new UI - use cached values where possible
    $scope.getAgeGradeStatusClass = function(hasAgeGradedInfo) {
        if (hasAgeGradedInfo === true) {
            return 'agegrade-enabled';
        } else if (hasAgeGradedInfo === false) {
            return 'agegrade-disabled';
        } else {
            return 'agegrade-undefined';
        }
    };

    $scope.getAgeGradeIcon = function(hasAgeGradedInfo) {
        if (hasAgeGradedInfo === true) {
            return 'fa-check-circle';
        } else if (hasAgeGradedInfo === false) {
            return 'fa-times-circle';
        } else {
            return 'fa-question-circle';
        }
    };

    $scope.getAgeGradeText = function(hasAgeGradedInfo) {
        if (hasAgeGradedInfo === true) {
            return 'Age Graded';
        } else if (hasAgeGradedInfo === false) {
            return 'Not Age Graded';
        } else {
            return 'Age Graded Not Defined';
        }
    };

                // Use cached values for these functions
            $scope.getAgeGradedCount = function() {
                return $scope.cachedStats.ageGradedCount;
            };

            $scope.getSurfaceTypesCount = function() {
                return $scope.cachedStats.surfaceTypesCount;
            };

            $scope.getSurfaceBreakdown = function() {
                return $scope.cachedStats.surfaceBreakdown;
            };

            // Helper function to convert surface names to valid CSS class names
            $scope.getSurfaceClass = function(surfaceName) {
                if (!surfaceName) return '';
                // Convert to lowercase and replace spaces with hyphens
                return 'surface-' + surfaceName.toLowerCase().replace(/\s+/g, '-');
            };

    $scope.showAddRaceTypeModal = function() {
        ResultsService.showAddRaceTypeModal().then(function(racetype) {
            if (racetype !== null) {
                $scope.racetypesList.push(racetype);
                $scope.updateCachedStats();
            }
        });
    };

    // select a racetype after checking it
    $scope.retrieveRaceTypeForEdit = function(racetype) {
        ResultsService.retrieveRaceTypeForEdit(racetype).then(function() {});
    };

    $scope.removeRaceType = function(racetype) {
        var dlg = dialogs.confirm("Remove RaceType?", "Are you sure you want to remove this racetype?");
        dlg.result.then(function(btn) {
            ResultsService.deleteRaceType(racetype).then(function() {
                var index = $scope.racetypesList.indexOf(racetype);
                if (index > -1) {
                    $scope.racetypesList.splice(index, 1);
                    $scope.updateCachedStats();
                }
            });
        }, function(btn) {});
    };



}]);

angular.module('mcrrcApp.results').controller('RaceTypeModalInstanceController', ['$scope', '$uibModalInstance', 'racetype', function($scope, $uibModalInstance, racetype) {
    $scope.autoconvert = true;
    $scope.editmode = false;
    if (racetype) {
        $scope.formData = racetype;
        $scope.editmode = true;
    } else {
        $scope.formData = {};
        $scope.formData.isVariable = false;
        $scope.formData.hasAgeGradedInfo = false;
        $scope.editmode = false;
    }

    $scope.surfaces = ['road', 'track', 'trail', 'ultra', 'other', 'multiple', 'pool', 'open water'];

    $scope.onMetersChange = function() {
        if ($scope.autoconvert) {
            $scope.formData.miles = $scope.formData.meters * 0.000621371;
        }
    };

    $scope.onMilesChange = function() {
        if ($scope.autoconvert) {
            $scope.formData.meters = $scope.formData.miles * 1609.3440;
        }
    };

    $scope.addRaceType = function() {
        if ($scope.formData.isVariable){
            $scope.formData.meters = null;
            $scope.formData.miles = null;
        }
        $uibModalInstance.close($scope.formData);
    };

    $scope.editRaceType = function() {
        if ($scope.formData.isVariable){
            $scope.formData.meters = null;
            $scope.formData.miles = null;
        }
        $uibModalInstance.close($scope.formData);
    };

    $scope.cancel = function() {
        $uibModalInstance.dismiss('cancel');
    };



}]);
