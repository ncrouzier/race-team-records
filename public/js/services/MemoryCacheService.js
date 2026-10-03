angular.module('mcrrcApp').service('MemoryCacheService', ['SystemService', function(SystemService) {
    var registeredClearFns = [];
    var lastSystemInfoVersion = null; // Service-level state

    // Generic named memory caches
    var caches = {};


    // Get a value from a named cache
    this.get = function(cacheName, key) {
        if (caches[cacheName] && caches[cacheName][key]) {
            return caches[cacheName][key];
        }
        return undefined;
    };

    // Set a value in a named cache
    this.set = function(cacheName, key, value) {
        if (!caches[cacheName]) caches[cacheName] = {};
        caches[cacheName][key] = value;
    };

    // Keys currently held in a named cache. Callers that key by request
    // params cannot reconstruct a key to look something up by — they need to
    // search what is already there.
    this.keys = function(cacheName) {
        return caches[cacheName] ? Object.keys(caches[cacheName]) : [];
    };

    // Clear a named cache (or all caches if no name given)
    this.clear = function(cacheName) {
        if (cacheName) {
            caches[cacheName] = {};
        } else {
            caches = {};
        }
    };

    
}]); 