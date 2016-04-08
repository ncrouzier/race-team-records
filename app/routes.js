var mongoose = require('mongoose');

module.exports = function(app, qs, passport, async, _) {

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

    var SystemInfo = require('./models/systeminfo');
    var RaceType = require('./models/racetype');
    var Member = require('./models/member');
    var Result = require('./models/result');
    var Race = require('./models/race');
    var AgeGrading = require('./models/agegrading');


    // =====================================
    // SYSTEM INFO =========================
    // ===================================== 

    //Init SytemInfo, should only happen once.
    SystemInfo.findOne({
        name: 'mcrrc'
    }, function(err, systemInfo) {
        if (err)
            console.log("error fetching systemInfo")
        if (!systemInfo) {
            SystemInfo.create({
                name: "mcrrc"
            }, function(err) {
                if (err) {
                    console.log(err);
                }
            });
        }
    });



    // get a member
    app.get('/api/systeminfos/:name', function(req, res) {
        SystemInfo.findOne({
            name: req.params.name
        }, function(err, systeminfo) {
            if (err)
                res.send(err);
            if (systeminfo) {
                res.json(systeminfo);
            }
        });
    });

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


    app.get('/api/members/:member_id/pbs', function(req, res) {
        var pbraces = ['1 mile', '5k', '8k', '10k', '10 miles', 'Half Marathon', 'Marathon'];
        var pbs = [];
        var calls = [];

        pbraces.forEach(function(pb) {
            calls.push(function(callback) {
                var query = Result.find({
                    'members._id': req.params.member_id,
                    'race.racetype.name': pb
                });
                query = query.sort('time');
                query.exec(function(err, results) {
                    if (err) {
                        return callback(err);
                    } else {
                        if (results.length > 0) {
                            pbs.push(results[0]);
                            callback(null);
                        } else {
                            callback(null);
                        }
                    }
                });
            });
        });

        async.parallel(calls, function(err) {
            /* this code will run after all calls finished the job or
               when any of the calls passes an error */
            if (err)
                return res.send(err);

            //sort
            pbs.sort(sortResultsByDistance);
            res.json(pbs);
        });
    });

    // create member 
    app.post('/api/members', isAdminLoggedIn, function(req, res) {
        // create a member, information comes from AJAX request from Angular
        Member.create({
            firstname: req.body.firstname,
            lastname: req.body.lastname,
            dateofbirth: req.body.dateofbirth,
            sex: req.body.sex,
            bio: req.body.bio,
            pictureLink: req.body.pictureLink,
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
            member.pictureLink = req.body.pictureLink;
            member.memberStatus = req.body.memberStatus;
            member.save(function(err) {
                if (!err) {
                    Result.find({
                            'members._id': member._id
                        },
                        function(err, results) {
                            if (err) {
                                console.log(err);
                                res.send(err);
                            } else {
                                for (i = 0; i < results.length; i++) {
                                    for (j = 0; j < results[i].members.length; j++) { //itirates members if relay race
                                        if (results[i].members[j]._id.equals(req.body._id)) {
                                            results[i].members[j].firstname = req.body.firstname;
                                            results[i].members[j].lastname = req.body.lastname;
                                            results[i].members[j].sex = req.body.sex;
                                            results[i].members[j].dateofbirth = req.body.dateofbirth;
                                        }
                                    }
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


    app.get('/updateResults',isAdminLoggedIn, function(req, res) {
        var data = req.body;
        query = Result.find();
     	
        query.exec(function(err, results) {

            if (err) {
                res.send(err)
            } else {
                if (results) {
                    var numberOfUpdates = 0;
                    var numberOfCreated = 0;

                     async.forEachOfSeries(results, function(result, key, callback) {
             			if (result.racename !== undefined && result.racedate !== undefined && result.racetype !== undefined){ // only take care of old model
 						 	async.waterfall([
							    function(callback) {
							    	 Race.findOne({
			                            'racename': result.racename,
			                            'racedate': result.racedate,
			                            'racetype._id': result.racetype._id
			                        }, function(err, race) {
			                            if (err){
			                                callback(err);
			                            }else{
											callback(null, race);
			                            }
			                            
									    
									});										    
								},
							    function(race, callback) {
									if (!race) { //do not deal with multiple racers
										Race.create({
								            racename: result.racename,
								            racetype: result.racetype,
								            racedate: result.racedate,
								        }, function(err, r) {
								            if (err) {
								                callback(err);
								            } else {
								            	numberOfCreated++;
								            	result.race = r;
								            	callback(null);
								           }
							        	});
		                            }else{
		                            	numberOfUpdates++;
		                            	result.race = race;
		                            	callback(null);
									}
									
							    },
							    function(callback) {
							    	result.racename = undefined;
							    	result.racedate = undefined;
							    	result.racetype = undefined;
							        result.save(function(err) {
	                                    if (err) {
	                                        callback(err);
	                                    } else {
	                                        callback(null);
	                                    }
	                                });
							    }
							], function (err) {
							    if (err){
							    	 console.error(err.message);
							    	}else{
							    		 callback(); //foreach
							    		// console.log('done');
							    	}
							});
						 }else{
						 	callback();
						 } 						 	
                    }, function(err) {
                        if (err) {
                            console.error(err.message);
                        }
                        res.json({'numberOfUpdates':numberOfUpdates, 'numberOfCreated':numberOfCreated});

                    });

                }

            }


        });

    });


    // update agegrade
    app.get('/updateAgeGrade', isAdminLoggedIn, function(req, res) {
        var data = req.body;
        query = Result.find();
        query = query.or([{
            'race.racetype.surface': 'track'
        }, {
            'race.racetype.surface': 'road'
        }]);

        query.exec(function(err, results) {

            if (err) {
                res.send(err)
            } else {
                if (results) {
                    var numberOfUpdates = 0;
                    async.forEachOf(results, function(res, key, callback) {

                        //SYNC ISSUE
                        AgeGrading.findOne({
                            sex: res.members[0].sex.toLowerCase(),
                            type: res.race.racetype.surface,
                            age: calculateAge(res.race.racedate, res.members[0].dateofbirth),
                        }, function(err, ag) {
                            if (err){
                                res.send(err);
                            }
                            if (ag && res.members.length === 1) { //do not deal with multiple racers
                                if (ag[res.racetype.name.toLowerCase()] !== undefined) {
                                    agegrade = (ag[res.racetype.name.toLowerCase()] / (res.time / 100)*100).toFixed(2);
                                    res.agegrade = agegrade;
                                    res.save(function(err) {
                                        if (err) {
                                            console.error(err.message);
                                        } else {
                                            numberOfUpdates++;
                                            callback();
                                        }
                                    });

                                }else{
                                    callback();
                                }

                            }else{
                                callback();
                            }
                            

                        });
                    }, function(err) {
                        if (err) {
                            console.error(err.message);
                        }
                        res.json({'numberOfUpdates':numberOfUpdates});

                    });

                }

            }


        });

    });



    // get all results
    app.get('/api/results', function(req, res) {
        var sort = req.query.sort;
        var limit = req.query.limit;
        var skip = req.query.skip;
        var search = req.query.search;

        query = Result.find();
        queryCount = Result.count();
        if (req.query.filters) {
            var filters = JSON.parse(req.query.filters);

            if (filters.category) {
                query = query.regex('category', filters.category);
                queryCount = queryCount.regex('category', filters.category);
            }

            if (filters.sex) {
                query = query.where('members.sex').regex(filters.sex);
                queryCount = queryCount.where('members.sex').regex(filters.sex);

            }
            if (filters.datefrom) {
                query = query.gte('race.racedate', filters.datefrom);
                queryCount = queryCount.gte('race.racedate', filters.datefrom);

            }
            if (filters.dateto) {
                query = query.lte('race.racedate', filters.dateto);
                queryCount = queryCount.lte('race.racedate', filters.dateto);

            }
            if (filters.raceid) {
                query = query.where('race._id').equals(new mongoose.Types.ObjectId(filters.raceid));
                queryCount = queryCount.where('race._id').equals(new mongoose.Types.ObjectId(filters.raceid));

            }
            if (filters.racetype) {
                var racetype = filters.racetype;
                query = query.where('race.racetype._id').equals(racetype._id);
                queryCount = queryCount.where('race.racetype._id').equals(racetype._id);

            }
            if (filters.mode && limit) {
                if (filters.mode === 'All') {
                    query = query.limit(limit);
                    queryCount = queryCount.limit(limit);
                }
            }
        }

        if (search && search !== ""){

        	query.or([{
                        "race.racename": new RegExp(search, 'i')
                    }, {
                        "race.racetype.surface": new RegExp(search, 'i')
                    }, {
                        "members.firstname": new RegExp(search, 'i')
                    }]);

        	queryCount.or([{
                        "race.racename": new RegExp(search, 'i')
                    }, {
                        "race.racetype.surface": new RegExp(search, 'i')
                    }, {
                        "members.firstname": new RegExp(search, 'i')
                    }]);
        }

        if (skip) {
        	query = query.skip(skip);
        }

        if (limit && ((filters && !filters.mode) || !filters)) {
            query = query.limit(limit);
        }
        if (sort) {
        	query = query.sort(sort);
    	}
        
        if (req.query.member) {
            var member = JSON.parse(req.query.member);
            query = query.where('members._id').equals(member._id);
            queryCount =queryCount.where('members._id').equals(member._id);
        }

        var countQuery = function(callback){
        	queryCount.exec(function(err, count) {
               	if(err){
               		callback(err, null);
           		}
               	else{
             		callback(null, count);
            	}
         	});
    	};

	    var retrieveQuery = function(callback){
	    	console.log("retrieveQuery");
	    	
			query.exec(function(err, results) {
	            if (err) {
	                callback(err, null)
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
	                                if (!containsMember(filteredResult, results[i].members[0])) {
	                                    filteredResult.push(results[i]);
	                                    resCount++;
	                                }
	                            }
	                        }
	                    }
	                }
	                callback(null, filteredResult);
	            }
        	});


	    };

    

        


        async.parallel([countQuery, retrieveQuery], function(err, results){
         //err contains the array of error of all the functions
         //results contains an array of all the results
         //results[0] will contain value of doc.length from countQuery function
         //results[1] will contain doc of retrieveQuery function
         //You can send the results as

         res.json({status:"success",data:{data: results[1], meta:{totalresults: results[0]}}});

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

    // create result 
    app.post('/api/results', isAdminLoggedIn, function(req, res) {
        var members = [];
        for (i = 0; i < req.body.members.length; i++) {
            members.push({
                _id: req.body.members[i]._id,
                firstname: req.body.members[i].firstname,
                lastname: req.body.members[i].lastname,
                sex: req.body.members[i].sex,
                dateofbirth: req.body.members[i].dateofbirth
            });
        }

        if (members.length === 1) {

        }
        AgeGrading.findOne({
            sex: members[0].sex.toLowerCase(),
            type: req.body.race.racetype.surface,
            age: calculateAge(req.body.race.racedate, members[0].dateofbirth),
        }, function(err, ag) {
            var agegrade;
            if (err)
                console.log("error fetching agegrading")
            if (ag && members.length === 1) { //do not deal with multiple racers
                if (ag[req.body.race.racetype.name.toLowerCase()] !== undefined) {
                    agegrade = (ag[req.body.race.racetype.name.toLowerCase()] / (req.body.time / 100) * 100).toFixed(2);
                }
            }



            //does the race exists?
            	Race.findOne({
                    'racename': req.body.race.racename,
                    'racedate': req.body.race.racedate,
                    'racetype._id': req.body.race.racetype._id
                }, function(err, race) {
                    if (err){
                        res.send(err);
                    }else{
						if (!race){//if race does not exists
							Race.create({
					            racename: req.body.race.racename,
					            racedate: req.body.race.racedate,
					            racetype: req.body.race.racetype
					        }, function(err, r) {
					            if (err) {
					                res.send(err);
					            } else {

					            	Result.create({
									    race: r,
									    members: members,
									    time: req.body.time,
									    ranking: req.body.ranking,
									    comments: req.body.comments,
									    resultlink: req.body.resultlink,
									    agegrade: agegrade,
									    is_accepted: false,
									    done: false
									}, function(err, result) {
									    if (err) {
									        res.send(err);
									    } else {
									        res.json(result);
									    }
									});
					           }
				        	});
						}else{ // race exists
							Result.create({
							    race: race,
							    members: members,
							    time: req.body.time,
							    ranking: req.body.ranking,
							    comments: req.body.comments,
							    resultlink: req.body.resultlink,
							    agegrade: agegrade,
							    is_accepted: false,
							    done: false
							}, function(err, result) {
							    if (err) {
							        res.send(err);
							    } else {
							        res.json(result);
							    }
							});
						}
                    }
				});
        });

    });



    //update a result
    app.put('/api/results/:result_id', isAdminLoggedIn, function(req, res) {
        var members = [];
        for (i = 0; i < req.body.members.length; i++) {
            members.push({
                _id: req.body.members[i]._id,
                firstname: req.body.members[i].firstname,
                lastname: req.body.members[i].lastname,
                sex: req.body.members[i].sex,
                dateofbirth: req.body.members[i].dateofbirth
            });
        }



        AgeGrading.findOne({
            sex: members[0].sex.toLowerCase(),
            type: req.body.race.racetype.surface,
            age: calculateAge(req.body.race.racedate, members[0].dateofbirth),
        }, function(err, ag) {
            var agegrade;
            if (err)
                console.log("error fetching agegrading")
            if (ag && members.length === 1) { //do not deal with multiple racers
                if (ag[req.body.race.racetype.name.toLowerCase()] !== undefined) {
                    agegrade = (ag[req.body.race.racetype.name.toLowerCase()] / (req.body.time / 100) * 100).toFixed(2);
                }
            }

            Result.findById(req.params.result_id, function(err, result) {
            	var oldraceid = result.race._id;
            	//does the race exists?
            	Race.findOne({
                    'racename': req.body.race.racename,
                    'racedate': req.body.race.racedate,
                    'racetype._id': req.body.race.racetype._id
                }, function(err, race) {
                    if (err){
                        res.send(err);
                    }else{
						if (!race){//if race does not exists
							Race.create({
					            racename: req.body.race.racename,
					            racedate: req.body.race.racedate,
					            racetype: req.body.race.racetype
					        }, function(err, r) {
					            if (err) {
					                res.send(err);
					            } else {
					            	result.race._id = r._id;
									result.race.racename = r.racename;
									result.race.racedate = r.racedate;
									result.race.racetype = {
					                    _id: r.racetype._id,
					                    name: r.racetype.name,
					                    surface: r.racetype.surface,
					                    isVariable: r.racetype.isVariable,
					                    meters: r.racetype.meters,
					                    miles: r.racetype.miles
					                };
					                result.members = members;
					                result.time = req.body.time;
					                result.ranking = req.body.ranking;
					                result.comments = req.body.comments;
					                result.resultlink = req.body.resultlink;
					                result.agegrade = agegrade,
					                result.is_accepted = req.body.is_accepted;
					                result.save(function(err) {
					                    if (err) {
					                        res.send(err);
					                    } else {

					                    	// check if previous race entry is not a zombie now.
					                    	cleanQuery = Result.find().where('race._id').equals(oldraceid);
									       	cleanQuery.exec(function(err, cleanResults) {
									            if (err) {
									                res.send(err)
									            }
									            if (cleanResults){
									            	if (cleanResults.length === 0){
									            		Race.remove({
												            _id: oldraceid
												        }, function(err, raceD) {
												            if (err) {
												                res.send(err);
												            } else {
												                //remove zombie race entry successful
												            }
												        });
									            	}
									            }
									        });
									       	res.json(result);
					                        // res.end('{"success" : "Result updated successfully", "status" : 200}');
					                    }
					                });
					           }
				        	});
						}else{ // race exists
							//the race is updated here but this should not be necessary (no changes)
							result.race._id = race._id;
							result.race.racename = race.racename;
							result.race.racedate = race.racedate;
							result.race.racetype = {
							    _id: race.racetype._id,
							    name: race.racetype.name,
								surface: race.racetype.surface,
			                    isVariable: race.racetype.isVariable,
			                    meters: race.racetype.meters,
			                    miles: race.racetype.miles
			                };

			                result.members = members;
			                result.time = req.body.time;
			                result.ranking = req.body.ranking;
			                result.comments = req.body.comments;
			                result.resultlink = req.body.resultlink;
			                result.agegrade = agegrade,
			                result.is_accepted = req.body.is_accepted;
			                result.save(function(err) {
			                    if (err) {
			                        res.send(err);
			                    } else {
			                    	// check if previous race entry is not a zombie now.
			                    	cleanQuery = Result.find().where('race._id').equals(oldraceid);
							       	cleanQuery.exec(function(err, cleanResults) {
							            if (err) {
							                res.send(err)
							            }
							            if (cleanResults){
							            	if (cleanResults.length === 0){
							            		Race.remove({
										            _id: oldraceid
										        }, function(err, raceD) {
										            if (err) {
										                res.send(err);
										            } else {
										                //remove zombie race entry successful
										            }
										        });
							            	}
							            }
							        });
							        res.json(result);
			                        // res.end('{"success" : "Result updated successfully", "status" : 200}');
			                    }
			                });
						}
                    }
				});

            }); //result FindById

        });

    });


    // delete a result
    app.delete('/api/results/:result_id', isAdminLoggedIn, function(req, res) {
    	Result.findById(req.params.result_id, function(err, result) {
    		var oldraceid = result.race._id;
    		Result.remove({
            _id: req.params.result_id
        }, function(err, result) {
            if (err) {
                res.send(err);
            } else {
            	// check if previous race entry is not a zombie now.
            	cleanQuery = Result.find().where('race._id').equals(oldraceid);
		       	cleanQuery.exec(function(err, cleanResults) {
		            if (err) {
		                res.send(err)
		            }
		            if (cleanResults){
		            	if (cleanResults.length === 0){
		            		Race.remove({
					            _id: oldraceid
					        }, function(err, raceD) {
					            if (err) {
					                res.send(err);
					            } else {
					                //remove zombie race entry successful
					            }
					        });
		            	}
		            }
		        });
                res.end('{"success" : "Result deleted successfully", "status" : 200}');
            }
        });
    	}); 

        
    });



    //races

    // get a racelist
    app.get('/api/races', function(req, res) {
        var filters = req.query.filters;
        var sort = req.query.sort;
        var limit = req.query.limit;

        query = Race.find();
        if (filters) {   
          
        }
        if (sort) {
            query = query.sort(sort);
        }
        if (limit) {
            query = query.limit(req.query.limit);
        }


        query.exec(function(err, races) {
            // if there is an error retrieving, send the error. nothing after res.send(err) will execute
            if (err)
                res.send(err)
            res.json(races); // return all members in JSON format
        });
    });


 	// get raceinfo list
    app.get('/api/raceinfos', function(req, res) {
        var filters = req.query.filters;
        var sort = req.query.sort;
        var limit = req.query.limit;
		var resultId = req.query.resultId;

        query = Result.aggregate([
	        
	        {
	        	$project: {
	        		race: '$race', // we need this field
                	members: {
                		members:'$members',
                		time: '$time',
                		agegrade: '$agegrade',
                		category: '$category',
                        resultlink: '$resultlink',
                        ranking: '$ranking',
                		result_id: '$_id'
                	}
                	
                }
            },
            {
	        	$unwind: "$members"
			    
			},
            {
	            $group: {
	                _id: '$race._id', 
	                racename: { $first: '$race.racename' },
	                racedate: { $first: '$race.racedate' },
	                racetype: { $first: '$race.racetype' },
	                results: { $addToSet: '$members' },	                
	                count: {$sum: 1}
	            }
	        }
		]);

        if (resultId) {
            query = query.match({ 'results.result_id':  new mongoose.Types.ObjectId(resultId)  });
        }

        if (filters) {   
          
        }
        if (sort) {
            query = query.sort(sort);
        }

        if (limit) {
            query = query.limit(parseInt(req.query.limit)); //no idea why I need to parse
        }

		query.exec(function (err, results) {
		        if (err) {
		            res.send(err);
		        } else {

                    results.forEach(function(resu) {                        
                        resu.results = _.sortBy( resu.results, 'time' );                        
                    });

		            res.json(results); // return all members in JSON format
		        }
	    	});
        
    });



    //pdf
    app.get('/api/pdfreport', function(req, res) {
        var calls = [];
        var fullreport = {};
        var openMaleRecords = [];
        var masterMaleRecords = [];
        var openFemaleRecords = [];
        var masterFemaleRecords = [];

        raceTypeQuery = RaceType.find().sort('meters').where('name').ne('Odd road distance');
        raceTypeQuery.exec(function(err, racetypes) {
            if (err) {
                res.send(err)
            }
            racetypes.forEach(function(rt) {

                calls.push(function(callback) {
                    query = Result.find();
                    query = query.regex('category', 'Open').where('members.sex').regex('Male').where('race.racetype._id').equals(rt._id).sort('time').limit(5);
                    query.exec(function(err, results) {
                        if (err) {
                            callback(err);
                        }
                        openMaleRecords.push({
                            'racetype': rt,
                            'records': results
                        });
                        callback(null);
                    });

                });
                calls.push(function(callback) {
                    query = Result.find();
                    query = query.regex('category', 'Master').where('members.sex').regex('Male').where('race.racetype._id').equals(rt._id).sort('time').limit(5);
                    query.exec(function(err, results) {
                        if (err) {
                            callback(err);
                        }
                        masterMaleRecords.push({
                            'racetype': rt,
                            'records': results
                        });
                        callback(null);
                    });
                });
                calls.push(function(callback) {
                    query = Result.find();
                    query = query.regex('category', 'Open').where('members.sex').regex('Female').where('race.racetype._id').equals(rt._id).sort('time').limit(5);
                    query.exec(function(err, results) {
                        if (err) {
                            callback(err);
                        }
                        openFemaleRecords.push({
                            'racetype': rt,
                            'records': results
                        });
                        callback(null);
                    });
                });
                calls.push(function(callback) {
                    query = Result.find();
                    query = query.regex('category', 'Master').where('members.sex').regex('Female').where('race.racetype._id').equals(rt._id).sort('time').limit(5);
                    query.exec(function(err, results) {
                        if (err) {
                            callback(err);
                        }
                        masterFemaleRecords.push({
                            'racetype': rt,
                            'records': results
                        });
                        callback(null);
                    });
                });
            });


            async.parallel(calls, function(err) {
                if (err)
                    return res.send(err);

                openMaleRecords.sort(sortRecordDistanceByDistance);
                masterMaleRecords.sort(sortRecordDistanceByDistance);
                openFemaleRecords.sort(sortRecordDistanceByDistance);
                masterFemaleRecords.sort(sortRecordDistanceByDistance);

                fullreport = {
                    'openMaleRecords': {
                        'category': 'Open',
                        'sex': 'Male',
                        'recordsList': openMaleRecords
                    },

                    'masterMaleRecords': {
                        'category': 'Master',
                        'sex': 'Male',
                        'recordsList': masterMaleRecords
                    },

                    'openFemaleRecords': {
                        'category': 'Open',
                        'sex': 'Female',
                        'recordsList': openFemaleRecords
                    },

                    'masterFemaleRecords': {
                        'category': 'Matser',
                        'sex': 'Female',
                        'recordsList': masterFemaleRecords
                    }
                };

                res.json(fullreport);
            });
        });

    });


    app.get('/api/milesraced', function(req, res) {
        var date = req.query.date;
        var query = Result.find();
        query = query.gte('race.racedate', new Date(date));
        query.exec(function(err, results) {
            if (err) {
                res.send(err)
            } else {
                var sum = 0;
                results.forEach(function(r) {
                    sum += r.race.racetype.miles;
                });
                res.json(sum);

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
        var isVariable = req.query.isVariable;

        query = RaceType.find();
        if (surface) {
            query = query.where('surface').equals(surface);
        }
        if (isVariable) {
            query = query.where('isVariable').equals(isVariable);
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
            miles: req.body.miles,
            isVariable: req.body.isVariable
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
            racetype.isVariable = req.body.isVariable;
            racetype.save(function(err) {
                if (!err) {
                    Result.find({
                            'race.racetype._id': racetype._id
                        },
                        function(err, results) {
                            if (err) {
                                console.log(err);
                                res.send(err);
                            } else {
                                for (i = 0; i < results.length; i++) {
                                    if (!req.body.isVariable) {
                                        results[i].race.racetype = {
                                            _id: results[i].race.racetype._id,
                                            name: req.body.name,
                                            surface: req.body.surface,
                                            meters: req.body.meters,
                                            miles: req.body.miles,
                                            isVariable: req.body.isVariable
                                        };
                                    } else {
                                        results[i].race.racetype = {
                                            _id: results[i].race.racetype._id,
                                            name: req.body.name,
                                            surface: req.body.surface,
                                            meters: results[i].racetype.meters,
                                            miles: results[i].racetype.miles,
                                            isVariable: req.body.isVariable
                                        };
                                    }

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

    // MAIL

    app.post('/sendEmail', function(req, res) {
        var data = req.body;
        transport.sendMail({
            from: {
                name: data.name,
                address: data.from
            },
            to: {
                name: "MCRRC RACE TEAM SITE ADMIN",
                address: process.env.MCRRC_EMAIL_ADDRESS
            },
            subject: data.subject, // Subject line
            text: data.body // plaintext body
        }, function(error, response) {
            if (error) {
                res.sendStatus(404);
            } else {
                res.end('{"success" : "Email sent successfully", "status" : 200}');
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

//get age at race date
function calculateAge(dateofrace, birthday) {
    var rd = new Date(dateofrace);
    var bd = new Date(birthday);
    var ageDifMs = rd.getTime() - bd.getTime();
    var ageDate = new Date(ageDifMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
};

// check if member is in list
function containsMember(list, member) {
    if (list.length == 0) {
        return false;
    }

    var i;
    for (i = 0; i < list.length; i++) {
        if (list[i].members[0]._id.equals(member._id)) {
            return true;
        }
    }
    return false;
}

function sortResultsByDistance(a, b) {
    if (a.race.racetype.meters < b.race.racetype.meters)
        return -1;
    if (a.race.racetype.meters > b.race.racetype.meters)
        return 1;
    return 0;
}

function sortRecordDistanceByDistance(a, b) {
    if (a.racetype.meters < b.racetype.meters)
        return -1;
    if (a.racetype.meters > b.racetype.meters)
        return 1;
    return 0;
}
