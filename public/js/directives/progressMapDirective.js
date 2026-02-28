angular.module('mcrrcApp').directive('progressMap', ['$timeout', '$filter', function ($timeout, $filter) {
    return {
        restrict: 'EA',
        scope: {
            routeData: '=',
            segments: '=',
            waypoints: '=',
            totalTeamMiles: '=',
            totalRouteMiles: '=',
            reachedEnd: '=',
            onRaceClick: '&'
        },
        template: '<div class="progress-map-container" style="height: 500px; width: 100%;"></div>',
        link: function (scope, element) {
            var map = null;
            var layerGroup = null;

            function initMap() {
                if (map) {
                    map.remove();
                }
                var container = element.find('.progress-map-container')[0];
                map = L.map(container).setView([39.5, -98.35], 4);

                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                    maxZoom: 18
                }).addTo(map);

                layerGroup = L.layerGroup().addTo(map);
            }

            function updateMap() {
                if (!map) initMap();
                layerGroup.clearLayers();

                if (!scope.routeData || !scope.routeData.geometry) return;

                // Draw the full route as a gray background line
                var fullRouteCoords = scope.routeData.geometry.coordinates.map(function (c) {
                    return [c[1], c[0]];
                });
                L.polyline(fullRouteCoords, {
                    color: '#6d6d6dff',
                    weight: 4,
                    opacity: 0.5,
                    dashArray: '8, 8'
                }).addTo(layerGroup);

                // Draw each race segment as a colored line
                if (scope.segments && scope.segments.length > 0) {
                    scope.segments.forEach(function (seg) {
                        if (seg.coords && seg.coords.length >= 2) {
                            var latLngs = seg.coords.map(function (c) {
                                return [c[1], c[0]];
                            });
                            var polyline = L.polyline(latLngs, {
                                color: seg.color,
                                weight: 6,
                                opacity: 0.85
                            }).addTo(layerGroup);

                            var dateStr = $filter('date')(seg.raceDate, 'MMM d, yyyy', 'UTC');
                            polyline.bindTooltip(
                                '<strong>' + seg.raceName + '</strong><br>' +
                                (dateStr ? dateStr + '<br>' : '') +
                                (seg.raceTypeName ? seg.raceTypeName + '<br>' : '') +
                                seg.teamMiles.toFixed(1) + ' team miles',
                                { sticky: true }
                            );

                            polyline.on('click', function () {
                                scope.$apply(function () {
                                    scope.onRaceClick({ race: seg.race });
                                });
                            });
                        }
                    });

                    // Add a flag marker at the current progress point
                    var lastSegWithCoords = null;
                    for (var i = scope.segments.length - 1; i >= 0; i--) {
                        if (scope.segments[i].coords && scope.segments[i].coords.length > 0) {
                            lastSegWithCoords = scope.segments[i];
                            break;
                        }
                    }
                    if (lastSegWithCoords) {
                        var endCoord = lastSegWithCoords.coords[lastSegWithCoords.coords.length - 1];
                        var progressIcon = L.divIcon({
                            className: 'progress-marker',
                            html: '<i class="fa fa-flag" style="color: #e83e8c; font-size: 20px; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);"></i>',
                            iconSize: [20, 20],
                            iconAnchor: [4, 18]
                        });
                        L.marker([endCoord[1], endCoord[0]], {
                            icon: progressIcon,
                            title: 'Current Progress',
                            zIndexOffset: 1000
                        }).bindPopup(
                            '<strong>Current Progress</strong><br>' +
                            scope.totalTeamMiles.toFixed(0) + ' of ' +
                            scope.totalRouteMiles.toFixed(0) + ' miles'
                        ).addTo(layerGroup);
                    }
                }

                // waypoint markers
                if (scope.waypoints && scope.waypoints.length > 0) {
                    scope.waypoints.forEach(function (wp, idx) {
                        // Skip the start point (index 0)
                        if (idx === 0) return;

                        var color = wp.reached ? '#28a745' : '#999';
                        var icon = L.divIcon({
                            className: 'waypoint-marker',
                            html: '<div style="width:10px;height:10px;border-radius:50%;background:' + color +
                                ';border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.4);"></div>',
                            iconSize: [10, 10],
                            iconAnchor: [5, 5]
                        });
                        L.marker([wp.lat, wp.lng], {
                            icon: icon,
                            title: wp.name
                        }).bindTooltip(wp.name + (wp.reached ? ' (reached)' : ''), {
                            direction: 'top',
                            offset: [0, -5]
                        }).addTo(layerGroup);
                    });
                }

                // Start marker
                var startIcon = L.divIcon({
                    className: 'progress-marker',
                    html: '<i class="fa fa-play-circle" style="color: #28a745; font-size: 22px; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);"></i>',
                    iconSize: [22, 22],
                    iconAnchor: [11, 11]
                });
                var startLabel = scope.routeData.startLabel || 'Start';
                var startLat = scope.routeData.startLat || 38.9784;
                var startLng = scope.routeData.startLng || -77.1528;
                L.marker([startLat, startLng], { icon: startIcon, title: 'Start: ' + startLabel, zIndexOffset: 900 })
                    .bindPopup('<strong>Start</strong><br>' + startLabel)
                    .addTo(layerGroup);

                // Fit map bounds to the route
                if (fullRouteCoords.length > 0) {
                    map.fitBounds(L.latLngBounds(fullRouteCoords), { padding: [30, 30] });
                }
            }

            scope.$watchCollection('segments', function (newVal) {
                if (newVal) {
                    $timeout(function () {
                        updateMap();
                    }, 100);
                }
            });

            scope.$watch('routeData', function (newVal, oldVal) {
                if (newVal) {
                    $timeout(function () {
                        if (!map) initMap();
                        updateMap();
                    }, 100);
                }
            });

            scope.$on('centerMap', function (event, data) {
                if (map && data && data.lat && data.lng) {
                    map.setView([data.lat, data.lng], data.zoom || 8);
                }
            });

            scope.$on('fitMapBounds', function (event, data) {
                if (map && data && data.bounds && data.bounds.length >= 2) {
                    map.fitBounds(data.bounds, { padding: [40, 40], maxZoom: 12 });
                }
            });

            scope.$on('resetMap', function () {
                if (map && scope.routeData && scope.routeData.geometry) {
                    var coords = scope.routeData.geometry.coordinates.map(function (c) {
                        return [c[1], c[0]];
                    });
                    if (coords.length > 0) {
                        map.fitBounds(L.latLngBounds(coords), { padding: [30, 30] });
                    }
                }
            });

            scope.$on('$destroy', function () {
                if (map) {
                    map.remove();
                    map = null;
                }
            });
        }
    };
}]);
