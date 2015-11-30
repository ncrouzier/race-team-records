angular.module('mcrrcApp').factory('UtilsService',['Restangular', function(Restangular) {

    var factory = {};
    var user;


    factory.calculateAge = function(birthday) { // birthday is a date
        var bd = new Date(birthday);
        var ageDifMs = Date.now() - bd.getTime();
        var ageDate = new Date(ageDifMs); // miliseconds from epoch
        return Math.abs(ageDate.getUTCFullYear() - 1970);
    };


    factory.getSystemInfo = function(name) {
        return Restangular.one('systeminfos', name).get().then(
            function(systeminfo) {
                return systeminfo;
            },
            function(res) {
                console.log('Error: ' + res.status);
            });
    };

    return factory;

}]);
