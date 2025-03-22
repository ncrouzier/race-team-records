angular.module('mcrrcApp.tools').factory('NotificationService', ['notify', function( notify) {

    var factory = {};
   


    factory.showNotifiction = function(successful,text) {
        if (successful){
            messageTemplate = '<div style="text-align: left; font-size: 12px;">'+text+'</div>';
            notify({ messageTemplate: messageTemplate, classes: 'notify-message-success', position:'right', duration: 2000}); 
        }else{
            messageTemplate = '<div style="text-align: left; font-size: 12px;">'+text+'</div>';
            notify({ messageTemplate: messageTemplate, classes: 'notify-message-failure', position:'right', duration: 2000}); 
        }
    };

    factory.clipboardCopyNotifiction = function(successful,data) {
        if (successful){
            messageTemplate = '<div style="text-align: left; font-size: 12px;">Text copied to clipboard successfully! <BR>'+data+'</div>';
            notify({ messageTemplate: messageTemplate, classes: 'notify-message-success', position:'right', duration: 2000}); 
        }else{
            messageTemplate = '<div style="text-align: left; font-size: 12px;">Error trying to copy to clipboard! <BR>'+data+'</div>';
            notify({ messageTemplate: messageTemplate, classes: 'notify-message-failure', position:'right', duration: 2000}); 
        }
       
    };


    return factory;

}]);
