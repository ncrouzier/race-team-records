angular.module('mcrrcApp').service('SystemService', ['Restangular', function(Restangular) {
    var lastSystemInfo = null;
    var lastApiCallTime = 0;
    
    // Add response interceptor to automatically update system info from headers
    Restangular.addResponseInterceptor(function(data, operation, what, url, response) {
        // Update system info from response headers
        if (response && response.headers) {
            var headers = response.headers();
            if (headers['x-result-update'] || headers['x-race-update'] || headers['x-racetype-update'] || headers['x-member-update'] || headers['x-overall-update']) {
                lastSystemInfo = {
                    resultUpdate: headers['x-result-update'],
                    raceUpdate: headers['x-race-update'],
                    racetypeUpdate: headers['x-racetype-update'],
                    memberUpdate: headers['x-member-update'],
                    volunteerJobUpdate: headers['x-volunteer-job-update'],
                    seriesUpdate: headers['x-series-update'],
                    overallUpdate: headers['x-overall-update']
                };
                lastApiCallTime = Date.now();
            }
        }
        return data;
    });
    
    // One request at a time: everything asking while it runs shares it
    var inFlight = null;
    this.getSystemInfo = function(name) {
        // Check if we have recent system info from headers (within last 10 minutes)
        var now = Date.now();
        if (lastSystemInfo && (now - lastApiCallTime) < 600000) {
            return Promise.resolve(lastSystemInfo);
        }
        if (inFlight) return inFlight;

        // If no cached data, make a lightweight API call to get initial system info
        // This should only happen if there is no cache expires
        inFlight = Restangular.one('systeminfos', name).get().then(
            function(systeminfo) {
                // lastSystemInfo = systeminfo;
                lastApiCallTime = now;
                inFlight = null;

                return lastSystemInfo;
            },
            function(res) {
                inFlight = null;
                // Return cached data if available, even if stale
                if (lastSystemInfo) {
                    return lastSystemInfo;
                }
                return null;
            }
        );
        return inFlight;
    };

    // The stamps held may be out of date (this browser just saved something):
    // the next getSystemInfo asks the server
    this.forget = function() {
        lastApiCallTime = 0;
    };

    // Method to update system info from response headers
    this.updateFromHeaders = function(response) {
        if (response && response.headers) {
            var headers = response.headers();
            if (headers['x-result-update'] || headers['x-race-update'] || headers['x-racetype-update'] || headers['x-member-update'] || headers['x-overall-update']) {
                lastSystemInfo = {
                    resultUpdate: headers['x-result-update'],
                    raceUpdate: headers['x-race-update'],
                    racetypeUpdate: headers['x-racetype-update'],
                    memberUpdate: headers['x-member-update'],
                    volunteerJobUpdate: headers['x-volunteer-job-update'],
                    seriesUpdate: headers['x-series-update'],
                    overallUpdate: headers['x-overall-update']
                };
                lastApiCallTime = Date.now();
            }
        }
    };

    // Method to get cached system info
    this.getCachedSystemInfo = function() {
        return lastSystemInfo;
    };
}]); 