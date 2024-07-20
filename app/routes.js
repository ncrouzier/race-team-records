const mongoose = require('mongoose');
const member = require('./models/member');
const { query } = require('express');
const path = require("path");

module.exports = async function(app, qs, passport, async, _) {

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
    // app.get('/api/signup', function(req, res) {
    //     console.log("caca");
    //     // render the page and pass in any flash data if it exists
    //     res.send({
    //         message: req.flash('signupMessage')
    //     });
    // });

    app.post('/api/signup', function(req, res, next) {
        passport.authenticate('local-signup', function(err, user, info) {
            console.log(err);
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
    app.get('/api/profile', isLoggedIn, function(req, res) {
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
   
  

    // get a member
    app.get('/api/systeminfos/:name', async function(req, res) {
        try{
            SystemInfo.findOne({
                name: req.params.name
            }).then(systeminfo => {
                if (systeminfo) {
                    res.json(systeminfo);
                }
            });
        }catch (err){
            res.send(err);
        }
    });

    // =====================================
    // TEAM MEMBERS ========================
    // =====================================


    //get all members
    app.get('/api/members', function(req, res) {
        const filters = req.query.filters;
        const sort = req.query.sort;
        const limit = parseInt(req.query.limit);
        const select = req.query.select;

        let query = Member.find();
        if (filters) { 
            if (filters.category) {
                const datetobemaster = getAddDateToDate(new Date(), -40, 0, 0);
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
            Member.findOne({
                _id: req.params.member_id
            }).then(member =>{    
                if (member) {
                    res.json(member);
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
            pbs.sort(sortResultsByDistance);
            res.json(pbs);
        });
    });

    // create member
    app.post('/api/members', isAdminLoggedIn, function(req, res) {
        res.setHeader("Content-Type", "application/json");
        // create a member, information comes from AJAX request from Angular
        Member.create({
            firstname: req.body.firstname,
            lastname: req.body.lastname,
            dateofbirth: req.body.dateofbirth,
            sex: req.body.sex,
            bio: req.body.bio,
            pictureLink: req.body.pictureLink,
            memberStatus: req.body.memberStatus,
            membershipDates: req.body.membershipDates,
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
        res.setHeader("Content-Type", "application/json");
        try{
            Member.findById(req.params.member_id).then(member=> {
                member.firstname = req.body.firstname;
                member.lastname = req.body.lastname;
                member.dateofbirth = req.body.dateofbirth;
                member.sex = req.body.sex;
                member.bio = req.body.bio;
                member.pictureLink = req.body.pictureLink;
                member.memberStatus = req.body.memberStatus;
                member.membershipDates = req.body.membershipDates;
                try{
                    member.save().then(() => {       
                        try{
                            Result.find({'members._id': member._id}).then(results => {                                
                                for (const resultElement of results) {
                                    for (const memberElement of resultElement.members) { //itirates members if relay race
                                        if (memberElement._id.equals(req.body._id)) {
                                            memberElement.firstname = req.body.firstname;
                                            memberElement.lastname = req.body.lastname;
                                            memberElement.sex = req.body.sex;
                                            memberElement.dateofbirth = req.body.dateofbirth;
                                        }
                                    }
                                    try {
                                        resultElement.save().then(()=> {});
                                    }catch(resultsiSaveErr){
                                        console.log(resultsiSaveErr);
                                        res.send(resultsiSaveErr);
                                    }
                                    

                                }
                                res.end('{"success" : "Member updated successfully", "status" : 200}');                                
                            });  
                        }catch(ResultFindErr){
                            console.log(ResultFindErr);
                            res.send(ResultFindErr);
                        }                                                  
                    });
                }catch(memberSaveErr){
                    console.log(memberSaveErr);
                    res.send(memberSaveErr);
                }
                
            });
        }catch(MemberFindByIdErr){
            res.send(MemberFindByIdErr);
        }
        



    });


    // delete a member
    app.delete('/api/members/:member_id', isAdminLoggedIn, function(req, res) {
        try{
            Member.deleteOne({
                _id: req.params.member_id
            }).then(deleteResult => {               
                if (deleteResult.deletedCount === 1){
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
                                if (!containsMember(filteredResult, results[i].members[0])) {
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
            res.json(await Result.findOne(req.params.result_id));
        }catch(err){
            res.send(err);
        }
    });


    // create a result
    app.post('/api/results', isAdminLoggedIn, async function(req, res) {

        let members = [];
        for (const member of req.body.members) {
            members.push({
                _id: member._id,
                firstname: member.firstname,
                lastname: member.lastname,
                sex: member.sex,
                dateofbirth: member.dateofbirth
            });
        }


        try{  
            const ag = await getAgeGrading(members[0].sex.toLowerCase(),
                calculateAge(req.body.race.racedate,members[0].dateofbirth),
                req.body.race.racetype.surface,
                req.body.race.racedate);
          

            let agegrade;
            if (ag && members.length === 1 && !req.body.race.isMultisport && req.body.isRecordEligible) { //do not deal with multiple racers
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
                            }).then(r => {          
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
                                            await postResultsave(member);   
                                        }              
                                        resultWithPBsAndAchievements = await Result.findById(result._id);                                 
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
                                    await postResultsave(member);   
                                }                                   
                                resultWithPBsAndAchievements = await Result.findById(result._id);                                 
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
            console.log("error fetching agegrading")
        }
        

    });

   


    //update a result
    app.put('/api/results/:result_id', isAdminLoggedIn, async function(req, res) {

        let members = [];
        for (const member of req.body.members) {
            members.push({
                _id: member._id,
                firstname: member.firstname,
                lastname: member.lastname,
                sex: member.sex,
                dateofbirth: member.dateofbirth
            });
        }

        try{
            const ag = await getAgeGrading(members[0].sex.toLowerCase(),
                calculateAge(req.body.race.racedate, members[0].dateofbirth),
                req.body.race.racetype.surface,
                req.body.race.racedate);
        
            let agegrade;            
            if (ag && members.length === 1 && !req.body.race.isMultisport  && req.body.isRecordEligible) { //do not deal with multiple racers
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
                            postResultsave(member);   
                        }                       
                        resultWithPBsAndAchievements = await Result.findById(result._id);                                 
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
                    postResultsave(member);   
                }
                resultWithPBsAndAchievements = await Result.findById(result._id);                                 
                res.json(resultWithPBsAndAchievements);                 
            }                    
                                         
        }catch(err){
            console.log("error updating result", err)
        }
        

    });


    // delete a result
    app.delete('/api/results/:result_id', isAdminLoggedIn, function(req, res) {
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
                            console.log('updating after delete');
                            for (let m of members) {
                                let member = await Member.findById(m._id);    
                                postResultsave(member);   
                            }                                               
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
                $addFields: { 
                    count: { "$size": "$results"  }
                  }
              }
        ]);



        // let query = Result.aggregate([

        //     {
        //         $project: {
        //             race: '$race', // we need this field
        //             legs: '$legs',
        //             members: {
        //                 members: '$members',
        //                 time: '$time',
        //                 agegrade: '$agegrade',
        //                 category: '$category',
        //                 resultlink: '$resultlink',
        //                 ranking: '$ranking',
        //                 result_id: '$_id',
        //                 legs: '$legs',
        //                 achievements: '$achievements',
        //                 customOptions: '$customOptions'
        //             },
                    
        //         }
        //     }, {
        //         $unwind: "$members"

        //     }, {
        //         $group: {
        //             _id: '$race._id',
        //             // racename: { $first: '$race.racename' },
        //             // distanceName: {$first: '$race.distanceName' },
        //             // racedate: { $first: '$race.racedate' },
        //             // racetype: { $first: '$race.racetype' },
        //             race: { $first: '$race' },
        //             results: { $addToSet: '$members' },
        //             count: { $sum: 1 }
        //         }
        //     }
        // ]);

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



    // =====================================
    // ACHIEVEMENTS ========================
    // =====================================
    /*
    //old 
    app.get('/updateResults', isAdminLoggedIn, async function(req, res) {
        res.json( 'deprecated');
        let query = Result.find();

        let results = await query.exec();
        if (results) {
                let numberOfUpdates = 0;
                let numberOfCreated = 0;

                async.forEachOfSeries(results, function(result, key, callback) {
                    if (result.racename !== undefined && result.racedate !== undefined && result.racetype !== undefined) { // only take care of old model
                        async.waterfall([
                            function(callback) {
                                Race.findOne({
                                    'racename': result.racename,
                                    'racedate': result.racedate,
                                    'racetype._id': result.racetype._id
                                }, function(err, race) {
                                    if (err) {
                                        callback(err);
                                    } else {
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
                                } else {
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
                        ], function(err) {
                            if (err) {
                                console.error(err.message);
                            } else {
                                callback(); //foreach
                                // console.log('done');
                            }
                        });
                    } else {
                        callback();
                    }
                }, function(err) {
                    if (err) {
                        console.error(err.message);
                    }
                    res.json({ 'numberOfUpdates': numberOfUpdates, 'numberOfCreated': numberOfCreated });

                });

        }
    });
    */


// update agegrade
app.get('/updateAgeGrade', isAdminLoggedIn, async function(req, res) {
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
                const ag = await getAgeGrading(res.members[0].sex.toLowerCase(),
                    calculateAge(res.race.racedate,res.members[0].dateofbirth),
                    res.race.racetype.surface,
                    res.race.racedate
                );
                                                                       
                    if (ag && res.members.length === 1 && !res.race.isMultisport && res.isRecordEligible) { //do not deal with multiple racers
                        if (ag[res.race.racetype.name.toLowerCase()] !== undefined) {                            
                            const agegrade = (ag[res.race.racetype.name.toLowerCase()] / (res.time / 100) * 100).toFixed(2);          
                             if (res.agegrade- agegrade > maxDiff){
                                maxDiff = res.agegrade-agegrade;
                                console.log(res.race.racedate,res.race.racename,res.members[0].firstname + ' ' + res.members[0].lastname, res.agegrade, agegrade, maxDiff);
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
                res.json({ 'numberOfUpdates': numberOfUpdates,
                    'differences' : diffrenceArray
                });

        }
});




//update all achievements
app.get('/updateAchievements', isAdminLoggedIn, async function(req, res) {
    res.setHeader("Content-Type", "application/json");
    try{
        let memberQuery = Member.find();
        memberQuery = memberQuery.sort("lastname");
        let achievements = [];
        memberQuery.exec().then(async members => { 
            for (const member of members) {                        
                achievements.push({
                    "member": member.firstname + " " + member.lastname,
                    "achievements": await updateAchievements(member)
                });            
            }
            res.end('{"success" : "Achievements updated successfully", "status" : 200 , "achievements" : '+JSON.stringify(achievements)+'}');
        });
        
    }catch(err){
        res.end('{"success" : "Achievements not updated", "status" : 500, "error" : "'+err+'"}');
    }
    
});

// update all pbs
app.get('/updatePbs', isAdminLoggedIn, async function(req, res) {
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
                res.end('{"success" : "Pbs updated successfully", "status" : 200 , "achievements" : '+JSON.stringify(pbs)+'}');
            }            
    });

    }catch(err){
        res.end('{"success" : "Pbs not updated", "status" : 500, "error" : "'+err+'"}');
    }
});

app.get('/updatePBsandAchivements', isAdminLoggedIn, async function(req, res) {
    res.setHeader("Content-Type", "application/json");
    try{
        const clear = ((req.query.clear+'').toLowerCase() === 'true')
        let memberQuery = Member.find();
        memberQuery = memberQuery.sort("lastname");
        let pbs = [];
        memberQuery.exec().then(async members => {            
                if (members) {                
                    for (let member of members) {
                        pbs.push({
                            "member": member.firstname + " " + member.lastname,
                            "results": await updatePBsandAchivements(member, clear)
                        });                           
                    }
                    res.end('{"success" : "Pbs updated successfully", "status" : 200 , "achievements" : '+JSON.stringify(pbs)+'}');
                }            
        });

    }catch(err){
        res.end('{"success" : "Pbs not updated", "status" : 500, "error" : "'+err+'"}');
    }
});





async function postResultsave(member){
    await updatePBsandAchivements(member);
    // await updatePBs(member);
    // await updateAchievements(member);
}

async function updatePBsandAchivements(member,clear){
    let returnRes = [];
    let bestAG = 0;
    let numberOfSaves = 0;
    const pbDistances = ["400m", "800m", "1500m","1 mile","2 miles","5k", "5000m", "4 miles",
    "5 miles","8k", "10k","10000m", "10 miles", "Half Marathon", "20 miles",
    "Marathon","50k", "50 miles", "100k", "100 miles"];
    const pbSurfaces = ["road", "track", "ultra", "cross country"];
    const raceNumber = [1, 10, 25, 50, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300, 325, 350, 375, 400, 425, 450, 475, 500, 525, 550, 575, 600, 625, 650, 675, 700, 725, 750, 775, 800, 825, 850, 875, 900, 925, 950, 975, 1000];

    if(clear){
        //remove all non manual entries
        for (let i = 0; i < member.personalBests.length; i++) {            
            if (member.personalBests[i].source === "computed") {               
                member.personalBests.splice(i,1);
                i--;
            }
        }
    }
    let tmpPersonalBests = [];

    //get all results for this member
    let resultquery = Result.find({
        'members': {$elemMatch: { _id: member._id}}
    });
    resultquery.sort('race.racedate race.order'); 
    const results = await resultquery.exec();
    let index= 0;
    for(let result of results){ 
        let resModification = false;
        if(clear){
            if(result.achievements.findIndex(item => (item.name === "pb" && item.value.memberId && item.value.memberId.equals(member._id))) > -1){
                result.achievements = result.achievements.filter(item => !(item.name === "pb" && item.value.memberId && item.value.memberId.equals(member._id)));                                
                // console.log("resModification");
                resModification = true;
            }
            if(result.achievements.findIndex(item => (item.name === "raceCount" && item.value.memberId && item.value.memberId.equals(member._id))) > -1){
                result.achievements = result.achievements.filter(item => !(item.name === "raceCount" && item.value.memberId && item.value.memberId.equals(member._id)));                                
                // console.log("resModification2");
                resModification = true;
            }
        }
        //check if this result is a race count milestone
        if (raceNumber.find(num => num ===index+1)){ 

            let ind = result.achievements.findIndex(item => (item.name === "raceCount" && item.value.memberId && item.value.memberId.equals(member._id)));
             //if the member already have the achievement and is different from the current result, we update
            if (ind !== -1 && result.achievements[ind].value.raceCount !== index+1 ){
                result.achievements[ind]={
                    name:"raceCount",
                    text:member.firstname+"'s "+addOrdinalSuffix(index+1)+" race with the team!",
                    value: {raceCount:index+1,memberId: new mongoose.Types.ObjectId(member._id)}
                };
                returnRes.push(result.race.racename+" is "+ member.firstname+"'s "+addOrdinalSuffix(index+1)+" race with the team!");
                // console.log("resModification3");
                resModification = true;
            }else if(ind === -1 ){ //if we have no raceCount achievements
                result.achievements.push({
                    name:"raceCount",
                    text:member.firstname+"'s "+addOrdinalSuffix(index+1)+" race with the team!",
                    value: {raceCount:index+1,memberId: new mongoose.Types.ObjectId(member._id)}
                });     
                returnRes.push(result.race.racename+" is "+ member.firstname+"'s "+addOrdinalSuffix(index+1)+" race with the team!");  
                // console.log("resModification4");
                resModification = true;   
            }
        }else {
            //result is not a race count milestone            
            if (result.achievements){
                //we remove raceCount miletone info if it's related to the current member
                let ind = result.achievements.findIndex(item => (item.name === "raceCount" && item.value.memberId && item.value.memberId.equals(member._id)));                                
                if (ind !== -1){
                    result.achievements.splice(ind,1);                
                    resModification = true;
                }    
            }            
        }// end of if is a race count milestone check

        //now dealing with personal bests
        if(result.isRecordEligible && result.members.length === 1 && pbDistances.includes(result.race.racetype.name) && pbSurfaces.includes(result.race.racetype.surface)){

            //Does the pb entry for this distance and surface already exist?
            let index = tmpPersonalBests.findIndex(r => (r.name === result.race.racetype.name && r.surface === result.race.racetype.surface && r.source === "computed"));
            if (index > -1 ) {
                //if it exists and the time is better, we update it
                if (result.time <= tmpPersonalBests[index].time) {
                    tmpPersonalBests[index] = {
                        result: result,
                        name: result.race.racetype.name,
                        surface: result.race.racetype.surface,
                        distance: result.race.racetype.meters,
                        time: result.time,
                        source: "computed"
                    }                                   
                    

                    //result PB achievement
                    let ind = result.achievements.findIndex(item => (item.name === "pb" && item.value.memberId && item.value.memberId.equals(member._id)));
                    //if achievement exists we update it if needed                 
                    if (ind !== -1){
                        if(result.achievements[ind].value.time != result.time){
                            result.achievements[ind]={
                                name:"pb",
                                text:member.firstname+"'s new "+result.race.racetype.name+" ("+getSurfaceText(result.race.racetype.surface)+") personal best with the team!",
                                value: {time:result.time,memberId: new mongoose.Types.ObjectId(member._id)}
                            };
                            returnRes.push("New "+result.race.racetype.name+" ("+getSurfaceText(result.race.racetype.surface)+") PB at "+result.race.racename +"!");   
                            // console.log("resModification5");
                            resModification = true;
                        }                        
                    }else{ //otherwise we add it
                        result.achievements.push({
                            name:"pb",
                            text:member.firstname+"'s new "+result.race.racetype.name+" ("+getSurfaceText(result.race.racetype.surface)+") personal best with the team!",
                            value: {time:result.time,memberId: new mongoose.Types.ObjectId(member._id)}
                        });
                        returnRes.push("New "+result.race.racetype.name+" ("+getSurfaceText(result.race.racetype.surface)+") PB at "+result.race.racename +"!");   
                        // console.log("resModification6");
                        resModification = true;
                    }                    
                }else{
                    //if it exists and the time is worse, we remove it
                    if (result.achievements){
                        if(result.achievements.findIndex(item => (item.name === "pb" && item.value.memberId && item.value.memberId.equals(member._id))) > -1){
                            result.achievements = result.achievements.filter(item => !(item.name === "pb" && item.value.memberId && item.value.memberId.equals(member._id)));                                
                            // console.log("resModification7 removed",member.firstname," ", result.race.racename );
                            resModification = true;
                        }
                    } 
                }
            }else{
                // the member PB entry doesn't exist, we create it (time is always better than no PB)
                tmpPersonalBests.push({
                    result: result,
                    name: result.race.racetype.name,
                    surface: result.race.racetype.surface,
                    distance: result.race.racetype.meters,
                    time: result.time,
                    source: "computed"
                })

                //result PB achievement
                let ind = result.achievements.findIndex(item => (item.name === "pb" && item.value.memberId && item.value.memberId.equals(member._id)));
                //if achievement exists we update it                    
                if (ind !== -1 ){
                    if(result.achievements[ind].value.time != result.time){
                        result.achievements[ind]={
                            name:"pb",
                            text:member.firstname+"'s new "+result.race.racetype.name+" ("+getSurfaceText(result.race.racetype.surface)+") personal best with the team!",
                            value: {time:result.time,memberId: new mongoose.Types.ObjectId(member._id)}
                        };
                        returnRes.push("New "+result.race.racetype.name+" ("+getSurfaceText(result.race.racetype.surface)+") PB at "+result.race.racename +"!");   
                        // console.log("resModification8");
                        resModification = true;
                    }
                }else{ //otherwise we add it
                    result.achievements.push({
                        name:"pb",
                        text:member.firstname+"'s new "+result.race.racetype.name+" ("+getSurfaceText(result.race.racetype.surface)+") personal best with the team!",
                        value: {time:result.time,memberId: new mongoose.Types.ObjectId(member._id)}
                    });
                    returnRes.push("New "+result.race.racetype.name+" ("+getSurfaceText(result.race.racetype.surface)+") PB at "+result.race.racename +"!");   
                    // console.log("resModification9");
                    resModification = true;
                }  
                // resModification = true;
                // returnRes.push("New "+res.race.racetype.name+" ("+getSurfaceText(res.race.racetype.surface)+") PB at "+res.race.racename +"!");   
            }//end with pb 
        }




        if(result.agegrade && result.isRecordEligible){
             //Does the agregrade entry ?
            let agInd = result.achievements.findIndex(item => (item.name === "agegrade"))
            if (agInd !== -1){          
                //update          
                if(result.agegrade > bestAG){   
                    bestAG = result.agegrade;
                    if(result.achievements[agInd].value !== result.agegrade){                        
                        result.achievements[agInd]={
                            name:"agegrade",
                            text:member.firstname+"'s best age graded result with the team! " + result.agegrade + "%" ,
                            value: result.agegrade
                        };
                        returnRes.push(result.race.racename+" is "+member.firstname+"'s best age graded result with the team! " + result.agegrade + "%"); 
                        // console.log("resModification10");
                        resModification = true;
                    }                                                                      
                }else if (result.agegrade < bestAG){
                    //we remove it if it's not accurate anymore
                    result.achievements.splice(agInd,1);  
                    // console.log("resModification11");
                    resModification = true;
                }else{
                    //we don't do anything if the agegrade is the same
                }
                
            }else{
                //add   
                if(result.agegrade > bestAG ){                
                    bestAG = result.agegrade;
                    result.achievements.push({
                        name:"agegrade",
                        text:member.firstname+"'s best age graded result with the team! " + result.agegrade + "%" ,
                        value: result.agegrade
                    });                  
                    returnRes.push(result.race.racename+" is "+member.firstname+"'s best age graded result with the team! " + result.agegrade + "%");   
                    // console.log("resModification12");
                    resModification = true;
                }
            }
        }

        if(resModification){
            await result.save();
            numberOfSaves++;
        }
        index++;
    }
    member.personalBests=tmpPersonalBests;
    await member.save();
    return {"Number of saves": numberOfSaves, "Results": returnRes}; //returnRes;
}




async function updatePBs(member){
    //const pbDistances = ["1 mile","5k","5 miles", "8k", "10k", "10 miles", "Half Marathon","Marathon","50K", "100k", "100 miles"];
    const pbDistances = ["400m", "800m", "1500m","1 mile","2 miles","5k", "5000m", "4 miles",
                         "5 miles","8k", "10k","10000m", "10 miles", "Half Marathon", "20 miles",
                         "Marathon","50k", "50 miles", "100k", "100 miles"];
    let returnRes = [];
    //remove all non manual entries
    for (let i = 0; i < member.personalBests.length; i++) {
        if (member.personalBests[i].source === "computed") {
            member.personalBests.splice(i,1);
        }
      }

    let resultquery = Result.find({
        'members._id': member._id
    });
    resultquery.and({"race.racetype.name":{ $in : pbDistances}});
    resultquery.and({"race.racetype.surface":{ $in : ["road", "track", "ultra", "cross country"]}}); //don't deal with swim or multi sports
    resultquery.and({"$expr": {"$eq": [{$size: "$members"},1]}}); // only deal with single members
    resultquery.sort('race.racedate race.order');                        
     let results = await resultquery.exec()
        if (results){
            let resModification = false;
            for(let res of results){                                    
                //we clear all pb achievements for this member
                if(res.achievements.findIndex(item => (item.name === "pb" && item.value.memberId && item.value.memberId.equals(member._id))) > -1){
                    res.achievements = res.achievements.filter(item => !(item.name === "pb" && item.value.memberId && item.value.memberId.equals(member._id)));                                
                    resModification = true;
                }
                
                // console.log(res.achievements);
                // res.achievements.splice(ind,1);               

                if(res.isRecordEligible){                
                    //version where we don't mix surfaces
                    const index = member.personalBests.findIndex(r => (r.name === res.race.racetype.name && r.surface === res.race.racetype.surface));
                    // const index = member.personalBests.findIndex(r => (r.name === res.race.racetype.name) )
                    //pb entry exists?
                    if (index > -1 ) {
                        //if it exists we update it
                        if (res.time <= member.personalBests[index].time) {

                            member.personalBests[index] = {
                                result: res,
                                name: res.race.racetype.name,
                                surface: res.race.racetype.surface,
                                distance: res.race.racetype.meters,
                                time: res.time,
                                source: "computed"
                            }
                            // console.log("updated pb",member.firstname, res.race.racename);
                            res.achievements.push({
                                name:"pb",
                                text:member.firstname+"'s new "+res.race.racetype.name+" ("+getSurfaceText(res.race.racetype.surface)+") personal best with the team!",
                                value: {time:res.time,memberId: new mongoose.Types.ObjectId(member._id)}
                            });
                            resModification = true;
                            returnRes.push("New "+res.race.racetype.name+" ("+getSurfaceText(res.race.racetype.surface)+") PB at "+res.race.racename +"!");   
                        }                                                                            
                    }else{
                        // if not we create it
                        member.personalBests.push({
                            result: res,
                            name: res.race.racetype.name,
                            surface: res.race.racetype.surface,
                            distance: res.race.racetype.meters,
                            time: res.time,
                            source: "computed"
                        })
                        // console.log("new pb",member.firstname,res.race.racename);
                        res.achievements.push({
                            name:"pb",
                            text:member.firstname+"'s new "+res.race.racetype.name+" ("+getSurfaceText(res.race.racetype.surface)+") personal best with the team!",
                            value: {time:res.time,memberId: new mongoose.Types.ObjectId(member._id)}
                        });  
                        resModification = true;
                        returnRes.push("New "+res.race.racetype.name+" ("+getSurfaceText(res.race.racetype.surface)+") PB at "+res.race.racename +"!");   
                    }//end with pb   
                }
                if(resModification){
                    await res.save();
                }
            }                                            
        }                                
    await member.save();
    return returnRes;
}

async function updateAchievements(member){
    // console.log(member.lastname);
    //check if it's a race count milestone
    const raceNumber = [1, 10, 25, 50, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300, 325, 350, 375, 400, 425, 450, 475, 500, 525, 550, 575, 600, 625, 650, 675, 700, 725, 750, 775, 800, 825, 850, 875, 900, 925, 950, 975, 1000];
    let returnRes = [];

    let bestAG = 0;

    let resultquery = Result.find({
        'members': {$elemMatch: { _id: member._id}}
    });

    resultquery.sort('race.racedate race.order'); 
    const results = await resultquery.exec();

    //write code to find index of the element with the same id as result._id
    // const index = results.findIndex(item => item._id === result._id);
    let index= 0;
    for(let result of results){ 
        
        //check for race count achievement
        if (raceNumber.find(num => num ===index+1)){

            let ind = result.achievements.findIndex(item => (item.name === "raceCount" && item.value.memberId && item.value.memberId.equals(member._id)));
            if (ind !== -1){
                //we update                
                result.achievements[ind]={
                    name:"raceCount",
                    text:member.firstname+"'s "+addOrdinalSuffix(index+1)+" race with the team!",
                    value: {raceCount:index+1,memberId: new mongoose.Types.ObjectId(member._id)}
                };
                returnRes.push(result.race.racename+" is "+ member.firstname+"'s "+addOrdinalSuffix(index+1)+" race with the team!");
                // console.log("updated achievement: ",result.race.racename, " ",member.firstname+"'s "+addOrdinalSuffix(index+1)+" race with the team!");
            }else{
                //we add
                result.achievements.push({
                    name:"raceCount",
                    text:member.firstname+"'s "+addOrdinalSuffix(index+1)+" race with the team!",
                    value: {raceCount:index+1,memberId: new mongoose.Types.ObjectId(member._id)}
                });     
                returnRes.push(result.race.racename+" is "+ member.firstname+"'s "+addOrdinalSuffix(index+1)+" race with the team!");                                
                // console.log("added achievement: ",result.race.racename, " ",member.firstname+"'s "+addOrdinalSuffix(index+1)+" race with the team!");
            }            
            // console.log(result);
            // console.log(result.race.racename, " ", result.race.racedate, " ", result.achievements.length)
            await result.save();
        }else {
            if (result.achievements){
                //we remove raceCount info if it's related to the current member
                let ind = result.achievements.findIndex(item => (item.name === "raceCount" && item.value.memberId && item.value.memberId.equals(member._id)));                                
                if (ind !== -1){
                    // console.log("removing ",result.achievements[ind].value.memberId," member._id: ", member._id," from result ", result._id); 
                    result.achievements.splice(ind,1);                
                    await result.save();
                }    
            }            
        }

        //check for age grade achievement
        if(result.agegrade){
            let agInd = result.achievements.findIndex(item => (item.name === "agegrade"))
            if (agInd !== -1){                    
                if(result.agegrade > bestAG && result.isRecordEligible){
                    //update
                    // console.log("update ag for member",member.firstname," ", result.agegrade, "("+bestAG+")");  
                    bestAG = result.agegrade;
                    result.achievements[agInd]={
                        name:"agegrade",
                        text:member.firstname+"'s best age graded result with the team! " + result.agegrade + "%" ,
                        value: result.agegrade
                    };
                    returnRes.push(result.race.racename+" is "+member.firstname+"'s best age graded result with the team! " + result.agegrade + "%"); 
                }else{
                    //we remove it if it's not accurate anymore
                    result.achievements.splice(agInd,1);  
                }
                await result.save();
            }else{
                //add   
                if(result.agegrade > bestAG && result.isRecordEligible){                
                    // console.log("add ag for member",member.firstname," ", result.agegrade, "("+bestAG+")");  
                    bestAG = result.agegrade;
                    result.achievements.push({
                        name:"agegrade",
                        text:member.firstname+"'s best age graded result with the team! " + result.agegrade + "%" ,
                        value: result.agegrade
                    });                  
                    returnRes.push(result.race.racename+" is "+member.firstname+"'s best age graded result with the team! " + result.agegrade + "%");   
                    await result.save();
                }
            }
        }
        
        index++;
    }        
    return returnRes;
} 

app.get('/updateResultsUpdateDatesAndCreatedAt', isAdminLoggedIn, async function(req, res) {
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
        res.end('{"message" : "results updated successfully", "status" : 200 ,  "Results":'+ JSON.stringify(returnRes)+'}');

    }catch(err){
        res.end('{"message" : "results not updated", "status" : 500, "error" : "'+err+'"}');
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
     app.get('/api/stats/participation', function(req, res) {
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
    app.post('/api/racetypes', isAdminLoggedIn, function(req, res) {
        try{
            RaceType.create({
                name: req.body.name,
                surface: req.body.surface,
                meters: req.body.meters,
                miles: req.body.miles,
                isVariable: req.body.isVariable,
                hasAgeGradedInfo: req.body.hasAgeGradedInfo
            }).then(racetype => {              
                    res.end('{"success" : "Result created successfully", "status" : 200}');                    
            });
        }catch(raceTypeErr){
            res.send(raceTypeErr);
        }        
    });

    //update a racetype
    app.put('/api/racetypes/:racetype_id', isAdminLoggedIn, function(req, res) {
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
                                }).then(results => {                                    
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
    app.delete('/api/racetypes/:racetype_id', isAdminLoggedIn, function(req, res) {
        try{
            RaceType.deleteOne({
                _id: req.params.racetype_id
            }, function(err, racetype) {           
                    res.end('{"success" : "Racetype deleted successfully", "status" : 200}');            
            });
        }catch(raceTypedeleteOneErr){
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


    app.get('*', function(req, res) {
        res.render('index.ejs', {
            user: req.user
        }); // load the index.ejs file
    });

    async function getAgeGrading(sex,age,raceSurface,raceDate) {        
        if (raceSurface === "road") {
            if (new Date(raceDate).getFullYear() < 2020) {
                version = "2015";
            }else{
                version = "2020";
            }
        }
        if (raceSurface === "track") {
            if (new Date(raceDate).getFullYear() < 2023) {
                version = "2005";
            }else{                
                version = "2023";
            }
        }
    
        const ag = await AgeGrading.findOne({
            sex: sex,
            type: raceSurface,
            age: age,
            version: version
        });  
       
        return ag;
    }

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
    const resDate = new Date(date);
    resDate.setFullYear(resDate.getFullYear() + years, resDate.getMonth() + months, resDate.getDate() + days);
    return resDate;
}

//get age at race date
function calculateAge(dateofrace, birthday) {
    const rd = new Date(dateofrace);
    const bd = new Date(birthday);
    const ageDifMs = rd.getTime() - bd.getTime();
    const ageDate = new Date(ageDifMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
};

// check if member is in list
function containsMember(list, member) {
    if (list.length == 0) {
        return false;
    }
    for (const memberresultElement of list) {
        if (memberresultElement.members[0]._id.equals(member._id)) {
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

function addOrdinalSuffix(number) {
    if (number % 100 >= 11 && number % 100 <= 13) {
        return number + "th";
    }

    switch (number % 10) {
        case 1:
            return number + "st";
        case 2:
            return number + "nd";
        case 3:
            return number + "rd";
        default:
            return number + "th";
    }
}

function getSurfaceText(surface) {
    const surfaceMap = new Map([
        ['road', 'road'],
        ['track', 'track'],
        ['cross country', 'trail'],
        ['ultra', 'ultra'],
        ['multiple', 'multi sport'],
        ['pool', 'pool'],
        ['open water', 'openwater']
      ]);
      return surfaceMap.get(surface);
}

