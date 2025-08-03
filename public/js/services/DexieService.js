angular.module('mcrrcApp').factory('DexieService', function() {
    if (!window.mcrrcDexie) {
        var db = new Dexie("mcrrcAppDatabase");
        db.version(2).stores({
            races: 'instance',
            statsCache: 'year'
            // Add more stores as needed
        });
        window.mcrrcDexie = db;
    }
    return window.mcrrcDexie;
}); 