angular.module('mcrrcApp.admin').controller('BannersController', ['$scope', '$rootScope', '$http', '$q', '$uibModal', 'AuthService', 'MembersService', '$transitions', 'NotificationService', 'dialogs', function ($scope, $rootScope, $http, $q, $uibModal, AuthService, MembersService, $transitions, NotificationService, dialogs) {

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

    // Entries whose image file is gone (the server flags them)
    $scope.missingFiles = function () {
        return $scope.banners.filter(function (b) { return b.fileMissing; }).map(function (b) { return b.filename; });
    };

    // ---- Making banners: the editor (upload, frame, save) ----

    // A banner from the server (new, or its photo replaced) into the list,
    // keeping the card's unsaved edits when it was already there
    function putBanner(fromServer) {
        var idx = $scope.banners.findIndex(function (b) { return b._id === fromServer._id; });
        if (idx === -1) {
            var fresh = angular.extend({}, fromServer, { _members: [] });
            $scope.banners.push(fresh);
            $scope.banners.sort(function (a, b) { return a.filename.localeCompare(b.filename); });
            remember(fresh);
            return fresh;
        }
        var card = $scope.banners[idx];
        ['filename', 'url', 'version', 'fileMissing', 'titlePosition'].forEach(function (k) { card[k] = fromServer[k]; });
        if (savedState[card._id]) savedState[card._id].values.titlePosition = fromServer.titlePosition || 'right';
        return card;
    }

    $scope.openEditor = function (banner) {
        $uibModal.open({
            templateUrl: 'views/modals/bannerEditorModal.html',
            controller: 'BannerEditorModalController',
            windowClass: 'banner-editor-window',
            backdrop: 'static',
            keyboard: false,
            resolve: { replacing: function () { return banner || null; } }
        }).result.then(function (saved) {
            var card = putBanner(saved);
            NotificationService.showNotifiction(true, (banner ? 'New photo saved for ' : 'Banner saved: ') + saved.filename);
            $scope.setActive(card);
        }, function () { });
    };

    // ---- Renaming (the file is renamed with it) ----
    $scope.renaming = {};
    $scope.startRename = function (banner) {
        $scope.renaming[banner._id] = { name: banner.filename.replace(/\.jpg$/i, ''), error: null, busy: false };
    };
    $scope.cancelRename = function (banner) {
        delete $scope.renaming[banner._id];
    };
    $scope.saveRename = function (banner) {
        var r = $scope.renaming[banner._id];
        if (!r || r.busy) return;
        r.busy = true;
        r.error = null;
        $http.put('/api/admin/banners/' + banner._id, { name: r.name }).then(function (resp) {
            putBanner(resp.data);
            delete $scope.renaming[banner._id];
            if ($scope.activeBannerId === banner._id) $scope.setActive(banner);
        }, function (resp) {
            r.busy = false;
            r.error = (resp.data && resp.data.error) || 'Could not rename it';
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
        var dlg = dialogs.confirm('Delete banner', 'Delete "' + banner.filename + '"? The banner image is deleted from ' +
            'the server, with its members, credit and settings; this cannot be undone. ' +
            'To stop showing it but keep it, set it to Disabled instead.');
        dlg.result.then(function () {
            $http.delete('/api/admin/banners/' + banner._id).then(function () {
                $scope.banners = $scope.banners.filter(function (b) { return b._id !== banner._id; });
                delete savedState[banner._id];
                if ($scope.activeBannerId === banner._id) $scope.activeBannerId = null;
            }, function () {
                NotificationService.showNotifiction(false, 'Failed to delete banner');
            });
        });
    };

    $scope.setActive = function (banner) {
        $scope.activeBannerId = banner._id;
        $rootScope.$broadcast('banner:preview', {
            url:        banner.url,
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

// The banner editor: upload a photo (step 1), then frame it behind the title
// and fade, name it, and save (step 2). The server keeps the photo as a draft
// only while this is open: saving or cancelling deletes it.
angular.module('mcrrcApp.admin').controller('BannerEditorModalController', ['$scope', '$http', '$q', '$uibModalInstance', 'replacing', function ($scope, $http, $q, $uibModalInstance, replacing) {
    // Photos bigger than this are shrunk in the browser first: the server
    // keeps at most 3000 px of them anyway, and it saves a slow upload
    var SHRINK_ABOVE_SIDE = 4000;
    var SHRINK_ABOVE_BYTES = 15 * 1024 * 1024;
    var MAX_BYTES = 20 * 1024 * 1024;
    var ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

    $scope.replacing = replacing;
    $scope.draft = null;
    $scope.crop = null;
    $scope.form = { name: '' };
    $scope.nameState = { ok: false };
    $scope.view = { mode: 'narrow', showTitle: true };
    try { if (localStorage.getItem('bannerEditorPreview') === 'wide') $scope.view.mode = 'wide'; } catch (e) { /* no storage */ }

    function failure(resp, fallback) {
        return (resp && resp.data && resp.data.error) || (resp && resp.status === 413 ? 'The file is too large.' : fallback);
    }

    function shrinkIfNeeded(file) {
        if (!window.createImageBitmap) return $q.when(file);
        return $q.when(createImageBitmap(file, { imageOrientation: 'from-image' })).then(function (bitmap) {
            var longSide = Math.max(bitmap.width, bitmap.height);
            if (longSide <= SHRINK_ABOVE_SIDE && file.size <= SHRINK_ABOVE_BYTES) {
                if (bitmap.close) bitmap.close();
                return file;
            }
            var scale = Math.min(1, SHRINK_ABOVE_SIDE / longSide);
            var canvas = document.createElement('canvas');
            canvas.width = Math.round(bitmap.width * scale);
            canvas.height = Math.round(bitmap.height * scale);
            var ctx = canvas.getContext('2d');
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            if (bitmap.close) bitmap.close();
            return $q(function (resolve) {
                canvas.toBlob(function (blob) { resolve(blob || file); }, 'image/jpeg', 0.92);
            });
        }, function () { return file; });
    }

    // ---- Step 1: the photo ----
    $scope.onFile = function (file) {
        if ($scope.uploading) return;
        $scope.error = null;
        if (/heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)) {
            $scope.error = 'iPhone HEIC photos are not accepted. Export it as JPEG first.';
            return;
        }
        if (ACCEPTED.indexOf(file.type) === -1) {
            $scope.error = 'Only JPEG, PNG or WebP photos are accepted.';
            return;
        }
        $scope.uploading = true;
        shrinkIfNeeded(file).then(function (blob) {
            if (blob.size > MAX_BYTES) return $q.reject({ data: { error: 'This photo is over 20 MB. Try a smaller one.' } });
            return $http.post('/api/admin/banner-drafts', blob, {
                params: { name: file.name },
                headers: { 'Content-Type': blob.type || 'image/jpeg' },
                transformRequest: angular.identity
            });
        }).then(function (resp) {
            $scope.draft = resp.data;
            $scope.crop = angular.copy(resp.data.crop);
            $scope.previewUrl = null;
            $scope.form.name = replacing ? replacing.filename.replace(/\.jpg$/i, '') : resp.data.suggestedName;
            $scope.checkName();
        }, function (resp) {
            $scope.error = failure(resp, 'The photo could not be uploaded.');
        }).finally(function () {
            $scope.uploading = false;
        });
    };

    function discardDraft() {
        if ($scope.draft) $http.delete('/api/admin/banner-drafts/' + $scope.draft.draftId).catch(angular.noop);
    }

    $scope.startOver = function () {
        discardDraft();
        $scope.draft = null;
        $scope.crop = null;
        $scope.error = null;
        if ($scope.previewUrl) URL.revokeObjectURL($scope.previewUrl);
        $scope.previewUrl = null;
    };

    // ---- Step 2: name and framing ----
    var nameCheck = 0;
    $scope.checkName = function () {
        var mine = ++nameCheck;
        if (!($scope.form.name || '').trim()) {
            $scope.nameState = { ok: false, cls: 'is-bad', icon: 'fa-exclamation-circle', text: 'Give the banner a name.' };
            return;
        }
        $scope.nameState = { ok: false, cls: '', icon: 'fa-spinner fa-spin', text: 'Checking…' };
        $http.get('/api/admin/banners/name-available', {
            params: { name: $scope.form.name, bannerId: replacing ? replacing._id : undefined }
        }).then(function (resp) {
            if (mine !== nameCheck) return;
            var d = resp.data;
            $scope.nameState = d.available
                ? { ok: true, cls: 'is-ok', icon: 'fa-check', text: 'Saved as ' + d.name + '.jpg' }
                : { ok: false, cls: 'is-bad', icon: 'fa-times', text: d.reason };
        }, function () {
            if (mine === nameCheck) $scope.nameState = { ok: false, cls: 'is-bad', icon: 'fa-times', text: 'Could not check the name.' };
        });
    };

    $scope.setMode = function (mode) {
        $scope.view.mode = mode;
        try { localStorage.setItem('bannerEditorPreview', mode); } catch (e) { /* no storage */ }
    };

    function sameCrop(a, b) {
        return a && b && ['x', 'y', 'width'].every(function (k) { return Math.abs(a[k] - b[k]) <= 1; });
    }
    $scope.isAutomatic = function () {
        return $scope.draft && sameCrop($scope.crop, $scope.draft.autoCrop);
    };
    $scope.resetFraming = function () {
        $scope.crop = angular.copy($scope.draft.autoCrop);
    };

    function roundedCrop() {
        return { x: Math.round($scope.crop.x), y: Math.round($scope.crop.y), width: Math.round($scope.crop.width) };
    }

    var previewCrop = null;
    $scope.renderPreview = function () {
        $scope.previewing = true;
        $scope.error = null;
        var crop = roundedCrop();
        $http.post('/api/admin/banner-drafts/' + $scope.draft.draftId + '/preview', { crop: crop }, { responseType: 'blob' })
            .then(function (resp) {
                if ($scope.previewUrl) URL.revokeObjectURL($scope.previewUrl);
                $scope.previewUrl = URL.createObjectURL(resp.data);
                previewCrop = crop;
            }, function () {
                $scope.error = 'The preview could not be made.';
            }).finally(function () {
                $scope.previewing = false;
            });
    };
    $scope.$watch('crop', function () {
        $scope.previewStale = !!previewCrop && !sameCrop(roundedCrop(), previewCrop);
    }, true);

    $scope.save = function () {
        $scope.saving = true;
        $scope.error = null;
        $http.post('/api/admin/banner-drafts/' + $scope.draft.draftId + '/save', {
            crop: roundedCrop(),
            name: $scope.form.name,
            bannerId: replacing ? replacing._id : undefined
        }).then(function (resp) {
            if ($scope.previewUrl) URL.revokeObjectURL($scope.previewUrl);
            $uibModalInstance.close(resp.data);
        }, function (resp) {
            $scope.saving = false;
            $scope.error = failure(resp, 'The banner could not be saved.');
            if (resp.status === 409) $scope.nameState = { ok: false, cls: 'is-bad', icon: 'fa-times', text: $scope.error };
        });
    };

    $scope.cancel = function () {
        discardDraft();
        if ($scope.previewUrl) URL.revokeObjectURL($scope.previewUrl);
        $uibModalInstance.dismiss('cancel');
    };
}]);
