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

    // Clear a named cache (or all caches if no name given)
    this.clear = function(cacheName) {
        if (cacheName) {
            caches[cacheName] = {};
        } else {
            caches = {};
        }
    };

    
}]); 