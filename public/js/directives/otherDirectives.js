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

app.directive('usaMap', ['$timeout', '$window', 'UtilsService', function($timeout, $window, UtilsService) {
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
                return ['<div class="hoverinfo"><strong>',
                  data.count + ' races ran in ' + geo.properties.name,
                  '',
                  '</strong></div>'
                ].join('');
              }
            },
            done: function(datamap) {
              datamap.svg.call(d3.behavior.zoom().on("zoom", redraw));

              function redraw() {
                datamap.svg.selectAll("g").attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
              }
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


app.directive('worldMap', ['$timeout', '$window', 'UtilsService', function($timeout, $window, UtilsService) {
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
                return ['<div class="hoverinfo"><strong>',
                  data.count + ' races ran in ' + geo.properties.name,
                  '',
                  '</strong></div>'
                ].join('');
              }
            },
            done: function(datamap) {
              datamap.svg.call(d3.behavior.zoom().on("zoom", redraw));

              function redraw() {
                datamap.svg.selectAll("g").attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
              }
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
