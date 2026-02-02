angular.module('mcrrcApp.results').factory('RequirementsService', ['Restangular', function(Restangular) {

    var factory = {};

    factory.getRequirements = function(year) {
        return Restangular.one('requirements', year).get().then(
            function(data) {
                return data;
            },
            function(res) {
                console.log('Error: ' + res.status);
            });
    };

    return factory;
}]);
