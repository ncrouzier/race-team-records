angular.module('mcrrcApp').controller('ProgressMapController',
    ['$scope', 'AuthService', 'ResultsService', 'MemoryCacheService', '$http', '$q', 'localStorageService',
        function ($scope, AuthService, ResultsService, MemoryCacheService, $http, $q, localStorageService) {

            // Auth
            $scope.authService = AuthService;
            $scope.$watch('authService.isLoggedIn()', function (user) {
                $scope.user = user;
            });

            // Year setup
            var currentYear = new Date().getFullYear();
            $scope.yearsList = [];
            for (var i = currentYear; i >= 2013; i--) {
                $scope.yearsList.push(i);
            }

            $scope.loading = true;
            $scope.routeData = null;
            $scope.segments = [];
            $scope.totalRouteMiles = 0;
            $scope.totalTeamMiles = 0;
            $scope.progressPercent = 0;
            $scope.reachedEnd = false;
            $scope.waypoints = [];
            $scope.nextWaypoint = null;
            var savedMapMode = localStorageService.get('progressMapMode');
            $scope.view = { table: 'segments', mapMode: savedMapMode === 'members' ? 'members' : 'races' };

            // ---- Route definitions ----
            // Each route has its own start point; OSRM optimizes waypoint order
            var ROUTES = [
                {
                    key: 'crossCountry2',
                    name: 'Cross Country to SF (2,941 miles)',
                    description: 'MCRRC HQ to Golden Gate Bridge via major cities',
                    start: { lat: 39.096731, lng: -77.1405693, name: 'MCRRC HQ, Rockville, MD' },
                    waypoints: [
                        { name: 'Pittsburgh, PA', lat: 40.4406, lng: -79.9959 },
                        { name: 'Columbus, OH', lat: 39.9612, lng: -82.9988 },
                        { name: 'Indianapolis, IN', lat: 39.7684, lng: -86.1581 },
                        { name: 'St. Louis, MO', lat: 38.6270, lng: -90.1994 },
                        { name: 'Kansas City, MO', lat: 39.0997, lng: -94.5786 },
                        { name: 'Denver, CO', lat: 39.7392, lng: -104.9903 },
                        { name: 'Salt Lake City, UT', lat: 40.7608, lng: -111.8910 },
                        { name: 'Reno, NV', lat: 39.5296, lng: -119.8138 },
                        { name: 'Sacramento, CA', lat: 38.5816, lng: -121.4944 },
                        { name: 'Golden Gate Bridge, SF', lat: 37.8199, lng: -122.4783 }
                    ]
                },
                {
                    key: 'perimeterUS',
                    name: 'US Perimeter (9,402 miles)',
                    description: 'Around the entire contiguous US border and back to MCRRC HQ',
                    start: { lat: 39.096731, lng: -77.1405693, name: 'MCRRC HQ, Rockville, MD' },
                    waypoints: [
                        { name: 'Portland, ME', lat: 43.6591, lng: -70.2568 },
                        { name: 'Boston, MA', lat: 42.3601, lng: -71.0589 },
                        { name: 'New York, NY', lat: 40.7128, lng: -74.0060 },
                        { name: 'Virginia Beach, VA', lat: 36.8529, lng: -75.9780 },
                        { name: 'Wilmington, NC', lat: 34.2257, lng: -77.9447 },
                        { name: 'Charleston, SC', lat: 32.7765, lng: -79.9311 },
                        { name: 'Jacksonville, FL', lat: 30.3322, lng: -81.6557 },
                        { name: 'Miami, FL', lat: 25.7617, lng: -80.1918 },
                        { name: 'Key West, FL', lat: 24.5551, lng: -81.7800 },
                        { name: 'Tampa, FL', lat: 27.9506, lng: -82.4572 },
                        { name: 'Mobile, AL', lat: 30.6954, lng: -88.0399 },
                        { name: 'New Orleans, LA', lat: 29.9511, lng: -90.0715 },
                        { name: 'Houston, TX', lat: 29.7604, lng: -95.3698 },
                        { name: 'San Antonio, TX', lat: 29.4241, lng: -98.4936 },
                        { name: 'El Paso, TX', lat: 31.7619, lng: -106.4850 },
                        { name: 'Tucson, AZ', lat: 32.2226, lng: -110.9747 },
                        { name: 'San Diego, CA', lat: 32.7157, lng: -117.1611 },
                        { name: 'Los Angeles, CA', lat: 34.0522, lng: -118.2437 },
                        { name: 'San Francisco, CA', lat: 37.7749, lng: -122.4194 },
                        { name: 'Portland, OR', lat: 45.5155, lng: -122.6789 },
                        { name: 'Seattle, WA', lat: 47.6062, lng: -122.3321 },
                        { name: 'Spokane, WA', lat: 47.6588, lng: -117.4260 },
                        { name: 'Glacier NP, MT', lat: 48.7596, lng: -113.7870 },
                        { name: 'Bismarck, ND', lat: 46.8083, lng: -100.7837 },
                        { name: 'Fargo, ND', lat: 46.8772, lng: -96.7898 },
                        { name: 'Minneapolis, MN', lat: 44.9778, lng: -93.2650 },
                        { name: 'Chicago, IL', lat: 41.8781, lng: -87.6298 },
                        { name: 'Detroit, MI', lat: 42.3314, lng: -83.0458 },
                        { name: 'Buffalo, NY', lat: 42.8864, lng: -78.8784 },
                        { name: 'Burlington, VT', lat: 44.4759, lng: -73.2121 },
                        { name: 'MCRRC HQ, Rockville, MD', lat: 39.096731, lng: -77.1405693 }
                    ]
                },
                {
                    key: 'stateCapitals2',
                    name: 'State Capitals + DC (13,355 miles)',
                    description: 'From MCRRC HQ through all 48 contiguous state capitals + DC',
                    start: { lat: 39.096731, lng: -77.1405693, name: 'MCRRC HQ, Rockville, MD' },
                    waypoints: [
                        { name: 'Washington, DC', lat: 38.8951, lng: -77.0364 },
                        { name: 'Montgomery, AL', lat: 32.3792, lng: -86.3077 },
                        { name: 'Phoenix, AZ', lat: 33.4484, lng: -112.0740 },
                        { name: 'Little Rock, AR', lat: 34.7465, lng: -92.2896 },
                        { name: 'Sacramento, CA', lat: 38.5816, lng: -121.4944 },
                        { name: 'Denver, CO', lat: 39.7392, lng: -104.9903 },
                        { name: 'Hartford, CT', lat: 41.7658, lng: -72.6734 },
                        { name: 'Dover, DE', lat: 39.1582, lng: -75.5244 },
                        { name: 'Tallahassee, FL', lat: 30.4383, lng: -84.2807 },
                        { name: 'Atlanta, GA', lat: 33.7490, lng: -84.3880 },
                        { name: 'Boise, ID', lat: 43.6150, lng: -116.2023 },
                        { name: 'Springfield, IL', lat: 39.7817, lng: -89.6501 },
                        { name: 'Indianapolis, IN', lat: 39.7684, lng: -86.1581 },
                        { name: 'Des Moines, IA', lat: 41.5868, lng: -93.6250 },
                        { name: 'Topeka, KS', lat: 39.0473, lng: -95.6752 },
                        { name: 'Frankfort, KY', lat: 38.2009, lng: -84.8733 },
                        { name: 'Baton Rouge, LA', lat: 30.4515, lng: -91.1871 },
                        { name: 'Augusta, ME', lat: 44.3106, lng: -69.7795 },
                        { name: 'Annapolis, MD', lat: 38.9784, lng: -76.4922 },
                        { name: 'Boston, MA', lat: 42.3601, lng: -71.0589 },
                        { name: 'Lansing, MI', lat: 42.7325, lng: -84.5555 },
                        { name: 'Saint Paul, MN', lat: 44.9537, lng: -93.0900 },
                        { name: 'Jackson, MS', lat: 32.2988, lng: -90.1848 },
                        { name: 'Jefferson City, MO', lat: 38.5767, lng: -92.1735 },
                        { name: 'Helena, MT', lat: 46.5884, lng: -112.0245 },
                        { name: 'Lincoln, NE', lat: 40.8136, lng: -96.7026 },
                        { name: 'Carson City, NV', lat: 39.1638, lng: -119.7674 },
                        { name: 'Concord, NH', lat: 43.2081, lng: -71.5376 },
                        { name: 'Trenton, NJ', lat: 40.2171, lng: -74.7429 },
                        { name: 'Santa Fe, NM', lat: 35.6870, lng: -105.9378 },
                        { name: 'Albany, NY', lat: 42.6526, lng: -73.7562 },
                        { name: 'Raleigh, NC', lat: 35.7796, lng: -78.6382 },
                        { name: 'Bismarck, ND', lat: 46.8083, lng: -100.7837 },
                        { name: 'Columbus, OH', lat: 39.9612, lng: -82.9988 },
                        { name: 'Oklahoma City, OK', lat: 35.4676, lng: -97.5164 },
                        { name: 'Salem, OR', lat: 44.9429, lng: -123.0351 },
                        { name: 'Harrisburg, PA', lat: 40.2732, lng: -76.8867 },
                        { name: 'Providence, RI', lat: 41.8240, lng: -71.4128 },
                        { name: 'Columbia, SC', lat: 34.0007, lng: -81.0348 },
                        { name: 'Pierre, SD', lat: 44.3683, lng: -100.3510 },
                        { name: 'Nashville, TN', lat: 36.1627, lng: -86.7816 },
                        { name: 'Austin, TX', lat: 30.2672, lng: -97.7431 },
                        { name: 'Salt Lake City, UT', lat: 40.7608, lng: -111.8910 },
                        { name: 'Montpelier, VT', lat: 44.2601, lng: -72.5754 },
                        { name: 'Richmond, VA', lat: 37.5407, lng: -77.4360 },
                        { name: 'Olympia, WA', lat: 47.0379, lng: -122.9007 },
                        { name: 'Charleston, WV', lat: 38.3498, lng: -81.6326 },
                        { name: 'Madison, WI', lat: 43.0731, lng: -89.4012 },
                        { name: 'Cheyenne, WY', lat: 41.1400, lng: -104.8202 }
                    ]
                }
            ];

            $scope.routesList = ROUTES;

            // Restore last selected route from localStorage
            var savedRouteKey = localStorageService.get('progressMapRouteKey');
            var initialRoute = ROUTES[0];
            if (savedRouteKey) {
                for (var r = 0; r < ROUTES.length; r++) {
                    if (ROUTES[r].key === savedRouteKey) {
                        initialRoute = ROUTES[r];
                        break;
                    }
                }
            }
            $scope.filter = { year: currentYear, route: initialRoute };

            // ---- Haversine distance (miles) ----
            function haversineDistance(lat1, lon1, lat2, lon2) {
                var R = 3958.8;
                var dLat = (lat2 - lat1) * Math.PI / 180;
                var dLon = (lon2 - lon1) * Math.PI / 180;
                var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                    Math.sin(dLon / 2) * Math.sin(dLon / 2);
                var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                return R * c;
            }

            // ---- Build cumulative distance array from GeoJSON coordinates ----
            function buildCumulativeDistances(coords) {
                var cumulative = [0];
                for (var i = 1; i < coords.length; i++) {
                    var d = haversineDistance(
                        coords[i - 1][1], coords[i - 1][0],
                        coords[i][1], coords[i][0]
                    );
                    cumulative.push(cumulative[i - 1] + d);
                }
                return cumulative;
            }

            // ---- Interpolate position along route at a given mile ----
            function interpolatePosition(cumulativeMiles, coords, targetMile) {
                var maxMile = cumulativeMiles[cumulativeMiles.length - 1];
                if (targetMile >= maxMile) {
                    return { index: coords.length - 1, coord: coords[coords.length - 1], atEnd: true };
                }
                if (targetMile <= 0) {
                    return { index: 0, coord: coords[0], atEnd: false };
                }
                var lo = 0, hi = cumulativeMiles.length - 1;
                while (lo < hi - 1) {
                    var mid = Math.floor((lo + hi) / 2);
                    if (cumulativeMiles[mid] <= targetMile) lo = mid;
                    else hi = mid;
                }
                var segLen = cumulativeMiles[hi] - cumulativeMiles[lo];
                var fraction = segLen > 0 ? (targetMile - cumulativeMiles[lo]) / segLen : 0;
                var lng = coords[lo][0] + fraction * (coords[hi][0] - coords[lo][0]);
                var lat = coords[lo][1] + fraction * (coords[hi][1] - coords[lo][1]);
                return { index: lo, coord: [lng, lat], atEnd: false };
            }

            // ---- Extract sub-polyline between two mile markers ----
            function extractSegmentCoords(cumulativeMiles, coords, startMile, endMile) {
                var startPos = interpolatePosition(cumulativeMiles, coords, startMile);
                var endPos = interpolatePosition(cumulativeMiles, coords, endMile);
                var result = [startPos.coord];
                for (var i = startPos.index + 1; i <= endPos.index; i++) {
                    result.push(coords[i]);
                }
                result.push(endPos.coord);
                return result;
            }

            // ---- Fetch pre-computed route from static JSON file ----
            function fetchRoute(routeConfig) {
                // Check memory cache first to avoid re-fetching from disk
                var cached = MemoryCacheService.get('progressMapRoute', routeConfig.key);
                if (cached) {
                    return $q.resolve(cached);
                }

                return $http.get('data/routes/' + routeConfig.key + '.json').then(function (response) {
                    var routeData = response.data;
                    routeData.cumulativeMiles = buildCumulativeDistances(routeData.geometry.coordinates);
                    MemoryCacheService.set('progressMapRoute', routeConfig.key, routeData);
                    return routeData;
                });
            }

            // ---- Build segments from race data ----
            function buildSegments(races, routeData) {
                var filteredRaces = races.filter(function (race) {
                    var raceYear = new Date(race.racedate).getUTCFullYear();
                    return raceYear === parseInt($scope.filter.year);
                });

                filteredRaces.sort(function (a, b) {
                    var d = new Date(a.racedate) - new Date(b.racedate);
                    if (d !== 0) return d;
                    // Stable tiebreaker: sort by race name, then by _id
                    var nameA = (a.racename || '').toLowerCase();
                    var nameB = (b.racename || '').toLowerCase();
                    if (nameA < nameB) return -1;
                    if (nameA > nameB) return 1;
                    return (a._id || '') < (b._id || '') ? -1 : 1;
                });

                var colors = [
                    '#007bff', '#28a745', '#ffc107', '#fd7e14', '#e83e8c',
                    '#dc3545', '#6f42c1', '#20c997', '#17a2b8', '#6c757d',
                    '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57'
                ];

                // Build waypoint mile markers list (excluding start at index 0)
                var waypointMarkers = [];
                if (routeData.orderedStops) {
                    for (var w = 1; w < routeData.orderedStops.length; w++) {
                        var stop = routeData.orderedStops[w];
                        waypointMarkers.push({
                            name: stop.name,
                            lat: stop.lat,
                            lng: stop.lng,
                            mileMarker: stop.mileMarker
                        });
                    }
                }

                var cumulativeMile = 0;
                var segments = [];
                var maxRouteMiles = routeData.cumulativeMiles[routeData.cumulativeMiles.length - 1];
                var memberMap = {}; // keyed by member _id

                filteredRaces.forEach(function (race, index) {
                    if (!race.racetype || race.isMultisport) return;

                    var isVariable = race.racetype.isVariable;
                    var raceMiles = 0;
                    var memberCount = 0;

                    if (race.results && race.results.length > 0) {
                        race.results.forEach(function (result) {
                            if (result.members && result.members.length > 0) {
                                memberCount += result.members.length;
                                var milesPerMember = 0;
                                if (isVariable) {
                                    milesPerMember = result.miles || 0;
                                    raceMiles += milesPerMember * result.members.length;
                                } else if (race.racetype.miles) {
                                    milesPerMember = race.racetype.miles;
                                    raceMiles += milesPerMember * result.members.length;
                                }
                                if (milesPerMember > 0) {
                                    result.members.forEach(function (member) {
                                        if (!memberMap[member._id]) {
                                            memberMap[member._id] = {
                                                _id: member._id,
                                                firstname: member.firstname,
                                                lastname: member.lastname,
                                                username: member.username,
                                                totalMiles: 0,
                                                raceCount: 0
                                            };
                                        }
                                        memberMap[member._id].totalMiles += milesPerMember;
                                        memberMap[member._id].raceCount += 1;
                                    });
                                }
                            }
                        });
                    }
                    if (raceMiles === 0) return;

                    var startMile = cumulativeMile;
                    var endMile = cumulativeMile + raceMiles;

                    // Determine which waypoints this segment passes through
                    var waypointsReached = [];
                    for (var wi = 0; wi < waypointMarkers.length; wi++) {
                        var wm = waypointMarkers[wi];
                        if (wm.mileMarker > startMile && wm.mileMarker <= endMile) {
                            waypointsReached.push({ name: wm.name, lat: wm.lat, lng: wm.lng });
                        }
                    }

                    var cappedStartMile = Math.min(startMile, maxRouteMiles);
                    var cappedEndMile = Math.min(endMile, maxRouteMiles);

                    var coords = [];
                    if (cappedStartMile < maxRouteMiles) {
                        coords = extractSegmentCoords(
                            routeData.cumulativeMiles,
                            routeData.geometry.coordinates,
                            cappedStartMile,
                            cappedEndMile
                        );
                    }

                    // Distance display: show miles for variable, type name for fixed
                    var distanceDisplay = race.racetype.name || '';
                    if (isVariable) {
                        var perMemberMiles = race.results && race.results[0] ? (race.results[0].miles || 0) : 0;
                        distanceDisplay = perMemberMiles.toFixed(1) + ' mi';
                        if (race.distanceName) {
                            distanceDisplay = race.distanceName;
                        }
                    }

                    segments.push({
                        race: race,
                        raceName: race.racename,
                        raceDate: race.racedate,
                        raceTypeName: distanceDisplay,
                        teamMiles: raceMiles,
                        memberCount: memberCount,
                        startMile: startMile,
                        endMile: endMile,
                        color: colors[index % colors.length],
                        coords: coords,
                        waypointsReached: waypointsReached
                    });

                    cumulativeMile = endMile;
                });

                $scope.raceSegments = segments;
                $scope.raceSegmentsReversed = segments.slice().reverse();
                $scope.totalTeamMiles = cumulativeMile;
                $scope.totalRouteMiles = maxRouteMiles;
                $scope.progressPercent = maxRouteMiles > 0 ? Math.min(100, (cumulativeMile / maxRouteMiles * 100)).toFixed(1) : '0.0';
                $scope.reachedEnd = cumulativeMile >= maxRouteMiles;

                // Determine which waypoints have been passed (excluding start at index 0)
                $scope.nextWaypoint = null;
                if (routeData.orderedStops) {
                    $scope.waypoints = routeData.orderedStops.map(function (stop, idx) {
                        var isStart = (idx === 0);
                        var reached = isStart || cumulativeMile >= stop.mileMarker;
                        var milesRemaining = reached ? 0 : stop.mileMarker - cumulativeMile;
                        return {
                            order: idx,
                            name: stop.name,
                            lat: stop.lat,
                            lng: stop.lng,
                            mileMarker: stop.mileMarker,
                            reached: reached,
                            isStart: isStart,
                            milesRemaining: milesRemaining
                        };
                    });
                    // Find the next unreached waypoint (skip start)
                    for (var n = 1; n < $scope.waypoints.length; n++) {
                        if (!$scope.waypoints[n].reached) {
                            $scope.nextWaypoint = $scope.waypoints[n];
                            break;
                        }
                    }
                }

                // Build member contributions list sorted by total miles descending
                $scope.memberContributions = Object.keys(memberMap).map(function (id) {
                    var m = memberMap[id];
                    m.percent = cumulativeMile > 0 ? (m.totalMiles / cumulativeMile * 100) : 0;
                    return m;
                }).sort(function (a, b) {
                    var d = b.totalMiles - a.totalMiles;
                    if (d !== 0) return d;
                    // Stable tiebreaker: sort by name, then by _id
                    var nameA = ((a.firstname || '') + ' ' + (a.lastname || '')).toLowerCase();
                    var nameB = ((b.firstname || '') + ' ' + (b.lastname || '')).toLowerCase();
                    if (nameA < nameB) return -1;
                    if (nameA > nameB) return 1;
                    return (a._id || '') < (b._id || '') ? -1 : 1;
                });

                // Build member-based segments for the map
                var memberCumMile = 0;
                $scope.memberSegments = $scope.memberContributions.map(function (member, idx) {
                    var startMile = memberCumMile;
                    var endMile = memberCumMile + member.totalMiles;

                    // Determine which waypoints this member's segment passes through
                    var wpReached = [];
                    for (var wi = 0; wi < waypointMarkers.length; wi++) {
                        var wm = waypointMarkers[wi];
                        if (wm.mileMarker > startMile && wm.mileMarker <= endMile) {
                            wpReached.push({ name: wm.name, lat: wm.lat, lng: wm.lng });
                        }
                    }

                    var cappedStart = Math.min(startMile, maxRouteMiles);
                    var cappedEnd = Math.min(endMile, maxRouteMiles);
                    var coords = [];
                    if (cappedStart < maxRouteMiles) {
                        coords = extractSegmentCoords(
                            routeData.cumulativeMiles,
                            routeData.geometry.coordinates,
                            cappedStart,
                            cappedEnd
                        );
                    }

                    memberCumMile = endMile;
                    return {
                        memberName: member.firstname + ' ' + member.lastname,
                        username: member.username,
                        raceCount: member.raceCount,
                        teamMiles: member.totalMiles,
                        startMile: startMile,
                        endMile: endMile,
                        color: colors[idx % colors.length],
                        coords: coords,
                        waypointsReached: wpReached,
                        // Fields the directive tooltip uses
                        raceName: member.firstname + ' ' + member.lastname,
                        raceDate: null,
                        raceTypeName: member.raceCount + ' races',
                        race: null
                    };
                });

                // Set active segments based on current map mode
                $scope.segments = $scope.view.mapMode === 'members' ? $scope.memberSegments : $scope.raceSegments;
            }

            // ---- Main initialization ----
            $scope.loadProgressMap = function () {
                $scope.loading = true;
                var routeConfig = $scope.filter.route;
                $q.all([
                    fetchRoute(routeConfig),
                    ResultsService.getRaceResultsWithCacheSupport({
                        "sort": '-racedate -order racename',
                        "preload": false
                    })
                ]).then(function (results) {
                    $scope.routeData = results[0];
                    $scope.allRaces = results[1];
                    buildSegments($scope.allRaces, $scope.routeData);
                    $scope.loading = false;
                    if (!$scope.$$phase) { $scope.$apply(); }
                }).catch(function (error) {
                    console.error('Error loading progress map:', error);
                    $scope.loading = false;
                    if (!$scope.$$phase) { $scope.$apply(); }
                });
            };

            // Year change
            $scope.onYearChange = function () {
                if ($scope.routeData && $scope.allRaces) {
                    buildSegments($scope.allRaces, $scope.routeData);
                }
            };

            // Route change
            $scope.onRouteChange = function () {
                if (!$scope.filter.route) return;
                localStorageService.set('progressMapRouteKey', $scope.filter.route.key);
                $scope.loading = true;
                fetchRoute($scope.filter.route).then(function (routeData) {
                    $scope.routeData = routeData;
                    if ($scope.allRaces) {
                        buildSegments($scope.allRaces, routeData);
                    }
                    $scope.loading = false;
                    if (!$scope.$$phase) { $scope.$apply(); }
                }).catch(function (error) {
                    console.error('Error loading route:', error);
                    $scope.loading = false;
                    if (!$scope.$$phase) { $scope.$apply(); }
                });
            };

            // Map mode change (races vs members)
            $scope.onMapModeChange = function (mode) {
                $scope.view.mapMode = mode;
                $scope.segments = mode === 'members' ? $scope.memberSegments : $scope.raceSegments;
                $scope.view.table = 'segments';
                localStorageService.set('progressMapMode', mode);
            };

            // Center map on a waypoint
            $scope.centerOnWaypoint = function (wp) {
                $scope.$broadcast('centerMap', { lat: wp.lat, lng: wp.lng });
            };

            // Center and zoom map to fit a segment's bounds
            $scope.centerOnSegment = function (seg) {
                if (seg.coords && seg.coords.length >= 2) {
                    var bounds = seg.coords.map(function (c) { return [c[1], c[0]]; });
                    $scope.$broadcast('fitMapBounds', { bounds: bounds });
                }
            };

            // Reset map to fit the full route
            $scope.resetMap = function () {
                $scope.$broadcast('resetMap');
            };

            // Race modal
            $scope.showRaceModal = function (raceinfo) {
                if (raceinfo) {
                    ResultsService.showRaceModal(raceinfo).then(function () { });
                }
            };

            // Initialize
            $scope.loadProgressMap();
        }]);
