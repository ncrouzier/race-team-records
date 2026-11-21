// Libraries only a few pages need, kept out of the page head and the bundle:
// the first page that needs one loads it, once, and every later page reuses it.
//
//   LazyLoad.lib('leaflet').then(function () { ... L.map(...) ... });
//
//   datamaps  the US and world race maps (otherDirectives.js), with topojson
//   leaflet   the progress map and the pace tool's weather map
//   tinymce   the bio editor (tinymceDirective.js)
//
// Files from a CDN keep their integrity hash: the browser refuses a copy that
// is not byte-for-byte this version. Update the hash with the version.
// A failed load is forgotten, so the next page that needs it tries again.
angular.module('mcrrcApp').factory('LazyLoad', ['$q', function ($q) {

    var LIBS = {
        datamaps: {
            loaded: function () { return !!window.Datamap; },
            files: [
                {
                    script: 'https://cdnjs.cloudflare.com/ajax/libs/topojson/1.6.9/topojson.min.js',
                    integrity: 'sha512-RzAPb80dX80u+WhT+/e+t3J+Oa1aHEkUuPrb5pkLCf6UInraMxYY9PtIe0zZFFp7IWr5RWLr0qvCwCZf0JvqMw=='
                },
                { script: '/libs/datamaps/dist/datamaps.all.hires.min.js' }
            ]
        },
        leaflet: {
            loaded: function () { return !!(window.L && window.L.map); },
            files: [
                // Waited for too: a map laid out before its styles draws its tiles out of place
                {
                    style: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
                    integrity: 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='
                },
                {
                    script: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
                    integrity: 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo='
                }
            ]
        },
        tinymce: {
            loaded: function () { return !!window.tinymce; },
            files: [{ script: '/libs/tinymce/tinymce.min.js' }]
        }
    };

    var loading = {};

    function loadFile(file) {
        return $q(function (resolve, reject) {
            var el;
            if (file.style) {
                el = document.createElement('link');
                el.rel = 'stylesheet';
                el.href = file.style;
            } else {
                el = document.createElement('script');
                el.src = file.script;
                // Fetched side by side, run in the order listed
                el.async = false;
            }
            if (file.integrity) {
                el.integrity = file.integrity;
                el.crossOrigin = 'anonymous';
            }
            el.onload = resolve;
            el.onerror = function () { reject(new Error('Could not load ' + (file.style || file.script))); };
            document.head.appendChild(el);
        });
    }

    return {
        lib: function (name) {
            var lib = LIBS[name];
            if (!lib) return $q.reject(new Error('Unknown library ' + name));
            if (lib.loaded()) return $q.resolve();
            if (!loading[name]) {
                loading[name] = $q.all(lib.files.map(loadFile)).catch(function (err) {
                    delete loading[name];
                    return $q.reject(err);
                });
            }
            return loading[name];
        }
    };
}]);
