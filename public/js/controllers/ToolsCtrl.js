angular.module('mcrrcApp.tools').controller('AgeGradeController', ['$scope', '$location', '$timeout', '$state', '$stateParams', '$http', '$analytics', 'AuthService', 'MembersService', 'ResultsService', 'dialogs', '$filter', 'UtilsService', 'localStorageService', 'StopwatchTime', function ($scope, $location, $timeout, $state, $stateParams, $http, $analytics, AuthService, MembersService, ResultsService, dialogs, $filter, UtilsService, localStorageService, StopwatchTime) {

    $scope.authService = AuthService;
    $scope.$watch('authService.isLoggedIn()', function (user) {
        $scope.user = user;
    });

    // The standard age-grading bands.
    const LEVELS = [
        { min: 90, key: 'world', label: 'World class', starClass: 'ageworld' },
        { min: 80, key: 'national', label: 'National class', starClass: 'agenational' },
        { min: 70, key: 'regional', label: 'Regional class', starClass: 'ageregional' },
        { min: 0, key: 'local', label: 'Local class', starClass: '' }
    ];
    // Columns in the standards table, and the targets shown under a result.
    // 72% is not a classification band — it is the club kit standard, so it
    // sits alongside the medal thresholds and is flagged differently.
    const TEAM_KIT_PERCENT = 72;
    const TARGET_PERCENTS = [70, TEAM_KIT_PERCENT, 80, 90];

    $scope.currentType = 'Road';
    $scope.mode = 'calculator';

    // Bound through an object rather than bare scope properties: the
    // calculator sits inside an ng-if, which creates a child scope, and a
    // bare ng-model would write to that child and shadow the value the
    // controller reads.
    $scope.calc = {
        timeInput: '',
        selectedDistance: null
    };

    if (localStorageService.get('tools.agegrade.options')) {
        $scope.formData = localStorageService.get('tools.agegrade.options');
    } else {
        $scope.formData = {};
    }

    $scope.setMode = function (mode) {
        $scope.mode = mode;
    };

    $scope.selectMyInfo = function () {
        if ($scope.user && $scope.user.member && $scope.user.member.dateofbirth && $scope.user.member.sex) {
            $scope.formData.age = UtilsService.calculateAge($scope.user.member.dateofbirth);
            $scope.formData.sex = $scope.user.member.sex;
        }
    };

    $scope.canSelectMyInfo = function () {
        return !!($scope.user && $scope.user.member && $scope.user.member.dateofbirth && $scope.user.member.sex);
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

    $scope.$watchGroup(['formData.age', 'formData.sex'], function () {
        if ($scope.formData.age >= 5 && $scope.formData.age <= 110 && $scope.formData.sex) {
            $scope.submitForm();
        }
    });

    // The watcher on currentType rebuilds the distance list and revalidates
    // the selection.
    $scope.switchType = function (type) {
        if (type && type !== $scope.currentType) {
            $scope.currentType = type;
        }
    };

    $scope.hasType = function (type) {
        return type === 'Road' ? !!$scope.roadTableData : !!$scope.trackTableData;
    };

    function activeTable() {
        return $scope.currentType === 'Road' ? $scope.roadTableData : $scope.trackTableData;
    }

    // Built once whenever the source data or surface changes, never on the
    // fly from a binding: ng-options and ng-repeat compare by reference, so
    // returning a fresh array per digest never settles and Angular aborts
    // with an infdig error.
    $scope.distances = [];

    // The API mixes distance keys in with record metadata (_id, type, sex,
    // version, age). Rather than slicing off a fixed number of leading keys,
    // keep only the ones that are both numeric and a distance we recognise —
    // that stays correct if the API ever grows another field.
    function buildDistances() {
        var data = activeTable();
        if (!data) {
            $scope.distances = [];
            return;
        }

        // Times typed into the standards table survive a rebuild (changing
        // age, say) so the grades just re-derive against the new standards
        // instead of the user losing their entries.
        var previousTimes = {};
        ($scope.distances || []).forEach(function (d) {
            if (d.userTime) previousTimes[d.key] = d.userTime;
        });

        $scope.distances = Object.keys(data)
            .filter(function (key) {
                return typeof data[key] === 'number' && !!$filter('racenameToDistance')(key);
            })
            .map(function (key) {
                var info = $filter('racenameToDistance')(key);
                return {
                    key: key,
                    name: info.name,
                    miles: info.miles,
                    meters: info.meters,
                    standard: data[key],
                    userTime: previousTimes[key] || ''
                };
            })
            .sort(function (a, b) { return a.meters - b.meters; });

        $scope.distances.forEach(updateRowGrade);
    }

    // Grades one row of the standards table against the time typed into it.
    // Results are written back onto the row as plain values rather than
    // returned from a binding — a binding that built a fresh object each
    // digest would never settle.
    function updateRowGrade(distance) {
        distance.gradePercent = null;
        distance.gradePace = null;
        distance.gradeInvalid = false;

        if (!distance.userTime) return;

        var seconds = StopwatchTime.parseSeconds(distance.userTime);
        if (seconds === null || seconds <= 0) {
            distance.gradeInvalid = true;
            return;
        }

        distance.gradePercent = distance.standard / seconds * 100;
        distance.gradePace = paceFor(seconds, distance.miles);
    }

    $scope.updateRowGrade = updateRowGrade;

    $scope.clearRowTime = function (distance) {
        distance.userTime = '';
        updateRowGrade(distance);
    };

    // Keeps the chosen distance meaningful: road and track share only a few
    // keys, so switching surface (or age) can strand a selection that no
    // longer exists in the active table.
    function ensureValidDistance() {
        var distances = $scope.distances;
        if (!distances.length) {
            $scope.calc.selectedDistance = null;
            return;
        }
        var stillThere = $scope.calc.selectedDistance && distances.some(function (d) {
            return d.key === $scope.calc.selectedDistance;
        });
        if (stillThere) return;

        var preferred = $scope.currentType === 'Road' ? '5k' : '5000m';
        var match = distances.find(function (d) { return d.key === preferred; });
        $scope.calc.selectedDistance = match ? match.key : distances[0].key;
    }

    function levelFor(percent) {
        return LEVELS.find(function (l) { return percent >= l.min; }) || null;
    }

    $scope.starClassFor = function (percent) {
        var level = levelFor(percent);
        return level ? level.starClass : '';
    };

    // Pace per mile, as m:ss.
    function paceFor(totalSeconds, miles) {
        if (!miles) return null;
        return StopwatchTime.formatSeconds(Math.round(totalSeconds / miles));
    }

    $scope.paceFor = paceFor;

    // Whole seconds for anything a minute or longer, hundredths below that —
    // track sprint standards are only a few seconds long, so rounding them to
    // the second would throw away most of the precision.
    function roundSeconds(seconds) {
        return seconds < 60 ? Math.round(seconds * 100) / 100 : Math.round(seconds);
    }

    // The threshold time for a given standard, e.g. what 80% looks like.
    $scope.standardTimeFor = function (standardSeconds, percent) {
        return StopwatchTime.formatSeconds(roundSeconds(standardSeconds / (percent / 100)));
    };

    $scope.targetPercents = TARGET_PERCENTS;
    $scope.teamKitPercent = TEAM_KIT_PERCENT;

    function recalculate() {
        $scope.result = null;
        $scope.timeError = null;

        var distance = $scope.distances.find(function (d) { return d.key === $scope.calc.selectedDistance; });
        if (!distance || !$scope.calc.timeInput) return;

        var seconds = StopwatchTime.parseSeconds($scope.calc.timeInput);
        if (seconds === null) {
            $scope.timeError = 'Enter a time like 45:00 — type the digits and the colons appear as you go.';
            return;
        }
        if (seconds <= 0) {
            $scope.timeError = 'Enter a time greater than zero.';
            return;
        }

        var percent = distance.standard / seconds * 100;
        var level = levelFor(percent);

        $scope.result = {
            distance: distance,
            seconds: seconds,
            timeText: StopwatchTime.formatSeconds(seconds),
            percent: percent,
            level: level,
            pace: paceFor(seconds, distance.miles),
            // How much faster (or slower) than each classification threshold.
            targets: TARGET_PERCENTS.map(function (pct) {
                var targetSeconds = distance.standard / (pct / 100);
                var delta = Math.abs(seconds - targetSeconds);
                var sprint = distance.standard < 60;
                return {
                    percent: pct,
                    timeText: StopwatchTime.formatSeconds(roundSeconds(targetSeconds)),
                    pace: paceFor(targetSeconds, distance.miles),
                    reached: seconds <= targetSeconds,
                    deltaText: StopwatchTime.formatSeconds(sprint ? roundSeconds(delta) : Math.round(delta))
                };
            })
        };
    }

    // Rebuild the distance list only when its inputs actually change, then
    // re-derive everything downstream of it.
    $scope.$watchGroup(['roadTableData', 'trackTableData', 'currentType'], function () {
        buildDistances();
        ensureValidDistance();
        recalculate();
    });

    $scope.$watchGroup(['calc.timeInput', 'calc.selectedDistance'], recalculate);

    $scope.clearTime = function () {
        $scope.calc.timeInput = '';
    };

}]);

angular.module('mcrrcApp.tools').controller('TempAdjustmentController', [
    '$scope', '$analytics', 'AuthService', 'localStorageService', '$http',
    function ($scope, $analytics, AuthService, localStorageService, $http) {

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

    // ---- Auto-fill from the runner's current conditions -------------------

    // WMO weather codes, grouped — Open-Meteo returns these alongside the
    // temperature. Only used for a short human-readable label.
    const WEATHER_CODES = {
        0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
        45: 'Fog', 48: 'Depositing rime fog',
        51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
        56: 'Light freezing drizzle', 57: 'Dense freezing drizzle',
        61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
        66: 'Light freezing rain', 67: 'Heavy freezing rain',
        71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow', 77: 'Snow grains',
        80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
        85: 'Slight snow showers', 86: 'Heavy snow showers',
        95: 'Thunderstorm', 96: 'Thunderstorm with slight hail', 99: 'Thunderstorm with heavy hail'
    };

    $scope.weather = null;
    $scope.weatherLoading = false;
    $scope.weatherError = null;

    // Straight-line distance between the runner and the grid point the
    // reading actually describes, so a far-off reading is obvious.
    function milesBetween(lat1, lon1, lat2, lon2) {
        const toRad = (d) => d * Math.PI / 180;
        const R = 3958.8; // Earth radius in miles
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // Open-Meteo returns local-to-the-location time as "2026-08-21T11:15".
    // Formatted by hand rather than through Date, which would reinterpret a
    // zoneless string in the *browser's* timezone and shift the clock.
    function formatObservedAt(isoLocal) {
        if (!isoLocal) return null;
        const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(isoLocal);
        if (!match) return isoLocal;
        let hour = parseInt(match[4], 10);
        const minute = match[5];
        const suffix = hour >= 12 ? 'PM' : 'AM';
        hour = hour % 12;
        if (hour === 0) hour = 12;
        return hour + ':' + minute + ' ' + suffix;
    }

    // origin: 'gps' when the browser located the runner, 'map' when they
    // clicked a spot themselves. Only affects labelling and the accuracy ring.
    function fetchWeatherFor(lat, lon, accuracyMeters, origin) {
        $scope.weatherLoading = true;
        $scope.weatherError = null;

        $http.get('/api/weather/current', { params: { lat: lat, lon: lon } })
            .then(function (res) {
                const d = res.data;

                // The table and adjustment math work in whole degrees.
                $scope.inputTemp = Math.round(d.temperature);
                $scope.inputDew = Math.round(d.dewPoint);

                $scope.weather = {
                    origin: origin || 'gps',
                    temperature: d.temperature,
                    dewPoint: d.dewPoint,
                    humidity: d.humidity,
                    description: WEATHER_CODES[d.weatherCode] || null,
                    observedAt: formatObservedAt(d.observedAt),
                    timezone: d.timezone,
                    elevation: d.elevation,
                    userLat: lat,
                    userLon: lon,
                    accuracyMeters: accuracyMeters,
                    sourceLat: d.latitude,
                    sourceLon: d.longitude,
                    sourceDistanceMiles: (d.latitude != null && d.longitude != null)
                        ? milesBetween(lat, lon, d.latitude, d.longitude)
                        : null
                };
                $scope.weatherLoading = false;
            })
            .catch(function (res) {
                $scope.weatherError = (res.data && res.data.error) || 'Could not fetch current conditions.';
                $scope.weatherLoading = false;
            });
    }

    $scope.useMyLocation = function () {
        $scope.weatherError = null;

        // Browsers only expose geolocation over HTTPS (localhost excepted),
        // so this is a normal condition on an http:// origin, not a bug.
        if (!navigator.geolocation) {
            $scope.weatherError = 'Your browser does not support location lookup.';
            return;
        }

        $scope.weatherLoading = true;

        navigator.geolocation.getCurrentPosition(
            function (position) {
                $scope.$apply(function () {
                    fetchWeatherFor(
                        position.coords.latitude,
                        position.coords.longitude,
                        position.coords.accuracy,
                        'gps'
                    );
                });
            },
            function (error) {
                $scope.$apply(function () {
                    $scope.weatherLoading = false;
                    if (error.code === error.PERMISSION_DENIED) {
                        $scope.weatherError = 'Location access was denied. You can still enter the temperature and dew point by hand.';
                    } else if (error.code === error.POSITION_UNAVAILABLE) {
                        $scope.weatherError = 'Your location is unavailable right now. Please enter the values by hand.';
                    } else if (error.code === error.TIMEOUT) {
                        $scope.weatherError = 'Timed out getting your location. Please try again.';
                    } else {
                        $scope.weatherError = 'Could not get your location. Please enter the values by hand.';
                    }
                });
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
        );
    };

    // Called by the map when the runner clicks a spot with pick mode armed —
    // lets them check conditions somewhere other than where they're standing.
    $scope.pickWeatherLocation = function (lat, lon) {
        if (lat == null || lon == null) return;
        fetchWeatherFor(lat, lon, null, 'map');
    };

    $scope.clearWeather = function () {
        $scope.weather = null;
        $scope.weatherError = null;
    };
}]);


