const mongoose = require('mongoose');
const member = require('./models/member');
const { query } = require('express');
const path = require("path");
const SystemInfo = require('./models/systeminfo');
const RaceType = require('./models/racetype');
const Member = require('./models/member');
const Result = require('./models/result');
const Race = require('./models/race');
const AgeGrading = require('./models/agegrading');

module.exports = {


    postResultSave: async function (member) {
        await this.updatePBsandAchivements(member);
        await this.updateTeamRequirementStats(member);

    },

    updatePBsandAchivements: async function (member, clear) {
        let returnRes = [];
        let bestAG = 0;
        let numberOfSaves = 0;
        const pbDistances = ["400m", "800m", "1500m", "1 mile", "2 miles", "5k", "5000m", "4 miles",
            "5 miles", "8k", "10k", "10000m", "10 miles", "Half Marathon", "20 miles",
            "Marathon", "50k", "50 miles", "100k", "100 miles"];
        const pbSurfaces = ["road", "track", "ultra", "cross country"];
        const raceNumber = [1, 10, 25, 50, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300, 325, 350, 375, 400, 425, 450, 475, 500, 525, 550, 575, 600, 625, 650, 675, 700, 725, 750, 775, 800, 825, 850, 875, 900, 925, 950, 975, 1000];

        if (clear) {
            //remove all non manual entries
            for (let i = 0; i < member.personalBests.length; i++) {
                if (member.personalBests[i].source === "computed") {
                    member.personalBests.splice(i, 1);
                    i--;
                }
            }
        }
        let tmpPersonalBests = [];

        //get all results for this member
        let resultquery = Result.find({
            'members': { $elemMatch: { _id: member._id } }
        });
        resultquery.sort('race.racedate race.order');
        const results = await resultquery.exec();
        let index = 0;
        for (let result of results) {
            let resModification = false;
            if (clear) {
                if (result.achievements.findIndex(item => (item.name === "pb" && item.value.memberId && item.value.memberId.equals(member._id))) > -1) {
                    result.achievements = result.achievements.filter(item => !(item.name === "pb" && item.value.memberId && item.value.memberId.equals(member._id)));
                    // console.log("resModification");
                    resModification = true;
                }
                if (result.achievements.findIndex(item => (item.name === "raceCount" && item.value.memberId && item.value.memberId.equals(member._id))) > -1) {
                    result.achievements = result.achievements.filter(item => !(item.name === "raceCount" && item.value.memberId && item.value.memberId.equals(member._id)));
                    // console.log("resModification2");
                    resModification = true;
                }
            }
            //check if this result is a race count milestone
            if (raceNumber.find(num => num === index + 1)) {

                let ind = result.achievements.findIndex(item => (item.name === "raceCount" && item.value.memberId && item.value.memberId.equals(member._id)));
                //if the member already have the achievement and is different from the current result, we update
                if (ind !== -1 && result.achievements[ind].value.raceCount !== index + 1) {
                    result.achievements[ind] = {
                        name: "raceCount",
                        text: member.firstname + "'s " + addOrdinalSuffix(index + 1) + " race with the team!",
                        value: { raceCount: index + 1, memberId: new mongoose.Types.ObjectId(member._id) }
                    };
                    returnRes.push(result.race.racename + " is " + member.firstname + "'s " + addOrdinalSuffix(index + 1) + " race with the team!");
                    // console.log("resModification3");
                    resModification = true;
                } else if (ind === -1) { //if we have no raceCount achievements
                    result.achievements.push({
                        name: "raceCount",
                        text: member.firstname + "'s " + addOrdinalSuffix(index + 1) + " race with the team!",
                        value: { raceCount: index + 1, memberId: new mongoose.Types.ObjectId(member._id) }
                    });
                    returnRes.push(result.race.racename + " is " + member.firstname + "'s " + addOrdinalSuffix(index + 1) + " race with the team!");
                    // console.log("resModification4");
                    resModification = true;
                }
            } else {
                //result is not a race count milestone            
                if (result.achievements) {
                    //we remove raceCount miletone info if it's related to the current member
                    let ind = result.achievements.findIndex(item => (item.name === "raceCount" && item.value.memberId && item.value.memberId.equals(member._id)));
                    if (ind !== -1) {
                        result.achievements.splice(ind, 1);
                        resModification = true;
                    }
                }
            }// end of if is a race count milestone check

            //now dealing with personal bests
            if (result.isRecordEligible && result.members.length === 1 && pbDistances.includes(result.race.racetype.name) && pbSurfaces.includes(result.race.racetype.surface)) {

                //Does the pb entry for this distance and surface already exist?
                let index = tmpPersonalBests.findIndex(r => (r.name === result.race.racetype.name && r.surface === result.race.racetype.surface && r.source === "computed"));
                if (index > -1) {
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
                        if (ind !== -1) {
                            if (result.achievements[ind].value.time != result.time) {
                                result.achievements[ind] = {
                                    name: "pb",
                                    text: member.firstname + "'s new " + result.race.racetype.name + " (" + getSurfaceText(result.race.racetype.surface) + ") personal best with the team!",
                                    value: { time: result.time, memberId: new mongoose.Types.ObjectId(member._id) }
                                };
                                returnRes.push("New " + result.race.racetype.name + " (" + getSurfaceText(result.race.racetype.surface) + ") PB at " + result.race.racename + "!");
                                // console.log("resModification5");
                                resModification = true;
                            }
                        } else { //otherwise we add it
                            result.achievements.push({
                                name: "pb",
                                text: member.firstname + "'s new " + result.race.racetype.name + " (" + getSurfaceText(result.race.racetype.surface) + ") personal best with the team!",
                                value: { time: result.time, memberId: new mongoose.Types.ObjectId(member._id) }
                            });
                            returnRes.push("New " + result.race.racetype.name + " (" + getSurfaceText(result.race.racetype.surface) + ") PB at " + result.race.racename + "!");
                            // console.log("resModification6");
                            resModification = true;
                        }
                    } else {
                        //if it exists and the time is worse, we remove it
                        if (result.achievements) {
                            if (result.achievements.findIndex(item => (item.name === "pb" && item.value.memberId && item.value.memberId.equals(member._id))) > -1) {
                                result.achievements = result.achievements.filter(item => !(item.name === "pb" && item.value.memberId && item.value.memberId.equals(member._id)));
                                // console.log("resModification7 removed",member.firstname," ", result.race.racename );
                                resModification = true;
                            }
                        }
                    }
                } else {
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
                    if (ind !== -1) {
                        if (result.achievements[ind].value.time != result.time) {
                            result.achievements[ind] = {
                                name: "pb",
                                text: member.firstname + "'s new " + result.race.racetype.name + " (" + getSurfaceText(result.race.racetype.surface) + ") personal best with the team!",
                                value: { time: result.time, memberId: new mongoose.Types.ObjectId(member._id) }
                            };
                            returnRes.push("New " + result.race.racetype.name + " (" + getSurfaceText(result.race.racetype.surface) + ") PB at " + result.race.racename + "!");
                            // console.log("resModification8");
                            resModification = true;
                        }
                    } else { //otherwise we add it
                        result.achievements.push({
                            name: "pb",
                            text: member.firstname + "'s new " + result.race.racetype.name + " (" + getSurfaceText(result.race.racetype.surface) + ") personal best with the team!",
                            value: { time: result.time, memberId: new mongoose.Types.ObjectId(member._id) }
                        });
                        returnRes.push("New " + result.race.racetype.name + " (" + getSurfaceText(result.race.racetype.surface) + ") PB at " + result.race.racename + "!");
                        // console.log("resModification9");
                        resModification = true;
                    }
                    // resModification = true;
                    // returnRes.push("New "+res.race.racetype.name+" ("+getSurfaceText(res.race.racetype.surface)+") PB at "+res.race.racename +"!");   
                }//end with pb 
            }




            if (result.agegrade && result.isRecordEligible) {
                //Does the agregrade entry ?
                let agInd = result.achievements.findIndex(item => (item.name === "agegrade"))
                if (agInd !== -1) {
                    //update          
                    if (result.agegrade > bestAG) {
                        bestAG = result.agegrade;
                        if (result.achievements[agInd].value !== result.agegrade) {
                            result.achievements[agInd] = {
                                name: "agegrade",
                                text: member.firstname + "'s best age graded result with the team! " + result.agegrade + "%",
                                value: result.agegrade
                            };
                            returnRes.push(result.race.racename + " is " + member.firstname + "'s best age graded result with the team! " + result.agegrade + "%");
                            // console.log("resModification10");
                            resModification = true;
                        }
                    } else if (result.agegrade < bestAG) {
                        //we remove it if it's not accurate anymore
                        result.achievements.splice(agInd, 1);
                        // console.log("resModification11");
                        resModification = true;
                    } else {
                        //we don't do anything if the agegrade is the same
                    }

                } else {
                    //add   
                    if (result.agegrade > bestAG) {
                        bestAG = result.agegrade;
                        result.achievements.push({
                            name: "agegrade",
                            text: member.firstname + "'s best age graded result with the team! " + result.agegrade + "%",
                            value: result.agegrade
                        });
                        returnRes.push(result.race.racename + " is " + member.firstname + "'s best age graded result with the team! " + result.agegrade + "%");
                        // console.log("resModification12");
                        resModification = true;
                    }
                }
            }

            if (resModification) {
                await result.save();
                numberOfSaves++;
            }
            index++;
        }
        member.personalBests = tmpPersonalBests;
        await member.save();
        return { "Number of saves": numberOfSaves, "Results": returnRes }; //returnRes;
    },




    updatePBs: async function (member) {
        //const pbDistances = ["1 mile","5k","5 miles", "8k", "10k", "10 miles", "Half Marathon","Marathon","50K", "100k", "100 miles"];
        const pbDistances = ["400m", "800m", "1500m", "1 mile", "2 miles", "5k", "5000m", "4 miles",
            "5 miles", "8k", "10k", "10000m", "10 miles", "Half Marathon", "20 miles",
            "Marathon", "50k", "50 miles", "100k", "100 miles"];
        let returnRes = [];
        //remove all non manual entries
        for (let i = 0; i < member.personalBests.length; i++) {
            if (member.personalBests[i].source === "computed") {
                member.personalBests.splice(i, 1);
            }
        }

        let resultquery = Result.find({
            'members._id': member._id
        });
        resultquery.and({ "race.racetype.name": { $in: pbDistances } });
        resultquery.and({ "race.racetype.surface": { $in: ["road", "track", "ultra", "cross country"] } }); //don't deal with swim or multi sports
        resultquery.and({ "$expr": { "$eq": [{ $size: "$members" }, 1] } }); // only deal with single members
        resultquery.sort('race.racedate race.order');
        let results = await resultquery.exec()
        if (results) {
            let resModification = false;
            for (let res of results) {
                //we clear all pb achievements for this member
                if (res.achievements.findIndex(item => (item.name === "pb" && item.value.memberId && item.value.memberId.equals(member._id))) > -1) {
                    res.achievements = res.achievements.filter(item => !(item.name === "pb" && item.value.memberId && item.value.memberId.equals(member._id)));
                    resModification = true;
                }

                // console.log(res.achievements);
                // res.achievements.splice(ind,1);               

                if (res.isRecordEligible) {
                    //version where we don't mix surfaces
                    const index = member.personalBests.findIndex(r => (r.name === res.race.racetype.name && r.surface === res.race.racetype.surface));
                    // const index = member.personalBests.findIndex(r => (r.name === res.race.racetype.name) )
                    //pb entry exists?
                    if (index > -1) {
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
                                name: "pb",
                                text: member.firstname + "'s new " + res.race.racetype.name + " (" + getSurfaceText(res.race.racetype.surface) + ") personal best with the team!",
                                value: { time: res.time, memberId: new mongoose.Types.ObjectId(member._id) }
                            });
                            resModification = true;
                            returnRes.push("New " + res.race.racetype.name + " (" + getSurfaceText(res.race.racetype.surface) + ") PB at " + res.race.racename + "!");
                        }
                    } else {
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
                            name: "pb",
                            text: member.firstname + "'s new " + res.race.racetype.name + " (" + getSurfaceText(res.race.racetype.surface) + ") personal best with the team!",
                            value: { time: res.time, memberId: new mongoose.Types.ObjectId(member._id) }
                        });
                        resModification = true;
                        returnRes.push("New " + res.race.racetype.name + " (" + getSurfaceText(res.race.racetype.surface) + ") PB at " + res.race.racename + "!");
                    }//end with pb   
                }
                if (resModification) {
                    await res.save();
                }
            }
        }
        await member.save();
        return returnRes;
    },

    updateAchievements: async function (member) {
        // console.log(member.lastname);
        //check if it's a race count milestone
        const raceNumber = [1, 10, 25, 50, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300, 325, 350, 375, 400, 425, 450, 475, 500, 525, 550, 575, 600, 625, 650, 675, 700, 725, 750, 775, 800, 825, 850, 875, 900, 925, 950, 975, 1000];
        let returnRes = [];

        let bestAG = 0;

        let resultquery = Result.find({
            'members': { $elemMatch: { _id: member._id } }
        });

        resultquery.sort('race.racedate race.order');
        const results = await resultquery.exec();

        //write code to find index of the element with the same id as result._id
        // const index = results.findIndex(item => item._id === result._id);
        let index = 0;
        for (let result of results) {

            //check for race count achievement
            if (raceNumber.find(num => num === index + 1)) {

                let ind = result.achievements.findIndex(item => (item.name === "raceCount" && item.value.memberId && item.value.memberId.equals(member._id)));
                if (ind !== -1) {
                    //we update                
                    result.achievements[ind] = {
                        name: "raceCount",
                        text: member.firstname + "'s " + addOrdinalSuffix(index + 1) + " race with the team!",
                        value: { raceCount: index + 1, memberId: new mongoose.Types.ObjectId(member._id) }
                    };
                    returnRes.push(result.race.racename + " is " + member.firstname + "'s " + addOrdinalSuffix(index + 1) + " race with the team!");
                    // console.log("updated achievement: ",result.race.racename, " ",member.firstname+"'s "+addOrdinalSuffix(index+1)+" race with the team!");
                } else {
                    //we add
                    result.achievements.push({
                        name: "raceCount",
                        text: member.firstname + "'s " + addOrdinalSuffix(index + 1) + " race with the team!",
                        value: { raceCount: index + 1, memberId: new mongoose.Types.ObjectId(member._id) }
                    });
                    returnRes.push(result.race.racename + " is " + member.firstname + "'s " + addOrdinalSuffix(index + 1) + " race with the team!");
                    // console.log("added achievement: ",result.race.racename, " ",member.firstname+"'s "+addOrdinalSuffix(index+1)+" race with the team!");
                }
                // console.log(result);
                // console.log(result.race.racename, " ", result.race.racedate, " ", result.achievements.length)
                await result.save();
            } else {
                if (result.achievements) {
                    //we remove raceCount info if it's related to the current member
                    let ind = result.achievements.findIndex(item => (item.name === "raceCount" && item.value.memberId && item.value.memberId.equals(member._id)));
                    if (ind !== -1) {
                        // console.log("removing ",result.achievements[ind].value.memberId," member._id: ", member._id," from result ", result._id); 
                        result.achievements.splice(ind, 1);
                        await result.save();
                    }
                }
            }

            //check for age grade achievement
            if (result.agegrade) {
                let agInd = result.achievements.findIndex(item => (item.name === "agegrade"))
                if (agInd !== -1) {
                    if (result.agegrade > bestAG && result.isRecordEligible) {
                        //update
                        // console.log("update ag for member",member.firstname," ", result.agegrade, "("+bestAG+")");  
                        bestAG = result.agegrade;
                        result.achievements[agInd] = {
                            name: "agegrade",
                            text: member.firstname + "'s best age graded result with the team! " + result.agegrade + "%",
                            value: result.agegrade
                        };
                        returnRes.push(result.race.racename + " is " + member.firstname + "'s best age graded result with the team! " + result.agegrade + "%");
                    } else {
                        //we remove it if it's not accurate anymore
                        result.achievements.splice(agInd, 1);
                    }
                    await result.save();
                } else {
                    //add   
                    if (result.agegrade > bestAG && result.isRecordEligible) {
                        // console.log("add ag for member",member.firstname," ", result.agegrade, "("+bestAG+")");  
                        bestAG = result.agegrade;
                        result.achievements.push({
                            name: "agegrade",
                            text: member.firstname + "'s best age graded result with the team! " + result.agegrade + "%",
                            value: result.agegrade
                        });
                        returnRes.push(result.race.racename + " is " + member.firstname + "'s best age graded result with the team! " + result.agegrade + "%");
                        await result.save();
                    }
                }
            }

            index++;
        }
        return returnRes;
    },



    getAgeGrading: async function (sex, age, raceSurface, raceDate) {
        if (raceSurface === "road") {
            if (new Date(raceDate).getFullYear() < 2020) {
                version = "2015";
            } else {
                version = "2020";
            }
        }
        if (raceSurface === "track") {
            if (new Date(raceDate).getFullYear() < 2023) {
                version = "2005";
            } else {
                version = "2023";
            }
        }
        try {
            const ag = await AgeGrading.findOne({
                sex: sex,
                type: raceSurface,
                age: age,
                version: version
            });
            return ag;
        } catch (err) {
            //no age grading
            return null;
        }

    },


    /**
     * Updates the team requirement statistics for a given member for the current year.
     *
     * This function calculates the number of races a member has participated in 
     * during the current year and identifies the highest age grade achieved by the
     * member in those races. It saves the member's updated information and returns 
     * an array containing the number of races and the highest age grade.
     *
     * @param {Object} member - The member object containing the member's unique identifier.
     * @returns {Promise<Array>} A promise that resolves to an array containing two elements:
     *                           - The number of races the member has participated in the current year.
     *                           - The highest age grade achieved by the member in these races, or "N/A" if none.
     */

    updateTeamRequirementStats: async function (member) {
        if (member) {
            //only update team requirement stats for current members
            if(member.memberStatus === 'past'){
                member.teamRequirementStats = undefined;
                await member.save();
                return null;
            }
            const currentYear = new Date().getFullYear();
            //get current year start time in epoc time
            const currentYearStart = new Date(currentYear, 0, 1).getTime();
            //get current year end time in epoc time
            const currentYearEnd = new Date(currentYear + 1, 0, 1).getTime();
            const results = await Result.find({
                "members._id": member._id,
                "race.racedate": {
                    $gte: new Date(currentYearStart),
                    $lt: new Date(currentYearEnd)
                }
            });
            //get highest agregrade attribute in the results array
            let highestAg = "N/A";
            if (results.length !== 0) {
                highestAg = Math.max(...results.filter(obj => obj.agegrade !== undefined).map(obj => obj.agegrade));
            }
            //console.log([results.length,highestAg]);
            member.teamRequirementStats = { year: currentYear, raceCount: results.length, maxAgeGrade: highestAg };
            await member.save();
            return [results.length, highestAg];
        }
    },

    updateTeamRequirementStatsForAllMembers: async function () {
        const members = await Member.find();
        for (const member of members) {
            await this.updateTeamRequirementStats(member);
        }
    },


    // route middleware to make sure a user is logged in
    isLoggedIn: function (req, res, next) {
        // if user is authenticated in the session, carry on
        if (req.isAuthenticated()) {
            return next();
        }
        // if they aren't redirect them to the home page
        res.status(401).send("insufficient privileges");
    },
    // route middleware to make sure a user is logged in and an admin
    isAdminLoggedIn: function (req, res, next) {
        // if user is authenticated in the session and has an admin role, carry on
        if (req.isAuthenticated() && req.user.role === 'admin') {
            return next();
        }
        // if they aren't redirect them to the home page
        res.status(401).send("insufficient privileges");
    },
    isUserLoggedIn: function (req, res, next) {
        // if user is authenticated in the session and has an admin role, carry on
        if (req.isAuthenticated() && (req.user.role === 'user' || req.user.role === 'admin')) {
            return next();
        }
        // if they aren't redirect them to the home page
        res.status(401).send("insufficient privileges");
    },

    getAddDateToDate: function (date, years, months, days) {
        const resDate = new Date(date);
        resDate.setFullYear(resDate.getFullYear() + years, resDate.getMonth() + months, resDate.getDate() + days);
        return resDate;
    },
    //get age at race date
    calculateAge: function (dateofrace, birthday) {
        const rd = new Date(dateofrace);
        const bd = new Date(birthday);
        const ageDifMs = rd.getTime() - bd.getTime();
        const ageDate = new Date(ageDifMs);
        return Math.abs(ageDate.getUTCFullYear() - 1970);
    },
    // check if member is in list
    containsMember: function (list, member) {
        if (list.length == 0) {
            return false;
        }
        for (const memberresultElement of list) {
            if (memberresultElement.members[0]._id.equals(member._id)) {
                return true;
            }
        }
        return false;
    },
    sortResultsByDistance: function (a, b) {
        if (a.race.racetype.meters < b.race.racetype.meters)
            return -1;
        if (a.race.racetype.meters > b.race.racetype.meters)
            return 1;
        return 0;
    },
    sortRecordDistanceByDistance: function (a, b) {
        if (a.racetype.meters < b.racetype.meters)
            return -1;
        if (a.racetype.meters > b.racetype.meters)
            return 1;
        return 0;
    }

};



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



