angular.module('mcrrcApp').factory('UtilsService', function() {

    var factory = {};
    var user;


    factory.calculateAge = function(birthday) { // birthday is a date
        var bd = new Date(birthday);
        var ageDifMs = Date.now() - bd.getTime();
        var ageDate = new Date(ageDifMs); // miliseconds from epoch
        return Math.abs(ageDate.getUTCFullYear() - 1970);
    };

    return factory;

});
