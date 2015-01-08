module.exports = function(app, passport) {

    // server routes ===========================================================
    // handle things like api calls
    // authentication routes

    members = require('./controllers/members');

    // Server API Routes



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


    // =====================================
    // TEAM MEMBERS ========================
    // =====================================
    var Member = require('./models/member');

    //get all members
    app.get('/api/members', function(req, res) {
        Member.find(function(err, members) {
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
            done: false
        }, function(err, member) {
            if (err)
                res.send(err);

            // get and return all the members after you create another
            Member.find(function(err, members) {
                if (err)
                    res.send(err)
                res.json(members);
            });
        });
    });

    //update a member
    app.put('/api/members/:member_id', isAdminLoggedIn, function(req, res) {
        Member.findById(req.params.member_id, function(err, member) {
            member.firstname = req.body.firstname;
            member.lastname = req.body.lastname;
            member.dateofbirth = req.body.dateofbirth;

            member.save(function(err) {
                if (!err) {
                    Member.find(function(err, members) {
                        if (err)
                            res.send(err)
                        res.json(members);
                    });
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
            if (err)
                res.send(err);
            res.json(member);
        });
    });


    // =====================================
    // RESULTS =============================
    // =====================================
    var Result = require('./models/result');

    // get all results
    app.get('/api/results', function(req, res) {
        Result.find(function(err, results) {
            if (err)
                res.send(err)
            res.json(results);
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
        Result.create({
            racename: req.body.racename,
            racetype: req.body.racetype,
            date: req.body.date,
            member: req.body.member,
            timeout: req.body.timeout,
            member_category: req.body.member_category,
            is_accepted: false,
            done: false
        }, function(err, result) {
            if (err)
                res.send(err);

            Member.find(function(err, results) {
                if (err)
                    res.send(err)
                res.json(results);
            });
        });
    });

    //update a result
    app.put('/api/results/:result_id', isAdminLoggedIn, function(req, res) {
        Result.findById(req.params.result_id, function(err, result) {
            result.racename = req.body.racename;
            result.racetype = req.body.racetype;
            result.date = req.body.date;
            result.member = req.body.member;
            result.timeout = req.body.timeout;
            result.member_category = req.body.member_category;
            result.is_accepted = req.body.is_accepted;

            result.save(function(err) {
                if (!err) {
                    Result.find(function(err, results) {
                        if (err)
                            res.send(err)
                        res.json(results);
                    });
                } else {
                    console.log(err);
                    res.send(err);
                }
            });
        });
    });


    // delete a result
    app.delete('/api/results/:result_id', isAdminLoggedIn, function(req, res) {
        Result.remove({
            _id: req.params.result_id
        }, function(err, result) {
            if (err)
                res.send(err);
            res.json(result);
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
