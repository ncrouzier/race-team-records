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
                    overallUpdate: headers['x-overall-update']
                };
                lastApiCallTime = Date.now();
            }
        }
        return data;
    });
    
    this.getSystemInfo = function(name) {
        // Check if we have recent system info from headers (within last 10 minutes)
        var now = Date.now();
        if (lastSystemInfo && (now - lastApiCallTime) < 600000) { 
            return Promise.resolve(lastSystemInfo);
        }

        // If no cached data, make a lightweight API call to get initial system info
        // This should only happen if there is no cache expires        
        return Restangular.one('systeminfos', name).get().then(
            function(systeminfo) {
                // lastSystemInfo = systeminfo;
                lastApiCallTime = now;

                return lastSystemInfo;
            },
            function(res) {
                // Return cached data if available, even if stale
                if (lastSystemInfo) {
                    return lastSystemInfo;
                }
                return null;
            }
        );
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