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

    // memberStatus by member id, from the banners' own tagged members (the
    // server includes it) — for members picked from the full list, their
    // own memberStatus is used
    var memberStatusById = {};

    // Each card as last loaded or saved: what it's compared against to know
    // whether it has unsaved changes, and what the filters and search use —
    // so a card doesn't vanish from a filtered list mid-edit, only once saved
    var savedState = {};

    // The fields a card edits, as plain values
    function snapshot(b) {
        var c = b.copyright || {};
        return {
            pinned: !!b.pinned,
            disabled: !!b.disabled,
            titlePosition: b.titlePosition || 'right',
            copyright: { name: c.name || '', url: c.url || '', color: c.color || '' },
            members: (b._members || []).map(function (m) { return m._id; }).sort()
        };
    }

    function remember(b) {
        savedState[b._id] = { values: snapshot(b), members: (b._members || []).slice(), copyright: angular.copy(b.copyright || {}) };
    }

    // Whether a card differs from what's saved
    $scope.changed = function (b) {
        var saved = savedState[b._id];
        return !saved || !angular.equals(snapshot(b), saved.values);
    };

    // The card's Save button: 'saving', 'saved' (and not edited since),
    // 'error' (the last attempt failed, and not edited since) or 'save'
    $scope.saveState = function (b) {
        if ($scope.saving[b._id]) return 'saving';
        if ($scope.saveError[b._id] && angular.equals(snapshot(b), $scope.saveError[b._id])) return 'error';
        if ($scope.saved[b._id] && !$scope.changed(b)) return 'saved';
        return 'save';
    };

    // A card as saved, in the shape the flags below take
    function asSaved(b) {
        var saved = savedState[b._id];
        return saved ? { _members: saved.members, copyright: saved.copyright } : b;
    }

    function load() {
        $http.get('/api/admin/banners').then(function (resp) {
            resp.data.forEach(function (b) {
                (b.members || []).forEach(function (m) { memberStatusById[m._id] = m.memberStatus; });
            });
            $scope.banners = resp.data.map(function (b) {
                var memberObjs = (b.members || []).map(function (m) {
                    return $scope.allMembers.find(function (a) { return a._id === m._id; }) || m;
                });
                return angular.extend({}, b, { _members: memberObjs });
            });
            savedState = {};
            $scope.banners.forEach(remember);
            $scope.saved = {};
            $scope.saveError = {};
        });
    }

    MembersService.getMembersWithCacheSupport({}).then(function (members) {
        $scope.allMembers = members;
        load();
    });

    // Images deployed to public/images/banners that have no entry yet, and
    // entries whose image is gone
    $scope.newImages = [];
    $scope.missingFiles = [];
    $scope.addingImages = false;

    function loadUnregistered() {
        $http.get('/api/admin/banners/unregistered', { params: { _: Date.now() } }).then(function (resp) {
            $scope.newImages = resp.data.images || [];
            $scope.missingFiles = resp.data.missingFiles || [];
        });
    }
    loadUnregistered();

    $scope.addNewImages = function () {
        $scope.addingImages = true;
        var filenames = $scope.newImages.map(function (img) { return img.filename; });
        $http.post('/api/admin/banners/register', { filenames: filenames }).then(function (resp) {
            var count = (resp.data.created || []).length;
            NotificationService.showNotifiction(true, 'Added ' + count + ' banner' + (count === 1 ? '' : 's'));
            // Unsaved edits on the other cards would be lost by a reload
            if (!$scope.dirty) load();
            else NotificationService.showNotifiction(true, 'Save or reset your changes to see the new banners');
            loadUnregistered();
        }, function () {
            NotificationService.showNotifiction(false, 'Failed to add the new banners');
        }).finally(function () {
            $scope.addingImages = false;
        });
    };

    // Unsaved changes: any card differing from what's saved
    $scope.$watch(function () {
        return $scope.banners.some($scope.changed);
    }, function (any) {
        $scope.dirty = any;
    });

    function buildPayload(banner) {
        return {
            pinned:     banner.pinned,
            disabled:   !!banner.disabled,
            members:    (banner._members || []).map(function (m) { return m._id; }),
            titlePosition: banner.titlePosition || 'right',
            copyright:  banner.copyright,
        };
    }

    $scope.save = function (banner) {
        $scope.saving[banner._id] = true;
        var attempt = snapshot(banner);
        return $http.put('/api/admin/banners/' + banner._id, buildPayload(banner)).then(function (resp) {
            var idx = $scope.banners.findIndex(function (b) { return b._id === banner._id; });
            if (idx !== -1) {
                $scope.banners[idx] = angular.extend({}, resp.data, { _members: banner._members });
                remember($scope.banners[idx]);
            }
            $scope.saved[banner._id] = true;
            $scope.saveError[banner._id] = false;
        }, function () {
            // What failed to save: the button says Error until the card is edited
            $scope.saveError[banner._id] = attempt;
            $scope.saved[banner._id] = false;
        }).finally(function () {
            $scope.saving[banner._id] = false;
        });
    };

    $scope.saveAll = function () {
        $scope.savingAll = true;
        var promises = $scope.banners.map(function (b) { return $scope.save(b); });
        $q.all(promises).then(function () {
            NotificationService.showNotifiction(true, 'All banners saved');
        }, function () {
            NotificationService.showNotifiction(false, 'Some banners failed to save');
        }).finally(function () {
            $scope.savingAll = false;
        });
    };

    $scope.reset = function () {
        load();
    };

    // Where the title sits: away from the runner, or centred over a group shot
    $scope.titlePositions = [
        { value: 'left', label: 'Left', icon: 'fa-align-left' },
        { value: 'center', label: 'Center', icon: 'fa-align-center' },
        { value: 'right', label: 'Right', icon: 'fa-align-right' }
    ];

    $scope.setTitlePosition = function (banner, value) {
        banner.titlePosition = value;
        if ($scope.activeBannerId === banner._id) $scope.setActive(banner);
    };

    // Tagged members who aren't current team members — the banner probably
    // needs retiring or retagging
    $scope.formerMembers = function (banner) {
        return (banner._members || []).filter(function (m) {
            var status = m.memberStatus || memberStatusById[m._id];
            return status && status !== 'current';
        });
    };
    $scope.formerNames = function (banner) {
        return $scope.formerMembers(banner).map(function (m) { return m.firstname + ' ' + m.lastname; }).join(', ');
    };
    // Counted on the cards as saved, like the filter
    $scope.formerCount = function () {
        return $scope.banners.filter(function (b) { return $scope.formerMembers(asSaved(b)).length; }).length;
    };

    // Current team members with no banner on the homepage: tagged in none, or
    // only in disabled ones. Worked out from the cards as they stand, so
    // tagging someone takes them off the list straight away.
    $scope.withoutBanner = { open: false };
    $scope.membersWithoutBanner = function () {
        var shown = {}, disabledOnly = {};
        $scope.banners.forEach(function (b) {
            (b._members || []).forEach(function (m) {
                if (b.disabled) disabledOnly[m._id] = true;
                else shown[m._id] = true;
            });
        });
        return ($scope.allMembers || [])
            .filter(function (m) { return m.memberStatus === 'current' && !shown[m._id]; })
            .map(function (m) { return { member: m, disabledOnly: !!disabledOnly[m._id] }; })
            .sort(function (a, b) {
                return (a.member.lastname || '').localeCompare(b.member.lastname || '') ||
                    (a.member.firstname || '').localeCompare(b.member.firstname || '');
            });
    };

    // No photographer named in the credit (a missing link is fine)
    $scope.missingCredit = function (banner) {
        return !(banner.copyright && banner.copyright.name && String(banner.copyright.name).trim());
    };
    $scope.missingCreditCount = function () {
        return $scope.banners.filter(function (b) { return $scope.missingCredit(asSaved(b)); }).length;
    };

    // Search box: matches the image's filename or a tagged member's name.
    // An object, as the box sits inside an ng-if. formerOnly / noCreditOnly
    // narrow to the banners flagged for those. All on the cards as saved: a
    // card being edited stays in the list until it's saved.
    $scope.bannerFilter = { text: '', formerOnly: false, noCreditOnly: false };
    $scope.bannerMatches = function (banner) {
        var saved = asSaved(banner);
        if ($scope.bannerFilter.formerOnly && !$scope.formerMembers(saved).length) return false;
        if ($scope.bannerFilter.noCreditOnly && !$scope.missingCredit(saved)) return false;
        var q = ($scope.bannerFilter.text || '').toLowerCase().trim();
        if (!q) return true;
        if (banner.filename.toLowerCase().indexOf(q) !== -1) return true;
        return (saved._members || []).some(function (m) {
            return ((m.firstname || '') + ' ' + (m.lastname || '')).toLowerCase().indexOf(q) !== -1;
        });
    };

    $scope.memberSearch = function (search) {
        return function (m) {
            if (!search) return true;
            var q = search.toLowerCase();
            return (m.firstname + ' ' + m.lastname).toLowerCase().indexOf(q) !== -1;
        };
    };

    $scope.deleteBanner = function (banner) {
        var dlg = dialogs.confirm('Remove banner', 'Remove "' + banner.filename + '"? Its members, credit and settings are ' +
            'deleted. The image file stays, so it will be listed as a new image that can be added again. ' +
            'To stop showing it but keep the entry, tick Disabled instead.');
        dlg.result.then(function () {
            $http.delete('/api/admin/banners/' + banner._id).then(function () {
                $scope.banners = $scope.banners.filter(function (b) { return b._id !== banner._id; });
                delete savedState[banner._id];
                if ($scope.activeBannerId === banner._id) $scope.activeBannerId = null;
                loadUnregistered();
            }, function () {
                NotificationService.showNotifiction(false, 'Failed to delete banner');
            });
        });
    };

    $scope.setActive = function (banner) {
        $scope.activeBannerId = banner._id;
        $rootScope.$broadcast('banner:preview', {
            url:        '/images/banners/' + banner.filename,
            titlePosition: banner.titlePosition || 'right',
            copyright:  banner.copyright,
        });
    };

    var deregister = $transitions.onStart({}, function (transition) {
        if (!$scope.dirty) return;
        var dlg = dialogs.confirm('Unsaved changes', 'You have unsaved changes. Leave without saving?');
        dlg.result.then(function () {
            $scope.banners.forEach(remember);
            $scope.dirty = false;
            transition.router.stateService.go(transition.to().name, transition.params('to'));
        });
        return false;
    });

    $scope.$on('$destroy', deregister);

}]);
