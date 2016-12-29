angular.module('mcrrcApp').factory('AuthService', function() {

	var factory = {};
    var user; 


        factory.setUser = function(aUser) {
            user = aUser;
        };

        factory.isLoggedIn =function() {
            return (user) ? user : false;
        }; 
    
    return factory;

});
