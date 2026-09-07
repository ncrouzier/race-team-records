angular.module('mcrrcApp.admin').factory('AgeGradingService', ['Restangular', function (Restangular) {

    var factory = {};

    factory.getMeta = function () {
        return Restangular.all('agegrading').customGET('meta').then(function (response) {
            return response.plain();
        }, function (res) {
            console.log('Error fetching age grading meta: ' + res.status);
        });
    };

    factory.getTable = function (params) {
        return Restangular.all('agegrading').customGET('table', params).then(function (response) {
            return response.plain();
        }, function (res) {
            console.log('Error fetching age grading table: ' + res.status);
        });
    };

    factory.refreshCache = function () {
        return Restangular.all('refresh-agegrading-cache').customPOST({});
    };

    return factory;
}]);
