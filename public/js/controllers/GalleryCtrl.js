angular.module('mcrrcApp.members').controller('GalleryController', ['$scope', '$analytics', '$filter', 'AuthService', 'ResultsService', function($scope, $analytics, $filter, AuthService, ResultsService) {

    $scope.authService = AuthService;
    $scope.$watch('authService.isLoggedIn()', function(user) {
        $scope.user = user;
    });



    $(function() {
        $("#nanoGallery1").nanoGallery({
            kind: 'picasa',
            userID: 'mcrrcraceteamsite@gmail.com',
            thumbnailWidth: 'auto',
            thumbnailHeight: 250,
            colorScheme: 'none',
            thumbnailHoverEffect: [{
                name: 'labelAppear75',
                duration: 300
            }],
            theme: 'light',
            photoSorting: 'standard',
            thumbnailGutterWidth: 0,
            thumbnailGutterHeight: 0,
            i18n: {
                thumbnailImageDescription: 'View Photo',
                thumbnailAlbumDescription: 'Open Album'
            },
            thumbnailLabel: {
                display: true,
                hideIcons: true,
                position: 'overImageOnBottom',
                align: 'center',
                itemsCount: 'description'  
            }
        });
    });





}]);
