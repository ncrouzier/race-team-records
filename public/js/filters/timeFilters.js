var app = angular.module('mcrrcApp');

app.filter('secondsToTimeStringLong', function() {
    return function(sec) {
        var hours = Math.floor((sec % 86400) / 3600);
        var minutes = Math.floor(((sec % 86400) % 3600) / 60);
        var seconds = Math.floor(((sec % 86400) % 3600) % 60);
        var timeString = '';
        if (hours > 0) timeString += (hours > 1) ? (hours + " hours ") : (hours + " hour ");
        if (minutes > 0) timeString += (minutes > 1) ? (minutes + " minutes ") : (minutes + " minute ");
        if (seconds >= 0) timeString += (seconds > 1) ? (seconds + " seconds ") : (seconds + " second ");
        return timeString;
    };
});

app.filter('secondsToTimeString', function() {
    return function(sec) {
        var hours = Math.floor((sec % 86400) / 3600);
        var minutes = Math.floor(((sec % 86400) % 3600) / 60);
        var seconds = Math.floor(((sec % 86400) % 3600) % 60);
        var timeString = '';
        if (minutes < 10) minutes = "0" + minutes;
        if (seconds < 10) seconds = "0" + seconds;

        if (hours === 0) {
            return minutes + ":" + seconds;

        } else {
            return hours + ":" + minutes + ":" + seconds;

        }

    };
});

app.filter('secondsToTimeDiff', function() {
    return function(sec) {
        var hours = Math.floor((sec % 86400) / 3600);
        var minutes = Math.floor(((sec % 86400) % 3600) / 60);
        var seconds = Math.floor(((sec % 86400) % 3600) % 60);
        var timeString = '';
        if (seconds < 10) seconds = "0" + seconds;

        if (hours === 0) {
            return minutes + ":" + seconds;

        } else {
            return hours + ":" + minutes + ":" + seconds;

        }

    };
});

app.filter('propsFilter', function() {
    return function(items, props) {
        var out = [];

        if (angular.isArray(items)) {
            items.forEach(function(item) {
                var itemMatches = false;

                var keys = Object.keys(props);
                for (var i = 0; i < keys.length; i++) {
                    var prop = keys[i];
                    var text = props[prop].toLowerCase();
                    if (item[prop].toString().toLowerCase().indexOf(text) !== -1) {
                        itemMatches = true;
                        break;
                    }
                }

                if (itemMatches) {
                    out.push(item);
                }
            });
        } else {
            // Let the output be the input untouched
            out = items;
        }

        return out;
    };
});


app.filter('ageFilter', function() {
    function calculateAge(birthday) {
        var bd = new Date(birthday);
        var ageDifMs = Date.now() - bd.getTime();
        var ageDate = new Date(ageDifMs);
        return Math.abs(ageDate.getUTCFullYear() - 1970);
    }

    return function(birthdate) {
        return calculateAge(birthdate);
    };
});
