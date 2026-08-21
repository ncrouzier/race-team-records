// Small OSM map for the pace adjustment tool: shows where the runner is and
// where the weather reading actually came from (Open-Meteo snaps to its own
// grid, so the two are never quite the same point).
angular.module('mcrrcApp').directive('weatherMap', ['$timeout', function ($timeout) {
    return {
        restrict: 'EA',
        scope: {
            weather: '=',
            onPick: '&'
        },
        template: '<div class="weather-map-container"></div>',
        link: function (scope, element) {
            var map = null;
            var layerGroup = null;
            var pickMode = false;
            var pickLink = null;

            function container() {
                return element.find('.weather-map-container')[0];
            }

            function setPickMode(on) {
                pickMode = on;
                var mapContainer = container();
                if (mapContainer) {
                    // Crosshair cursor makes the armed state unmistakable.
                    mapContainer.classList.toggle('weather-map-picking', on);
                }
                if (pickLink) {
                    pickLink.classList.toggle('active', on);
                    pickLink.title = on
                        ? 'Click the map to read the weather there (click to cancel)'
                        : 'Pick a spot on the map';
                }
            }

            // Leaflet control that arms "click the map to read the weather there".
            function addPickControl() {
                var PickControl = L.Control.extend({
                    options: { position: 'topright' },
                    onAdd: function () {
                        var wrap = L.DomUtil.create('div', 'leaflet-bar leaflet-control weather-pick-control');
                        pickLink = L.DomUtil.create('a', '', wrap);
                        pickLink.href = '#';
                        pickLink.title = 'Pick a spot on the map';
                        pickLink.setAttribute('role', 'button');
                        pickLink.innerHTML = '<i class="fa fa-crosshairs"></i>';

                        L.DomEvent.on(pickLink, 'click', function (e) {
                            L.DomEvent.stop(e);
                            setPickMode(!pickMode);
                        });
                        // Otherwise clicking the control also counts as a map click.
                        L.DomEvent.disableClickPropagation(wrap);
                        return wrap;
                    }
                });
                map.addControl(new PickControl());
            }

            function initMap() {
                map = L.map(container(), {
                    // A tiny inline map shouldn't hijack page scrolling on
                    // mobile or steal the wheel on desktop.
                    scrollWheelZoom: false,
                    zoomControl: true,
                    attributionControl: true
                }).setView([39.0840, -77.1528], 11);

                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                    maxZoom: 18
                }).addTo(map);

                layerGroup = L.layerGroup().addTo(map);

                addPickControl();

                map.on('click', function (e) {
                    if (!pickMode) return;
                    // Leaflet fires outside Angular's digest.
                    scope.$apply(function () {
                        scope.onPick({ lat: e.latlng.lat, lon: e.latlng.lng });
                    });
                });
            }

            function render(weather) {
                if (!weather || weather.userLat == null || weather.userLon == null) return;
                if (!map) initMap();
                layerGroup.clearLayers();

                var userLatLng = [weather.userLat, weather.userLon];
                var picked = weather.origin === 'map';
                var originLabel = picked ? 'Picked spot' : 'You';

                var youIcon = L.divIcon({
                    className: 'weather-marker',
                    html: '<span class="weather-marker-pin weather-marker-you">' +
                        '<i class="fa ' + (picked ? 'fa-map-marker' : 'fa-user') + '"></i></span>',
                    iconSize: [26, 26],
                    iconAnchor: [13, 13]
                });
                L.marker(userLatLng, { icon: youIcon, title: originLabel, zIndexOffset: 900 })
                    .bindPopup('<strong>' + originLabel + '</strong><br>' +
                        weather.userLat.toFixed(4) + ', ' + weather.userLon.toFixed(4))
                    .addTo(layerGroup);

                // GPS accuracy circle — makes it clear the fix is approximate.
                if (weather.accuracyMeters) {
                    L.circle(userLatLng, {
                        radius: weather.accuracyMeters,
                        color: '#008cba',
                        weight: 1,
                        fillColor: '#008cba',
                        fillOpacity: 0.10
                    }).addTo(layerGroup);
                }

                var bounds = [userLatLng];

                if (weather.sourceLat != null && weather.sourceLon != null) {
                    var sourceLatLng = [weather.sourceLat, weather.sourceLon];

                    var sourceIcon = L.divIcon({
                        className: 'weather-marker',
                        // fa-cloud, not fa-thermometer-*: this app bundles
                        // FontAwesome 4.5, which predates the thermometer set.
                        html: '<span class="weather-marker-pin weather-marker-source"><i class="fa fa-cloud"></i></span>',
                        iconSize: [26, 26],
                        iconAnchor: [13, 13]
                    });
                    L.marker(sourceLatLng, { icon: sourceIcon, title: 'Weather reading location', zIndexOffset: 1000 })
                        .bindPopup('<strong>Weather reading</strong><br>' +
                            weather.sourceLat.toFixed(4) + ', ' + weather.sourceLon.toFixed(4))
                        .addTo(layerGroup);

                    L.polyline([userLatLng, sourceLatLng], {
                        color: '#6d6d6d',
                        weight: 2,
                        dashArray: '4,6'
                    }).addTo(layerGroup);

                    bounds.push(sourceLatLng);
                }

                if (bounds.length > 1) {
                    // The two points are typically well under a mile apart, so
                    // allow a close zoom or the markers land on top of each other.
                    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
                } else {
                    map.setView(userLatLng, 14);
                }

                // The container is inside an ng-if, so it may have had zero
                // size when Leaflet measured it — remeasure once it's laid out.
                $timeout(function () {
                    if (map) map.invalidateSize();
                }, 0);
            }

            scope.$watch('weather', function (weather) {
                if (weather) render(weather);
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
