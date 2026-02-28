#!/usr/bin/env node
/**
 * Downloads route data from OSRM for all configured routes and saves
 * them as static JSON files in public/data/routes/.
 *
 * Usage: node scripts/download-routes.js
 */

var https = require('https');
var fs = require('fs');
var path = require('path');

var OUTPUT_DIR = path.join(__dirname, '..', 'public', 'data', 'routes');

// ---- Route definitions (same as ProgressMapCtrl.js) ----
var ROUTES = [
    {
        key: 'stateCapitals2',
        name: 'State Capitals + DC',
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
    },
    {
        key: 'crossCountry2',
        name: 'Cross Country to SF',
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
        name: 'US Perimeter',
        description: 'Around the entire contiguous US border (~8,500 mi)',
        loop: true,
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
    }
];

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

// ---- Fetch JSON via HTTPS ----
function fetchJSON(url) {
    return new Promise(function (resolve, reject) {
        https.get(url, function (res) {
            var data = '';
            res.on('data', function (chunk) { data += chunk; });
            res.on('end', function () {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error('Failed to parse JSON: ' + e.message));
                }
            });
        }).on('error', reject);
    });
}

// ---- Process a single route ----
async function processRoute(routeConfig) {
    var startPoint = routeConfig.start;
    var allPoints = [startPoint].concat(routeConfig.waypoints);
    var coordsStr = allPoints.map(function (p) {
        return p.lng + ',' + p.lat;
    }).join(';');

    var params = 'source=first&roundtrip=false&geometries=geojson&overview=full';
    if (routeConfig.loop) {
        params += '&destination=last';
    }
    var url = 'https://router.project-osrm.org/trip/v1/driving/' + coordsStr + '?' + params;

    console.log('  Fetching from OSRM...');
    var response = await fetchJSON(url);

    if (response.code !== 'Ok') {
        throw new Error('OSRM error for ' + routeConfig.key + ': ' + response.code + ' - ' + (response.message || ''));
    }

    var trip = response.trips[0];

    // OSRM waypoints are returned in input order, each with waypoint_index = visit position
    var tripOrderMap = [];
    response.waypoints.forEach(function (wp, inputIdx) {
        tripOrderMap.push({
            tripPosition: wp.waypoint_index,
            point: allPoints[inputIdx]
        });
    });
    tripOrderMap.sort(function (a, b) {
        return a.tripPosition - b.tripPosition;
    });
    var orderedStops = tripOrderMap.map(function (item) {
        return item.point;
    });

    // Compute cumulative mile marker for each stop using leg distances
    var stopMileMarkers = [0];
    var legCumulative = 0;
    for (var i = 0; i < trip.legs.length; i++) {
        legCumulative += trip.legs[i].distance * 0.000621371;
        stopMileMarkers.push(legCumulative);
    }

    // Attach mile markers to ordered stops
    for (var j = 0; j < orderedStops.length; j++) {
        orderedStops[j].mileMarker = stopMileMarkers[j];
    }

    // Round coordinates to 5 decimal places (~1m precision) to reduce file size
    var roundedCoords = trip.geometry.coordinates.map(function (c) {
        return [Math.round(c[0] * 100000) / 100000, Math.round(c[1] * 100000) / 100000];
    });

    var routeData = {
        geometry: { type: trip.geometry.type, coordinates: roundedCoords },
        distanceMiles: Math.round(trip.distance * 0.000621371 * 100) / 100,
        orderedStops: orderedStops,
        startLabel: startPoint.name,
        startLat: startPoint.lat,
        startLng: startPoint.lng
    };
    // cumulativeMiles is computed client-side from coordinates (not stored in file)

    return routeData;
}

// ---- Main ----
async function main() {
    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    console.log('Downloading ' + ROUTES.length + ' routes from OSRM...\n');

    for (var i = 0; i < ROUTES.length; i++) {
        var route = ROUTES[i];
        console.log('[' + (i + 1) + '/' + ROUTES.length + '] ' + route.name + ' (' + route.key + ')');

        try {
            var routeData = await processRoute(route);
            var outputPath = path.join(OUTPUT_DIR, route.key + '.json');
            fs.writeFileSync(outputPath, JSON.stringify(routeData));

            var coordCount = routeData.geometry.coordinates.length;
            var fileSizeKB = (fs.statSync(outputPath).size / 1024).toFixed(0);
            console.log('  Saved: ' + fileSizeKB + ' KB, ' + coordCount + ' coordinates, ' +
                routeData.distanceMiles.toFixed(0) + ' miles, ' +
                routeData.orderedStops.length + ' stops');
        } catch (err) {
            console.error('  ERROR: ' + err.message);
        }

        // Rate limit: wait 1 second between requests to be polite to OSRM public server
        if (i < ROUTES.length - 1) {
            await new Promise(function (resolve) { setTimeout(resolve, 1000); });
        }
    }

    console.log('\nDone! Route files saved to ' + OUTPUT_DIR);
}

main().catch(function (err) {
    console.error('Fatal error:', err);
    process.exit(1);
});
