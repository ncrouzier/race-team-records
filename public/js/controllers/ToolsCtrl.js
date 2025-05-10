angular.module('mcrrcApp.tools').controller('AgeGradeController', ['$scope', '$location', '$timeout', '$state', '$stateParams', '$http', '$analytics', 'AuthService', 'MembersService', 'ResultsService', 'dialogs', '$filter', 'UtilsService', 'localStorageService', function ($scope, $location, $timeout, $state, $stateParams, $http, $analytics, AuthService, MembersService, ResultsService, dialogs, $filter, UtilsService, localStorageService) {

    $scope.authService = AuthService;
    $scope.$watch('authService.isLoggedIn()', function (user) {
        $scope.user = user;
    });

    $scope.currentType = 'Road';

    $scope.$watch('formData.age', function (user) {
        if ($scope.formData.age >= 5 && $scope.formData.age <= 110 && $scope.formData.sex) {
            $scope.submitForm();
        }
    });

    if (localStorageService.get('tools.agegrade.options')) {
        $scope.formData = localStorageService.get('tools.agegrade.options');
    } else {
        $scope.formData = {
        };
    }

    $scope.getAgeGrade = function (time, ref) {
        return $filter('timeToAgeGrade')(time, ref, false);
    };


    $scope.getYears = function () {
        var years = [];
        for (var i = 18; i <= 99; i++) {
            years.push(i);
        }
        return years;
    };

    $scope.getSexes = function () {
        return ['Male', 'Female'];
    };

    $scope.getSurfaces = function () {
        return ['Road', 'Track'];
    };

    $scope.submitForm = function () {
        if ($scope.formData.age >= 5 && $scope.formData.age <= 110 && $scope.formData.sex) {
            UtilsService.getAgeGrade({
                sex: $scope.formData.sex,
                surface: $scope.formData.surface,
                age: $scope.formData.age
            }).then(function (agegrade) {
                localStorageService.set('tools.agegrade.options', $scope.formData);
                $scope.roadTableData = agegrade[0];
                $scope.trackTableData = agegrade[1];
                if (!$scope.roadTableData) {
                    $scope.currentType = 'Track';
                } else if (!$scope.trackTableData) {
                    $scope.currentType = 'Road';
                }
                $scope.currentAge = $scope.formData.age;
            });
        }
    };


    $scope.switchType = function () {
        $scope.currentType = $scope.currentType === 'Road' ? 'Track' : 'Road';
    };

    $scope.hasOtherType = function () {
        if ($scope.currentType === 'Road' && $scope.trackTableData) {
            return true;
        } else if ($scope.currentType === 'Track' && $scope.roadTableData) {
            return true;
        }
        return false;
    };

    $scope.getDistances = function () {
        if ($scope.currentType === 'Road') {
            data = $scope.roadTableData;
        } else if ($scope.currentType === 'Track') {
            data = $scope.trackTableData;
        }
        if (!data) {
            return [];
        }

        return Object.keys(data).slice(5).reduce(function (obj, key) {
            obj[key] = data[key];
            return obj;
        }, {});
    };



}]);

angular.module('mcrrcApp.tools').controller('TempAdjustmentController', [
    '$scope', '$analytics', 'AuthService', 'localStorageService',
    function ($scope, $analytics, AuthService, localStorageService) {

    // Cache DOM elements and constants
    const BASE_VALUES = Array.from({ length: 11 }, (_, i) => 50 + i * 5);
    let previousCustomTemp = null;
    let previousCustomDew = null;

    // Initialize scope variables
    $scope.authService = AuthService;
    $scope.temperatures = BASE_VALUES.slice();
    $scope.dews = BASE_VALUES.slice();
    $scope.inputError = null;
    $scope.hoveredTemp = null;
    $scope.hoveredDew = null;

    // Load saved pace from localStorage
    if(localStorageService.get('ageAdjustment.pace')){
        $scope.pace = localStorageService.get('ageAdjustment.pace');
    }

    // Watch for auth changes
    $scope.$watch('authService.isLoggedIn()', function (user) {
        $scope.user = user;
    });

    // Optimized helper functions
    function insertSorted(arr, value) {
        if (arr.includes(value)) return;
        arr.push(value);
        arr.sort((a, b) => a - b);
    }

    function removeValue(arr, value) {
        const index = arr.indexOf(value);
        if (index > -1) arr.splice(index, 1);
    }

    function removeCustomValues() {
        if (previousCustomTemp) {
            removeValue($scope.temperatures, previousCustomTemp);
            previousCustomTemp = null;
        }
        if (previousCustomDew) {
            removeValue($scope.dews, previousCustomDew);
            previousCustomDew = null;
        }
    }

    // Optimized pace parsing
    function parsePace(paceStr) {
        if (typeof paceStr !== 'string' || !paceStr.trim()) return null;
      
        const trimmed = paceStr.trim();
      
        // "7" => 7:00
        if (/^\d+$/.test(trimmed)) {
            return parseInt(trimmed, 10) * 60;
        }
      
        // "7:" => 7:00
        if (/^\d+:$/.test(trimmed)) {
            return parseInt(trimmed, 10) * 60;
        }
      
        const parts = trimmed.split(':');
        if (parts.length !== 2) return null;
      
        const min = parseInt(parts[0], 10);
        let secRaw = parts[1].trim();
      
        if (isNaN(min)) return null;
      
        // If seconds are empty, default to 0
        if (secRaw === '') return min * 60;
      
        let sec = parseInt(secRaw, 10);
      
        // If single-digit, assume tens place (e.g., 2 → 20)
        if (secRaw.length === 1 && !isNaN(sec)) {
            sec *= 10;
        }
      
        if (isNaN(sec) || sec < 0 || sec >= 60) return null;
      
        return min * 60 + sec;
    }

    // Optimized pace formatting
    function formatPace(seconds) {
        const min = Math.floor(seconds / 60);
        const sec = Math.round(seconds % 60);
        return `${min}:${sec < 10 ? '0' : ''}${sec}`;
    }

    // Optimized adjustment calculation
    function getAdjustmentPercent(sum) {
        if (sum <= 100) return 0;
        if (sum <= 110) return {'low': 0, 'high': 0.005};
        if (sum <= 120) return {'low': 0.005, 'high': 0.01};
        if (sum <= 130) return {'low': 0.01, 'high': 0.02};
        if (sum <= 140) return {'low': 0.02, 'high': 0.03};
        if (sum <= 150) return {'low': 0.03, 'high': 0.045};
        if (sum <= 160) return {'low': 0.045, 'high': 0.06};
        if (sum <= 170) return {'low': 0.06, 'high': 0.08};
        if (sum <= 180) return {'low': 0.08, 'high': 0.10};
        return null;
    }

    // Optimized validation functions
    $scope.isTempValid = function () {
        const temp = parseInt($scope.inputTemp);
        if (isNaN(temp) && $scope.inputDew  && $scope.inputTemp) {
            $scope.inputError = 'Please enter a valid temperature';
            return false;
        }
        $scope.inputError = null;
        return true;
    };

    $scope.isDewValid = function() {
        const dew = parseInt($scope.inputDew);
        const temp = parseInt($scope.inputTemp);
        
        if (isNaN(dew) && $scope.inputTemp && $scope.inputDew) {
            $scope.inputError = 'Please enter a valid dew point';
            return false;
        }
        if (!isNaN(dew) && !isNaN(temp) && dew > temp) {
            $scope.inputError = 'Dew point cannot be higher than temperature';
            return false;
        }
        $scope.inputError = null;
        return true;
    };

    // Optimized event handlers
    $scope.setHoveredCell = function (temp, dew) {
        if (dew <= temp) {
            $scope.hoveredTemp = temp;
            $scope.hoveredDew = dew;
        } else {
            $scope.hoveredTemp = null;
            $scope.hoveredDew = null;
        }
    };

    $scope.clearHoveredCell = function () {
        $scope.hoveredTemp = null;
        $scope.hoveredDew = null;
    };

    $scope.setInputsFromCell = function(temp, dew) {
        if (dew <= temp) {
            $scope.inputTemp = temp;
            $scope.inputDew = dew;
        }
    };

    $scope.adjustPace = function (event) {
        const paceSec = parsePace($scope.pace);
        if (paceSec === null) return;

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            $scope.pace = formatPace(paceSec + 1);
        } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (paceSec > 1) {
                $scope.pace = formatPace(paceSec - 1);
            }
        }
    };

    // Optimized watchers
    $scope.$watch('inputTemp', function(newVal) {
        const temp = parseInt(newVal);      
        if (isNaN(temp) || !$scope.inputDew) {
            $scope.inputDew = null;
            $scope.inputError = null;
            removeCustomValues();
        } else {
            $scope.isTempValid();
        }
    });

    $scope.$watch('inputDew', function(newVal) {
        if (newVal !== null) {
            $scope.isDewValid();
            if ($scope.inputError) {
                removeCustomValues();
            }
        } else {
            $scope.inputError = null;
            // Remove custom temperature when dew point is cleared
            if (previousCustomTemp) {
                removeValue($scope.temperatures, previousCustomTemp);
                previousCustomTemp = null;
            }
        }
    });

    // Optimized main watch group
    $scope.$watchGroup(['inputTemp', 'inputDew', 'pace'], function () {
        let temp = parseInt($scope.inputTemp);
        let dew = parseInt($scope.inputDew);
        let paceStr = $scope.pace;
        let paceSec = parsePace(paceStr);

        if (!$scope.isTempValid() || !$scope.isDewValid()) {
            $scope.adjustedPace = null;
            $scope.paceEmoji = '';
            removeCustomValues();
            return;
        }
        //save if pace is valid or empty
        if (paceSec !== null || paceStr === ""){
            localStorageService.set('ageAdjustment.pace',paceStr);
        }

        const bothValid = !isNaN(temp) && !isNaN(dew);

        if (bothValid && !BASE_VALUES.includes(temp)) {
            if (previousCustomTemp && previousCustomTemp !== temp) {
                removeValue($scope.temperatures, previousCustomTemp);
            }
            insertSorted($scope.temperatures, temp);
            previousCustomTemp = temp;
        } else if (previousCustomTemp && previousCustomTemp !== temp) {
            removeValue($scope.temperatures, previousCustomTemp);
            previousCustomTemp = null;
        }

        if (bothValid && !BASE_VALUES.includes(dew)) {
            if (previousCustomDew && previousCustomDew !== dew) {
                removeValue($scope.dews, previousCustomDew);
            }
            insertSorted($scope.dews, dew);
            previousCustomDew = dew;
        } else if (previousCustomDew && previousCustomDew !== dew) {
            removeValue($scope.dews, previousCustomDew);
            previousCustomDew = null;
        }

        if (!isNaN(temp) && !isNaN(dew) && dew <= temp) {
            let sum = temp + dew;
            let adj = getAdjustmentPercent(sum);
            if (adj !== null) {
                $scope.adjustedPace = $scope.getAdjustment(temp, dew, paceSec === null ).long;
                $scope.paceEmoji = getPaceFeelingEmoji(sum);
            } else {
                $scope.adjustedPace = "Not recommended to run hard.";
                $scope.paceEmoji = '💀';
            }
        } else {
            $scope.adjustedPace = null;
            $scope.paceEmoji = '';
        }
    });

    function getPaceFeelingEmoji(sum) {
        if (sum <= 100) return '🤩';  
        if (sum <= 110) return '😎';    
        if (sum <= 120) return '🙂';      
        if (sum <= 130) return '😅';     
        if (sum <= 140) return '😖';      
        if (sum <= 160) return '🥵';      
        if (sum <= 180) return '🫠';     
        return '💀';                      
    }

    $scope.getAdjustment = function (temp, dew, showPercentage) {
        if (dew > temp) return '';

        let sum = temp + dew;
        let paceSec = parsePace($scope.pace);

        if (paceSec !== null && !showPercentage) {
            let adj = getAdjustmentPercent(sum);
            if (adj === null) return {short:'Not rec.', long:'Not recommended to run hard.'};
            if (adj === 0) return {short:formatPace(paceSec), long:formatPace(paceSec)};
            let newLowPace = paceSec * (1 + adj.low);
            let newHighPace = paceSec * (1 + adj.high);
            return {short:formatPace(newLowPace) + '–' + formatPace(newHighPace), long:formatPace(newLowPace) + '–' + formatPace(newHighPace)};
        } else {
            if (sum <= 100) return {short:'No adj.', long:'No adjustment needed'};
            if (sum <= 110) return {short:'0–0.5%', long:'0–0.5% slower'};
            if (sum <= 120) return {short:'0.5–1%', long:'0.5–1% slower'};
            if (sum <= 130) return {short:'1–2%', long:'1–2% slower'};
            if (sum <= 140) return {short:'2–3%', long:'2–3% slower'};
            if (sum <= 150) return {short:'3–4.5%', long:'3–4.5% slower'};
            if (sum <= 160) return {short:'4.5–6%', long:'4.5–6% slower'};
            if (sum <= 170) return {short:'6–8%', long:'6–8% slower'};
            if (sum <= 180) return {short:'8–10%', long:'8–10% slower'};
            return {short:'Not rec.', long:'Not recommended to run hard.'};
        }
    };

    $scope.getAdjustmentClass = function (sum) {
        if (sum <= 110) return 'adj-safe';
        if (sum <= 130) return 'adj-moderate';
        if (sum <= 170) return 'adj-high';
        return 'adj-extreme';
    };

    $scope.getPaceTooltipHtml = function(temp, dew) {
        return `
            <div class="text-left">
                <div>${$scope.getAdjustment(temp, dew, true).long} ${getPaceFeelingEmoji(temp+dew)} </div>
            </div>
        `;
    };
}]);


