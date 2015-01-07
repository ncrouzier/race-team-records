angular.module('AuthService', []).factory('AuthService', [function() {

    var user;

    return {
        setUser: function(aUser) {
            user = aUser;
        },
        isLoggedIn: function() {
            return (user) ? user : false;
        }
    };

}]);
