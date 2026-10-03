// Sets the browser tab title for pages about one thing (a race, a result), so
// tabs and history entries say which one. Every other page keeps the site
// title from views/index.ejs.
angular.module('mcrrcApp').service('PageTitleService', ['$document', function ($document) {
    var SITE_TITLE = 'MCRRC Racing Team';

    // Sets "<title> | MCRRC Racing Team" and puts the site title back when
    // the given scope is destroyed.
    this.set = function (scope, title) {
        var doc = $document[0];
        var full = title ? title + ' | ' + SITE_TITLE : SITE_TITLE;
        doc.title = full;

        scope.$on('$destroy', function () {
            // The next page may already have set its own title by now
            if (doc.title === full) {
                doc.title = SITE_TITLE;
            }
        });
    };
}]);
