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


function secondsToTimeString(sec) {
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
}

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


function resultToPace(result) {
    var seconds = result.time;
    var distance = result.racetype.miles;

    var m = Math.floor((seconds / 60) / distance);

    var s = Math.round(((((seconds / 60) / distance) % 1) * 60));

    if (m < 10) m = "0" + m;
    if (s < 10) s = "0" + s;
    return m + ":" + s;
}

app.filter('resultToPace', function() {
    return function(result) {
        var seconds = result.time;
        var distance = result.racetype.miles;

        var m = Math.floor((seconds / 60) / distance);

        var s = Math.round(((((seconds / 60) / distance) % 1) * 60));

        if (m < 10) m = "0" + m;
        if (s < 10) s = "0" + s;
        return m + ":" + s;
    };
});



app.filter('membersNamesFilter', function() {
    return function(members) {
        var res = "";
        members.forEach(function(member) {
            res += member.firstname + ' ' + member.lastname + ', ';

        });
        res = res.slice(0, -2);

        return res;
    };
});



// Options:
// wordwise (boolean) - if true, cut only by words bounds,
// max (integer) - max length of the text, cut to this number of chars,
// tail (string, default: ' …') - add this string to the input string if the string was cut.
app.filter('cut', function() {
    return function(value, wordwise, max, tail) {
        if (!value) return '';

        max = parseInt(max, 10);
        if (!max) return value;
        if (value.length <= max) return value;

        value = value.substr(0, max);
        if (wordwise) {
            var lastspace = value.lastIndexOf(' ');
            if (lastspace != -1) {
                value = value.substr(0, lastspace);
            }
        }
        return value + (tail || ' …');
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

app.filter('categoryFilter', function() {
    function calculateCategory(birthday) {
        var bd = new Date(birthday);
        var ageDifMs = Date.now() - bd.getTime();
        var ageDate = new Date(ageDifMs);
        var age = Math.abs(ageDate.getUTCFullYear() - 1970);
        return (age >= 40 ? "Master" : "Open");
    }

    return function(birthdate) {
        return calculateCategory(birthdate);
    };

});
app.filter('memberFilter', function(query) {
    return function(members, query) {
        var filtered = [];
        angular.forEach(members, function(member) {
            var name = member.firstname + ' ' + member.lastname;
            if (name.toLowerCase().indexOf(query.toLowerCase()) !== -1) {
                filtered.push(member);
            }
        });
        return filtered;
    };
});
app.filter('resultSuperFilter', function(query) {
    return function(results, query) {
        if (undefined !== query) {
            var filtered = [];
            angular.forEach(results, function(result) {
                //race name
                if (result.racename.toLowerCase().indexOf(query.toLowerCase()) !== -1) {
                    filtered.push(result);
                    return;
                }
                //racetype
                if (result.racetype.name.toLowerCase().indexOf(query.toLowerCase()) !== -1) {
                    filtered.push(result);
                    return;
                }
                //racetype surface
                if (result.racetype.surface.toLowerCase().indexOf(query.toLowerCase()) !== -1) {
                    filtered.push(result);
                    return;
                }

                //member name
                var foundname = false;
                result.member.forEach(function(member) {
                    name = member.firstname + ' ' + member.lastname + ', ';
                    if (name.toLowerCase().indexOf(query.toLowerCase()) !== -1) {
                        filtered.push(result);
                        foundname = true;
                        return;
                    }
                });
                if (foundname) return;

                //time 
                var time = secondsToTimeString(result.time);
                if (time.toLowerCase().indexOf(query.toLowerCase()) === 0) {
                    filtered.push(result);
                    return;
                }

                //pace
                var pace = resultToPace(result);
                if (pace.toLowerCase().indexOf(query.toLowerCase()) === 0) {
                    filtered.push(result);
                    return;
                }
            });
            return filtered;
        } else {
            return results;
        }


    };
});
