angular.module('mcrrcApp').factory('DexieService', function() {
    if (!window.mcrrcDexie) {
        var db = new Dexie("mcrrcAppDatabase");
        db.version(4).stores({
            races: 'instance',
            statsCache: 'year',
            members: 'params',
            volunteerjobs: 'instance'
        });
        // The race series index (SeriesService), cached until seriesUpdate moves
        db.version(5).stores({
            races: 'instance',
            statsCache: 'year',
            members: 'params',
            volunteerjobs: 'instance',
            series: 'instance'
        });
        window.mcrrcDexie = db;
    }
    return window.mcrrcDexie;
}); 