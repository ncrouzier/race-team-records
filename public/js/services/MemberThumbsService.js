// Every member's profile thumbnail as a data: URI, keyed by member _id, read
// from the one cached list of all members the members page also uses
// (MembersService.getAllMembersWithThumbs: IndexedDB-backed, refreshed when
// member data changes) instead of one request per avatar. A member missing
// from the map has no photo: callers show initials without asking the server.
angular.module('mcrrcApp.members').factory('MemberThumbsService', ['MembersService', '$q', function (MembersService, $q) {
    var mapPromise = null;
    var map = null;

    function load() {
        if (!mapPromise) {
            mapPromise = MembersService.getAllMembersWithThumbs().then(function (members) {
                var byId = {};
                (members || []).forEach(function (m) {
                    if (m.profileThumbUrl) byId[m._id] = m.profileThumbUrl;
                });
                map = byId;
                return byId;
            }, function () {
                // Couldn't load: no photos this time, and a later call tries again
                mapPromise = null;
                return {};
            });
        }
        return mapPromise;
    }

    return {
        // Promise of the { memberId: dataUri } map
        all: load,
        // The thumbnail for one member once the map is in, else null
        peek: function (memberId) {
            return map && memberId ? (map[memberId] || null) : null;
        },
        // Promise of one member's thumbnail (null when they have none)
        get: function (memberId) {
            if (!memberId) return $q.when(null);
            return load().then(function (byId) { return byId[memberId] || null; });
        }
    };
}]);
