module.exports = function(app, qs, passport) {

    // =====================================
    // LOGIN ===============================
    // =====================================
    // show the login form
    app.get('/api/login', function(req, res) {
        // render the page and pass in any flash data if it exists
        res.send({
            user: req.user
        });
    });

    app.post('/api/login', function(req, res, next) {
        passport.authenticate('local-login', function(err, user, info) {
            if (err) {
                return next(err);
            }
            if (!user) {
                res.status(401).send(req.flash('loginMessage'));
            } else {
                req.logIn(user, function(err) {
                    if (err) {
                        return next(err);
                    }
                    res.status(200).send({
                        message: req.flash('loginMessage'),
                        user: req.user
                    });
                });
            }
        })(req, res, next);
    });

    // =====================================
    // SIGNUP ==============================
    // =====================================
    // show the signup form
    app.get('/api/signup', function(req, res) {
        // render the page and pass in any flash data if it exists
        res.send({
            message: req.flash('signupMessage')
        });
    });

    app.post('/api/signup', function(req, res, next) {
        passport.authenticate('local-signup', function(err, user, info) {
            if (err) {
                return next(err);
            }
            if (!user) {
                res.status(401).send(req.flash('signupMessage'));
            } else {
                req.logIn(user, function(err) {
                    if (err) {
                        return next(err);
                    }
                    res.status(200).send(req.flash('signupMessage'));
                });
            }
        })(req, res, next);
    });

    // =====================================
    // PROFILE SECTION =====================
    // =====================================
    // we will want this protected so you have to be logged in to visit
    // we will use route middleware to verify this (the isLoggedIn function)
    app.get('/api/profile', isLoggedIn, function(req, res) {
        res.send({
            user: req.user
        });
    });

    // =====================================
    // LOGOUT ==============================
    // =====================================
    app.get('/logout', function(req, res) {
        req.logout();
        res.redirect('/');
    });


    var RaceType = require('./models/racetype');
    var Member = require('./models/member');
    var Result = require('./models/result');

    // =====================================
    // TEAM MEMBERS ========================
    // =====================================


    //get all members
    app.get('/api/members', function(req, res) {
        var filters = req.query.filters;
        var sort = req.query.sort;
        var limit = req.query.limit;

        query = Member.find();
        if (filters) {
            if (filters.category) {
                var datetobemaster = getAddDateToDate(new Date(), -40, 0, 0);
                if (filters.category === 'Open') {
                    query = query.gt('dateofbirth', datetobemaster);
                } else if (filters.category === 'Master') {
                    query = query.lte('dateofbirth', datetobemaster);
                }
            }
            if (filters.sex) {
                query = query.regex('sex', filters.sex);
            }
            if (filters.memberStatus) {
                if (filters.memberStatus !== 'all') {
                    console.log(filters.memberStatus);
                    query = query.where('memberStatus').equals(filters.memberStatus);
                }

            }
        }
        if (sort) {
            query = query.sort(sort);
        }
        if (limit) {
            query = query.limit(req.query.limit);
        }


        query.exec(function(err, members) {
            // if there is an error retrieving, send the error. nothing after res.send(err) will execute
            if (err)
                res.send(err)
            res.json(members); // return all members in JSON format
        });
    });

    // get a member
    app.get('/api/members/:member_id', function(req, res) {
        Member.findOne({
            _id: req.params.member_id
        }, function(err, member) {
            if (err)
                res.send(err);

            if (member) {
                res.json(member);
            }


        });
    });

    // create member and send back all members after creation
    app.post('/api/members', isAdminLoggedIn, function(req, res) {
        // create a member, information comes from AJAX request from Angular
        Member.create({
            firstname: req.body.firstname,
            lastname: req.body.lastname,
            dateofbirth: req.body.dateofbirth,
            sex: req.body.sex,
            bio: req.body.bio,
            memberStatus: req.body.memberStatus,
            done: false
        }, function(err, member) {
            if (err) {
                res.send(err);
            } else {
                res.end('{"success" : "Member created successfully", "status" : 200}');
            }

        });
    });

    //update a member
    app.put('/api/members/:member_id', isAdminLoggedIn, function(req, res) {
        Member.findById(req.params.member_id, function(err, member) {
            member.firstname = req.body.firstname;
            member.lastname = req.body.lastname;
            member.dateofbirth = req.body.dateofbirth;
            member.sex = req.body.sex;
            member.bio = req.body.bio;
            member.memberStatus = req.body.memberStatus;
            member.save(function(err) {
                if (!err) {
                    Result.find({
                            'member._id': member._id
                        },
                        function(err, results) {
                            if (err) {
                                console.log(err);
                                res.send(err);
                            } else {

                                for (i = 0; i < results.length; i++) {
                                    results[i].member = [{
                                        _id: results[i].member[0]._id,
                                        firstname: req.body.firstname,
                                        lastname: req.body.lastname,
                                        sex: req.body.sex,
                                        dateofbirth: req.body.dateofbirth
                                    }];
                                    results[i].save(function(err) {
                                        if (err) {
                                            console.log(err);
                                            res.send(err);
                                        }
                                    });
                                }
                                res.end('{"success" : "Member updated successfully", "status" : 200}');
                            }
                        }
                    );
                } else {
                    console.log(err);
                    res.send(err);
                }
            });
        });



    });


    // delete a member
    app.delete('/api/members/:member_id', isAdminLoggedIn, function(req, res) {
        Member.remove({
            _id: req.params.member_id
        }, function(err, member) {
            if (err) {
                res.send(err);
            } else {
                res.end('{"success" : "Member deleted successfully", "status" : 200}');
            }
        });
    });


    // =====================================
    // RESULTS =============================
    // =====================================

    // get all results
    app.get('/api/results', function(req, res) {
        var sort = req.query.sort;
        var limit = req.query.limit;

        query = Result.find();

        if (req.query.filters) {
            var filters = JSON.parse(req.query.filters);

            if (filters.category) {
                query = query.regex('category', filters.category);
            }

            if (filters.sex) {
                query = query.where('member.sex').regex(filters.sex);

            }

            if (filters.racetype) {
                var racetype = filters.racetype;
                query = query.where('racetype._id').equals(racetype._id);
            }
            if (filters.mode && limit) {
                if (filters.mode === 'All') {
                    query = query.limit(limit);
                }
            }
        }
        if (sort) {
            query = query.sort(sort);
        }
        if (limit && ((filters && !filters.mode) || !filters)) {
            query = query.limit(limit);
        }

        if (req.query.member) {
            var member = JSON.parse(req.query.member);
            query = query.where('member._id').equals(member._id);
        }

        query.exec(function(err, results) {

            if (err) {
                res.send(err)
            } else {
                var filteredResult = results;
                if (req.query.filters) {
                    var filters = JSON.parse(req.query.filters);
                    if (filters.mode && limit) {
                        if (filters.mode === 'Best') {
                            filteredResult = [];
                            var resultLength = results.length;
                            var resCount = 0;
                            for (var i = 0; i < resultLength && resCount < limit; i++) {
                                if (!containsMember(filteredResult, results[i].member[0])) {
                                    filteredResult.push(results[i]);
                                    resCount++;
                                }
                            }
                        }
                    }
                }
                res.json(filteredResult);

            }




        });
    });

    // get a result
    app.get('/api/results/:result_id', function(req, res) {
        Result.findOne({
            _id: req.params.result_id
        }, function(err, result) {
            if (err)
                res.send(err);

            if (result) {
                res.json(result);
            }
        });
    });

    // create result and send back all members after creation
    app.post('/api/results', isAdminLoggedIn, function(req, res) {
        var members = [];
        for (i = 0; i < req.body.member.length; i++) {
            members.push({
                _id: req.body.member[i]._id,
                firstname: req.body.member[i].firstname,
                lastname: req.body.member[i].lastname,
                sex: req.body.member[i].sex,
                dateofbirth: req.body.member[i].dateofbirth
            });
        }
        Result.create({
            racename: req.body.racename,
            racetype: {
                _id: req.body.racetype._id,
                name: req.body.racetype.name,
                surface: req.body.racetype.surface,
                meters: req.body.racetype.meters,
                miles: req.body.racetype.miles
            },
            racedate: req.body.racedate,
            member: members,
            time: req.body.time,
            resultlink: req.body.resultlink,
            is_accepted: false,
            done: false
        }, function(err, result) {
            if (err) {
                res.send(err);
            } else {
                res.end('{"success" : "Result created successfully", "status" : 200}');
            }


        });
    });

    //update a result
    app.put('/api/results/:result_id', isAdminLoggedIn, function(req, res) {
        var members = [];
        for (i = 0; i < req.body.member.length; i++) {
            members.push({
                _id: req.body.member[i]._id,
                firstname: req.body.member[i].firstname,
                lastname: req.body.member[i].lastname,
                sex: req.body.member[i].sex,
                dateofbirth: req.body.member[i].dateofbirth
            });
        }
        console.log(req.body.member);
        console.log(members);


        Result.findById(req.params.result_id, function(err, result) {
            result.racename = req.body.racename;
            result.racetype = {
                _id: req.body.racetype._id,
                name: req.body.racetype.name,
                surface: req.body.racetype.surface,
                meters: req.body.racetype.meters,
                miles: req.body.racetype.miles
            };
            result.racedate = req.body.racedate;
            result.member = members;
            result.time = req.body.time;
            result.resultlink = req.body.resultlink;
            result.is_accepted = req.body.is_accepted;
            result.save(function(err) {
                if (err) {
                    res.send(err);
                } else {
                    res.end('{"success" : "Result updated successfully", "status" : 200}');
                }
            });
        });
    });


    // delete a result
    app.delete('/api/results/:result_id', isAdminLoggedIn, function(req, res) {
        Result.remove({
            _id: req.params.result_id
        }, function(err, result) {
            if (err) {
                res.send(err);
            } else {
                res.end('{"success" : "Result deleted successfully", "status" : 200}');
            }
        });
    });

    // =====================================
    // RaceTypes =============================
    // =====================================


    // get all racetypes
    app.get('/api/racetypes', function(req, res) {

        var sort = req.query.sort;
        var limit = req.query.limit;
        var surface = req.query.surface;

        query = RaceType.find();
        if (surface) {
            query = query.where('surface').equals(surface);
        }
        if (sort) {
            query = query.sort(sort);
        }
        if (limit) {
            query = query.limit(req.query.limit);
        }

        query.exec(function(err, racetypes) {
            if (err)
                res.send(err)
            res.json(racetypes);
        });
    });

    // get a racetype
    app.get('/api/racetypes/:racetype_id', function(req, res) {
        RaceType.findOne({
            _id: req.params.racetype_id
        }, function(err, racetype) {
            if (err)
                res.send(err);

            if (racetype) {
                res.json(racetype);
            }
        });
    });

    // create racetype and send back all racetypes after creation
    app.post('/api/racetypes', isAdminLoggedIn, function(req, res) {
        RaceType.create({
            name: req.body.name,
            surface: req.body.surface,
            meters: req.body.meters,
            miles: req.body.miles
        }, function(err, racetype) {
            if (err) {
                res.send(err);
            } else {
                res.end('{"success" : "Result created successfully", "status" : 200}');
            }

        });
    });

    //update a racetype
    app.put('/api/racetypes/:racetype_id', isAdminLoggedIn, function(req, res) {
        RaceType.findById(req.params.racetype_id, function(err, racetype) {
            racetype.name = req.body.name;
            racetype.surface = req.body.surface;
            racetype.meters = req.body.meters;
            racetype.miles = req.body.miles;
            racetype.save(function(err) {
                if (!err) {
                    Result.find({
                            'racetype._id': racetype._id
                        },
                        function(err, results) {
                            if (err) {
                                console.log(err);
                                res.send(err);
                            } else {
                                for (i = 0; i < results.length; i++) {
                                    results[i].racetype = {
                                        _id: results[i].racetype._id,
                                        name: req.body.name,
                                        surface: req.body.surface,
                                        meters: req.body.meters,
                                        miles: req.body.miles
                                    };
                                    results[i].save(function(err) {
                                        if (err) {
                                            console.log(err);
                                            res.send(err);
                                        }
                                    });
                                }
                                res.end('{"success" : "Result updated successfully", "status" : 200}');
                            }
                        }
                    );
                } else {
                    console.log(err);
                    res.send(err);
                }
            });
        });
    });


    // delete a racetype
    app.delete('/api/racetypes/:racetype_id', isAdminLoggedIn, function(req, res) {
        RaceType.remove({
            _id: req.params.racetype_id
        }, function(err, racetype) {
            if (err) {
                res.send(err);
            } else {
                res.end('{"success" : "Racetype deleted successfully", "status" : 200}');
            }
        });
    });


    app.get('*', function(req, res) {
        res.render('index.ejs', {
            user: req.user
        }); // load the index.ejs file
    });

};

// route middleware to make sure a user is logged in
function isLoggedIn(req, res, next) {
    // if user is authenticated in the session, carry on 
    if (req.isAuthenticated()) {
        return next();
    }
    // if they aren't redirect them to the home page
    res.status(401).send("insufficient privileges");
}

// route middleware to make sure a user is logged in and an admin
function isAdminLoggedIn(req, res, next) {
    // if user is authenticated in the session and has an admin role, carry on 
    if (req.isAuthenticated() && req.user.role === 'admin') {
        return next();
    }
    // if they aren't redirect them to the home page
    res.status(401).send("insufficient privileges");
}


function getAddDateToDate(date, years, months, days) {
    var resDate = new Date(date);
    resDate.setFullYear(resDate.getFullYear() + years, resDate.getMonth() + months, resDate.getDay() + days);
    return resDate;
}

// check if member is in list
function containsMember(list, member) {
    if (list.length == 0) {
        return false;
    }

    var i;
    for (i = 0; i < list.length; i++) {
        if (list[i].member[0]._id.equals(member._id)) {
            return true;
        }
    }
    return false;


}
