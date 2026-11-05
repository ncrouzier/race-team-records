// Admin: Hosted Pages. Upload standalone HTML pages, served at /pages/<address>
// with an access level, a draft/published state and, unless trusted, in a
// browser sandbox (see app/routes.js, /pages/:slug).
angular.module('mcrrcApp.admin').controller('HostedPagesController', ['$scope', '$http', '$window', '$timeout', 'dialogs', 'AuthService',
    function ($scope, $http, $window, $timeout, dialogs, AuthService) {

    $scope.authService = AuthService;
    $scope.$watch('authService.isLoggedIn()', function (user) {
        $scope.user = user;
    });

    var MAX_BYTES = 10 * 1024 * 1024;

    $scope.ACCESS_LEVELS = [
        { key: 'public', label: 'Everyone', icon: 'fa-globe' },
        { key: 'members', label: 'Logged-in members', icon: 'fa-users' },
        { key: 'captains', label: 'Captains and admins', icon: 'fa-star' },
        { key: 'admin', label: 'Admins only', icon: 'fa-lock' }
    ];

    $scope.accessLevel = function (key) {
        return $scope.ACCESS_LEVELS.find(function (level) { return level.key === key; }) || $scope.ACCESS_LEVELS[0];
    };

    $scope.pages = [];
    $scope.loading = true;
    $scope.editor = null;

    function load() {
        $http.get('/api/hosted-pages').then(function (res) {
            $scope.pages = res.data || [];
        }, function () {
            $scope.loadError = true;
        }).finally(function () {
            $scope.loading = false;
        });
    }
    load();

    $scope.pageUrl = function (page) {
        return $window.location.origin + '/pages/' + page.slug;
    };

    $scope.formatSize = function (bytes) {
        if (!bytes) return '';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
        return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    };

    // "2027 Team Handbook" -> "2027-team-handbook"
    function slugify(text) {
        return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '');
    }

    // ---- The upload / edit form -------------------------------------------
    $scope.newPage = function () {
        $scope.editor = {
            mode: 'new', title: '', slug: '', description: '', access: 'members',
            published: false, trusted: false, showBanner: true, html: null, filename: '', slugEdited: false
        };
    };

    $scope.editPage = function (page) {
        $scope.editor = {
            mode: 'edit', id: page._id, title: page.title, slug: page.slug,
            description: page.description || '', access: page.access,
            published: page.published, trusted: page.trusted,
            // Pages saved before the option existed show the bar
            showBanner: page.showBanner !== false,
            // The stored file stays unless a new one is chosen
            html: null, filename: page.filename, currentFilename: page.filename, slugEdited: true
        };
    };

    $scope.cancelEdit = function () {
        $scope.editor = null;
    };

    // The address follows the title until edited by hand
    $scope.titleChanged = function () {
        var e = $scope.editor;
        if (e && !e.slugEdited) e.slug = slugify(e.title);
    };

    $scope.slugChanged = function () {
        $scope.editor.slugEdited = true;
    };

    // From <html-file-input>: the chosen file, read as text
    $scope.fileChosen = function (file, text) {
        var e = $scope.editor;
        e.error = null;
        if (file.size > MAX_BYTES) {
            e.error = 'The file is larger than 10 MB.';
            return;
        }
        e.html = text;
        e.filename = file.name;
        // A new page takes its title from the file's own <title>, if it has one
        if (e.mode === 'new' && !e.title) {
            var match = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
            var fromFile = match ? match[1].replace(/\s+/g, ' ').trim() : file.name.replace(/\.html?$/i, '');
            e.title = fromFile;
            $scope.titleChanged();
        }
    };

    $scope.savePage = function () {
        var e = $scope.editor;
        e.error = null;
        if (e.mode === 'new' && !e.html) {
            e.error = 'Choose an HTML file to upload.';
            return;
        }
        var payload = {
            title: e.title, slug: e.slug, description: e.description,
            access: e.access, published: e.published, trusted: e.trusted, showBanner: e.showBanner
        };
        if (e.html) {
            payload.html = e.html;
            payload.filename = e.filename;
        }
        e.saving = true;
        var request = e.mode === 'new' ?
            $http.post('/api/hosted-pages', payload) :
            $http.put('/api/hosted-pages/' + e.id, payload);
        request.then(function () {
            $scope.editor = null;
            load();
        }, function (res) {
            e.error = (res.data && res.data.error) || 'The page could not be saved.';
        }).finally(function () {
            e.saving = false;
        });
    };

    $scope.deletePage = function (page) {
        var dlg = dialogs.confirm('Delete page',
            'Delete "' + page.title + '"? Its link (/pages/' + page.slug + ') will stop working. This cannot be undone.');
        dlg.result.then(function () {
            $http.delete('/api/hosted-pages/' + page._id).then(load, function (res) {
                $scope.listError = (res.data && res.data.error) || 'The page could not be deleted.';
            });
        }, angular.noop);
    };

    // Quick publish / unpublish from the list
    $scope.togglePublished = function (page) {
        $http.put('/api/hosted-pages/' + page._id, { published: !page.published }).then(load, function (res) {
            $scope.listError = (res.data && res.data.error) || 'The page could not be updated.';
        });
    };

    $scope.copyLink = function (page) {
        var done = function () {
            page.copied = true;
            $timeout(function () { page.copied = false; }, 1500);
        };
        if ($window.navigator.clipboard) {
            $window.navigator.clipboard.writeText($scope.pageUrl(page)).then(function () { $scope.$apply(done); });
        } else {
            $window.prompt('Copy this link:', $scope.pageUrl(page));
        }
    };
}]);

// <input type="file" html-file-input="fileChosen(file, text)">: reads the chosen
// file as text in the browser and hands it over; nothing is sent until saved.
angular.module('mcrrcApp.admin').directive('htmlFileInput', ['$parse', function ($parse) {
    return {
        restrict: 'A',
        link: function (scope, element, attrs) {
            var handler = $parse(attrs.htmlFileInput);
            element.on('change', function () {
                var file = element[0].files && element[0].files[0];
                if (!file) return;
                var reader = new FileReader();
                reader.onload = function () {
                    scope.$apply(function () {
                        handler(scope, { file: file, text: reader.result });
                    });
                };
                reader.readAsText(file);
            });
        }
    };
}]);
