var app = angular.module('mcrrcApp');

app.filter('secondsToTimeStringLong', function() {
    return function(centisec) {
        var hours = Math.floor(centisec / 360000);
        var minutes = Math.floor(((centisec % 8640000) % 360000) / 6000);
        var seconds = Math.floor((((centisec % 8640000) % 360000) % 6000) / 100);
        var centiseconds = Math.floor((((centisec % 8640000) % 360000) % 6000) % 100);
        var timeString = '';
        if (hours > 0) timeString += (hours > 1) ? (hours + " hours ") : (hours + " hour ");
        if (minutes > 0) timeString += (minutes > 1) ? (minutes + " minutes ") : (minutes + " minute ");
        if (seconds >= 0) timeString += (seconds > 1) ? (seconds + " seconds ") : (seconds + " second ");
        return timeString;
    };
});


function secondsToTimeString(centisec) {
    var hours = Math.floor(centisec / 360000);
    var minutes = Math.floor(((centisec % 8640000) % 360000) / 6000);
    var seconds = Math.floor((((centisec % 8640000) % 360000) % 6000) / 100);
    var centiseconds = Math.floor((((centisec % 8640000) % 360000) % 6000) % 100);
    var timeString = '';

    if (hours === 0) {
        if (seconds < 10) seconds = "0" + seconds;
        if (centiseconds !== 0) {
            if (centiseconds < 10) centiseconds = "0" + centiseconds;
            return minutes + ":" + seconds + "." + centiseconds;
        } else {
            return minutes + ":" + seconds;
        }

    } else {
        if (minutes < 10) minutes = "0" + minutes;
        if (seconds < 10) seconds = "0" + seconds;
        if (centiseconds !== 0) {
            if (centiseconds < 10) centiseconds = "0" + centiseconds;
            return hours + ":" + minutes + ":" + seconds + "." + centiseconds;
        } else {
            return hours + ":" + minutes + ":" + seconds;
        }
    }
}

app.filter('secondsToTimeString', function() {
    return function(centisec) {
        var hours = Math.floor(centisec / 360000);
        var minutes = Math.floor(((centisec % 8640000) % 360000) / 6000);
        var seconds = Math.floor((((centisec % 8640000) % 360000) % 6000) / 100);
        var centiseconds = Math.floor((((centisec % 8640000) % 360000) % 6000) % 100);
        var timeString = '';

        if (hours === 0) {
            if (seconds < 10) seconds = "0" + seconds;
            if (centiseconds !== 0) {
                if (centiseconds < 10) centiseconds = "0" + centiseconds;
                return minutes + ":" + seconds + "." + centiseconds;
            } else {
                return minutes + ":" + seconds;
            }

        } else {
            if (minutes < 10) minutes = "0" + minutes;
            if (seconds < 10) seconds = "0" + seconds;
            if (centiseconds !== 0) {
                if (centiseconds < 10) centiseconds = "0" + centiseconds;
                return hours + ":" + minutes + ":" + seconds + "." + centiseconds;
            } else {
                return hours + ":" + minutes + ":" + seconds;
            }
        }

    };
});





app.filter('secondsToTimeDiff', function() {
    return function(centisec) {
        var hours = Math.floor(centisec/ 360000);
        var minutes = Math.floor(((centisec % 8640000) % 360000) / 6000);
        var seconds = Math.floor((((centisec % 8640000) % 360000) % 6000) / 100);
        var centiseconds = Math.floor((((centisec % 8640000) % 360000) % 6000) % 100);
        var timeString = '';
        if (seconds < 10) seconds = "0" + seconds;

        if (hours === 0) {
            if (centiseconds !== 0) {
                if (centiseconds < 10) centiseconds = "0" + centiseconds;
                return minutes + ":" + seconds + "." + centiseconds;
            } else {
                return minutes + ":" + seconds;
            }
        } else {
            if (centiseconds !== 0) {
                if (centiseconds < 10) centiseconds = "0" + centiseconds;
                return hours + ":" + minutes + ":" + seconds + "." + centiseconds;
            } else {
                return hours + ":" + minutes + ":" + seconds;
            }
        }
    };
});


function resultToPace(result) {
    //round up!
    var seconds = Math.ceil(result.time / 100);
    var distance = result.race.racetype.miles;

    var m = Math.floor((seconds / 60) / distance);

    var s = Math.round(((((seconds / 60) / distance) % 1) * 60));
    if (s === 60) { m = m + 1;
        s = 0; }

    if (s < 10) s = "0" + s;
    return m + ":" + s;
}

app.filter('resultToPace', function() {
    return function(result, race) {
        //round up!
        var seconds = Math.ceil(result.time / 100);
        if (!race) {
            distance = result.race.racetype.miles;
        } else {
            distance = race.racetype.miles;
        }


        var m = Math.floor((seconds / 60) / distance);

        var s = Math.round(((((seconds / 60) / distance) % 1) * 60));
        if (s === 60) { m = m + 1;
            s = 0; }

        if (s < 10) s = "0" + s;
        return m + ":" + s;
    };
});

app.filter('legToSwimPace', function() {
    return function(leg) {
        //round up!
        var seconds = Math.ceil(leg.time / 100);
        var distance = leg.meters;
        var hundreds = distance/100;

        var secperhundreds = Math.floor(seconds/hundreds);

        var m = Math.floor((secperhundreds / 60));
        var s = Math.round(((secperhundreds % 60)));
        if (s === 60) { m = m + 1;
            s = 0; }

        if (s < 10) s = "0" + s;
        return m + ":" + s;
    };
});

app.filter('legToRunPace', function() {
    return function(leg) {
        //round up!
        var seconds = Math.ceil(leg.time / 100);
        var distance = leg.miles;

        var m = Math.floor((seconds / 60) / distance);
        var s = Math.round(((((seconds / 60) / distance) % 1) * 60));
        if (s === 60) { m = m + 1; s = 0; }

        if (s < 10) s = "0" + s;
        return m + ":" + s;
    };
});

app.filter('legToBikePace', function() {
    return function(leg) {
        //round up!
        var hours = leg.time / 360000;
        var distance = leg.miles;
        var mph = Math.floor(distance/hours);
        return mph;
    };
});

app.filter('resultToBikePace', function() {
    return function(result,raceinfo) {
        //round up!
        var hours = result.time / 360000;
        var distance;
        if(raceinfo){
            distance = raceinfo.race.racetype.miles;
        }else{
            distance = result.race.racetype.miles;
        }
        var mph = Math.floor(distance/hours);
        return mph;
    };
});

app.filter('resultToSwimPace', function() {
    return function(result,raceinfo) {
        //round up!
        var seconds = Math.ceil(result.time / 100);
        var distance;
        if(raceinfo){
            distance = raceinfo.race.racetype.meters;
        }else{
            distance = result.race.racetype.meters;
        }
        var hundreds = distance/100;
        var secperhundreds = Math.floor(seconds/hundreds);

        var m = Math.floor((secperhundreds / 60));
        var s = Math.round(((secperhundreds % 60)));
        if (s === 60) { m = m + 1;
            s = 0; }

        if (s < 10) s = "0" + s;
        return m + ":" + s;
    };
});

app.filter('resultSportIcons', function() {
    return function(result) {
        var res = " ";
        if( result.race.isMultisport){
            result.legs.forEach(function(leg) {
                if(leg.legType ==='swim'){
                    res += '<span class="hoverhand" title="swim ('+leg.distanceName+')">🏊</span>';
                }else if(leg.legType ==='bike'){
                    res += '<span class="hoverhand" title="bike ('+leg.distanceName+')">🚴</span>';
                }else if(leg.legType ==='run'){
                    res += '<span class="hoverhand" title="run ('+leg.distanceName+')">🏃</span>';
                }
            });
        }else {
            if( result.race.racetype.name === 'Swim'){
                res += '<span class="hoverhand" title="swim">🏊</span>';
            }else if ( result.race.racetype.name === 'Cycling'){
                res += '<span class="hoverhand" title="bike">🚴</span>';
            }
        }

        return res;
    };
});

app.filter('raceinfoSportIcons', function() {
    return function(raceinfo) {
        var res = " ";
        if( raceinfo.isMultisport === true && raceinfo.results[0] && raceinfo.results[0].legs){
            raceinfo.results[0].legs.forEach(function(leg) {
                if(leg.legType ==='swim'){
                    res += '<span class="hoverhand" title="swim ('+leg.distanceName+')">🏊</span>';
                }else if(leg.legType ==='bike'){
                    res += '<span class="hoverhand" title="bike ('+leg.distanceName+')">🚴</span>';
                }else if(leg.legType ==='run'){
                    res += '<span class="hoverhand" title="run ('+leg.distanceName+')">🏃</span>';
                }
            });
        }else {
            if( raceinfo.racetype.name === 'Swim'){
                res += '<span class="hoverhand" title="swim">🏊</span>';
            }else if ( raceinfo.racetype.name === 'Cycling'){
                res += '<span class="hoverhand" title="bike">🚴</span>';
            }
        }

        return res;
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

app.filter('memberAgeFilter', function() {
    function calculateAgeAtDate(birthday, date) {
        var bd = new Date(birthday);
        var customDate = new Date(date);
        var ageDifMs = customDate.getTime() - bd.getTime();
        var ageDate = new Date(ageDifMs);
        return Math.abs(ageDate.getUTCFullYear() - 1970);
    }
    return function(member) {
        var res = "";
        res = calculateAgeAtDate(member.dateofbirth, new Date());
        return res;
    };
});


app.filter('membersNamesWithAgeFilter', function() {
    function calculateAgeAtDate(birthday, date) {
        var bd = new Date(birthday);
        var customDate = new Date(date);
        var ageDifMs = customDate.getTime() - bd.getTime();
        var ageDate = new Date(ageDifMs);
        return Math.abs(ageDate.getUTCFullYear() - 1970);
    }
    return function(result, race) {
        var res = "";
        var members = result.members;
        if (race) {
            date = race.racedate;
        } else {
            date = result.race.racedate;
        }
        members.forEach(function(member) {
            res += member.firstname + ' ' + member.lastname + ' (' + calculateAgeAtDate(member.dateofbirth, date) + ') , ';

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

app.filter('ageAtDateFilter', function() {
    function calculateAgeAtDate(birthday, date) {
        var bd = new Date(birthday);
        var customDate = new Date(date);
        var ageDifMs = customDate.getTime() - bd.getTime();
        var ageDate = new Date(ageDifMs);
        return Math.abs(ageDate.getUTCFullYear() - 1970);
    }

    return function(birthdate, date) {
        return calculateAgeAtDate(birthdate, date);
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
app.filter('memberFilter', function() {
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
app.filter('resultSuperFilter', function() {
    return function(results, query, racetype) {
        if ( query || racetype ) {
            let filtered = [];
            let jsonQuery;
            if (isJson(query)){
                jsonQuery = JSON.parse(query);
            }
            angular.forEach(results, function(result) {
                let raceTypeFound = false;
                if(racetype && result.race.racetype._id !== racetype._id){                                    
                    return;
                }
                if (jsonQuery){
                    if (jsonQuery.country &&  result.race.location.country &&  jsonQuery.country.toLowerCase() === result.race.location.country.toLowerCase()){
                        if (jsonQuery.state ){
                            if (result.race.location.state && jsonQuery.state.toLowerCase() === result.race.location.state.toLowerCase())
                            filtered.push(result);
                            return; 
                        }else{
                            filtered.push(result);
                            return; 
                        }                       
                    }    
                }

                if(query){                

                    //race name
                    if (result.race.racename.toLowerCase().indexOf(query.toLowerCase()) !== -1) {
                        filtered.push(result);
                        return;
                    }
                    //racetype
                    if (result.race.racetype.name.toLowerCase().indexOf(query.toLowerCase()) !== -1) {
                        filtered.push(result);
                        return;
                    }

                    //racetype surface
                    if (result.race.racetype.surface.toLowerCase().indexOf(query.toLowerCase()) !== -1) {
                        filtered.push(result);
                        return;
                    }
                    //member name
                    var foundname = false;
                    result.members.forEach(function(member) {
                        let name = member.firstname + ' ' + member.lastname + ', ';
                        if (!foundname && name.toLowerCase().indexOf(query.toLowerCase()) !== -1) {
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
                    if (pace.toLowerCase().indexOf(query.toLowerCase()) !== -1) {
                        filtered.push(result);
                        return;
                    }
                }else{
                    if(racetype && result.race.racetype._id === racetype._id){     
                        filtered.push(result);                               
                        return;
                    }
                }                           
            });
            return filtered;
        } else {
            return results;
        }
    };
});

app.filter('highlightignorespan', function() {
    function escapeRegexp(queryToEscape) {
        var esc = queryToEscape.replace(/([.?*+^$[\]\\(){}|-])/g, '\\$1');
        return esc + '(?![^<]*>)';
    }

    return function(matchItem, query) {
        var cleanedItem = matchItem.replace(new RegExp("(<([^>]+)>)", 'gi'), '');
        return query && matchItem ? matchItem.replace(new RegExp(escapeRegexp(query), 'gi'), '<span class="ui-select-highlight">$&</span>') : matchItem;
    };
});



app.filter('rankTooltip', function() {
    return function(ranking) {
        if (ranking) {
            var res = "";
            if (ranking.agerank) {
                res += '<span class="ranking-tooltip-cat">Age group rank: </span><span class="ranking-tooltip-rank">' + ordinal_suffix_of(ranking.agerank, true);
                if (ranking.agetotal) {
                    res += ' of ' + ranking.agetotal;
                }
                res += '</span><br>';
            }
            if (ranking.genderrank) {
                res += '<span class="ranking-tooltip-cat">Gender rank: </span><span class="ranking-tooltip-rank">' + ordinal_suffix_of(ranking.genderrank, true);
                if (ranking.gendertotal) {
                    res += ' of ' + ranking.gendertotal;
                }
                res += '</span><br>';
            }
            if (ranking.overallrank) {
                res += '<span class="ranking-tooltip-cat">Overall rank: </span><span class="ranking-tooltip-rank">' + ordinal_suffix_of(ranking.overallrank, true);
                if (ranking.overalltotal) {
                    res += ' of ' + ranking.overalltotal;
                }
                res += '</span>';
            }
            return res;
        }
    };
});

app.filter('rankTooltipOneLine', function() {
    return function(ranking) {
        if (ranking) {
            var res = "";
            if (ranking.agerank) {
                res += "Age group rank: " + ordinal_suffix_of(ranking.agerank, false);
                if (ranking.agetotal) {
                    res += " of " + ranking.agetotal;
                }
                res += ", ";
            }
            if (ranking.genderrank) {
                res += "Gender rank: " + ordinal_suffix_of(ranking.genderrank, false);
                if (ranking.gendertotal) {
                    res += " of " + ranking.gendertotal;
                }
                res += ", ";
            }
            if (ranking.overallrank) {
                res += "Overall rank: " + ordinal_suffix_of(ranking.overallrank, false);
                if (ranking.overalltotal) {
                    res += " of " + ranking.overalltotal;
                }
                res += ", ";
            }
            return res.slice(0, -2);
        }
    };
});

app.filter('rankTooltipTd', function() {
    return function(ranking) {
        if (ranking) {
            var res = '';
            if (ranking.agerank) {
                res += '<td style="text-align: center;"><span style="cursor:pointer;" title="out of ' + ranking.agetotal + '">' + inline_ordinal_suffix_of(ranking.agerank, true) + '</span></td>';
            } else {
                res += '<td></td>';
            }
            if (ranking.genderrank) {
                res += '<td style="text-align: center;"><span style="cursor:pointer;" title="out of ' + ranking.gendertotal + '">' + inline_ordinal_suffix_of(ranking.genderrank, true) + '</span></td>';
            } else {
                res += '<td></td>';
            }
            if (ranking.overallrank) {
                res += '<td style="text-align: center;"><span style="cursor:pointer;" title="out of ' + ranking.overalltotal + '">' + inline_ordinal_suffix_of(ranking.overallrank, true) + '</span></td>';
            } else {
                res += '<td></td>';
            }
            return res;
            // return res.slice(0, -2);
        } else {
            return '<td></td><td></td><td></td>';
        }
    };
});


function ordinal_suffix_of(i, withStyle) {
    var j = i % 10,
        k = i % 100;
    if (j == 1 && k != 11) {
        if (withStyle) {
            return i + '<span class="ordinal_suffix ordinal_suffix_st">st</span>';
        } else {
            return i + "st";
        }
    }
    if (j == 2 && k != 12) {
        if (withStyle) {
            return i + '<span class="ordinal_suffix ordinal_suffix_nd">nd</span>';
        } else {
            return i + "nd";
        }
    }
    if (j == 3 && k != 13) {
        if (withStyle) {
            return i + '<span class="ordinal_suffix ordinal_suffix_rd">rd</span>';
        } else {
            return i + "rd";
        }
    }
    if (withStyle) {
        return i + '<span class="ordinal_suffix ordinal_suffix_th">th</span>';
    } else {
        return i + "th";
    }
}

app.filter('inline_ordinal_suffix_of', ['$sce',function($sce) {
    return function(i, withStyle, toptreeclass_) {
        if (i === undefined || i === null || i===""){
            return "";
        }
        if (i >3){
            toptreeclass_= '    ';
        }

        var j = i % 10,
            k = i % 100;
        if (j == 1 && k != 11) {
            if (withStyle) {
                return '<span class="'+toptreeclass_+'">' + i + '<span style="font-style: italic;vertical-align: super;font-size: 0.6em;">st</span></span>';
            } else {
                return i + "st";
            }
        }
        if (j == 2 && k != 12) {
            if (withStyle) {
                return '<span class="'+toptreeclass_+'">' + i + '<span style="font-style: italic;vertical-align: super;font-size: 0.6em;">nd</span></span>';
            } else {
                return i + "nd";
            }
        }
        if (j == 3 && k != 13) {
            if (withStyle) {
                return '<span class="'+toptreeclass_+'">' + i + '<span style="font-style: italic;vertical-align: super;font-size: 0.6em;">rd</span></span>';
            } else {
                return i + "rd";
            }
        }
        if (withStyle) {
            return '<span class="'+toptreeclass_+'">' + i + '<span style="font-style: italic;vertical-align: super;font-size: 0.6em;">th</span></span>';
        } else {
            return i + "th";
        }
    };
}]);


function inline_ordinal_suffix_of(i, withStyle) {
    var j = i % 10,
        k = i % 100;
    if (j == 1 && k != 11) {
        if (withStyle) {
            return i + '<span style="font-style: italic;vertical-align: super;font-size: 0.6em;">st</span>';
        } else {
            return i + "st";
        }
    }
    if (j == 2 && k != 12) {
        if (withStyle) {
            return i + '<span style="font-style: italic;vertical-align: super;font-size: 0.6em;">nd</span>';
        } else {
            return i + "nd";
        }
    }
    if (j == 3 && k != 13) {
        if (withStyle) {
            return i + '<span style="font-style: italic;vertical-align: super;font-size: 0.6em;">rd</span>';
        } else {
            return i + "rd";
        }
    }
    if (withStyle) {
        return i + '<span style="font-style: italic;vertical-align: super;font-size: 0.6em;">th</span>';
    } else {
        return i + "th";
    }
}

function isJson(variable) {
    try {
      JSON.parse(variable);
      return true;
    } catch (e) {
      return false;
    }
  }

app.filter('sortMembers', function () {
  return function (items,type,reverseSort) {
    var sorted = [];
    if (items !== undefined && Array.isArray(items)){
      items.forEach(function (i) {
        sorted.push(i);
      });
      if(type === "firstname"){
          sorted.sort(function(a, b) {
            var nameA = a.firstname.toUpperCase(); // ignore upper and lowercase
            var nameB = b.firstname.toUpperCase(); // ignore upper and lowercase
            if (nameA < nameB) {
              return 1;
            }
            if (nameA > nameB) {
              return -1;
            }
             return 0;
          });
        }else if (type === "age" || type ==="dateofbirth"){
        sorted.sort(function(a, b) {
          var dateA = new Date(a.dateofbirth); // ignore upper and lowercase
          var dateB = new Date(b.dateofbirth); // ignore upper and lowercase
          if (dateA < dateB) {
            return -1;
          }
          if (dateA > dateB) {
            return 1;
          }
           return 0;
        });
      }else if(type === "status"){
          sorted.sort(function(a, b) {
            var nameA = a.memberStatus.toUpperCase(); // ignore upper and lowercase
            var nameB = b.memberStatus.toUpperCase(); // ignore upper and lowercase
            if (nameA < nameB) {
              return 1;
            }
            if (nameA > nameB) {
              return -1;
            }
             return 0;
          });
        }else if(type === "numberofraces"){
            sorted.sort(function(a, b) {              
              if (a.numberofraces < b.numberofraces) {
                return 1;
              }
              if (a.numberofraces > b.numberofraces) {
                return -1;
              }
               return 0;
            });
          }else if(type === "maxage"){
            sorted.sort(function(a, b) {              
              if (a.max < b.max) {
                return 1;
              }
              if (a.max > b.max) {
                return -1;
              }
               return 0;
            });
          }else{
            return sorted;
      }
      
    }
    if(!reverseSort){
      return  Array.prototype.reverse.call(sorted);
    }else{
      return sorted;
    }

  };
});

app.filter("sanitize", ['$sce', function($sce) {
    return function(htmlCode) {
        return $sce.trustAsHtml(htmlCode);
    };
}]);

app.filter('unsafe', function($sce) {
    return $sce.trustAsHtml; });

app.filter('pbFilter', function() {
    return function(personalBests, surface) {
        return personalBests.filter(function(pb) {
            return pb.surface === surface;
        });
    };
});