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

angular.module('mcrrcApp.tools').controller('TempAdjustmentController', ['$scope', '$location', '$timeout', '$state', '$stateParams', '$http', '$analytics', 'AuthService', 'MembersService', 'ResultsService', 'dialogs', '$filter', 'UtilsService', 'localStorageService', function ($scope, $location, $timeout, $state, $stateParams, $http, $analytics, AuthService, MembersService, ResultsService, dialogs, $filter, UtilsService, localStorageService) {

    $scope.authService = AuthService;
    $scope.$watch('authService.isLoggedIn()', function (user) {
        $scope.user = user;
    });

    if(localStorageService.get('ageAdjustment.pace')){
        $scope.pace = localStorageService.get('ageAdjustment.pace');
    }

    $scope.hoveredTemp = null;
    $scope.hoveredDew = null;

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


    const BASE_VALUES = [];
    for (let i = 50; i <= 100; i += 5) BASE_VALUES.push(i);

    $scope.temperatures = BASE_VALUES.slice();
    $scope.dews = BASE_VALUES.slice();

    let previousCustomTemp = null;
    let previousCustomDew = null;

    function insertSorted(arr, value) {
        if (arr.includes(value)) return;
        arr.push(value);
        arr.sort((a, b) => a - b);
    }

    function removeValue(arr, value) {
        const index = arr.indexOf(value);
        if (index > -1) arr.splice(index, 1);
    }

    function parsePace(paceStr) {
        if (typeof paceStr !== 'string' || !paceStr.trim()) return null;

        const trimmed = paceStr.trim();

        // Allow "7" as "7:00"
        if (/^\d+$/.test(trimmed)) {
            return parseInt(trimmed, 10) * 60;
        }

        const parts = trimmed.split(':');
        if (parts.length !== 2) return null;

        const min = parseInt(parts[0], 10);
        const sec = parseInt(parts[1], 10);

        if (isNaN(min) || isNaN(sec) || sec < 0 || sec >= 60) return null;

        return min * 60 + sec;
    }


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

    // const API_KEY = '';

    // function fetchWeatherByLocation(lat, lon) {
    //     const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=imperial`;

    //     fetch(url)
    //         .then(response => response.json())
    //         .then(data => {
    //             if (data.main && data.main.temp && data.main.humidity) {
    //                 const tempF = data.main.temp;
    //                 const humidity = data.main.humidity;

    //                 // Estimate dew point using Magnus formula (approximation)
    //                 const b = 17.62;
    //                 const c = 243.12;
    //                 const gamma = Math.log(humidity / 100) + (b * tempF) / (c + tempF);
    //                 const dewPointF = (c * gamma) / (b - gamma);

    //                 $scope.$apply(() => {
    //                     $scope.inputTemp = Math.round(tempF);
    //                     $scope.inputDew = Math.round(dewPointF);
    //                 });
    //             }
    //         })
    //         .catch(err => {
    //             console.error("Weather fetch error:", err);
    //         });
    // }

    // function getUserLocation() {
    //     if (navigator.geolocation) {
    //         navigator.geolocation.getCurrentPosition(
    //             pos => fetchWeatherByLocation(pos.coords.latitude, pos.coords.longitude),
    //             err => console.warn('Geolocation error:', err)
    //         );
    //     } else {
    //         console.warn('Geolocation not supported by this browser.');
    //     }
    // }
    //   getUserLocation();

    function formatPace(seconds) {
        let min = Math.floor(seconds / 60);
        let sec = Math.round(seconds % 60);
        return `${min}:${sec < 10 ? '0' : ''}${sec}`;
    }

    function getAdjustmentPercent(sum) {
        if (sum <= 100) return 0;
        else if (sum <= 110) return {'low': 0, 'high': 0.005};
        else if (sum <= 120) return {'low': 0.005, 'high': 0.01}; // return 0.01;
        else if (sum <= 130) return {'low': 0.01, 'high': 0.02}; // return 0.02;
        else if (sum <= 140) return {'low': 0.02, 'high': 0.03}; // return 0.03;
        else if (sum <= 150) return {'low': 0.03, 'high': 0.045}; // return 0.045;
        else if (sum <= 160) return {'low': 0.045, 'high': 0.06}; // return 0.06;
        else if (sum <= 170) return {'low': 0.06, 'high': 0.08}; // return 0.08;
        else if (sum <= 180) return {'low': 0.08, 'high': 0.10}; // return 0.10;
        else return null;
    }

    $scope.getAdjustment = function (temp, dew,showPercentage) {
        if (dew > temp) return '';

        let sum = temp + dew;
        let paceSec = parsePace($scope.pace);

        if (paceSec !== null && !showPercentage) {
            let adj = getAdjustmentPercent(sum);
            if (adj === null) return 'Not rec.';
            if (adj === 0) return formatPace(paceSec);
            let newLowPace = paceSec * (1 + adj.low);
            let newHighPace = paceSec * (1 + adj.high);
            return formatPace(newLowPace) + '–' + formatPace(newHighPace);
        } else {
            // No valid base pace — show adjustment %
            if (sum <= 100) return 'No adj.';
            else if (sum <= 110) return '0–0.5%';
            else if (sum <= 120) return '0.5–1%';
            else if (sum <= 130) return '1–2%';
            else if (sum <= 140) return '2–3%';
            else if (sum <= 150) return '3–4.5%';
            else if (sum <= 160) return '4.5–6%';
            else if (sum <= 170) return '6–8%';
            else if (sum <= 180) return '8–10%';
            else return 'Not rec.';
        }
    };

    $scope.getAdjustmentClass = function (sum) {
        if (sum <= 110) return 'adj-safe';
        else if (sum <= 130) return 'adj-moderate';
        else if (sum <= 170) return 'adj-high';
        else return 'adj-extreme';
    };

    $scope.isTempValid = function () {
        const temp = parseInt($scope.inputTemp);
        return !isNaN(temp);
    };
    $scope.setInputsFromCell = function(temp, dew) {
        if (dew <= temp) {
          $scope.inputTemp = temp;
          $scope.inputDew = dew;
        }
      };

    $scope.isDewValid = function() {
        const dew = parseInt($scope.inputDew);
        const temp = parseInt($scope.inputTemp);
        return !isNaN(dew) && !isNaN(temp) && dew <= temp;
      };

    $scope.$watchGroup(['inputTemp', 'inputDew'], function ([temp, dew]) {
        temp = parseInt(temp);
        dew = parseInt(dew);
        if (!isNaN(temp) && !isNaN(dew) && dew > temp) {
            $scope.inputDew = temp; // clamp dew to temperature
        }
    });
    $scope.$watch('inputTemp', function(newVal) {
        const temp = parseInt(newVal);      
        if (isNaN(temp)) {
          $scope.inputDew = null;
        }
      });

    $scope.$watchGroup(['inputTemp', 'inputDew', 'pace'], function () {
        let temp = parseInt($scope.inputTemp);
        let dew = parseInt($scope.inputDew);
        let paceStr = $scope.pace;
        let paceSec = parsePace(paceStr);
        if (paceSec !== null){
            localStorageService.set('ageAdjustment.pace',paceStr);
        }


        // ----- Handle Temperature Input -----
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
        if (!isNaN(temp) && isNaN(dew)) {
            removeValue($scope.temperatures, previousCustomTemp);
        }
        

        // ----- Pace Adjustment -----
        if (!isNaN(temp) && !isNaN(dew) && dew <= temp && paceSec !== null) {
            let sum = temp + dew;
            let adj = getAdjustmentPercent(sum);
            if (adj !== null) {
                let newPace = paceSec * (1 + adj);
                $scope.adjustedPace = $scope.getAdjustment(temp,dew);
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
        if (sum <= 110) return '😎';    
        if (sum <= 120) return '🙂';      
        if (sum <= 130) return '😅';     
        if (sum <= 140) return '😖';      
        if (sum <= 160) return '🥵';      
        if (sum <= 180) return '🫠';     
        return '💀';                      
    }

    $scope.getPaceTooltipHtml = function(temp,dew) {
        return `
          <div class="text-left">
            <div>Pace adjustment: ${$scope.getAdjustment(temp,dew,true)} ${getPaceFeelingEmoji(temp+dew)} </div>
          </div>
        `;
      };

   



}]);


