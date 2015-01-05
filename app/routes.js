module.exports = function(app, passport) {

	// server routes ===========================================================
	// handle things like api calls
	// authentication routes

	

	 // =====================================
    // HOME PAGE (with login links) ========
    // =====================================
    // app.get('/', function(req, res) {
    //     res.render('index.ejs'); // load the index.ejs file
    // });

    // frontend routes =========================================================
    // route to handle all angular requests
    


    // =====================================
    // LOGIN ===============================
    // =====================================
    // show the login form
    app.get('/api/login', function(req, res) {
        console.log("login route");
        // render the page and pass in any flash data if it exists
        res.send({ message: req.flash('loginMessage') });
            // res.render('login.ejs', { message: req.flash('loginMessage') }); 
    });

    // process the login form
    // app.post('/api/login', passport.authenticate('local-login', {
    //     successRedirect : '/profile', // redirect to the secure profile section
    //     failureRedirect : '/login', // redirect back to the signup page if there is an error
    //     failureFlash : true // allow flash messages
    // }));

    app.post('/api/login', function(req, res, next) {
        passport.authenticate('local-login', function(err, user, info) {
            if (err) {
                return next(err); 
            }
            if (!user) { 
                res.status(401).send(req.flash('loginMessage')); 
            }else{
               req.logIn(user, function(err) {
                if (err) { 
                    return next(err); 
                }
                console.log("D");
                res.redirect('/');
                res.status(200).send(req.flash('loginMessage')); 
            });         
            }
      // if (user === false) {
      //   res.status(401).send();  
      // } else {
      //   console.log(user);
      //   res.status(200).send(); 
      // }
    })(req, res, next); 
    });

    // =====================================
    // SIGNUP ==============================
    // =====================================
    // show the signup form
    app.get('/api/signup', function(req, res) {
        // render the page and pass in any flash data if it exists
        res.send({ message: req.flash('signupMessage') });
        // res.render('signup.ejs', { message: req.flash('signupMessage') });
    });

    // process the signup form
    app.post('/api/signup', passport.authenticate('local-signup', {
        successRedirect : '/', // redirect to the secure profile section
        failureRedirect : '/signup', // redirect back to the signup page if there is an error
        failureFlash : true // allow flash messages
    }));

    // =====================================
    // PROFILE SECTION =====================
    // =====================================
    // we will want this protected so you have to be logged in to visit
    // we will use route middleware to verify this (the isLoggedIn function)
    app.get('/api/profile', isLoggedIn, function(req, res) {
        console.log("OK");
        res.send({user:req.user});
        // res.render('profile.ejs', {
        //     user : req.user // get the user out of session and pass to template
        // });
    });
	
	// =====================================
    // LOGOUT ==============================
    // =====================================
    app.get('/logout', function(req, res) {
        req.logout();
        res.redirect('/');
    });


    app.get('*', function(req, res) {
        res.render('index.ejs',{user:req.user}); // load the index.ejs file
    });

};

// route middleware to make sure a user is logged in
function isLoggedIn(req, res, next) {

    // if user is authenticated in the session, carry on 
    if (req.isAuthenticated()){
        return next();
    }
    // if they aren't redirect them to the home page
    res.redirect('/');
}