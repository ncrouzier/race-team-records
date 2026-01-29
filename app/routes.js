const mongoose = require('mongoose');
const service = require('./service');
const cheerio = require('cheerio');
const axios = require('axios');

module.exports = async function(app, qs, passport, async, _) {

    // Add response modification middleware BEFORE routes
    app.use('/api', function(req, res, next) {
        // Store original method
        const originalSend = res.send;
        
        // Override send method (catches all responses including res.json() calls)
        res.send = function(data) {
            // Get system info and set headers before sending
            service.getCachedSystemInfo().then(function(systemInfo) {
                if (systemInfo) {
                    this.set('X-Result-Update', systemInfo.resultUpdate ? systemInfo.resultUpdate.toISOString() : '');
                    this.set('X-Race-Update', systemInfo.raceUpdate ? systemInfo.raceUpdate.toISOString() : '');
                    this.set('X-Racetype-Update', systemInfo.racetypeUpdate ? systemInfo.racetypeUpdate.toISOString() : '');
                    this.set('X-Member-Update', systemInfo.memberUpdate ? systemInfo.memberUpdate.toISOString() : '');
                    this.set('X-Volunteer-Job-Update', systemInfo.volunteerJobUpdate ? systemInfo.volunteerJobUpdate.toISOString() : '');
                    // Calculate overall update
                    const dates = [
                        systemInfo.resultUpdate,
                        systemInfo.raceUpdate,
                        systemInfo.racetypeUpdate,
                        systemInfo.memberUpdate,
                        systemInfo.volunteerJobUpdate
                    ].filter(date => date);
                    
                    if (dates.length > 0) {
                        const latestDate = new Date(Math.max(...dates.map(date => new Date(date))));
                        this.set('X-Overall-Update', latestDate.toISOString());
                    }
                }
                // Send response after headers are set
                originalSend.call(this, data);
            }.bind(this)).catch(function(err) {
                console.error('Error getting system info:', err);
                // Send response even if there's an error
                originalSend.call(this, data);
            });
        };
        
        next();
    });

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

    // process the login form
    // app.post('/api/login', passport.authenticate('local-login', {
    //     successRedirect : '/profile', // redirect to the secure profile section
    //     failureRedirect : '/login', // redirect back to the signup page if there is an error
    //     failureFlash : true // allow flash messages
    // }));

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
            // console.log(err);
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

    app.post('/api/signup', passport.authenticate('local-signup', {
        successRedirect : '/profile', // redirect to the secure profile section
        failureRedirect : '/api/signup', // redirect back to the signup page if there is an error
        failureFlash : true // allow flash messages
    }));

    // =====================================
    // PROFILE SECTION =====================
    // =====================================
    // we will want this protected so you have to be logged in to visit
    // we will use route middleware to verify this (the isLoggedIn function)
    app.get('/api/profile', service.isLoggedIn, function(req, res) {
        res.send({
            user: req.user
        });
    });

    // =====================================
    // LOGOUT ==============================
    // =====================================
    app.get('/logout', function (req, res){
        req.session.destroy(function (err) {
            res.redirect('/'); 
        });
    });
    

    const SystemInfo = require('./models/systeminfo');
    const RaceType = require('./models/racetype');
    const Member = require('./models/member');
    const Result = require('./models/result');
    const Race = require('./models/race');
    const AgeGrading = require('./models/agegrading');
    const VolunteerJob = require('./models/volunteerjob');


    // =====================================
    // SYSTEM INFO =========================
    // =====================================

    //Init SytemInfo, should only happen once.
    try{
        SystemInfo.findOne({
            name: 'mcrrc'
        }).then(systemInfo => { 
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
    }catch (err) {
        console.log("error fetching systemInfo")
    }
   
  

    // get a system info
    app.get('/api/systeminfos/:name', async function(req, res) {
        try{
            // Use cached system info for better performance
            const systeminfo = await service.getCachedSystemInfo();
            if (systeminfo && systeminfo.name === req.params.name) {
                res.json(systeminfo);
            } else {
                res.status(404).json({ error: 'System info not found' });
            }
        }catch (err){
            res.send(err);
        }
    });

    // =====================================
    // TEAM MEMBERS ========================
    // =====================================


    //get all members
    app.get('/api/members', async function(req, res) {

    
       

        const filters = req.query.filters;
        const sort = req.query.sort;
        const limit = parseInt(req.query.limit);
        const select = req.query.select;

        let query = Member.find();
        if (filters) { 
            if (filters.name) {
                query = query.where({$expr: {
                    $eq: [{ $toLower: { $concat: ['$firstname', '$lastname'] } }, filters.name.toLowerCase()]
                  }});
            }
            if (filters.username) {
                query.where('username').equals(filters.username);
            }
            if (filters.firstname) {
                query.where('firstname').equals(filters.firstname);
            }
            if(filters.lastname) {
                query.where('lastname').equals(filters.lastname);
            }
            if (filters.category) {
                const datetobemaster = service.getAddDateToDate(new Date(), -40, 0, 0);
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

            if (filters.dateofbirth) {
                  const dob = new Date(filters.dateofbirth);
                  query = query.and({
                     "$expr": {
                         "$and": [
                              { "$eq": [ { "$dayOfMonth": "$dateofbirth" }, { "$dayOfMonth": dob } ] },
                              { "$eq": [ { "$month"     : "$dateofbirth" }, { "$month"     : dob } ] }
                         ]
                      }
                  });
            }
        }

        //remove teamRequirementStats if not logged in
        if (!req.isAuthenticated()) {
            query = query.select('-teamRequirementStats');
        }

        if (sort) {
            query = query.sort(sort);
        }
        if (limit) {
            query = query.limit(limit);
        }
        if (select){
            query = query.select(select);
        }
        try{
            query.exec().then(members => {
                // if there is an error retrieving, send the error. nothing after res.send(err) will execute                    
                res.json(members); // return all members in JSON format
            });
        }catch(err){
            res.send(err);
        }
       
    });

    // get a member
    app.get('/api/members/:member_id', function(req, res) {
        res.setHeader("Content-Type", "application/json");
        try{
            let query;
            
            // Check if member_id is actually a username (not a MongoDB ObjectId)
            if (req.params.member_id && !req.params.member_id.match(/^[0-9a-fA-F]{24}$/)) {
                // It's a username, search by username
                query = Member.findOne({
                    username: req.params.member_id
                });
            } else {
                // It's an ObjectId, search by _id
                query = Member.findOne({
                    _id: req.params.member_id
                });
            }

            //remove teamRequirementStats if not logged in
            if (!req.isAuthenticated()) {
                query = query.select('-teamRequirementStats');
            }    
            query.exec().then(member =>{    
                if (member) {
                    res.json(member);
                } else {
                    res.status(404).json({ error: 'Member not found' });
                }
            });
        }catch(err){
            res.send(err);
        }
       
    });


    app.get('/api/members/:member_id/pbs', function(req, res) {
        const pbraces = ['1 mile', '5k', '5 miles', '10k', '10 miles', 'Half Marathon', 'Marathon'];
        let pbs = [];
        let calls = [];

        pbraces.forEach(function(pb) {
            calls.push(function(callback) {
                let query = Result.find({
                    'members._id': req.params.member_id,
                    'race.racetype.name': pb
                });
                query = query.sort('time');
                try{
                    query.exec().then(results => {            
                        if (results.length > 0) {
                            pbs.push(results[0]);
                            callback(null);
                        } else {
                            callback(null);
                        }
                });
                }catch(err){
                    return callback(err);
                }
                
            });
        });

        async.parallel(calls, function(err) {
            /* this code will run after all calls finished the job or
               when any of the calls passes an error */
            if (err)
                return res.send(err);

            //sort
            pbs.sort(service.sortResultsByDistance);
            res.json(pbs);
        });
    });

    // create member
    app.post('/api/members', service.isAdminLoggedIn, async function(req, res) {
        res.setHeader("Content-Type", "application/json");
        try{ 
        const member = await Member.create({
            firstname: req.body.firstname,
            lastname: req.body.lastname,
            alternateFullNames: req.body.alternateFullNames,
            dateofbirth: req.body.dateofbirth,
            sex: req.body.sex,
            bio: req.body.bio,
            pictureLink: req.body.pictureLink,
            memberStatus: req.body.memberStatus,
            membershipDates: req.body.membershipDates,
            done: false
        });
        //will be 0 but initialize the fields
        await service.updateTeamRequirementStats(member);
        }catch(err){
            res.send(err);
        }    
       await service.invalidateSystemInfoCache();
        res.end('{"success" : "Member created successfully", "status" : 200}');
    
    });

    
    //update a member
    app.put('/api/members/:member_id', service.isAdminLoggedIn, async function(req, res) {
        res.setHeader("Content-Type", "application/json");
        try {
            const member = await Member.findById(req.params.member_id);
            if (!member) {
                return res.status(404).json({ error: 'Member not found' });
            }

            // Store old values to detect changes that require age grade recalculation
            const oldDateOfBirth = member.dateofbirth;
            const oldSex = member.sex;

            // Update member fields
            member.firstname = req.body.firstname;
            member.lastname = req.body.lastname;
            member.alternateFullNames = req.body.alternateFullNames;
            member.username = req.body.username || member.username;
            member.dateofbirth = req.body.dateofbirth;
            member.sex = req.body.sex;
            member.bio = req.body.bio;
            member.pictureLink = req.body.pictureLink;
            member.memberStatus = req.body.memberStatus;
            member.membershipDates = req.body.membershipDates;

            // Save the updated member
            await member.save();

            // Check if age grade recalculation is needed
            const needsAgeGradeRecalculation = 
                oldDateOfBirth.getTime() !== member.dateofbirth.getTime() || 
                oldSex !== member.sex;

            // Find all results for this member
            const results = await Result.find({ 'members._id': member._id }).populate('race');
            
            // Prepare bulk operations for result updates
            const resultBulkOperations = [];

            for (const result of results) {
                let resultModified = false;

                // Update member info in result only if changed
                for (const memberElement of result.members) {
                    if (memberElement._id.equals(member._id)) {
                        // Check if any member info actually changed
                        const memberInfoChanged = 
                            memberElement.firstname !== member.firstname ||
                            memberElement.lastname !== member.lastname ||
                            memberElement.username !== member.username ||
                            memberElement.sex !== member.sex ||
                            memberElement.dateofbirth.getTime() !== member.dateofbirth.getTime();
                        
                        if (memberInfoChanged) {
                            memberElement.firstname = member.firstname;
                            memberElement.lastname = member.lastname;
                            memberElement.username = member.username;
                            memberElement.sex = member.sex;
                            memberElement.dateofbirth = member.dateofbirth;
                            resultModified = true;
                        }
                    }
                }

                // Recalculate age grade if needed
                if (needsAgeGradeRecalculation && 
                    result.members.length === 1 && 
                    !result.race.isMultisport && 
                    result.isRecordEligible && 
                    result.time !== 0) {
                    
                    const ag = await service.getAgeGrading(
                        member.sex.toLowerCase(),
                        service.calculateAge(result.race.racedate, member.dateofbirth),
                        result.race.racetype.surface,
                        result.race.racedate
                    );
                    
                    if (ag && ag[result.race.racetype.name.toLowerCase()] !== undefined) {
                        const newAgeGrade = (ag[result.race.racetype.name.toLowerCase()] / (result.time / 100) * 100).toFixed(2);
                        result.agegrade = newAgeGrade;
                        resultModified = true;
                    }
                }

                // Add to bulk operations if modified
                if (resultModified) {
                    resultBulkOperations.push({
                        updateOne: {
                            filter: { _id: result._id },
                            update: { 
                                $set: { 
                                    members: result.members,
                                    ...(result.agegrade !== undefined && { agegrade: result.agegrade })
                                } 
                            }
                        }
                    });
                }
            }

            // Execute result updates
            if (resultBulkOperations.length > 0) {
                await Result.bulkWrite(resultBulkOperations);
            }

            // Find all volunteer jobs for this member and update embedded member info
            const volunteerJobs = await VolunteerJob.find({ 'member._id': member._id });
            const volunteerJobBulkOperations = [];

            for (const job of volunteerJobs) {
                // Check if any member info actually changed
                const memberInfoChanged =
                    job.member.firstname !== member.firstname ||
                    job.member.lastname !== member.lastname ||
                    job.member.username !== member.username ||
                    job.member.sex !== member.sex ||
                    job.member.dateofbirth.getTime() !== member.dateofbirth.getTime();

                if (memberInfoChanged) {
                    volunteerJobBulkOperations.push({
                        updateOne: {
                            filter: { _id: job._id },
                            update: {
                                $set: {
                                    'member.firstname': member.firstname,
                                    'member.lastname': member.lastname,
                                    'member.username': member.username,
                                    'member.sex': member.sex,
                                    'member.dateofbirth': member.dateofbirth
                                }
                            }
                        }
                    });
                }
            }

            // Execute volunteer job updates
            if (volunteerJobBulkOperations.length > 0) {
                await VolunteerJob.bulkWrite(volunteerJobBulkOperations);
            }

            // Update member stats using bulk operations
            await service.updateMemberStatsBulk([member._id]);

            await service.updateSystemInfoAndInvalidateSystemInfoCache("results");

            res.json({
                success: "Member updated successfully, results updated: " + resultBulkOperations.length + ", volunteer jobs updated: " + volunteerJobBulkOperations.length,
                status: 200
            });
            
        } catch (error) {
            console.error('Error updating member:', error);
            res.status(500).json({ error: 'Error updating member' });
        }
    });


    // delete a member
    app.delete('/api/members/:member_id', service.isAdminLoggedIn, async function(req, res) {
        try{
            Member.deleteOne({
                _id: req.params.member_id
            }).then(async deleteResult => {               
                if (deleteResult.deletedCount === 1){
                   await service.invalidateSystemInfoCache();
                    res.send('{"success" : "Member deleted successfully", "status" : 200}');   
                }else{
                    res.send('{"error" : "Member not deleted", "status" : 200}');   
                }                            
            });
        }catch(MemberDeleteOneErr){
            res.send(MemberDeleteOneErr);
        }
        
    });


    // =====================================
    // VOLUNTEER JOBS ======================
    // =====================================

    // get all volunteer jobs
    app.get('/api/volunteerjobs', function(req, res) {
        res.setHeader("Content-Type", "application/json");

        const filters = req.query.filters;
        const sort = req.query.sort;
        const limit = parseInt(req.query.limit);

        let query = VolunteerJob.find();

        if (filters) {
            if (filters.memberId) {
                query = query.where('member._id').equals(filters.memberId);
            }
            if (filters.eventName) {
                query = query.regex('eventName', new RegExp(filters.eventName, 'i'));
            }
            if (filters.dateFrom) {
                query = query.where('jobDate').gte(new Date(filters.dateFrom));
            }
            if (filters.dateTo) {
                query = query.where('jobDate').lte(new Date(filters.dateTo));
            }
        }

        if (sort) {
            query = query.sort(sort);
        }
        if (limit) {
            query = query.limit(limit);
        }

        try {
            query.exec().then(jobs => {
                res.json(jobs);
            });
        } catch(err) {
            res.send(err);
        }
    });

    // get a single volunteer job
    app.get('/api/volunteerjobs/:job_id', function(req, res) {
        res.setHeader("Content-Type", "application/json");
        try {
            VolunteerJob.findOne({
                _id: req.params.job_id
            }).then(job => {
                if (job) {
                    res.json(job);
                } else {
                    res.status(404).json({ error: 'Volunteer job not found' });
                }
            });
        } catch(err) {
            res.send(err);
        }
    });

    // get all volunteer jobs for a member
    app.get('/api/members/:member_id/volunteerjobs', function(req, res) {
        res.setHeader("Content-Type", "application/json");
        const sort = req.query.sort || '-jobDate';

        try {
            let query = VolunteerJob.find({
                'member._id': req.params.member_id
            });

            if (sort) {
                query = query.sort(sort);
            }

            query.exec().then(jobs => {
                res.json(jobs);
            });
        } catch(err) {
            res.send(err);
        }
    });

    // create a volunteer job
    app.post('/api/volunteerjobs', service.isAdminLoggedIn, async function(req, res) {
        res.setHeader("Content-Type", "application/json");
        try {
            // Validate that member exists
            const member = await Member.findById(req.body.member._id);
            if (!member) {
                return res.status(400).json({ error: 'Member not found' });
            }

            // Create volunteer job with embedded member info
            const volunteerJob = await VolunteerJob.create({
                member: {
                    _id: member._id,
                    firstname: member.firstname,
                    lastname: member.lastname,
                    username: member.username,
                    sex: member.sex,
                    dateofbirth: member.dateofbirth
                },
                jobDate: req.body.jobDate,
                eventName: req.body.eventName,
                description: req.body.description
            });

            await service.invalidateSystemInfoCache();
            res.json({ success: 'Volunteer job created successfully', job: volunteerJob });
        } catch(err) {
            res.status(400).send(err);
        }
    });

    // update a volunteer job
    app.put('/api/volunteerjobs/:job_id', service.isAdminLoggedIn, async function(req, res) {
        res.setHeader("Content-Type", "application/json");
        try {
            const job = await VolunteerJob.findById(req.params.job_id);

            if (!job) {
                return res.status(404).json({ error: 'Volunteer job not found' });
            }

            // Update fields if provided
            if (req.body.jobDate) job.jobDate = req.body.jobDate;
            if (req.body.eventName) job.eventName = req.body.eventName;
            if (req.body.description) job.description = req.body.description;

            // If member is being updated, validate and update
            if (req.body.member && req.body.member._id) {
                const member = await Member.findById(req.body.member._id);
                if (!member) {
                    return res.status(400).json({ error: 'Member not found' });
                }
                job.member = {
                    _id: member._id,
                    firstname: member.firstname,
                    lastname: member.lastname,
                    username: member.username,
                    sex: member.sex,
                    dateofbirth: member.dateofbirth
                };
            }

            await job.save();
            await service.invalidateSystemInfoCache();
            res.json({ success: 'Volunteer job updated successfully', job: job });
        } catch(err) {
            res.status(400).send(err);
        }
    });

    // delete a volunteer job
    app.delete('/api/volunteerjobs/:job_id', service.isAdminLoggedIn, async function(req, res) {
        res.setHeader("Content-Type", "application/json");
        try {
            const deleteResult = await VolunteerJob.deleteOne({
                _id: req.params.job_id
            });

            if (deleteResult.deletedCount === 1) {
                await service.invalidateSystemInfoCache();
                res.json({ success: 'Volunteer job deleted successfully' });
            } else {
                res.status(404).json({ error: 'Volunteer job not found' });
            }
        } catch(err) {
            res.status(400).send(err);
        }
    });


    // =====================================
    // REQUIREMENTS ========================
    // =====================================

    // get team requirements for a year
    app.get('/api/requirements/:year', service.isUserLoggedIn, async function(req, res) {
        res.setHeader("Content-Type", "application/json");
        try {
            const year = req.params.year;
            const isAllTime = year === 'all';

            let dateFrom, dateTo, yearNum;
            if (!isAllTime) {
                yearNum = parseInt(year);
                dateFrom = new Date(Date.UTC(yearNum, 0, 1, 0, 0, 0, 0));
                dateTo = new Date(Date.UTC(yearNum + 1, 0, 1, 0, 0, 0, 0));
            } else {
                yearNum = new Date().getFullYear();
                dateFrom = new Date(Date.UTC(2013, 0, 1, 0, 0, 0, 0));
                dateTo = new Date();
            }

            // Determine if volunteer requirement applies (2026 and later)
            const volunteerRequirementApplies = yearNum >= 2026;

            // Get all members with their membership dates
            const allMembers = await Member.find({})
                .select('_id firstname lastname username membershipDates')
                .lean();

            // Filter members who were active during the selected year
            const members = allMembers.filter(member => {
                if (!member.membershipDates || member.membershipDates.length === 0) {
                    return false;
                }

                // Check if any membership period overlaps with the year
                return member.membershipDates.some(period => {
                    const periodStart = new Date(period.start);
                    const periodEnd = period.end ? new Date(period.end) : new Date(9999, 11, 31); // Ongoing if no end date

                    // Member is active if period overlaps with the year
                    return periodStart < dateTo && periodEnd >= dateFrom;
                });
            });

            // For each member, calculate requirements
            const requirementsData = [];

            for (const member of members) {
                // Query race count and max age grade
                const results = await Result.find({
                    'members._id': member._id,
                    'race.racedate': { $gte: dateFrom, $lt: dateTo }
                }).select('agegrade');

                const raceCount = results.length;
                const ageGrades = results.map(r => r.agegrade || 0).filter(ag => ag > 0);
                const maxAgeGrade = ageGrades.length > 0 ? Math.max(...ageGrades) : 0;

                // Query volunteer jobs count
                const volunteerJobCount = await VolunteerJob.countDocuments({
                    'member._id': member._id,
                    jobDate: { $gte: dateFrom, $lt: dateTo }
                });

                // Calculate if requirements are met
                const meetsRaceRequirement = raceCount >= 8;
                const meetsAgeGradeRequirement = maxAgeGrade >= 70;
                const meetsVolunteerRequirement = volunteerJobCount >= 2;

                // All requirements met depends on whether volunteer requirement applies
                const meetsAllRequirements = volunteerRequirementApplies
                    ? (meetsRaceRequirement && meetsAgeGradeRequirement && meetsVolunteerRequirement)
                    : (meetsRaceRequirement && meetsAgeGradeRequirement);

                // Check if member joined or left during the year
                let joinedDuringYear = false;
                let leftDuringYear = false;

                if (member.membershipDates && member.membershipDates.length > 0) {
                    // Check if any membership period started during the year
                    joinedDuringYear = member.membershipDates.some(period => {
                        const periodStart = new Date(period.start);
                        return periodStart >= dateFrom && periodStart < dateTo;
                    });

                    // Check if any membership period ended during the year (not ongoing)
                    leftDuringYear = member.membershipDates.some(period => {
                        if (!period.end) return false; // Ongoing membership
                        const periodEnd = new Date(period.end);
                        return periodEnd >= dateFrom && periodEnd < dateTo;
                    });
                }

                requirementsData.push({
                    member: {
                        _id: member._id,
                        firstname: member.firstname,
                        lastname: member.lastname,
                        username: member.username
                    },
                    raceCount: raceCount,
                    maxAgeGrade: maxAgeGrade,
                    volunteerJobCount: volunteerJobCount,
                    meetsRaceRequirement: meetsRaceRequirement,
                    meetsAgeGradeRequirement: meetsAgeGradeRequirement,
                    meetsVolunteerRequirement: meetsVolunteerRequirement,
                    meetsAllRequirements: meetsAllRequirements,
                    volunteerRequirementApplies: volunteerRequirementApplies,
                    joinedDuringYear: joinedDuringYear,
                    leftDuringYear: leftDuringYear
                });
            }

            res.json(requirementsData);

        } catch (error) {
            console.error('Error fetching requirements:', error);
            res.status(500).json({ error: 'Error fetching requirements data' });
        }
    });


    // =====================================
    // RESULTS =============================
    // =====================================

    // get all results
    app.get('/api/results', function(req, res) {
        let sort = req.query.sort;
        const limit = parseInt(req.query.limit);

        let query = Result.find();
        let filters;
        if (req.query.filters) {
            //filters means we are in record mode (I think)
            filters = JSON.parse(req.query.filters);
            query = query.where('isRecordEligible').equals(true);
            if (filters.category) {
                query = query.regex('category', filters.category);
            }
            if (filters.sex) {
                query = query.where('members.sex').regex(filters.sex);
            }
            if (filters.datefrom) {
                query = query.gte('race.racedate', filters.datefrom);
            }
            if (filters.dateto) {
                query = query.lte('race.racedate', filters.dateto);
            }
            if (filters.raceid) {
                query = query.where('race._id').equals(new mongoose.Types.ObjectId(filters.raceid));
            }
            if (filters.racetype) {
                const racetype = filters.racetype;
                query = query.where('race.racetype._id').equals(racetype._id);
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
            const member = JSON.parse(req.query.member);
            query = query.where('members._id').equals(member._id);
        }

        query = query.select("-createdAt -updatedAt");

        try{
            query.exec().then(results =>{       
                let filteredResult = results;
                if (req.query.filters) {
                    const filters = JSON.parse(req.query.filters);
                    if (filters.mode && limit) {
                        if (filters.mode === 'Best') {
                            filteredResult = [];
                            const resultLength = results.length;
                            let resCount = 0;
                            for (let i = 0; i < resultLength && resCount < limit; i++) {
                                if (!service.containsMember(filteredResult, results[i].members[0])) {
                                    filteredResult.push(results[i]);
                                    resCount++;
                                }
                            }
                        }
                    }
                }
                res.json(filteredResult);
         });
        }catch(err){
            res.send(err)
        }
        
    });

    // get a result
    app.get('/api/results/:result_id',  async function(req, res) {
        try{
            res.json(await Result.findOne(new mongoose.Types.ObjectId(req.params.result_id)));
        }catch(err){
            res.send(err);
        }
    });


    // create a result
    app.post('/api/results', service.isAdminLoggedIn, async function(req, res) {

        let members = [];
        for (const m of req.body.members) {
            let member = await Member.findById(m._id);   
            
            members.push(member);
        }


        try{  
            const ag = await service.getAgeGrading(members[0].sex.toLowerCase(),
                service.calculateAge(req.body.race.racedate,members[0].dateofbirth),
                req.body.race.racetype.surface,
                req.body.race.racedate);

            let agegrade;
            if (ag && members.length === 1 && !req.body.race.isMultisport && req.body.isRecordEligible && req.body.time !== 0) { //do not deal with multiple racers
                if (ag[req.body.race.racetype.name.toLowerCase()] !== undefined) {
                    agegrade = (ag[req.body.race.racetype.name.toLowerCase()] / (req.body.time / 100) * 100).toFixed(2);
                }
            }            
            //does the race exists?
            try{  
                Race.findOne({
                    'racename': req.body.race.racename,
                    'isMultisport': req.body.race.isMultisport,
                    'distanceName': req.body.race.distanceName,
                    'racedate': req.body.race.racedate,
                    'location.country': req.body.race.location.country,
                    'location.state': req.body.race.location.state,
                    'racetype._id': req.body.race.racetype._id,
                    'order': req.body.race.order
                }).then(race => {
                    if (!race) { //if race does not exists
                        try{
                            Race.create({
                                racename: req.body.race.racename,
                                isMultisport: req.body.race.isMultisport,
                                distanceName: req.body.race.distanceName,
                                racedate: req.body.race.racedate,
                                order: req.body.race.order,
                                location: {
                                    country: req.body.race.location.country,
                                    state: req.body.race.location.state
                                },
                                racetype: req.body.race.racetype
                            }).then(async r => {                                                                                                                            
                                try{
                                    
                                    Result.create({
                                        race: r,
                                        members: members,
                                        time: req.body.time,
                                        legs: req.body.legs,
                                        ranking: req.body.ranking,
                                        comments: req.body.comments,
                                        resultlink: req.body.resultlink,
                                        agegrade: agegrade,
                                        is_accepted: false,
                                        isRecordEligible: req.body.isRecordEligible,
                                        customOptions: req.body.customOptions,
                                        achievements: [],
                                        done: false
                                    }).then(async result =>{   
                                        //update PBs
                                            
                                        for (let m of result.members) {
                                            let member = await Member.findById(m._id);    
                                            await service.updateMemberStats(member);   
                                        }      
                                            
                                        // Update location achievements for this location
                                        await service.updateAllLocationAchievements(r.location.country, r.location.state);
                                        
                                        resultWithPBsAndAchievements = await Result.findById(result._id);                                 
                                       await service.invalidateSystemInfoCache();
                                        res.json(resultWithPBsAndAchievements);                                                                        
                                    });                                       
                                }catch(resultCreateErr){                                  
                                    res.send(resultCreateErr);  
                                }                    
                            });
                        }catch(raceCreateErr){
                            res.send(raceCreateErr);
                        }
                        
                    } else { // race exists
                        try{

                            Result.create({
                                race: race,
                                members: members,
                                time: req.body.time,
                                legs: req.body.legs,
                                ranking: req.body.ranking,
                                comments: req.body.comments,
                                resultlink: req.body.resultlink,
                                agegrade: agegrade,
                                is_accepted: false,
                                isRecordEligible: req.body.isRecordEligible,
                                customOptions: req.body.customOptions,
                                achievements: [],
                                done: false
                            }).then(async result =>{      
                                //update PBs
                                for (let m of result.members) {
                                    let member = await Member.findById(m._id);    
                                    await service.updateMemberStats(member);   
                                }
                                // Update location achievements for this location
                                await service.updateAllLocationAchievements(race.location.country, race.location.state);                                
                                
                                resultWithPBsAndAchievements = await Result.findById(result._id);                                 
                                await service.invalidateSystemInfoCache();
                                res.json(resultWithPBsAndAchievements);                                                                      
                            }); 
                        }catch(resultCreateErr){
                            res.send(resultCreateErr);
                        }
                    }                
                });
            }catch(raceFindOneErr){                    
                res.send(raceFindOneErr);
            }                           
        }catch(ageGradingfindOneErr){

            console.log(ageGradingfindOneErr,"error fetching agegrading")
        }
        

    });

    // Bulk update existing results
    app.put('/api/results/bulk', service.isAdminLoggedIn, async function(req, res) {
        res.setHeader("Content-Type", "application/json");
        try {
            const { results } = req.body;
            
            if (!results || !Array.isArray(results) || results.length === 0) {
                return res.status(400).json({ error: 'Results array is required and must not be empty' });
            }
            
            const updatedResults = [];
            
            // Process each result
            for (const resultData of results) {
                try {
                    if (!resultData._id) {
                        throw new Error('Result ID is required for updates');
                    }
                    
                    // Find the existing result
                    const existingResult = await Result.findById(resultData._id);
                    if (!existingResult) {
                        throw new Error(`Result with ID ${resultData._id} not found`);
                    }
                    
                    // Update the result with new data
                    const updatedResult = await Result.findByIdAndUpdate(
                        resultData._id,
                        {
                            time: resultData.time,
                            ranking: resultData.ranking,
                            members: resultData.members,
                            legs: resultData.legs,
                            comments: resultData.comments,
                            resultlink: resultData.resultlink,
                            isRecordEligible: resultData.isRecordEligible,
                            customOptions: resultData.customOptions,
                            achievements: resultData.achievements
                        },
                        { new: true }
                    );
                    
                    if (updatedResult) {
                        updatedResults.push(updatedResult);
                    }
                    
                } catch (resultError) {
                    console.error(`Error updating result ${resultData._id}:`, resultError);
                    // Continue with other results even if one fails
                }
            }
            
            // Update member stats for all affected members
            const memberIds = new Set();
            updatedResults.forEach(result => {
                result.members.forEach(member => {
                    memberIds.add(member._id.toString());
                });
            });
            
            // Update stats for each unique member
            for (const memberId of memberIds) {
                try {
                    let member = await Member.findById(memberId);        
                    await service.updateMemberStats(member);
                } catch (memberError) {
                    console.error('Error updating member stats:', memberError);
                }
            }
            
            // Invalidate cache 
            await service.updateSystemInfoAndInvalidateSystemInfoCache("resultUpdate");
            
            res.json({
                success: true,
                message: `Successfully updated ${updatedResults.length} results`,
                updatedCount: updatedResults.length,
                totalRequested: results.length,
                results: updatedResults
            });
            
        } catch (error) {
            console.error('Bulk result update error:', error);
            res.status(500).json({ error: 'Failed to update bulk results', details: error.message });
        }
    });

    //update a result
    app.put('/api/results/:result_id', service.isAdminLoggedIn, async function(req, res) {
        let members = [];
        for (const m of req.body.members) {
            let member = await Member.findById(m._id);               
            members.push(member);
        }

        try{
            const ag = await service.getAgeGrading(members[0].sex.toLowerCase(),
                service.calculateAge(req.body.race.racedate, members[0].dateofbirth),
                req.body.race.racetype.surface,
                req.body.race.racedate);
        
            let agegrade;            
            if (ag && members.length === 1 && !req.body.race.isMultisport && req.body.isRecordEligible && req.body.time !== 0) { //do not deal with multiple racers
                if (ag[req.body.race.racetype.name.toLowerCase()] !== undefined) {
                    agegrade = (ag[req.body.race.racetype.name.toLowerCase()] / (req.body.time / 100) * 100).toFixed(2);
                }
            }            
            let result = await Result.findById(req.params.result_id);
            const oldraceid = result.race._id;
            //does the race exists?
            
            const race = await Race.findOne({ //by id would be simpler?
                'racename': req.body.race.racename,
                'isMultisport':req.body.race.isMultisport,
                'distanceName': req.body.race.distanceName,
                'racedate': req.body.race.racedate,
                'location.country': req.body.race.location.country,
                'location.state': req.body.race.location.state,
                'racetype._id': req.body.race.racetype._id,
                'order': req.body.race.order
            });                                     
            if (!race) { //if race does not exists                        
                    const r = await Race.create({
                        racename: req.body.race.racename,
                        isMultisport: req.body.race.isMultisport,
                        distanceName: req.body.race.distanceName,
                        racedate: req.body.race.racedate,
                        order: req.body.race.order,
                        location: {
                            country: req.body.race.location.country,
                            state: req.body.race.location.state
                        },
                        racetype: req.body.race.racetype
                    });                                                    
                    
                                                         
                    result.race = r;
                        result.members = members;
                        result.time = req.body.time;
                        result.legs = req.body.legs;
                        result.ranking = req.body.ranking;
                        result.comments = req.body.comments;
                        result.resultlink = req.body.resultlink;
                        result.agegrade = agegrade;
                        result.is_accepted = req.body.is_accepted;
                        result.isRecordEligible = req.body.isRecordEligible;
                        result.customOptions = req.body.customOptions;     
                        result.achievements=[];   //reset achievements
                        //not dealing with achievements because not editable by user (yet?)                    
                        await result.save();
                        // check if previous race entry is not a zombie now.
                        let cleanQuery = Result.find().where('race._id').equals(oldraceid);                                    
                        const cleanResults = await cleanQuery.exec(); 
                            if (cleanResults) {
                                if (cleanResults.length === 0) {
                                        Race.deleteOne({
                                            _id: oldraceid
                                        }).then(raceD => {                                                                        
                                                console.log("remove zombie race entry successful");                                                                     
                                        });                                                    
                                }
                            }         
                        //update PBs
                        for (let m of result.members) {
                            let member = await Member.findById(m._id);                                
                            await service.updateMemberStats(member);   
                        }                       
                        // Update location achievements for this location
                        await service.updateAllLocationAchievements(r.location.country, r.location.state);

                        resultWithPBsAndAchievements = await Result.findById(result._id);                                 
                       await service.invalidateSystemInfoCache();
                        res.json(resultWithPBsAndAchievements);                                                                     
                        
                                                    
            } else { // race exists       
                result.race = race;                
                
                result.members = members;
                result.time = req.body.time;
                result.legs = req.body.legs;
                result.ranking = req.body.ranking;
                result.comments = req.body.comments;
                result.resultlink = req.body.resultlink;
                result.agegrade = agegrade;
                result.is_accepted = req.body.is_accepted;
                result.isRecordEligible = req.body.isRecordEligible;
                result.customOptions = req.body.customOptions;
                result.achievements=[];   //reset achievements
                //not dealing with achievements because not editable by user (yet?)                
                await result.save();                                                                  
                // check if previous race entry is not a zombie now.
                let cleanQuery = Result.find().where('race._id').equals(oldraceid);                              
                cleanResults = await cleanQuery.exec();            
                        if (cleanResults) {
                            if (cleanResults.length === 0) {                                                
                                    Race.deleteOne({
                                        _id: oldraceid
                                    }).then(raceD => {                                                                        
                                            console.log("remove zombie race entry successful");                                                                     
                                    });                                                          
                            }
                        }
                //update PBs
                for (let m of result.members) {
                    let member = await Member.findById(m._id);    
                    await service.updateMemberStats(member);   
                }
                // Update location achievements for this location
                await service.updateAllLocationAchievements(race.location.country, race.location.state);
                resultWithPBsAndAchievements = await Result.findById(result._id); 
               await service.invalidateSystemInfoCache();
                res.json(resultWithPBsAndAchievements);                 
            }                    
                                         
        }catch(err){
            console.log("error updating result", err)
        }
        

    });

    // create bulk results
    app.post('/api/results/bulk', service.isAdminLoggedIn, async function(req, res) {
        res.setHeader("Content-Type", "application/json");
        try {
            const { results, race } = req.body;
            
            if (!results || !Array.isArray(results) || results.length === 0) {
                return res.status(400).json({ error: 'Results array is required and must not be empty' });
            }
            
            if (!race) {
                return res.status(400).json({ error: 'Race information is required' });
            }
            let existingRace = null;
            if (race._id) {
                existingRace = await Race.findById(race._id);
            }
            
            // No ID?, check if race exists or create it
            if(!existingRace){
                existingRace = await Race.findOne({
                    'racename': race.racename,
                    'isMultisport': race.isMultisport,
                    'distanceName': race.distanceName,
                    'racedate': race.racedate,
                    'location.country': race.location.country,
                    'location.state': race.location.state,
                    'racetype._id': race.racetype._id,
                    'order': race.order
                });
            }

            let raceToUse = existingRace;
            if (!existingRace) {
                raceToUse = await Race.create({
                    racename: race.racename,
                    isMultisport: race.isMultisport,
                    distanceName: race.distanceName,
                    racedate: race.racedate,
                    order: race.order,
                    location: {
                        country: race.location.country,
                        state: race.location.state
                    },
                    racetype: race.racetype
                });
            }
            
            const createdResults = [];
            const memberIds = new Set(); // Track unique members for PB updates
            
            // Process each result
            for (const resultData of results) {
                try {
                    // Find members by ID from the member objects - throw error if they don't exist
                    const members = [];
                    for (const memberObj of resultData.members) {
                        const member = await Member.findById(memberObj._id);
                        if (!member) {
                            throw new Error(`Member with ID ${memberObj._id} not found`);
                        }
                        members.push(member);
                        memberIds.add(member._id.toString());
                    }
                    
                    // Calculate age grade if applicable
                    let agegrade = null;
                    if (members.length === 1 && !raceToUse.isMultisport && resultData.isRecordEligible && resultData.time !== 0) {
                        const ag = await service.getAgeGrading(
                            members[0].sex.toLowerCase(),
                            service.calculateAge(raceToUse.racedate, members[0].dateofbirth),
                            raceToUse.racetype.surface,
                            raceToUse.racedate
                        );
                        
                        if (ag && ag[raceToUse.racetype.name.toLowerCase()] !== undefined) {
                            agegrade = (ag[raceToUse.racetype.name.toLowerCase()] / (resultData.time / 100) * 100).toFixed(2);
                        }
                    }
                    
                    // Create the result
                    const result = await Result.create({
                        race: raceToUse,
                        members: members,
                        time: resultData.time,
                        legs: resultData.legs || [],
                        ranking: resultData.ranking || {},
                        comments: resultData.comments || '',
                        resultlink: resultData.resultlink || '',
                        agegrade: agegrade,
                        is_accepted: resultData.is_accepted !== undefined ? resultData.is_accepted : false,
                        isRecordEligible: resultData.isRecordEligible !== undefined ? resultData.isRecordEligible : true,
                        customOptions: resultData.customOptions || [],
                        achievements: resultData.achievements || []
                    });
                    
                    createdResults.push(result);
                    
                } catch (resultError) {
                    console.error('Error creating result:', resultError);
                    // Continue with other results even if one fails
                }
            }
            
            // Update PBs for all affected members using bulk operation
            try {
                await service.updateMemberStatsBulk(Array.from(memberIds));
            } catch (memberError) {
                console.error('Error updating member stats:', memberError);
            }
            
            // Update location achievements
            await service.updateAllLocationAchievements(raceToUse.location.country, raceToUse.location.state);
            
            // Invalidate cache 
            await service.updateSystemInfoAndInvalidateSystemInfoCache("resultUpdate");

            
            res.json({
                success: true,
                message: `Successfully created ${createdResults.length} results`,
                createdCount: createdResults.length,
                totalRequested: results.length,
                race: raceToUse
            });
            
        } catch (error) {
            console.error('Bulk result creation error:', error);
            res.status(500).json({ error: 'Failed to create bulk results', details: error.message });
        }
    });

    // delete a result
    app.delete('/api/results/:result_id', service.isAdminLoggedIn, function(req, res) {
        res.setHeader("Content-Type", "application/json");
        try{
            Result.findById(req.params.result_id).then(result => {
                const members = result.members;
                const oldraceid = result.race._id;
                try{
                    Result.deleteOne({
                        _id: req.params.result_id
                    }).then(async result => {                                                  
                            let cleanQuery = Result.find().where('race._id').equals(oldraceid);
                            try{
                                cleanQuery.exec().then(cleanResults => {            
                                    if (cleanResults) {
                                        if (cleanResults.length === 0) {
                                            try{
                                                Race.deleteOne({
                                                    _id: oldraceid
                                                }).then(raceD => {                                                                        
                                                        console.log("remove zombie race entry successful");                                                                     
                                                });
                                            }catch(RacedeleteOneErr){
                                                res.send(RacedeleteOneErr);
                                            }
                                            
                                        }
                                    }
                                });
                            }catch(cleanQueryExecErr){
                                res.send(cleanQueryExecErr)
                            }        
                            for (let m of members) {
                                let member = await Member.findById(m._id);    
                                service.updateMemberStats(member);   
                            }                                               
                            await service.updateSystemInfoAndInvalidateSystemInfoCache("resultUpdate");
                            res.end('{"success" : "Result deleted successfully", "status" : 200}');
                        
                    });
                }catch(DeleteOneErr){
                    res.send(DeleteOneErr);
                }
                
            });
        }catch(findByIdErr){
            res.send(findByIdErr)
        }
       


    });



    // =====================================
    // Races ===============================
    // =====================================

    // get a racelist
    app.get('/api/races', function(req, res) {
        const sort = req.query.sort;
        const limit = parseInt(req.query.limit);
        let query = Race.find();

        if (req.query.filters) {
            const filters = JSON.parse(req.query.filters);
            if (filters.dateFrom) {
                query.gte('racedate', new Date(filters.dateFrom));
            }
            if (filters.dateTo) {
                query.lte('racedate', new Date(filters.dateTo));
            }
        }
        if (sort) {
            query = query.sort(sort);
        }
        if (limit) {
            query = query.limit(limit);
        }

        try{
            query.exec().then(races => {
                // if there is an error retrieving, send the error. nothing after res.send(err) will execute           
                res.json(races); // return all races in JSON format
            });
        }catch(err){
            res.send(err)
        }    
    });

    // get a single race by ID
    app.get('/api/races/:race_id', function(req, res) {
        try {
            Race.findById(req.params.race_id).then(race => {
                if (race) {
                    res.json(race);
                } else {
                    res.status(404).json({ error: 'Race not found' });
                }
            });
        } catch(err) {
            res.status(500).send(err);
        }
    });

    // update a race
    app.put('/api/races/:race_id', service.isLoggedIn, async function(req, res) {

        
        try {

            const race = await Race.findById(req.params.race_id);
            const oldRace = JSON.parse(JSON.stringify(race));
            if (!race) {
                return res.status(404).json({ error: 'Race not found' });
            }

            let raceToUse;
            // Check if race exists or create it
            let existingRace = await Race.findOne({
                '_id': { $ne: race._id },
                'racename': req.body.racename,
                'isMultisport': req.body.isMultisport,
                'distanceName': req.body.distanceName,
                'racedate': req.body.racedate,
                'location.country': req.body.location.country,
                'location.state': req.body.location.state,
                'racetype._id': req.body.racetype._id,
                'order': req.body.order
            });

            

            if (existingRace) {
                raceToUse = existingRace;
            } else {
                raceToUse = race;
                // Update raceToUse with request body data
                raceToUse.racename = req.body.racename;
                raceToUse.distanceName = req.body.distanceName;
                raceToUse.racedate = req.body.racedate;
                raceToUse.order = req.body.order;
                raceToUse.isMultisport = req.body.isMultisport;
                raceToUse.racetype = req.body.racetype;
                raceToUse.location = req.body.location;
                raceToUse.achievements = req.body.achievements || [];
                raceToUse.customOptions = req.body.customOptions || [];
                await raceToUse.save();
            }

            // Update the race data
            const updatedRace = raceToUse;

            // Update all related results
            const results = await Result.find({ 'race._id': req.params.race_id }).populate('members');
            
            // OPTIMIZATION: Collect all unique member IDs to avoid duplicate processing
            const allMemberIds = new Set();
            for (let result of results) {
                result.members.forEach(member => {
                    allMemberIds.add(member._id.toString());
                });
            }

            
            // OPTIMIZATION: Use bulk operations for result updates
            const resultBulkOperations = [];
            const ageGradeResults = [];
            
            for (let result of results) {
                // Update race information in the result
                // const raceUpdate = {
                //     'race.racename': updatedRace.racename,
                //     'race.distanceName': updatedRace.distanceName,
                //     'race.racedate': updatedRace.racedate,
                //     'race.order': updatedRace.order,
                //     'race.isMultisport': updatedRace.isMultisport,
                //     'race.racetype': updatedRace.racetype,
                //     'race.location': updatedRace.location,
                //     'race.achievements': updatedRace.achievements,
                //     'race.customOptions': updatedRace.customOptions
                // };

                // Check if age grade needs recalculation
                if (result.members.length === 1 && 
                    !updatedRace.isMultisport && 
                    result.isRecordEligible && 
                    result.time !== 0) {
                    
                    ageGradeResults.push({
                        resultId: result._id,
                        member: result.members[0],
                        raceUpdate: raceToUse
                    });
                } else {
                    // Add to bulk operations for results that don't need age grade recalculation
                    resultBulkOperations.push({
                        updateOne: {
                            filter: { _id: result._id },
                            update: { $set: { race: raceToUse } }
                        }
                    });
                }
            }
            
            // Process age grade calculations in parallel
            const ageGradePromises = ageGradeResults.map(async ({ resultId, member, raceUpdate }) => {
                // Get the result to access its time
                const result = results.find(r => r._id.toString() === resultId.toString());
                if (!result) {
                    return null;
                }
                
                const ag = await service.getAgeGrading(
                    member.sex.toLowerCase(),
                    service.calculateAge(updatedRace.racedate, member.dateofbirth),
                    updatedRace.racetype.surface,
                    updatedRace.racedate
                );
                // console.log("age grade", ag);

                let newAgeGrade = null;
                if (ag && ag[updatedRace.racetype.name.toLowerCase()] !== undefined) {
                    newAgeGrade = (ag[updatedRace.racetype.name.toLowerCase()] / (result.time / 100) * 100).toFixed(2);
                }
                return {
                    updateOne: {
                        filter: { _id: resultId },
                        update: { 
                            $set: { 
                                race: raceUpdate,
                                agegrade: newAgeGrade
                            } 
                        }
                    }
                };
            });
            
            const ageGradeBulkOps = await Promise.all(ageGradePromises);
            // Filter out null operations (failed age grade calculations)
            const validAgeGradeOps = ageGradeBulkOps.filter(op => op !== null);
            resultBulkOperations.push(...validAgeGradeOps);
            
            // Execute all result updates in a single bulk operation
            if (resultBulkOperations.length > 0) {
                await Result.bulkWrite(resultBulkOperations);
            }
            
            
            // OPTIMIZATION: Update all unique members in bulk to avoid version conflicts
            const memberIdsArray = Array.from(allMemberIds);
            
            try {
                await service.updateMemberStatsBulk(memberIdsArray);
                
            } catch (error) {
                console.error(`❌ Error in bulk member stats update:`, error.message);
                // Fallback to individual updates with retry logic
                
                for (const memberId of memberIdsArray) {
                    let memberUpdateSuccess = false;
                    let retryCount = 0;
                    const maxRetries = 3;
                    
                    while (!memberUpdateSuccess && retryCount < maxRetries) {
                        try {
                            const member = await Member.findById(memberId);
                            if (!member) {
                                break;
                            }
                            
                            await service.updateMemberStats(member);
                            memberUpdateSuccess = true;
                            
                        } catch (error) {
                            retryCount++;
                            if (error.name === 'VersionError') {
                                console.log(`🔄 Version conflict for member ${memberId}, retry ${retryCount}/${maxRetries}`);
                                if (retryCount >= maxRetries) {
                                    console.error(`❌ Failed to update member ${memberId} after ${maxRetries} retries:`, error.message);
                                }
                                await new Promise(resolve => setTimeout(resolve, 100 * retryCount));
                            } else {
                                console.error(`❌ Error updating member ${memberId}:`, error.message);
                                break;
                            }
                        }
                    }
                    
                }
            }
            
            // Update location achievements for this location
            if (oldRace.location.country !== updatedRace.location.country || oldRace.location.state !== updatedRace.location.state) {
                await service.updateAllLocationAchievements(oldRace.location.country, oldRace.location.state);
            }
            

            // Get the updated race with populated results
            const populatedRace = await Race.aggregate([
                {
                    $match: { _id: updatedRace._id }
                },
                {
                    $lookup: {
                        from: 'results',
                        localField: '_id',
                        foreignField: 'race._id',
                        as: 'results'
                    }
                },
                {
                    $set: {
                        results: {
                            $map: {
                                input: "$results",
                                as: "result",
                                in: {
                                    $mergeObjects: [
                                        "$$result",
                                        {
                                            race: {
                                                _id: "$$result.race._id"
                                            }
                                        }
                                    ]
                                }
                            }
                        }
                    }
                }
            ]);

            // Return the first (and only) result from the aggregation
            const raceWithResults = populatedRace[0];
            
            await service.updateSystemInfoAndInvalidateSystemInfoCache("resultUpdate");
            
            // If we found an existing race we are merging into it, delete the old race AFTER all updates are complete
            if (existingRace) {
                await race.deleteOne();
            }
            
            res.json(raceWithResults);
        } catch(err) {
            console.error('Error updating race:', err);
            res.status(500).json({ error: 'Error updating race' });
        }
    });

    //  app.get('/api/results/:result_id',  async function(req, res) {
    //     try{
    //         res.json(await Result.findOne(req.params.result_id));
    //     }catch(err){
    //         res.send(err);
    //     }
    // });

     // get raceinfo list
     app.get('/api/raceinfos', function(req, res) {
        const sort = req.query.sort;
        const limit = parseInt(req.query.limit);
        let raceId = req.query.raceId;

        
        let query = Race.aggregate([
                          
              {
                $lookup: {
                  from: 'results',
                  localField: '_id',
                  foreignField: 'race._id',
                  as: 'results'
                }
              },
              {
                $set: {
                  results: {
                    $map: {
                      input: "$results",
                      as: "result",
                      in: {
                        $mergeObjects: [
                          "$$result",
                          {
                            race: {
                              _id: "$$result.race._id"
                            }
                          }
                        ]
                      }
                    }
                  }
                }
              },
              {
                $addFields: { 
                    count: { "$size": "$results"  }
                  }
              }
        ]);


        if (raceId) {
            query = query.match({ '_id': new mongoose.Types.ObjectId(raceId) });
        }

        if (req.query.filters) {
            const filters = JSON.parse(req.query.filters);
            if (filters.dateFrom) {
                query = query.match({ 'racedate': { $gte: new Date(filters.dateFrom) } });
            }
            if (filters.dateTo) {
                query = query.match({ 'racedate': { $lte: new Date(filters.dateTo) } });
            }
        }

        if (sort) {
            query = query.sort(sort);
        }

        if (limit) {
            query = query.limit(limit); //no idea why I need to parse
        }

        try{
            query.exec().then(results =>{               
                results.forEach(function(resu) {
                    resu.results = _.sortBy(resu.results, 'time');
                });
                res.json(results); // return all members in JSON format                
            });
        }catch(err){
            res.send(err);
        }
        

    });


    app.delete('/api/raceinfos/:race_id', service.isAdminLoggedIn, async function (req, res) {
        //remove all results then the race itself
        try {
            const raceId = req.params.race_id;
            let query = Result.find().where('race._id').equals(raceId);
            let results = await query.exec();
            // Collect all member IDs first
            const memberIds = new Set();
            await Result.deleteMany({ _id: { $in: results.map(r => r._id) } });
            results.forEach(res => {
                res.members.forEach(m => memberIds.add(m._id));
            });
            
            // Update stats for all members in bulk
            if (memberIds.size > 0) {
                await service.updateMemberStatsBulk(Array.from(memberIds));
            }
            await Race.deleteOne({
                _id: raceId
            }).then(async raceD => {
                await service.updateSystemInfoAndInvalidateSystemInfoCache("resultUpdate");
                res.json('{"success" : "Result deleted successfully", "status" : 200}');
            });
        }catch (err) {
            res.send(err);
        }
    });




    // =====================================
    // CACHE MANAGEMENT ====================
    // =====================================

    // Refresh age grading cache
    app.post('/api/refresh-agegrading-cache', service.isAdminLoggedIn, async function(req, res) {
        try {
            await service.refreshAgeGradingCache();
            res.json({ success: true, message: 'Age grading cache refreshed successfully' });
        } catch (error) {
            console.error('Error refreshing age grading cache:', error);
            res.status(500).json({ error: 'Failed to refresh age grading cache' });
        }
    });

    // =====================================
    // ACHIEVEMENTS ========================
    // =====================================
  

// update agegrade
app.get('/updateAgeGrade', service.isAdminLoggedIn, async function(req, res) {
    let query = Result.find();
    query = query.or([{
        'race.racetype.surface': 'track'
    }, {
        'race.racetype.surface': 'road'
    }]);

    let results = await query.exec();
        if (results) {
            let diffrenceArray = [];
            let numberOfUpdates = 0;
            let maxDiff= 0;
            for(let res of results){ 
                
                //SYNC ISSUE
                const ag = await service.getAgeGrading(res.members[0].sex.toLowerCase(),
                    service.calculateAge(res.race.racedate,res.members[0].dateofbirth),
                    res.race.racetype.surface,
                    res.race.racedate
                );
                                                                       
                    if (ag && res.members.length === 1 && !res.race.isMultisport && res.isRecordEligible) { //do not deal with multiple racers
                        if (ag[res.race.racetype.name.toLowerCase()] !== undefined) {                            
                            const agegrade = (ag[res.race.racetype.name.toLowerCase()] / (res.time / 100) * 100).toFixed(2);          
                             if (res.agegrade- agegrade > maxDiff){
                                maxDiff = res.agegrade-agegrade;
                                // console.log(res.race.racedate,res.race.racename,res.members[0].firstname + ' ' + res.members[0].lastname, res.agegrade, agegrade, maxDiff);
                             }
                             if (res.agegrade - agegrade)
                                {
                                    diffrenceArray.push({
                                        "runner":res.members[0].firstname + ' ' + res.members[0].lastname,
                                        "racename":res.race.racename,
                                        "date":res.race.racedate,
                                        "old":res.agegrade,
                                        "new": agegrade,
                                        "diff": res.agegrade-agegrade});
                                }                                    
                            res.agegrade = agegrade;
                            // numberOfUpdates++;                                                        
                            res.save().then(() => {                                    
                                 numberOfUpdates++;                                   
                            });
                        } else {
                            if(res.agegrade !== undefined){
                                //if the ag info doesn't exist and we used to have one, we remove it
                                //Maybe this distance is not track since having a newer age grading data set. e.g. 2 miles track was tracked in the 2005 dataset but not anymore in the 2023.
                                res.agegrade = undefined;
                                res.save().then(() => {                                    
                                     numberOfUpdates++;                                   
                                });  
                            }                                                        
                        }
                    } else {
                        if(res.agegrade !== undefined){
                            //if the ag info doesn't exist and we used to have one, we remove it
                            //Maybe this distance is not track since having a newer age grading data set. e.g. 2 miles track was tracked in the 2005 dataset but not anymore in the 2023.
                            res.agegrade = undefined;
                            res.save().then(() => {                                    
                                 numberOfUpdates++;                                     
                            });  
                        } 
                    }                           
            };
            diffrenceArray.sort((a, b) => b.diff - a.diff);
           await service.invalidateSystemInfoCache();
                res.json({ 'numberOfUpdates': numberOfUpdates,
                    'differences' : diffrenceArray
                });

        }
});




//update all achievements
app.get('/updateAchievements', service.isAdminLoggedIn, async function(req, res) {
    res.setHeader("Content-Type", "application/json");
    try{
        let memberQuery = Member.find();
        memberQuery = memberQuery.sort("lastname");
        let achievements = [];
        memberQuery.exec().then(async members => { 
            for (const member of members) {                        
                achievements.push({
                    "member": member.firstname + " " + member.lastname,
                    "achievements": await service.updateAchievements(member)
                });            
            }
           await service.invalidateSystemInfoCache();
            res.end('{"success" : "Achievements updated successfully", "status" : 200 , "achievements" : '+JSON.stringify(achievements)+'}');
        });
        
    }catch(err){
        res.end('{"error" : "Achievements not updated", "status" : 500, "error" : "'+err+'"}');
    }
    
});

// update all pbs
app.get('/updatePbs', service.isAdminLoggedIn, async function(req, res) {
    res.setHeader("Content-Type", "application/json");
    try{
    let memberQuery = Member.find();
    memberQuery = memberQuery.sort("lastname");
    let pbs = [];
    memberQuery.exec().then(async members => {            
            if (members) {                
                for (let member of members) {
                    pbs.push({
                        "member": member.firstname + " " + member.lastname,
                        "pbs": await updatePBs(member)
                    });                           
                }
               await service.invalidateSystemInfoCache();
                res.end('{"success" : "Pbs updated successfully", "status" : 200 , "achievements" : '+JSON.stringify(pbs)+'}');
            }            
    });

    }catch(err){
        res.end('{"error" : "Pbs not updated", "status" : 500, "error" : "'+err+'"}');
    }
});

app.get('/updatePBsandAchivements', service.isAdminLoggedIn, async function(req, res) {
    res.setHeader("Content-Type", "application/json");
    try{       
        const members = await Member.find().select('_id firstname memberStatus teamRequirementStats');
            
            if (members.length === 0) {
                return;
            }
            
            // Extract member IDs for bulk processing
            const memberIds = members.map(member => member._id);
            
            // OPTIMIZATION: Use bulk team requirement stats update
            await service.updatePBsandAchivementsBulk(memberIds);
            res.end('{"success" : "Pbs and achievements updated successfully", "status" : 200}');
    }catch(err){
        res.end('{"error" : "Pbs and achievements not updated", "status" : 500, "error" : "'+err+'"}');
    }
});


app.get('/updateResultsUpdateDatesAndCreatedAt', service.isAdminLoggedIn, async function(req, res) {
    res.setHeader("Content-Type", "application/json");
    try{
        let returnRes = [];
        let resultquery = Result.find();
        resultquery.sort('race.racedate race.order'); 
        const results = await resultquery.exec();
        for(let result of results){ 
            let saveNeeded = false;
            let date = Date.now();
            if (!result.updatedAt){
                saveNeeded = true;
                if (!result.createdAt){
                    returnRes.push("Result missing createdAt and updatedAt: "+result.race.racename +" (" + result.members[0].firstname + " " + result.members[0].lastname + ")!");                      
                    result.updatedAt = date;
                    result.createdAt = date;
                }else{
                    returnRes.push("Result only missing updatedAt "+result.race.racename +" (" + result.members[0].firstname + " " + result.members[0].lastname + ")!");  
                    result.updatedAt = date;
                }            
            }else{
                if (!result.createdAt){
                    saveNeeded = true;
                    returnRes.push("Result only missing createdAt "+result.race.racename +" (" + result.members[0].firstname + " " + result.members[0].lastname + ")!");  
                    result.createdAt = date;
                }
            }
            if(saveNeeded){
                await result.save();
            }
            
        }
       await service.invalidateSystemInfoCache();
        res.end('{"success" : "results updated successfully", "status" : 200 ,  "Results":'+ JSON.stringify(returnRes)+'}');

    }catch(err){
        res.end('{"error" : "results not updated", "status" : 500, "error" : "'+err+'"}');
    }
});




    // =====================================
    // STATS ===============================
    // =====================================

    // get a location data
    app.get('/api/locations', function(req, res) {
        const type = req.query.type;
        let typeq;
        if (type === "country"){
          typeq = '$location.country';
        }else if (type === "state"){
          typeq = '$location.state';
        }else{
          typeq = '$location.state';
        }

        let query = Race.aggregate([
               {
                $group: {
                    _id: typeq,
                    number:{$sum:1}
                }
              },
              {
                $project: {
                    _id: 0, //
                    name: "$_id",
                    count: "$number"
                }
            }
        ]);

        try{
            query.exec().then(results => {                        
                let ret = [];
                let total = 0;
                results.forEach(function(resu) {
                  if(resu["name"] !== null){
                    total += resu["count"];
                  }
                });
  
                results.forEach(function(resu) {
                  if(resu["name"] !== null){
                    //ret[resu["name"]]={count:resu["count"],fillKey:"red"};
                    ret.push([resu["name"],resu["count"]])
                  }
  
                    // i++;
                });
  
                res.json(ret); // return all race in JSON format            
          });
        }catch(err){
            res.send(err);
        }
        
    });


     // get participation stats
     app.get('/api/stats/participation', service.isUserLoggedIn, function(req, res) {
        const startdateReq = parseInt(req.query.startdate);
        const enddateReq = parseInt(req.query.enddate);
        // let memberStatusReq = req.query.memberstatus;
        let startdate;
        if (startdateReq !== undefined){
            startdate = new Date(startdateReq);    
        }else{            
            startdate = new Date(new Date().getFullYear(), 0, 1);
        }

        let enddate;
        if (enddateReq !== undefined){
            enddate = new Date(enddateReq);
        }else{            
            enddate = new Date();
        }

        let query = Member.aggregate(
            [
                {
                  '$match': {
                    '$or': [
                      {
                        'membershipDates': {
                          '$elemMatch': {
                            '$or': [
                                {
                                    'start': {
                                        '$lte': startdate 
                                    }
                                },{
                                    'start': {
                                        '$lte': new Date('2013-01-01T00:00:00.000Z')
                                    }   
                                }
                            ],
                            'end': {
                              '$gte': startdate 
                            }
                          }
                        }
                      }, {
                        'membershipDates': {
                          '$elemMatch': {
                            'start': {
                              '$lte': enddate 
                            },
                            '$or': [
                              {
                                'end': {
                                  '$gte': enddate 
                                }
                              },{
                                'end': {
                                  '$gte': startdate 
                                }
                              }, {
                                'end': {
                                  '$exists': false
                                }
                              }
                            ]
                          }
                        }
                      }
                    ]
                  }
                }, {
                  '$lookup': {
                    'from': 'results', 
                    'localField': '_id', 
                    'foreignField': 'members._id', 
                    'as': 'results', 
                    'pipeline': [
                      {
                        '$match': {
                          '$and': [
                            {
                              'race.racedate': {
                                '$gte': startdate
                              }
                            }, {
                              'race.racedate': {
                                '$lte': enddate
                              }
                            }
                          ]
                        }
                      }
                    ]
                  }
                },
                {
                    '$set': {
                        "bestAgeGroup": {                      
                              '$first': {
                                '$sortArray': {
                                  'input': "$results",
                                  'sortBy': {            
                                    "agegrade": -1,
                                    "race.racedate": -1
                                    
                                  }
                                }
                              }
                            }
                      }
                },
                
                {
                  '$replaceRoot': {
                    'newRoot': {                      
                      'firstname': '$firstname',
                      'lastname': '$lastname',
                      'username': '$username',
                      'memberStatus': '$memberStatus',
                      'dateofbirth': '$dateofbirth',
                      'numberofraces': {
                        '$size': '$results'
                      },
                      "max": "$bestAgeGroup.agegrade",
                      "maxRaceId": "$bestAgeGroup.race._id",
                    }
                  }
                }, {
                  '$sort': {
                    'numberofraces': -1, 
                    'maxsortvalue': -1
                  }
                }
              ]);   

        try{
            query.exec().then(participation => {
                res.json(participation); // return all members in JSON format        
        });
        }catch(err){
            res.send(err);
        }
        
    });

    app.get('/api/agegrade', async function (req, res) {
        try {
            const sex = req.query.sex.toLowerCase();
            const age = req.query.age;
            const road = await service.getAgeGrading(sex,
                age,
                "road",
                new Date()
            );
            const track = await service.getAgeGrading(sex,
                age,
                "track",
                new Date()
            );

            res.json([road,track]);
        } catch (err) {
            res.send(err);
        }

    });

   



    //pdf
    app.get('/api/pdfreport', function(req, res) {
        let calls = [];
        let fullreport = {};
        let openMaleRecords = [];
        let masterMaleRecords = [];
        let openFemaleRecords = [];
        let masterFemaleRecords = [];

        let raceTypeQuery = RaceType.find().sort('meters').and([
        {
            'name': {'$ne':'Odd road distance'}
        },
         {
            'name': {'$ne':'Odd trail distance'}
        },
         {
            'name': {'$ne':'Multisport'}
        },{
            'name': {'$ne':'Swim'}
        },{
            'name': {'$ne':'Cycling'}
        },]);

        try{
            raceTypeQuery.exec().then(racetypes => {            
                racetypes.forEach(function(rt) {
    
                    calls.push(function(callback) {
                        let query = Result.find();
                        try{
                            query = query.where('isRecordEligible').equals(true).regex('category', 'Open').where('members.sex').regex('Male').where('race.racetype._id').equals(rt._id).sort('time').limit(5);
                            query.exec().then(results => {                            
                                openMaleRecords.push({
                                    'racetype': rt,
                                    'records': results
                                });
                                callback(null);
                            });
                        }catch(queryExecErr){
                            callback(queryExecErr);
                        }
                       
    
                    });
                    calls.push(function(callback) {
                        let query = Result.find();
                        try{
                            query = query.where('isRecordEligible').equals(true).regex('category', 'Master').where('members.sex').regex('Male').where('race.racetype._id').equals(rt._id).sort('time').limit(5);
                            query.exec().then(results => {                            
                                masterMaleRecords.push({
                                    'racetype': rt,
                                    'records': results
                                });
                                callback(null);
                            });
                        }catch(queryExecErr){
                            callback(queryExecErr);
                        }
                    });
                    calls.push(function(callback) {
                        let query = Result.find();
                        try{
                            query = query.where('isRecordEligible').equals(true).regex('category', 'Open').where('members.sex').regex('Female').where('race.racetype._id').equals(rt._id).sort('time').limit(5);
                            query.exec().then(results => {                            
                                openFemaleRecords.push({
                                    'racetype': rt,
                                    'records': results
                                });
                                callback(null);
                            });
                        }catch(queryExecErr){
                            callback(queryExecErr);
                        }
                    });
                    calls.push(function(callback) {
                        let query = Result.find();
                        try{
                            query = query.where('isRecordEligible').equals(true).regex('category', 'Master').where('members.sex').regex('Female').where('race.racetype._id').equals(rt._id).sort('time').limit(5);
                            query.exec().then(results => {                            
                                masterFemaleRecords.push({
                                    'racetype': rt,
                                    'records': results
                                });
                                callback(null);
                            });
                        }catch(queryExecErr){
                            callback(queryExecErr);
                        }
                    });
                });
    
    
                async.parallel(calls, function(err) {
                    if (err)
                        return res.send(err);
    
                    openMaleRecords.sort(service.sortRecordDistanceByDistance);
                    masterMaleRecords.sort(service.sortRecordDistanceByDistance);
                    openFemaleRecords.sort(service.sortRecordDistanceByDistance);
                    masterFemaleRecords.sort(service.sortRecordDistanceByDistance);
    
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
        }catch(raceTypeQueryExecErr){
            res.send(err)
        }
        

    });


    app.get('/api/milesraced', async function(req, res) {
        let filter;
        if (req.query.filters) {
            filters = JSON.parse(req.query.filters);
        }else{
            res.send("no dates provided");
        }
        let query = Result.aggregate([
            {
                $match:
                  /**
                   * query: The query in MQL.
                   */
                  {
                    $and: [{
                        "race.racedate": {
                          $gte: new Date(filters.dateFrom)
                        }
                      },
                      {
                        "race.racedate": {
                          $lte: new Date(filters.dateTo)
                        }
                      }]
                }
                  
              },

            {
            $group: {            
                _id: null,
                resultsCount: {
                  $sum: 1
                },
                 raceWon: {
                  $sum: {$cond:	[ {$or: [ {$eq: [ "$ranking.overallrank", 1] }, { $eq: [ "$ranking.genderrank", 1] } ]}, 1, 0] 
                      }
              },
                milesRaced:{
                  $sum: "$race.racetype.miles"
                }
              }            
        }]);
         try{
            let queryRes = await query.exec();     
            return res.json({resultsCount:queryRes[0].resultsCount, milesRaced:queryRes[0].milesRaced, raceWon:queryRes[0].raceWon});

         }catch (err){
                res.send(err);
         }
        
    });


    // =====================================
    // RaceTypes =============================
    // =====================================

    // get all racetypes
    app.get('/api/racetypes', function(req, res) {

        const sort = req.query.sort;
        const limit = parseInt(req.query.limit)
        const surface = req.query.surface;
        const isVariable = req.query.isVariable;

        let query = RaceType.find();
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
            query = query.limit(limit);
        }

        try{
            query.exec().then(racetypes => {                                
                res.json(racetypes);
            });
        }catch(err){
            res.send(err)
        }
        
    });

    // get a racetype
    app.get('/api/racetypes/:racetype_id', function(req, res) {
        try{
            RaceType.findOne({
                _id: req.params.racetype_id
            }).then(racetype =>{               
                if (racetype) {
                    res.json(racetype);
                }
            });
        }catch(raceTypeFindOneErr){
            res.send(raceTypeFindOneErr);
        }
        
    });

    // create racetype and send back all racetypes after creation
    app.post('/api/racetypes', service.isAdminLoggedIn, async function(req, res) {
        try{
            RaceType.create({
                name: req.body.name,
                surface: req.body.surface,
                meters: req.body.meters,
                miles: req.body.miles,
                isVariable: req.body.isVariable,
                hasAgeGradedInfo: req.body.hasAgeGradedInfo
            }).then(async racetype => {              
               await service.invalidateSystemInfoCache();
                    res.end('{"success" : "Result created successfully", "status" : 200}');                    
            });
        }catch(raceTypeErr){
            res.send(raceTypeErr);
        }        
    });

    //update a racetype
    app.put('/api/racetypes/:racetype_id', service.isAdminLoggedIn, async function(req, res) {
        try{
            RaceType.findById(req.params.racetype_id).then(racetype => {
                racetype.name = req.body.name;
                racetype.surface = req.body.surface;
                racetype.meters = req.body.meters;
                racetype.miles = req.body.miles;
                racetype.isVariable = req.body.isVariable;
                racetype.hasAgeGradedInfo =  req.body.hasAgeGradedInfo;
                try{
                    racetype.save().then(()=> {       
                            try{
                                Result.find({
                                    'race.racetype._id': racetype._id
                                }).then(async results => {                                    
                                    for (const result of results) {
                                        if (!req.body.isVariable) {
                                            result.race.racetype = {
                                                _id: result.race.racetype._id,
                                                name: req.body.name,
                                                surface: req.body.surface,
                                                meters: req.body.meters,
                                                miles: req.body.miles,
                                                isVariable: req.body.isVariable,
                                                hasAgeGradedInfo:req.body.hasAgeGradedInfo
                                            };
                                        } else {
                                            result.race.racetype = {
                                                _id: result.race.racetype._id,
                                                name: req.body.name,
                                                surface: req.body.surface,
                                                meters: result.race.racetype.meters,
                                                miles: result.race.racetype.miles,
                                                isVariable: req.body.isVariable,
                                                hasAgeGradedInfo:req.body.hasAgeGradedInfo
                                            };
                                        }
                                        try{
                                            result.save().then(()=> {                                          
                                            });
                                        }catch(resultsiSaveErr){
                                            console.log(resultsiSaveErr);
                                            res.send(resultsiSaveErr);
                                        }
                                        
                                    }
                                   await service.invalidateSystemInfoCache();
                                    res.end('{"success" : "Result updated successfully", "status" : 200}');                                    
                                }
                            );   
                            }catch(resultFindErr){
                                console.log(resultFindErr);
                                res.send(resultFindErr);
                            }              
                                                 
                    });
                }catch(racetypeSaveErr){
                    console.log(racetypeSaveErr);
                    res.send(racetypeSaveErr);
                }
                
            });
        }catch(raceTypeFindByIdErr){
            console.log(raceTypeFindByIdErr);
            res.send(raceTypeFindByIdErr);
        }
        
    });


    // delete a racetype
    app.delete('/api/racetypes/:racetype_id', service.isAdminLoggedIn, async function(req, res) {
        res.setHeader("Content-Type", "application/json");
        try {
            await RaceType.deleteOne({ _id: req.params.racetype_id });
            await service.invalidateSystemInfoCache();
            res.end('{"success" : "Racetype deleted successfully", "status" : 200}');    
          } catch (raceTypedeleteOneErr) {
            res.send(raceTypedeleteOneErr);              
        }       
    });

    // MAIL
    app.post('/sendEmail', function(req, res) {
        const data = req.body;
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

    // Add this with other route definitions
    app.post('/api/extract-table', service.isAdminLoggedIn, async function(req, res) {
        try {
            const { url } = req.body;
            if (!url) {
                return res.status(400).json({ success: false, error: 'URL is required' });
            }

            if (url.includes('runsignup.com')) {
                // Extract race ID and resultSetId from the URL
                const raceIdMatch = url.match(/\/Results\/(\d+)/);
                const resultSetMatch = url.match(/resultSetId-(\d+)/);
                
                if (!raceIdMatch) {
                    return res.status(400).json({ success: false, error: 'Could not find race ID in URL' });
                }
                
                const raceId = raceIdMatch[1];
                const resultSetId = resultSetMatch ? resultSetMatch[1] : null;
                
                // Get the page data and cookies
                const pageData = await axios.get(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5',
                        'Connection': 'keep-alive'
                    }
                });

                const cookies = pageData.headers['set-cookie'];
                
                // Extract title from the HTML page title and remove "results" at the end if present
                const $ = cheerio.load(pageData.data);
                const pageTitle = $('title').text().trim().replace(/\s*results\s*$/i, '') || 'RunSignUp Race';
                
                // Now make the API call with the cookies for Json
                const apiUrljson = `https://runsignup.com/Race/Results/${raceId}/?format=json&resultSetId=${resultSetId}&page=1&num=5000&search=`;
                const response = await axios.get(apiUrljson, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Accept': 'application/json',
                        'Accept-Language': 'en-US,en;q=0.5',
                        'Connection': 'keep-alive',
                        'Cookie': cookies ? cookies.join('; ') : ''
                    }
                });

           
                
                const raceData = response.data;
                if (!raceData.resultSet || !raceData.resultSet.results || !raceData.resultSet.results.length) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'No results found in the JSON data' 
                    });
                }

                // Get visible headers from RunSignUp data
                const visibleHeadings = raceData.headings.filter(h => !h.hidden);
                const headers = visibleHeadings.map(h => h.name.replace('\n', ' '));
          
                
                // Transform RunSignUp data using array indices, only including visible columns
                const data = raceData.resultSet.results.map(result => {
                    const row = {};
                    // Only process the visible columns using their array indices
                    visibleHeadings.forEach((heading, visibleIndex) => {
                        // Find the original index of this heading in the full headings array
                        const originalIndex = raceData.headings.findIndex(h => h.name === heading.name);
                        if (originalIndex !== -1) {
                            row[heading.name.replace('\n', ' ')] = result[originalIndex]?.toString() || '';
                        }
                    });
                    return row;
                });

                res.json({
                    success: true,
                    headers: headers,
                    data: data,
                    pageTitle: pageTitle
                });
            } else if (url.includes('parkrun.')) {
                // Use proxy to retrieve parkrun content
                const proxyUrl = `${process.env.PARKRUN_PROXY_URL}?url=${encodeURIComponent(url)}&key=${process.env.PARKRUN_PROXY_KEY}`;
                // console.log(proxyUrl);
                try {
                    const response = await axios.get(proxyUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                            'Accept-Language': 'en-US,en;q=0.9',
                            'Accept-Encoding': 'gzip, deflate, br',
                            'Connection': 'keep-alive',
                            'Cache-Control': 'no-cache',
                            'Pragma': 'no-cache'
                        },
                        maxRedirects: 5,
                        validateStatus: function (status) {
                            return status >= 200 && status < 500;
                        },
                        timeout: 15000 // 15 second timeout for proxy
                    });

                    // Check if we got a CAPTCHA page or any other error page
                    if (response.data.includes('JavaScript is disabled') || 
                        response.data.includes('CAPTCHA') || 
                        response.data.includes('Access Denied') ||
                        response.data.includes('Please try again later')) {
                        return res.status(403).json({
                            success: false,
                            error: 'Parkrun is restricting access. This could be due to CAPTCHA, rate limiting, or IP restrictions. Please try again later or use a different results source.'
                        });
                    }

                    const $ = cheerio.load(response.data);
                    
                    // Extract page title from Results-header
                    const resultsHeader = $('.Results-header h1').text().trim();
                    
                    // Parse event number and date from h3 spans
                    const dateText = $('.Results-header h3 .format-date').text().trim();
                    const eventNumber = $('.Results-header h3 span:last-child').text().trim().replace('#', '');
                    
                    // Convert date from DD/MM/YYYY to Date object
                    const [day, month, year] = dateText.split('/');
                    const raceDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                    
                    const pageTitle = `${resultsHeader} #${eventNumber}`;

                    // Try different table selectors
                    let table = null;
                    let headers = [];
                    let data = [];

                    // Parkrun specific table selectors
                    const tableSelectors = [
                        'table.Results-table',  // Parkrun specific class
                        'table.Results',        // Another Parkrun specific class
                        'table.results-table',  // Common for results tables
                        'table.table',          // Bootstrap tables
                        'table.dataTable',      // DataTables
                        'table.sortable',       // Sortable tables
                        'table.grid',           // Grid tables
                        'table',                // Any table as last resort
                        'div.table',            // Some sites use div with table class
                        'div.results'           // Some sites use div for results
                    ];

                    // Try each selector until we find a working one
                    for (const selector of tableSelectors) {
                        const element = $(selector).first();
                        if (element.length) {
                            // Try to extract headers - be more strict about what constitutes a header
                            const potentialHeaders = [];
                            const headerRow = element.find('thead tr, tr:first-child').first();
                            
                            // Only process if we found a header row
                            if (headerRow.length) {
                                // Check if this looks like a header row (all cells should be th elements)
                                const allCellsAreTh = headerRow.find('td').length === 0;
                                
                                if (allCellsAreTh) {
                                    headerRow.find('th').each(function() {
                                        const headerText = $(this).text().trim();
                                        // Only add if it looks like a header (not empty and not a number)
                                        if (headerText && !/^\d+$/.test(headerText)) {
                                            potentialHeaders.push(headerText);
                                        }
                                    });
                                }
                            }

                            // If we found valid headers, try to extract data
                            if (potentialHeaders.length > 0) {
                                const potentialData = [];
                                // Skip the header row when getting data
                                element.find('tbody tr, tr:not(:first-child)').each(function() {
                                    const row = {};
                                    $(this).find('td').each(function(index) {
                                        if (potentialHeaders[index]) {
                                            row[potentialHeaders[index]] = $(this).text().trim();
                                        }
                                    });
                                    if (Object.keys(row).length > 0) {
                                        potentialData.push(row);
                                    }
                                });

                                // If we found both headers and data, use this table
                                if (potentialData.length > 0) {
                                    table = element;
                                    headers = potentialHeaders;
                                    data = potentialData;
                                    break;
                                }
                            }
                        }
                    }

                    if (!table || headers.length === 0 || data.length === 0) {
                        return res.status(400).json({ 
                            success: false, 
                            error: 'No valid results table found on the page. Tried selectors: ' + tableSelectors.join(', ') 
                        });
                    }

                    res.json({
                        success: true,
                        headers: headers,
                        data: data,
                        pageTitle: pageTitle,
                        raceDate: raceDate
                    });

                } catch (proxyError) {
                    console.error('Proxy error for parkrun:', proxyError);
                    return res.status(500).json({
                        success: false,
                        error: 'Failed to retrieve parkrun data through proxy: ' + proxyError.message
                    });
                }
            } else if (url.includes('athlinks.com')) {
                // Extract event ID and race ID from the URL
                // Look for event ID after 'Event/' in the URL
                const eventMatch = url.match(/\/Event\/(\d+)/);
                const raceIdMatch = url.match(/\/Course\/(\d+)/);
                
                if (!eventMatch || !raceIdMatch) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'Could not find event ID or race ID in URL' 
                    });
                }

                const eventId = eventMatch[1];
                const raceId = raceIdMatch[1];

                // Make multiple requests to Athlinks API to get all results
                let allResults = [];
                let from = 0;
                const limit = 100; // Increased limit per request for efficiency
                let hasMoreResults = true;
                let firstResponse = null;
                

                while (hasMoreResults) {
                    try {
                        const response = await axios.get(`https://reignite-api.athlinks.com/event/${eventId}/race/${raceId}/results?from=${from}&limit=${limit}`, {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                                'Accept': 'application/json',
                                'Accept-Language': 'en-US,en;q=0.5',
                                'Connection': 'keep-alive'
                            }
                        });

                        // Store first response for race info
                        if (!firstResponse) {
                            firstResponse = response;
                        }

                        const raceData = response.data;
                        if (!raceData) {
                            return res.status(400).json({ 
                                success: false, 
                                error: 'No results found in the API response' + from + " " +limit 
                            });
                        }
                        if (raceData.intervals && raceData.intervals[0] && raceData.intervals[0].results){
                            const results = raceData.intervals[0].results;
                            if (results.length === 0) {
                                hasMoreResults = false;
                            } else {
                                allResults = allResults.concat(results);
                                // console.log(allResults.length);
                                from += limit;
                            }
                        }else{
                            hasMoreResults = false;
                        }
                       
                    } catch (error) {
                        console.error('Error fetching results:', error);
                        return res.status(500).json({
                            success: false,
                            error: 'Failed to fetch results: ' + error.message
                        });
                    }
                }

                if (allResults.length === 0) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'No results found in the API response' 
                    });
                }

                // Extract race info from the first response
                const raceInfo = firstResponse.data.intervals[0];
                const pageTitle = firstResponse.data.race.name;
                const raceDate = new Date(allResults[0].startTimeInMillis);
                const totalAthletes = firstResponse.data.division.totalAthletes;

                // Transform the accumulated results data
                const data = await Promise.all(allResults.map(async result => {
                    // Convert milliseconds to HH:MM:SS format
                    const timeInSeconds = result.chipTimeInMillis / 1000;
                    const hours = Math.floor(timeInSeconds / 3600);
                    const minutes = Math.floor((timeInSeconds % 3600) / 60);
                    const seconds = Math.ceil(timeInSeconds % 60);
                    const time = hours > 0 
                        ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
                        : `${minutes}:${seconds.toString().padStart(2, '0')}`;

                    // If this is a club member, fetch their individual result
                    // let additionalInfo = {};
                    // if (result.displayName === "Nicolas Crouzier" && result.id) {
                    //     try {
                    //         console.log(`https://reignite-api.athlinks.com/azp/ctlive/event/${eventId}/entry/${result.id}`);
                    //         const individualResponse = await axios.get(`https://reignite-api.athlinks.com/azp/ctlive/event/${eventId}/entry/${result.id}`, {
                    //             headers: {
                    //                 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    //                 'Accept': 'application/json',
                    //                 'Accept-Language': 'en-US,en;q=0.5',
                    //                 'Connection': 'keep-alive'
                    //             }
                    //         });
                            
                    //         if (individualResponse.data) {
                    //             additionalInfo = {
                    //                 'Division Total': individualResponse.data.divisions[2] || '',
                    //             };
                    //             console.log(individualResponse.data);
                    //         }
                    //     } catch (error) {
                    //         console.error('Error fetching individual result:', error);
                    //     }
                    // }

                    return {
                        'Place': result.rankings.overall,
                        'Name': result.displayName,
                        'Gender': result.gender,
                        'Age': result.age,
                        'Bib': result.bib,
                        'Time': time,
                        'Gender Place': result.rankings.gender,
                        'Division Place': result.rankings.primary
                        // ...additionalInfo
                    };
                }));

                // Update headers to include any additional fields we found
                const headers = [
                    'Place', 'Name', 'Gender', 'Age', 'Bib', 'Time', 'Gender Place', 'Division Place', 'Division Total'
                ];
                
                // Add any additional headers we found in the data
                if (data.length > 0) {
                    Object.keys(data[0]).forEach(key => {
                        if (!headers.includes(key)) {
                            headers.push(key);
                        }
                    });
                }

                res.json({
                    success: true,
                    headers: headers,
                    data: data,
                    pageTitle: pageTitle,
                    raceDate: raceDate,
                    raceInfo: {
                        name: firstResponse.data.race.name,
                        distance: {
                            meters: raceInfo.distance.meters,
                            units: raceInfo.distance.units
                        },
                        totalAthletes: totalAthletes
                    }
                });
            } else {
                // Original MCRRC parsing logic or any other compatible (unlikely)
                const response = await axios.get(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5',
                        'Connection': 'keep-alive',
                        'Upgrade-Insecure-Requests': '1'
                    }
                });
                const $ = cheerio.load(response.data);
                
                // Extract page title
                const pageTitle = $('title').text().trim();

                // Common table selectors
                const tableSelectors = [
                    'table.results-table',  // Common for results tables
                    'table.table',          // Bootstrap tables
                    'table.dataTable',      // DataTables
                    'table.sortable',       // Sortable tables
                    'table.grid',           // Grid tables
                    'table',                // Any table as last resort
                    'div.table',            // Some sites use div with table class
                    'div.results'           // Some sites use div for results
                ];

                let table = null;
                let headers = [];
                let data = [];

                // Try each selector until we find a working one
                for (const selector of tableSelectors) {
                    const element = $(selector).first();
                    if (element.length) {
                        // Try to extract headers - be more strict about what constitutes a header
                        const potentialHeaders = [];
                        const headerRow = element.find('thead tr, tr:first-child').first();
                        
                        // Only process if we found a header row
                        if (headerRow.length) {
                            // Get all cells from the header row, whether they are th or td
                            headerRow.find('th, td').each(function() {
                                const headerText = $(this).text().trim();
                                // Only add if it looks like a header (not empty and not a number)
                                if (headerText && !/^\d+$/.test(headerText)) {
                                    potentialHeaders.push(headerText);
                                }
                            });
                        }

                        // If we found valid headers, try to extract data
                        if (potentialHeaders.length > 0) {
                            const potentialData = [];
                            // Check if header row uses td elements
                            const headerUsesTd = headerRow.find('td').length > 0;
                            
                            // Skip the header row when getting data
                            element.find('tbody tr, tr:not(:first-child)').each(function() {
                                // If header uses td, skip the first row of data as it's the header
                                if (headerUsesTd && $(this).is(':first-child')) {
                                    return;
                                }
                                
                                const row = {};
                                $(this).find('td').each(function(index) {
                                    if (potentialHeaders[index]) {
                                        row[potentialHeaders[index]] = $(this).text().trim();
                                    }
                                });
                                if (Object.keys(row).length > 0) {
                                    potentialData.push(row);
                                }
                            });

                            // If we found both headers and data, use this table
                            if (potentialData.length > 0) {
                                table = element;
                                headers = potentialHeaders;
                                data = potentialData;
                                break;
                            }
                        }
                    }
                }

                if (!table || headers.length === 0 || data.length === 0) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'No valid results table found on the page'
                    });
                }

                res.json({
                    success: true,
                    headers: headers,
                    data: data,
                    pageTitle: pageTitle
                });
            }
        } catch (error) {
            console.error('Error extracting table:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to extract table data: ' + error.message
            });
        }
    });

    app.get('*', function(req, res) { 
        const isDev = process.env.NODE_ENV !== 'production';
        // console.log('Request URL:', req.url);
        // console.log('Request headers:', req.headers.host);
        // console.log('NODE_ENV:', process.env.NODE_ENV);
        res.render('index.ejs', {
            user: req.user,
            scriptPath: isDev ? '/dist/js/app.js' : '/dist/js/app.min.js'
        });
    });

    app.post('/api/extract-parkrun', service.isAdminLoggedIn, async function(req, res) {
        try {
            const { htmlSource } = req.body;
            
            if (!htmlSource) {
                return res.status(400).json({ success: false, error: 'HTML source is required' });
            }

            // Process the HTML source directly
            const $ = cheerio.load(htmlSource);
            
            // Extract page title from Results-header
            const resultsHeader = $('.Results-header h1').text().trim();
            
            // Parse event number and date from h3 spans
            const dateText = $('.Results-header h3 .format-date').text().trim();
            const eventNumber = $('.Results-header h3 span:last-child').text().trim().replace('#', '');
            
            // Convert date from DD/MM/YYYY to Date object
            let raceDate;
            if (dateText) {
                const [day, month, year] = dateText.split('/');
                raceDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            }
            
            const pageTitle = `${resultsHeader} #${eventNumber}`;

            // Try different table selectors
            let table = null;
            let headers = [];
            let data = [];

            // Parkrun specific table selectors
            const tableSelectors = [
                'table.Results-table',  // Parkrun specific class
                'table.Results',        // Another Parkrun specific class
                'table.results-table',  // Common for results tables
                'table.table',          // Bootstrap tables
                'table.dataTable',      // DataTables
                'table.sortable',       // Sortable tables
                'table.grid',           // Grid tables
                'table',                // Any table as last resort
                'div.table',            // Some sites use div with table class
                'div.results'           // Some sites use div for results
            ];

            // Try each selector until we find a working one
            for (const selector of tableSelectors) {
                const element = $(selector).first();
                if (element.length) {
                    // Try to extract headers - be more strict about what constitutes a header
                    const potentialHeaders = [];
                    const headerRow = element.find('thead tr, tr:first-child').first();
                    
                    // Only process if we found a header row
                    if (headerRow.length) {
                        // Get all cells from the header row, whether they are th or td
                        headerRow.find('th, td').each(function() {
                            const headerText = $(this).text().trim();
                            // Only add if it looks like a header (not empty and not a number)
                            if (headerText && !/^\d+$/.test(headerText)) {
                                potentialHeaders.push(headerText);
                            }
                        });
                    }

                    // If we found valid headers, try to extract data
                    if (potentialHeaders.length > 0) {
                        const potentialData = [];
                        // Skip the header row when getting data
                        element.find('tbody tr, tr:not(:first-child)').each(function() {
                            const row = {};
                            $(this).find('td').each(function(index) {
                                if (potentialHeaders[index]) {
                                    row[potentialHeaders[index]] = $(this).text().trim();
                                }
                            });
                            if (Object.keys(row).length > 0) {
                                potentialData.push(row);
                            }
                        });

                        // If we found both headers and data, use this table
                        if (potentialData.length > 0) {
                            table = element;
                            headers = potentialHeaders;
                            data = potentialData;
                            break;
                        }
                    }
                }
            }

            if (!table || headers.length === 0 || data.length === 0) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'No valid results table found in the provided content. Tried selectors: ' + tableSelectors.join(', ') 
                });
            }

            res.json({
                success: true,
                headers: headers,
                data: data,
                pageTitle: pageTitle,
                raceDate: raceDate
            });

        } catch (error) {
            console.error('Error extracting Parkrun table:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to extract table data: ' + error.message
            });
        }
    });


};





