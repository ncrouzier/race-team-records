angular.module('mcrrcApp.admin').controller('BannersController', ['$scope', '$rootScope', '$http', '$q', 'AuthService', 'MembersService', '$transitions', 'NotificationService', 'dialogs', function ($scope, $rootScope, $http, $q, AuthService, MembersService, $transitions, NotificationService, dialogs) {

    $scope.authService = AuthService;
    $scope.banners = [];
    $scope.allMembers = [];
    $scope.saving = {};
    $scope.saved = {};
    $scope.saveError = {};
    $scope.savingAll = false;
    $scope.activeBannerId = null;
    $scope.dirty = false;

    function load() {
        $http.get('/api/admin/banners').then(function (resp) {
            $scope.banners = resp.data.map(function (b) {
                var memberObjs = (b.members || []).map(function (m) {
                    return $scope.allMembers.find(function (a) { return a._id === m._id; }) || m;
                });
                return angular.extend({}, b, { _members: memberObjs });
            });
            $scope.dirty = false;
        });
    }

    MembersService.getMembersWithCacheSupport({}).then(function (members) {
        $scope.allMembers = members;
        load();
    });

    $scope.$watch('banners', function (newVal, oldVal) {
        if (oldVal.length && newVal !== oldVal) $scope.dirty = true;
    }, true);

    function buildPayload(banner) {
        return {
            pinned:     banner.pinned,
            members:    (banner._members || []).map(function (m) { return m._id; }),
            titleTheme: banner.titleTheme,
            copyright:  banner.copyright,
        };
    }

    $scope.save = function (banner) {
        $scope.saving[banner._id] = true;
        return $http.put('/api/admin/banners/' + banner._id, buildPayload(banner)).then(function (resp) {
            var idx = $scope.banners.findIndex(function (b) { return b._id === banner._id; });
            if (idx !== -1) $scope.banners[idx] = angular.extend({}, resp.data, { _members: banner._members });
            $scope.saved[banner._id] = true;
            $scope.saveError[banner._id] = false;
        }, function () {
            $scope.saveError[banner._id] = true;
        }).finally(function () {
            $scope.saving[banner._id] = false;
        });
    };

    $scope.saveAll = function () {
        $scope.savingAll = true;
        var promises = $scope.banners.map(function (b) { return $scope.save(b); });
        $q.all(promises).then(function () {
            $scope.dirty = false;
            NotificationService.showNotifiction(true, 'All banners saved');
        }, function () {
            NotificationService.showNotifiction(false, 'Some banners failed to save');
        }).finally(function () {
            $scope.savingAll = false;
        });
    };

    $scope.reset = function () {
        $scope.dirty = false;
        load();
    };

    $scope.memberSearch = function (search) {
        return function (m) {
            if (!search) return true;
            var q = search.toLowerCase();
            return (m.firstname + ' ' + m.lastname).toLowerCase().indexOf(q) !== -1;
        };
    };

    $scope.deleteBanner = function (banner) {
        var dlg = dialogs.confirm('Delete banner', 'Delete "' + banner.filename + '"? This only removes it from the database — the image file is not deleted.');
        dlg.result.then(function () {
            $http.delete('/api/admin/banners/' + banner._id).then(function () {
                $scope.banners = $scope.banners.filter(function (b) { return b._id !== banner._id; });
                if ($scope.activeBannerId === banner._id) $scope.activeBannerId = null;
            }, function () {
                NotificationService.showNotifiction(false, 'Failed to delete banner');
            });
        });
    };

    $scope.setActive = function (banner) {
        $scope.activeBannerId = banner._id;
        $rootScope.$broadcast('banner:preview', {
            url:        '/images/banners/' + banner.filename,
            titleTheme: banner.titleTheme,
            copyright:  banner.copyright,
        });
    };

    var deregister = $transitions.onStart({}, function (transition) {
        if (!$scope.dirty) return;
        var dlg = dialogs.confirm('Unsaved changes', 'You have unsaved changes. Leave without saving?');
        dlg.result.then(function () {
            $scope.dirty = false;
            transition.router.stateService.go(transition.to().name, transition.params('to'));
        });
        return false;
    });

    $scope.$on('$destroy', deregister);

}]);
