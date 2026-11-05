// A file <input> that calls back with the chosen file — ng-change does not
// fire for file inputs.
//
//   <input type="file" photo-file-input="onFileChosen(file)">
//
// The input is cleared after each pick, so choosing the same file again
// still calls back.
angular.module('mcrrcApp').directive('photoFileInput', function () {
    return {
        restrict: 'A',
        link: function (scope, element, attrs) {
            element.on('change', function () {
                var file = element[0].files && element[0].files[0];
                element[0].value = '';
                if (!file) return;
                scope.$apply(function () {
                    scope.$eval(attrs.photoFileInput, { file: file });
                });
            });
        }
    };
});
