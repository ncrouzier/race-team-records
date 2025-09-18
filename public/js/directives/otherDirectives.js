var app = angular.module('mcrrcApp');


app.directive('selectOnClick', function($window) {
  return {
    link: function(scope, element) {
      element.on('click', function() {
        var selection = $window.getSelection();
        var range = document.createRange();
        range.selectNodeContents(element[0]);
        selection.removeAllRanges();
        selection.addRange(range);
      });
    }
  };
});

app.directive('imageonload', function() {
  return {
      restrict: 'A',
      link: function(scope, element, attrs) {
          element.bind('load', function() {
              //call the function that was passed
              scope.$apply(attrs.imageonload);
          });
      }
  };
});

app.directive('usaMap', ['$timeout', '$window', 'UtilsService','$state', function($timeout, $window, UtilsService,$state) {
  return {
    restrict: 'EA',
    link: function($scope, element, $attr) {

      UtilsService.getLocationInfo({
        "type": 'state'
      }).then(function(results) {
        $timeout(function() {

          // color scale map with help from http://jsbin.com/sotenonese/edit?html,output
          var dataset = {};
          var onlyValues = results.map(function(obj){ return obj[1]; });
          var minValue = Math.min.apply(null, onlyValues),
              maxValue = Math.max.apply(null, onlyValues);

          var paletteScale = d3.scale.log()
                  .domain([minValue,maxValue])
                  .range(["#007196","red"]);

          results.forEach(function(item){ //
              var iso = item[0],value = item[1];
              dataset[iso] = { count: value, fillColor: paletteScale(value) };
          });

          var map = new Datamap({
            element: element[0],
            scope: 'usa',
            responsive: true,
            fills: {
              defaultFill: '#afafaf'
            },
            data: dataset,
            geographyConfig: {
              highlightBorderWidth: 2,
              highlightFillColor: function(geo) {
                return geo.fillColor || '#afafaf';
              },
              highlightBorderColor: 'red',
              popupTemplate: function(geo, data) {
                if(data.count > 1){
                  return ['<div class="hoverinfo"><strong>',
                    data.count + ' races ran in ' + geo.properties.name,
                    '',
                    '</strong></div>'
                  ].join('');
                }else{
                  return ['<div class="hoverinfo"><strong>',
                    data.count + ' race ran in ' + geo.properties.name,
                    '',
                    '</strong></div>'
                  ].join('');
                }        
              }
            },
            done: function(datamap) {
              datamap.svg.call(d3.behavior.zoom().on("zoom", redraw));

              function redraw() {
                datamap.svg.selectAll("g").attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
              }
              datamap.svg.selectAll('.datamaps-subunit').each(function(d){
                if(dataset[d.id] && dataset[d.id].count > 0){
                  d3.select(this).style('cursor', 'pointer');
                  d3.select(this).on('click', function(ele) {                  
                  $state.go("/results",{ search: "{\"states\":[\""+ele.id+"\"]}"});                   
                });      
              }});
              

            }
          });

          onResize = function() {
            map.resize();
          };
          cleanUp = function() {
            angular.element($window).off('resize', onResize);
          };
          angular.element($window).bind('resize', onResize);
          $scope.$on('$destroy', cleanUp);

        }, 10);
      });
    }
  };
}]);


app.directive('worldMap', ['$timeout', '$window', 'UtilsService','$state', function($timeout, $window, UtilsService,$state) {
  return {
    restrict: 'EA',
    link: function($scope, element, $attr) {

      UtilsService.getLocationInfo({
        "type": 'country'
      }).then(function(results) {
        $timeout(function() {

          var dataset = {};
          var onlyValues = results.map(function(obj){ return obj[1]; });
          var minValue = Math.min.apply(null, onlyValues),
              maxValue = Math.max.apply(null, onlyValues);

          var paletteScale = d3.scale.log()
                  .domain([minValue,maxValue])
                  .range(["#007196","red"]);

          results.forEach(function(item){
              var iso = item[0],
                  value = item[1];
              dataset[iso] = { count: value, fillColor: paletteScale(value) };
          });

          var map = new Datamap({
            element: element[0],
            projection: 'mercator',
            scope: 'world',
            responsive: true,
            fills: {
              defaultFill: '#afafaf'
            },
            data: dataset,
            geographyConfig: {
              highlightBorderWidth: 2,
              highlightFillColor: function(geo) {
                return geo.fillColor || '#afafaf';
              },
              highlightBorderColor: 'red',
              popupTemplate: function(geo, data) {
                if(data.count > 1){
                  return ['<div class="hoverinfo"><strong>',
                    data.count + ' races ran in ' + geo.properties.name,
                    '',
                    '</strong></div>'
                  ].join('');
                }else{
                  return ['<div class="hoverinfo"><strong>',
                    data.count + ' race ran in ' + geo.properties.name,
                    '',
                    '</strong></div>'
                  ].join('');
                }        
              }
            },
            done: function(datamap) {
              datamap.svg.call(d3.behavior.zoom().on("zoom", redraw));

              function redraw() {
                datamap.svg.selectAll("g").attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
              }

              datamap.svg.selectAll('.datamaps-subunit').each(function(d){
                if(dataset[d.id] && dataset[d.id].count > 0){
                  d3.select(this).style('cursor', 'pointer');
                  d3.select(this).on('click', function(ele) {                  
                  $state.go("/results",{ search: "{\"countries\":[\""+ele.id+"\"]}"});                   
                });      
              }});
            }
          });

          onResize = function() {
            map.resize();
          };
          cleanUp = function() {
            angular.element($window).off('resize', onResize);
          };
          angular.element($window).bind('resize', onResize);
          $scope.$on('$destroy', cleanUp);

        }, 10);
      });
    }
  };
}]);

// Race Achievements Directive
angular.module('mcrrcApp').directive('raceAchievements', ['UtilsService', function(UtilsService) {
    return {
        restrict: 'E',
        scope: {
            race: '='
        },
        template: '<span>' +
            '<span ng-repeat="ach in achievements" ng-if="ach.emoji" uib-tooltip="{{ach.tooltip}}" tooltip-placement="top" tooltip-trigger="mouseenter" tooltip-popup-delay="100" tooltip-append-to-body="true">{{ach.emoji}}</span>' +
            '<img ng-repeat="ach in achievements" ng-if="ach.flag" ng-src="{{ach.flag}}" alt="Location flag" class="achievement-flag" uib-tooltip="{{ach.tooltip}}" tooltip-placement="top" tooltip-trigger="mouseenter" tooltip-popup-delay="100" tooltip-append-to-body="true" onerror="this.style.display=\'none\'">' +
            '<i ng-repeat="ach in achievements" ng-if="ach.icon" ng-class="ach.icon" uib-tooltip="{{ach.tooltip}}" tooltip-placement="top" tooltip-trigger="mouseenter" tooltip-popup-delay="100" tooltip-append-to-body="true"></i>' +
        '</span>',
        controller: function($scope) {
            $scope.achievements = [];
            
            $scope.$watch('race', function(newRace) {
                if (newRace && newRace.results) {
                    $scope.achievements = $scope.getAchievements(newRace);
                }
            }, true);
            
            $scope.getAchievements = function (race) {
                if (!race.results || race.results.length === 0) {
                    return [];
                }
                var achievements = [];
                // Trophy for overall or gender win
                var overallWins = race.results.filter(function (result) {
                    return result.ranking && (result.ranking.overallrank === 1 || result.ranking.genderrank === 1);
                });
                if (overallWins.length > 0) {
                    achievements.push({type: 'trophy', emoji: '🏆', tooltip: 'Race winner!'});
                }
                // Silver for 2nd place
                var secondPlace = race.results.filter(function (result) {
                    return result.ranking && (result.ranking.overallrank === 2 || result.ranking.genderrank === 2);
                });
                if (secondPlace.length > 0) {
                    achievements.push({type: 'second', emoji: '🥈', tooltip: '2nd Place'});
                }
                // Bronze for 3rd place
                var thirdPlace = race.results.filter(function (result) {
                    return result.ranking && (result.ranking.overallrank === 3 || result.ranking.genderrank === 3);
                });
                if (thirdPlace.length > 0) {
                    achievements.push({type: 'third', emoji: '🥉', tooltip: '3rd Place'});
                }
                // Personal bests
                var personalBests = race.results.filter(function (result) {
                    return Array.isArray(result.achievements) && result.achievements.some(function(a) {
                        return a.name && a.name.toLowerCase() === 'pb';
                    });
                });
                if (personalBests.length > 0) {
                    achievements.push({type: 'pb', emoji: '🧨', tooltip: 'Personal Best on the team'});
                }
                // National class (agegrade >= 90)
                var excellentAgeGrades = race.results.filter(function (result) {
                    return result.agegrade && result.agegrade >= 90;
                });
                if (excellentAgeGrades.length > 0) {
                    achievements.push({type: 'nationalClass', icon: 'ageworld fa fa-star', tooltip: 'World Class age grade performance'});
                }
                
                // New location achievement
                if (race.achievements && race.achievements.some(function(a) {
                    return a.name && a.name.toLowerCase() === 'newlocation';
                })) {
                    var locationAchievement = race.achievements.find(function(a) {
                        return a.name && a.name.toLowerCase() === 'newlocation';
                    });
                    
                    if (locationAchievement && locationAchievement.value) {
                        var locationName = 'this location';
                        var flag = '';
                        var tooltip = '';
                        
                        // Use state flag if available, otherwise country emoji
                        if (locationAchievement.value.state) {
                            var stateName = UtilsService.getStateNameFromCode(locationAchievement.value.state);
                            locationName = stateName;
                            flag = UtilsService.getStateFlag(locationAchievement.value.state);
                            tooltip = 'First team race in ' + locationName + '!';
                            
                            if (flag) {
                                achievements.push({
                                    type: 'newLocation', 
                                    flag: flag, 
                                    tooltip: tooltip
                                });
                            } else {
                                achievements.push({
                                    type: 'newLocation', 
                                    emoji: '🗺️', 
                                    tooltip: tooltip
                                });
                            }
                        } else if (locationAchievement.value.country) {
                            var countryName = UtilsService.getCountryNameFromCode(locationAchievement.value.country);
                            locationName = countryName;
                            var countryEmoji = UtilsService.getCountryFlag(locationAchievement.value.country);
                            tooltip = 'First team race in ' + locationName + '!';
                            
                            achievements.push({
                                type: 'newLocation', 
                                emoji: countryEmoji, 
                                tooltip: tooltip
                            });
                        } else {
                            // Fallback to locationName if provided, otherwise generic message
                            if (locationAchievement.value.locationName) {
                                locationName = locationAchievement.value.locationName;
                            }
                            tooltip = 'First team race in ' + locationName + '!';
                            
                            achievements.push({
                                type: 'newLocation', 
                                emoji: '🗺️', 
                                tooltip: tooltip
                            });
                        }
                    } else {
                        achievements.push({
                            type: 'newLocation', 
                            emoji: '🗺️', 
                            tooltip: 'First team race in this location!'
                        });
                    }
                }
                return achievements;
            };
        }
    };
}]);

// D3 Interactive Pie Chart Directive
app.directive('d3PieChart', function() {
    return {
        restrict: 'E',
        scope: {
            data: '=',
            width: '@',
            height: '@',
            onSliceClick: '&'
        },
        template: '<div class="d3-pie-chart-container" style="display: flex; flex-direction: column; align-items: center; width: 100%;"><div class="d3-pie-svg"></div><div class="d3-pie-legend" style="min-width: 200px; max-width: 400px;"></div></div>',
        link: function(scope, element, attrs) {
            // Check if D3 is available
            if (typeof d3 === 'undefined') {
                console.error('D3 is not loaded');
                return;
            }
            
            var width = parseInt(scope.width) || 300;
            var height = parseInt(scope.height) || 300;
            var radius = Math.min(width, height) / 2;
            
            var svg, pie, arc, color;
            
            function initChart() {
                // Clear existing chart
                element.find('.d3-pie-svg').empty();
                element.find('.d3-pie-legend').empty();
                
                // Create SVG in left div
                var svgContainer = element.find('.d3-pie-svg')[0];
                if (!svgContainer) {
                    console.error('SVG container not found');
                    return;
                }
                
                svg = d3.select(svgContainer)
                    .append('svg')
                    .attr('width', width)
                    .attr('height', height)
                    .style('overflow', 'visible')
                    .append('g')
                    .attr('transform', 'translate(' + width / 2 + ',' + (height / 2) + ')');
                
                // Create pie layout
                pie = d3.layout.pie()
                    .value(function(d) { return d.count; })
                    .sort(null);
                
                // Create arc generator
                arc = d3.svg.arc()
                    .innerRadius(0)
                    .outerRadius(radius);
                
                // Create color scale with more colors to avoid repetition
                color = d3.scale.ordinal()
                    .domain(scope.data.map(function(d, i) { return i; }))
                    .range([
                        '#007bff', '#28a745', '#ffc107', '#fd7e14', '#e83e8c', '#dc3545', '#6f42c1', '#6c757d',
                        '#20c997', '#17a2b8', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3',
                        '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43', '#10ac84', '#ee5a24', '#0abde3', '#48dbfb',
                        '#2ecc71', '#9b59b6', '#f39c12', '#1abc9c', '#34495e', '#e67e22', '#3498db', '#8e44ad',
                        '#16a085', '#c0392b', '#d35400', '#27ae60', '#2980b9', '#f1c40f', '#7f8c8d', '#95a5a6'
                    ]);
                
                return svgContainer; // Return the container for use in updateChart
            }
            
            function updateChart() {
                if (!scope.data || !scope.data.length) {
                    return;
                }
                
                var svgContainer = initChart();
                
                // Create tooltip
                var tooltip = d3.select('body').append('div')
                    .attr('class', 'd3-tooltip')
                    .style('position', 'absolute')
                    .style('background', 'rgba(0, 0, 0, 0.8)')
                    .style('color', 'white')
                    .style('padding', '8px')
                    .style('border-radius', '4px')
                    .style('font-size', '12px')
                    .style('pointer-events', 'none')
                    .style('opacity', 0)
                    .style('z-index', 1000);
                
                // Create pie slices
                var pieData = pie(scope.data);
                
                var slices = svg.selectAll('.slice')
                    .data(pieData)
                    .enter()
                    .append('g')
                    .attr('class', 'slice')
                    .style('cursor', 'pointer');
                
                // Add paths for slices
                slices.append('path')
                    .attr('d', arc)
                    .attr('fill', function(d, i) { return color(i); })
                    .attr('stroke', '#fff')
                    .attr('stroke-width', 2)
                    .style('transition', 'all 0.3s ease')
                    .on('mouseover', function(d, i) {
                        d3.select(this)
                            .attr('transform', 'scale(1.10)') // less aggressive scale
                            .style('opacity', 0.85);

                            
                        
                        // Highlight corresponding legend item
                        legendDiv.selectAll('.legend-item')
                            .style('background-color', function(legendData, legendIndex) {
                                return legendIndex === i ? 'rgba(0, 123, 255, 0.1)' : 'transparent';
                            })
                            .style('border-radius', function(legendData, legendIndex) {
                                return legendIndex === i ? '4px' : '0px';
                            })
                            .style('padding', function(legendData, legendIndex) {
                                return legendIndex === i ? '2px 4px' : '2px 0';
                            });
                        
                        tooltip.transition()
                            .duration(200)
                            .style('opacity', 1);
                        
                        tooltip.html(
                            '<strong>' + d.data.name + '</strong><br/>' +
                            d.data.count + ' races (' + d.data.percentage + '%)'
                        )
                        .style('left', (d3.event.pageX + 10) + 'px')
                        .style('top', (d3.event.pageY - 10) + 'px');
                    })
                    .on('mouseout', function(d, i) {
                        d3.select(this)
                            .attr('transform', 'scale(1)')
                            .style('opacity', 1);
                        
                        // Restore all legend items
                        legendDiv.selectAll('.legend-item')
                            .style('background-color', 'transparent')
                            .style('border-radius', '0px')
                            .style('padding', '2px 0');
                        
                        tooltip.transition()
                            .duration(500)
                            .style('opacity', 0);
                    })
                    .on('click', function(d) {
                        if (scope.onSliceClick) {
                            scope.$apply(function() {
                                scope.onSliceClick({data: d.data});
                            });
                        }
                    });
                
                // Add labels
                slices.append('text')
                    .attr('transform', function(d) {
                        var centroid = arc.centroid(d);
                        return 'translate(' + centroid[0] + ',' + centroid[1] + ')';
                    })
                    .attr('text-anchor', 'middle')
                    .attr('dy', '0.35em')
                    .style('font-size', '12px')
                    .style('font-weight', 'bold')
                    .style('fill', 'white')
                    .style('text-shadow', '1px 1px 2px rgba(0,0,0,0.8)')
                    // .text(function(d) {
                    //     return d.data.percentage >= 5 ? d.data.name + '%' : '';
                    // })
                    ;
                
                // Render legend as HTML in right div
                var legendContainer = element.find('.d3-pie-legend')[0];
                
                if (!legendContainer) {
                    console.error('Legend container not found');
                    return;
                }
                
                // Calculate required height for legend with wrapping
                var legendItemHeight = 20;
                var legendItemWidth = 120; // Approximate width per legend item
                var legendPadding = 30; // 15px top + 15px bottom
                var legendContainerWidth = 400; // Max width of legend container
                var itemsPerRow = Math.floor(legendContainerWidth / legendItemWidth);
                var numberOfRows = Math.ceil(scope.data.length / itemsPerRow);
                var requiredLegendHeight = (numberOfRows * legendItemHeight) + legendPadding;
                
                // Use the larger of chart height or legend height
                var finalHeight = Math.max(height, requiredLegendHeight);
                
                // Update SVG height to match
                var svgElement = d3.select(svgContainer).select('svg');
                svgElement.attr('height', finalHeight);
                
                var legendDiv = d3.select(legendContainer)
                    .style('display', 'flex')
                    .style('flex-direction', 'row')
                    .style('flex-wrap', 'wrap')
                    .style('justify-content', 'left')
                    .style('align-items', 'flex-start')
                    .style('height', requiredLegendHeight + 'px')
                    .style('overflow-y', 'visible')
                    .style('margin-top', '8px')
                    .style('padding', '15px')
                    .style('background-color', '#f8f9fa')
                    .style('border-radius', '6px')
                    .style('border', '1px solid #dee2e6')
                    .style('min-height', '120px') 
                    .style('min-width', '200px')
                    .style('max-width', '500px');
                
                var legendItems = legendDiv.selectAll('.legend-item')
                    .data(scope.data)
                    .enter()
                    .append('div')
                    .attr('class', 'legend-item')
                    .style('display', 'flex')
                    .style('align-items', 'center')
                    .style('margin', '4px 0')
                    .style('cursor', 'pointer')
                    .style('padding', '2px 0')
                    .style('transition', 'all 0.2s ease')
                    .on('mouseenter', function(d, i) {
                        // Highlight corresponding pie slice with same behavior as slice hover
                        svg.selectAll('.slice')
                            .each(function(sliceData, sliceIndex) {
                                if (sliceIndex === i) { 
                                    // Scale and opacity for hovered slice
                                    d3.select(this).select('path')
                                        .attr('transform', 'scale(1.10)')
                                        .style('opacity', 0.85);
                                } 
                                // else {
                                //     // Fade other slices
                                //     d3.select(this).select('path')
                                //         .attr('transform', 'scale(1)')
                                //         .style('opacity', 0.3);
                                // }
                            });
                        
                        // Highlight legend item
                        d3.select(this)
                            .style('background-color', 'rgba(0, 123, 255, 0.1)')
                            .style('border-radius', '4px')
                            .style('padding', '2px 4px');
                    })
                    .on('mouseleave', function(d, i) {
                        // Restore all pie slices to normal state
                        svg.selectAll('.slice path')
                            .attr('transform', 'scale(1)')
                            .style('opacity', 1);
                        
                        // Restore legend item
                        d3.select(this)
                            .style('background-color', 'transparent')
                            .style('padding', '2px 0');
                    })
                    .on('click', function(d) {
                        if (scope.onSliceClick) {
                            scope.$apply(function() {
                                scope.onSliceClick({data: d});
                            });
                        }
                    });
                
                legendItems.append('span')
                    .style('display', 'inline-block')
                    .style('width', '14px')
                    .style('height', '14px')
                    .style('margin-left', '5px')
                    .style('background-color', function(d, i) { return color(i); })
                    .style('border', '1px solid #fff')
                    .style('border-radius', '2px');
                
                legendItems.append('span')
                    .style('font-size', '12px')
                    .style('color', 'black')
                    .style('font-weight', '500')
                    .text(function(d) {
                        var displayName = d.name.length > 16 ? d.name.substring(0, 16) + '...' : d.name;
                        return displayName + ' (' + d.count + ')';
                    });
                

            }
            
            // Watch for data changes
            scope.$watch('data', function(newVal, oldVal) {
                if (newVal && newVal.length > 0) {
                    updateChart();
                }
            }, true);
            
            // Cleanup on destroy
            scope.$on('$destroy', function() {
                d3.select('body').selectAll('.d3-tooltip').remove();
            });
        }
    };
});
