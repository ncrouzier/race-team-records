angular.module('mcrrcApp').directive('memberBestTimeChart', ['$timeout', function($timeout) {
    return {
        restrict: 'E',
        scope: {
            member: '=',
            raceTypeBreakdown: '='
        },
        template: `
            <div class="chart-container">
                <canvas id="bestTimeChart"></canvas>
            </div>
            <div  style="text-align: center;">
                 <label>Select Race Type:</label>
                 <ui-select 
                     ng-model="selectedRaceType" 
                     theme="select2" 
                     style="min-width: 300px; text-align: left;" 
                     on-select="onRaceTypeSelect($item, $model)">
                    <ui-select-match placeholder="Select a race type...">
                        <span class="surface-track" ng-bind-html="selectedRaceType.formattedDisplayName"> </span>
                    </ui-select-match>
                                         <ui-select-choices repeat="racetype in availableRaceTypes | propsFilter: {name: $select.search, surface: $select.search}">
                         <div ng-bind-html="racetype.formattedDisplayName | highlightignorespan: $select.search"></div>
                     </ui-select-choices>
                </ui-select>
                <button class="btn btn-primary" ng-click="reloadChart()" style="margin-left: 10px;" uib-tooltip="Reload Graph" tooltip-placement="right">
                    <i class="fa fa-refresh"></i>
                </button>
                <div class="chart-controls">
                    <div class="age-grade-toggle">
                        <label>
                            <input type="checkbox" ng-model="showAgeGradeLines" ng-change="updateChart()" checked> 
                            Show Age Grade Levels
                        </label>
                    </div>
                    <div class="performance-mode-toggle">
                        <label>
                            <input type="radio" ng-model="performanceMode" value="best" ng-change="updateChart()">
                            Best per Year
                        </label>
                        <label>
                            <input type="radio" ng-model="performanceMode" value="all" ng-change="updateChart()">
                            All Performances
                        </label>
                    </div>
                </div>
            </div>`,
        link: function(scope, element, attrs) {
            var chart = null;
            scope.selectedRaceType = null;
            scope.availableRaceTypes = [];
            scope.showAgeGradeLines = true; // Default to showing age grade lines
            scope.performanceMode = 'all'; // Default to all performances
            
            // Track removed points for temporary removal
            scope.removedPoints = new Set();
            
            // Constants
            var AGE_GRADE_LEVELS = {
                REGIONAL: 70,
                NATIONAL: 80,
                WORLD: 90
            };
            var TIME_CONSTANTS = {
                CENTISECONDS_PER_SECOND: 100,
                SECONDS_PER_HOUR: 3600,
                SECONDS_PER_MINUTE: 60
            };
            function initializeChart() {
                if (chart) {
                    chart.destroy();
                }
                
                var ctx = document.getElementById('bestTimeChart');
                if (!ctx) {
                    return;
                }
                
                // Get years with data for the selected race type
                var selectedRaceTypeId = scope.selectedRaceType ? scope.selectedRaceType._id : null;
                var years = getYearsWithData(selectedRaceTypeId);
                
                // Cache all results data to avoid multiple calls
                var allResultsData = getAllResultsForRaceType(selectedRaceTypeId);
                var timeData, ageGradeData;
                
                if (scope.performanceMode === 'best') {
                    // Best performance per year mode
                    timeData = years.map(function(year) {
                        return getBestTimeForYearAndRaceType(year, selectedRaceTypeId, allResultsData);
                    });
                    ageGradeData = years.map(function(year) {
                        return getMaxAgeGradeForYearAndRaceType(year, selectedRaceTypeId, allResultsData);
                    });
                } else {
                    // All performances mode - get all results ordered by date
                    timeData = [];
                    ageGradeData = [];
                    
                    allResultsData.forEach(function(result, index) {
                        // Skip removed points
                        if (!scope.removedPoints.has(index)) {
                            timeData.push(result.time);
                            ageGradeData.push(result.ageGrade);
                        }
                    });
                }
                
                // Check if any age grade data is available
                var hasAgeGradeData = ageGradeData.some(function(value) {
                    return value !== null && value !== undefined;
                });
                
                // Create datasets array
                var datasets = [{
                    label: (scope.selectedRaceType ? scope.selectedRaceType.name : '') + (scope.performanceMode === 'best' ? ' Best Time' : ' Time'),
                    data: timeData,
                    borderColor: '#3498db',
                    backgroundColor: '#3498db20',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.1,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    yAxisID: 'y',
                    spanGaps: false
                }];
                
                // Only add age grade dataset if data is available
                if (hasAgeGradeData) {
                    datasets.push({
                        label: (scope.selectedRaceType ? scope.selectedRaceType.name : '') + (scope.performanceMode === 'best' ? ' Max Age Grade' : ' Age Grade'),
                        data: ageGradeData,
                        borderColor: '#e74c3c',
                        backgroundColor: '#e74c3c20',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.1,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        yAxisID: 'y1',
                        spanGaps: false
                    });
                    
                    // Add horizontal reference lines for age grade levels (only if toggle is enabled)
                    if (scope.showAgeGradeLines) {
                        var minAgeGrade = Math.min(...ageGradeData.filter(function(value) {
                            return value !== null && value !== undefined;
                        }));
                        var maxAgeGrade = Math.max(...ageGradeData.filter(function(value) {
                            return value !== null && value !== undefined;
                        }));
                        var minAxis = Math.floor(Math.max(0, minAgeGrade - 10));
                        
                        // Add age grade reference lines
                        addAgeGradeReferenceLines(datasets, ageGradeData, minAxis);
                    }
                }
                
                // Prepare labels based on mode
                var labels;
                if (scope.performanceMode === 'best') {
                    labels = years;
                } else {
                    // For all performances mode, create labels showing years only at first occurrence
                    var allResultsLabels = getAllResultsForRaceType(selectedRaceTypeId);
                    var seenYears = new Set();
                    labels = [];
                    
                    allResultsLabels.forEach(function(result, index) {
                        // Skip removed points
                        if (!scope.removedPoints.has(index)) {
                            var year = result.date.getUTCFullYear();
                            if (!seenYears.has(year)) {
                                seenYears.add(year);
                                labels.push(year);
                            } else {
                                labels.push('');
                            }
                        }
                    });
                }
                
                chart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: datasets
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            title: {
                                display: true,
                                text: 'Performance by Year - ' + (scope.selectedRaceType ? scope.selectedRaceType.name : ''),
                                font: {
                                    size: 16,
                                    weight: 'bold'
                                }
                            },
                            legend: {
                                display: true,
                                position: 'top',
                                labels: {
                                    usePointStyle: true,
                                    padding: 20
                                },
                                onClick: function(e, legendItem, legend) {
                                    var index = legendItem.datasetIndex;
                                    var ci = legend.chart;
                                    var meta = ci.getDatasetMeta(index);
                                    
                                    // Toggle dataset visibility
                                    meta.hidden = !meta.hidden;
                                    
                                    // Update axis visibility based on dataset visibility
                                    updateAxisVisibility(ci);
                                    
                                    ci.update();
                                }
                            },
                            tooltip: {
                                mode: 'index',
                                intersect: false,
                                filter: function(tooltipItem) {
                                    // Filter out age grade level lines from tooltip
                                    var label = tooltipItem.dataset.label;
                                    return !label.includes('Regional Level') && 
                                           !label.includes('National Level') && 
                                           !label.includes('World Level');
                                },
                                callbacks: {
                                    title: function(context) {
                                        if (scope.performanceMode === 'best') {
                                            return 'Year: ' + context[0].label;
                                        } else {
                                            // For all performances mode, get race details
                                            var allResultsData = getAllResultsForRaceType(selectedRaceTypeId);
                                            // Calculate the original index accounting for removed points
                                            var originalIndex = 0;
                                            var currentIndex = 0;
                                            
                                            while (currentIndex <= context[0].dataIndex && originalIndex < allResultsData.length) {
                                                if (!scope.removedPoints.has(originalIndex)) {
                                                    currentIndex++;
                                                }
                                                originalIndex++;
                                            }
                                            
                                            if (originalIndex > 0) {
                                                originalIndex--; // Adjust for the final increment
                                            }
                                            
                                            if (allResultsData && allResultsData[originalIndex]) {
                                                var result = allResultsData[originalIndex];
                                                var dateStr = result.date.toLocaleDateString();
                                                return result.raceName + ' - ' + dateStr;
                                            }
                                            return context[0].label;
                                        }
                                    },
                                    label: function(context) {
                                        var value = context.parsed.y;
                                        if (value === null || value === undefined) {
                                            return context.dataset.label + ': No data';
                                        }
                                        if (scope.performanceMode === 'all') {
                                            // All performances mode - use simplified labels
                                            if (context.dataset.yAxisID === 'y') {
                                                return 'Time: ' + formatTime(value);
                                            } else {
                                                return 'Age Grade: ' + value.toFixed(2) + '%';
                                            }
                                        } else {
                                            // Best per year mode - use dataset labels
                                            if (context.dataset.yAxisID === 'y') {
                                                return context.dataset.label + ': ' + formatTime(value);
                                            } else {
                                                return context.dataset.label + ': ' + value.toFixed(2) + '%';
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        scales: {
                            x: {
                                display: true,
                                title: {
                                    display: true,
                                    text: 'Year'
                                },
                                ticks: {
                                    stepSize: 1
                                }
                            },
                            y: {
                                type: 'linear',
                                display: true,
                                position: 'left',
                                title: {
                                    display: true,
                                    text: 'Time',
                                    color: '#3498db' // Blue color to match time line
                                },
                                reverse: true, // Invert the axis so faster times are at the top
                                ticks: {
                                    callback: function(value) {
                                        if (value === null || value === undefined) {
                                            return '';
                                        }
                                        return formatTime(value);
                                    },
                                    color: '#3498db' // Blue color to match time line
                                }
                            },
                            y1: {
                                type: 'linear',
                                display: hasAgeGradeData,
                                position: 'right',
                                title: {
                                    display: hasAgeGradeData,
                                    text: 'Age Grade (%)',
                                    color: '#e74c3c' // Red color to match age grade line
                                },
                                min: function(context) {
                                    // Find the minimum age grade value in the data
                                    var minAgeGrade = Math.min(...ageGradeData.filter(function(value) {
                                        return value !== null && value !== undefined;
                                    }));
                                    // Return minimum age grade minus 10%, rounded to nearest percentage, but not less than 0
                                    var minAxis = Math.max(0, minAgeGrade - 10);
                                    return Math.floor(minAxis);
                                },
                                max: 100,
                                ticks: {
                                    callback: function(value) {
                                        return value + '%';
                                    },
                                    color: '#e74c3c' // Red color to match age grade line
                                },
                                grid: {
                                    drawOnChartArea: false
                                }
                            }
                        },
                        interaction: {
                            mode: 'nearest',
                            axis: 'x',
                            intersect: false
                        },
                        onClick: function(event, elements) {
                            if (elements.length > 0) {
                                var element = elements[0];
                                var datasetIndex = element.datasetIndex;
                                var dataIndex = element.index;
                                
                                // Only allow removal of actual data points (not reference lines)
                                if (datasetIndex === 0 || datasetIndex === 1) { // Time or Age Grade datasets
                                    if (scope.performanceMode === 'best') {
                                        // In best mode, we need to find the year and remove all results for that year
                                        var years = getYearsWithData(selectedRaceTypeId);
                                        
                                        if (dataIndex < years.length) {
                                            var yearToRemove = years[dataIndex];
                                            
                                            // Find all results for this year and race type, and add them to removed points
                                            allResultsData.forEach(function(result, index) {
                                                var resultYear = result.date.getUTCFullYear();
                                                if (resultYear === yearToRemove) {
                                                    scope.removedPoints.add(index);
                                                }
                                            });
                                        }
                                    } else {
                                        // All performances mode - calculate the original index in the full dataset
                                        var originalIndex = 0;
                                        var currentIndex = 0;
                                        
                                        while (currentIndex <= dataIndex && originalIndex < allResultsData.length) {
                                            if (!scope.removedPoints.has(originalIndex)) {
                                                currentIndex++;
                                            }
                                            originalIndex++;
                                        }
                                        
                                        if (originalIndex > 0) {
                                            originalIndex--; // Adjust for the final increment
                                        }
                                        
                                        // Add to removed points set
                                        scope.removedPoints.add(originalIndex);
                                    }
                                    
                                    // Update the chart
                                    $timeout(function() {
                                        initializeChart();
                                    }, 100);
                                }
                            }
                        }
                    }
                });
                
                // Initialize axis visibility based on current dataset visibility
                updateAxisVisibility(chart);
            }
            
            function updateAxisVisibility(chart) {
                var timeDatasetVisible = false;
                var ageGradeDatasetVisible = false;
                
                // Check which datasets are visible
                chart.data.datasets.forEach(function(dataset, index) {
                    var meta = chart.getDatasetMeta(index);
                    if (!meta.hidden) {
                        if (dataset.yAxisID === 'y') {
                            timeDatasetVisible = true;
                        } else if (dataset.yAxisID === 'y1' && !dataset.label.includes('Level')) {
                            ageGradeDatasetVisible = true;
                        }
                    }
                });
                
                // Update time axis visibility
                if (chart.options.scales.y) {
                    chart.options.scales.y.display = timeDatasetVisible;
                }
                
                // Update age grade axis visibility
                if (chart.options.scales.y1) {
                    chart.options.scales.y1.display = ageGradeDatasetVisible;
                }
                
                // Update age grade reference lines visibility
                chart.data.datasets.forEach(function(dataset, index) {
                    var meta = chart.getDatasetMeta(index);
                    if (dataset.label && dataset.label.includes('Level')) {
                        meta.hidden = !ageGradeDatasetVisible;
                    }
                });
            }
            
            function addAgeGradeReferenceLines(datasets, ageGradeData, minAxis) {
                var referenceLines = [
                    { level: AGE_GRADE_LEVELS.REGIONAL, label: 'Regional Level (70%)', color: '#cd7f32' },
                    { level: AGE_GRADE_LEVELS.NATIONAL, label: 'National Level (80%)', color: '#c0c0c0' },
                    { level: AGE_GRADE_LEVELS.WORLD, label: 'World Level (90%)', color: '#ffd700' }
                ];
                
                referenceLines.forEach(function(line) {
                    if (line.level >= minAxis) {
                        datasets.push({
                            label: line.label,
                            data: ageGradeData.map(function() { return line.level; }),
                            borderColor: line.color,
                            backgroundColor: 'transparent',
                            borderWidth: 1,
                            fill: false,
                            tension: 0,
                            pointRadius: 0,
                            pointHoverRadius: 0,
                            yAxisID: 'y1',
                            spanGaps: false,
                            borderDash: [5, 1]
                        });
                    }
                });
            }
            
            function getYearsWithData(selectedRaceTypeId) {
                if (!scope.raceTypeBreakdown || !scope.raceTypeBreakdown.yearly || !selectedRaceTypeId) {
                    return [];
                }
                
                var yearsWithData = [];
                
                Object.keys(scope.raceTypeBreakdown.yearly).forEach(function(year) {
                    var yearData = scope.raceTypeBreakdown.yearly[year];
                    var hasDataForRaceType = false;
                    
                    Object.keys(yearData).forEach(function(category) {
                        var raceTypeData = yearData[category];
                        if (raceTypeData.results && raceTypeData.results.length > 0) {
                            raceTypeData.results.forEach(function(result) {
                                if (result.race && result.race.racetype && result.race.racetype._id === selectedRaceTypeId) {
                                    hasDataForRaceType = true;
                                }
                            });
                        }
                    });
                    
                    if (hasDataForRaceType) {
                        yearsWithData.push(parseInt(year));
                    }
                });
                
                return yearsWithData.sort();
            }
            
            function getAvailableRaceTypes() {
                if (!scope.raceTypeBreakdown || !scope.raceTypeBreakdown.yearly) {
                    return [];
                }
                
                var raceTypeYears = {};
                Object.keys(scope.raceTypeBreakdown.yearly).forEach(function(year) {
                    var yearData = scope.raceTypeBreakdown.yearly[year];
                    Object.keys(yearData).forEach(function(category) {
                        var raceTypeData = yearData[category];
                        if (raceTypeData.results && raceTypeData.results.length > 0) {
                            raceTypeData.results.forEach(function(result) {
                                if (result.race && result.race.racetype && result.race.racetype._id) {
                                    var raceType = result.race.racetype;
                                    
                                    // Exclude race types that contain "odd", "multisport", or non-running surfaces
                                    var excludeKeywords = ['odd', 'multisport'];
                                    var excludeSurfaces = ['open water', 'pool', 'other'];
                                    var shouldExclude = excludeKeywords.some(function(keyword) {
                                        return raceType.name.toLowerCase().includes(keyword);
                                    }) || excludeSurfaces.includes(raceType.surface);
                                    
                                    if (!shouldExclude) {
                                        if (!raceTypeYears[raceType._id]) {
                                            raceTypeYears[raceType._id] = {
                                                raceType: raceType,
                                                years: new Set()
                                            };
                                        }
                                        // Add the year this race type was raced
                                        var raceYear = new Date(result.race.racedate).getUTCFullYear();
                                        raceTypeYears[raceType._id].years.add(raceYear);
                                    }
                                }
                            });
                        }
                    });
                });
                
                // Count total results for each race type while processing
                var raceTypeResults = {};
                Object.keys(scope.raceTypeBreakdown.yearly).forEach(function(year) {
                    var yearData = scope.raceTypeBreakdown.yearly[year];
                    Object.keys(yearData).forEach(function(category) {
                        var raceTypeData = yearData[category];
                        if (raceTypeData.results && raceTypeData.results.length > 0) {
                            raceTypeData.results.forEach(function(result) {
                                if (result.race && result.race.racetype && result.race.racetype._id) {
                                    var raceTypeId = result.race.racetype._id;
                                    if (!raceTypeResults[raceTypeId]) {
                                        raceTypeResults[raceTypeId] = 0;
                                    }
                                    raceTypeResults[raceTypeId]++;
                                }
                            });
                        }
                    });
                });
                
                // Convert to array with display names and sort by distance
                var raceTypeArray = Object.values(raceTypeYears).map(function(data) {
                    var yearsCount = data.years.size;
                    var raceType = data.raceType;
                    var totalResults = raceTypeResults[raceType._id] || 0;
                    
                    var displayCount = scope.performanceMode === 'all' ? totalResults : yearsCount;
                    var displayLabel = scope.performanceMode === 'all' ? 'result' + (totalResults !== 1 ? 's' : '') : 'year' + (yearsCount > 1 ? 's' : '');
                    
                    return {
                        _id: raceType._id,
                        name: raceType.name,
                        displayName: raceType.name + ' (' + raceType.surface + ') - ' + displayCount + ' ' + displayLabel,
                        formattedDisplayName: raceType.name + ' <span class="' + scope.getRaceTypeClass(raceType.surface) + '">(' + raceType.surface + ')</span> - ' + displayCount + ' ' + displayLabel,
                        yearsCount: yearsCount,
                        totalResults: totalResults,
                        meters: raceType.meters,
                        surface: raceType.surface
                    };
                }).sort(function(a, b) {
                    // Sort by distance length (meters)
                    return a.meters - b.meters;
                });
                
                return raceTypeArray;
            }
            
            function createResultLookupMap(allResultsData) {
                var lookupMap = new Map();
                allResultsData.forEach(function(result, index) {
                    var key = result.time + '_' + result.date.getTime() + '_' + result.raceName;
                    lookupMap.set(key, index);
                });
                return lookupMap;
            }
            
            function isResultRemoved(result, allResultsData, lookupMap) {
                var key = parseFloat(result.time) + '_' + new Date(result.race.racedate).getTime() + '_' + result.race.racename;
                var index = lookupMap.get(key);
                return index !== undefined && scope.removedPoints.has(index);
            }
            
            function getBestTimeForYearAndRaceType(year, raceTypeId, allResultsData) {
                if (!scope.raceTypeBreakdown || !scope.raceTypeBreakdown.yearly || !scope.raceTypeBreakdown.yearly[year]) {
                    return null;
                }
                
                var yearData = scope.raceTypeBreakdown.yearly[year];
                var bestTime = null;
                var lookupMap = createResultLookupMap(allResultsData);
                
                Object.keys(yearData).forEach(function(category) {
                    var raceTypeData = yearData[category];
                    if (raceTypeData.results && raceTypeData.results.length > 0) {
                        raceTypeData.results.forEach(function(result) {
                            if (result.race && result.race.racetype && result.race.racetype._id === raceTypeId) {
                                if (!isResultRemoved(result, allResultsData, lookupMap)) {
                                    var timeInCentiseconds = parseFloat(result.time);
                                    if (timeInCentiseconds && timeInCentiseconds > 0) {
                                        if (bestTime === null || timeInCentiseconds < bestTime) {
                                            bestTime = timeInCentiseconds;
                                        }
                                    }
                                }
                            }
                        });
                    }
                });
                
                return bestTime;
            }
            
            function getAllResultsForRaceType(raceTypeId) {
                if (!scope.raceTypeBreakdown || !scope.raceTypeBreakdown.yearly) {
                    return [];
                }
                
                var allResults = [];
                
                Object.keys(scope.raceTypeBreakdown.yearly).forEach(function(year) {
                    var yearData = scope.raceTypeBreakdown.yearly[year];
                    Object.keys(yearData).forEach(function(category) {
                        var raceTypeData = yearData[category];
                        if (raceTypeData.results && raceTypeData.results.length > 0) {
                            raceTypeData.results.forEach(function(result) {
                                if (result.race && result.race.racetype && result.race.racetype._id === raceTypeId) {
                                    var timeInCentiseconds = parseFloat(result.time);
                                    if (timeInCentiseconds && timeInCentiseconds > 0) {
                                        allResults.push({
                                            time: timeInCentiseconds,
                                            ageGrade: parseFloat(result.agegrade) || null,
                                            date: new Date(result.race.racedate),
                                            raceName: result.race.racename
                                        });
                                    }
                                }
                            });
                        }
                    });
                });
                
                // Sort by date (oldest to newest)
                return allResults.sort(function(a, b) {
                    return a.date - b.date;
                });
            }
            

            
            function getMaxAgeGradeForYearAndRaceType(year, raceTypeId, allResultsData) {
                if (!scope.raceTypeBreakdown || !scope.raceTypeBreakdown.yearly || !scope.raceTypeBreakdown.yearly[year]) {
                    return null;
                }
                
                var yearData = scope.raceTypeBreakdown.yearly[year];
                var maxAgeGrade = null;
                var lookupMap = createResultLookupMap(allResultsData);
                
                Object.keys(yearData).forEach(function(category) {
                    var raceTypeData = yearData[category];
                    if (raceTypeData.results && raceTypeData.results.length > 0) {
                        raceTypeData.results.forEach(function(result) {
                            if (result.race && result.race.racetype && result.race.racetype._id === raceTypeId) {
                                if (!isResultRemoved(result, allResultsData, lookupMap)) {
                                    var ageGrade = parseFloat(result.agegrade);
                                    if (ageGrade && ageGrade > 0) {
                                        if (maxAgeGrade === null || ageGrade > maxAgeGrade) {
                                            maxAgeGrade = ageGrade;
                                        }
                                    }
                                }
                            }
                        });
                    }
                });
                
                return maxAgeGrade;
            }
            

            

            
            function formatTime(centiseconds) {
                if (!centiseconds || centiseconds <= 0) {
                    return 'No data';
                }
                
                // Convert centiseconds to seconds
                var totalSeconds = Math.floor(centiseconds / TIME_CONSTANTS.CENTISECONDS_PER_SECOND);
                var hours = Math.floor(totalSeconds / TIME_CONSTANTS.SECONDS_PER_HOUR);
                var minutes = Math.floor((totalSeconds % TIME_CONSTANTS.SECONDS_PER_HOUR) / TIME_CONSTANTS.SECONDS_PER_MINUTE);
                var secs = totalSeconds % TIME_CONSTANTS.SECONDS_PER_MINUTE;
                
                if (hours > 0) {
                    return hours + ':' + (minutes < 10 ? '0' : '') + minutes + ':' + (secs < 10 ? '0' : '') + secs;
                } else {
                    return minutes + ':' + (secs < 10 ? '0' : '') + secs;
                }
            }
            
            scope.updateChart = function() {
                if (scope.selectedRaceType && scope.selectedRaceType._id) {
                    // Clear removed points when switching race types or modes
                    scope.removedPoints.clear();
                    $timeout(function() {
                        initializeChart();
                    }, 100);
                }
            };
            
            scope.reloadChart = function() {
                if (scope.selectedRaceType && scope.selectedRaceType._id) {
                    // Clear removed points and reload chart
                    scope.removedPoints.clear();
                    $timeout(function() {
                        initializeChart();
                    }, 100);
                }
            };
            
            scope.onRaceTypeSelect = function(item, model) {
                scope.selectedRaceType = item;
                scope.updateChart();
            };
            
            
            
            scope.getRaceTypeClass = function(s){
                if (s !== undefined){
                    return s.replace(/ /g, '')+'-col';
                }
            };
            

            
            // Watch for changes in the data
            scope.$watch('raceTypeBreakdown', function(newVal, oldVal) {
                if (newVal && newVal.yearly && newVal !== oldVal) {
                    scope.availableRaceTypes = getAvailableRaceTypes();
                    if (scope.availableRaceTypes.length > 0 && !scope.selectedRaceType) {
                        // Find the race type with the most results
                        var raceTypeWithMostResults = scope.availableRaceTypes.reduce(function(prev, current) {
                            return (prev.totalResults > current.totalResults) ? prev : current;
                        });
                        scope.selectedRaceType = raceTypeWithMostResults;
                        scope.removedPoints.clear(); // Clear removed points for new race type
                        $timeout(function() {
                            initializeChart();
                        }, 100);
                    }
                }
            }, true);
            
            // Initialize chart when directive is ready
            $timeout(function() {
                if (scope.raceTypeBreakdown && scope.raceTypeBreakdown.yearly) {
                    scope.availableRaceTypes = getAvailableRaceTypes();
                    if (scope.availableRaceTypes.length > 0) {
                        // Find the race type with the most results
                        var raceTypeWithMostResults = scope.availableRaceTypes.reduce(function(prev, current) {
                            return (prev.totalResults > current.totalResults) ? prev : current;
                        });
                        scope.selectedRaceType = raceTypeWithMostResults;
                        initializeChart();
                    }
                }
            }, 200);
            
            // Clean up chart when directive is destroyed
            scope.$on('$destroy', function() {
                if (chart) {
                    chart.destroy();
                }
            });
        }
    };
}]);

angular.module('mcrrcApp').directive('headToHeadBarChart', ['$timeout', function($timeout) {
    return {
        restrict: 'E',
        scope: {
            data: '=',
            member1Name: '=',
            member2Name: '=',
            colors: '='
        },
        template: '<div style="position: relative; height: 300px;"><canvas></canvas></div>',
        link: function(scope, element, attrs) {
            var chart = null;
            var canvas = element.find('canvas')[0];

            function buildChart() {
                if (chart) {
                    chart.destroy();
                    chart = null;
                }

                if (!scope.data || !scope.data.labels || scope.data.labels.length === 0) {
                    return;
                }

                var labels = scope.data.labels;
                var m1Wins = scope.data.member1Wins;
                var m2Wins = scope.data.member2Wins;
                var ties = scope.data.ties;

                // Calculate percentages for 100% stacked bar
                var m1Pct = [];
                var m2Pct = [];
                var tiesPct = [];
                for (var i = 0; i < labels.length; i++) {
                    var total = m1Wins[i] + m2Wins[i] + ties[i];
                    m1Pct.push(total > 0 ? (m1Wins[i] / total) * 100 : 0);
                    m2Pct.push(total > 0 ? (m2Wins[i] / total) * 100 : 0);
                    tiesPct.push(total > 0 ? (ties[i] / total) * 100 : 0);
                }

                var member1Color = scope.colors ? scope.colors.member1 : '#008cba';
                var member2Color = scope.colors ? scope.colors.member2 : '#ee8d5e';
                var tieColor = scope.colors ? scope.colors.tie : 'grey';

                var datasets = [
                    {
                        label: scope.member1Name + ' Wins',
                        data: m1Pct,
                        backgroundColor: member1Color,
                        _rawData: m1Wins
                    },
                    {
                        label: scope.member2Name + ' Wins',
                        data: m2Pct,
                        backgroundColor: member2Color,
                        _rawData: m2Wins
                    }
                ];

                // Only add ties dataset if there are any
                var hasTies = ties.some(function(t) { return t > 0; });
                if (hasTies) {
                    datasets.push({
                        label: 'Ties',
                        data: tiesPct,
                        backgroundColor: tieColor,
                        _rawData: ties
                    });
                }

                // Custom plugin to draw bar labels and 50% line
                var barLabelsPlugin = {
                    id: 'h2hBarLabels',
                    afterDraw: function(chartInstance) {
                        var ctx = chartInstance.ctx;
                        ctx.save();
                        ctx.font = 'bold 12px Arial';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';

                        var yScale = chartInstance.scales.y;
                        var lineY = yScale.getPixelForValue(50);
                        var textHeight = 14; // approximate height of the label
                        var safeZone = textHeight / 2 + 3; // half text height + padding

                        chartInstance.data.datasets.forEach(function(dataset, dsIndex) {
                            var meta = chartInstance.getDatasetMeta(dsIndex);
                            meta.data.forEach(function(bar, index) {
                                var raw = dataset._rawData[index];
                                if (raw > 0) {
                                    var barHeight = bar.height;
                                    // Only show label if bar is tall enough
                                    if (barHeight > 16) {
                                        var labelY = bar.y + barHeight / 2;
                                        // Push label away from 50% line if it would overlap
                                        if (Math.abs(labelY - lineY) < safeZone) {
                                            // Bar top is above the line → push label up, otherwise push down
                                            if (bar.y < lineY) {
                                                labelY = lineY - safeZone;
                                            } else {
                                                labelY = lineY + safeZone;
                                            }
                                        }
                                        ctx.fillStyle = '#fff';
                                        ctx.fillText(raw, bar.x, labelY);
                                    }
                                }
                            });
                        });

                        // Draw 50% dotted horizontal line
                        ctx.beginPath();
                        ctx.setLineDash([6, 4]);
                        ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
                        ctx.lineWidth = 1.5;
                        ctx.moveTo(chartInstance.chartArea.left, lineY);
                        ctx.lineTo(chartInstance.chartArea.right, lineY);
                        ctx.stroke();
                        ctx.restore();
                    }
                };

                chart = new Chart(canvas, {
                    type: 'bar',
                    data: {
                        labels: labels.map(String),
                        datasets: datasets
                    },
                    plugins: [barLabelsPlugin],
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'top'
                            },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        var raw = context.dataset._rawData[context.dataIndex];
                                        var pct = context.parsed.y.toFixed(0);
                                        return context.dataset.label + ': ' + raw + ' (' + pct + '%)';
                                    }
                                }
                            }
                        },
                        scales: {
                            x: {
                                stacked: true
                            },
                            y: {
                                stacked: true,
                                min: 0,
                                max: 100,
                                ticks: {
                                    callback: function(value) {
                                        return value + '%';
                                    }
                                }
                            }
                        }
                    }
                });
            }

            scope.$watch('data', function(newVal) {
                if (newVal) {
                    $timeout(function() {
                        buildChart();
                    }, 100);
                }
            });

            scope.$on('$destroy', function() {
                if (chart) {
                    chart.destroy();
                }
            });
        }
    };
}]);