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
const { configDotenv } = require('dotenv');

// In-memory age grading cache for performance optimization
let ageGradingCache = null;

// Global query counter for tracking all database operations
let globalQueryCount = 0;

// Backend memory cache for system info
var systemInfoCache = {
    data: null,
    lastUpdated: 0,
    cacheDuration: 60000 // 1 minute cache duration
};

// Standalone function to get cached system info
async function getCachedSystemInfo() {
    const now = Date.now();
    
    // Return cached data if it's still fresh
    if (systemInfoCache.data && (now - systemInfoCache.lastUpdated) < systemInfoCache.cacheDuration) {
        return systemInfoCache.data;
    }
    
    // Fetch fresh data from database
    try {
        const systemInfo = await SystemInfo.findOne({ name: 'mcrrc' });
        if (systemInfo) {
            systemInfoCache.data = systemInfo;
            systemInfoCache.lastUpdated = now;
        }
        return systemInfo;
    } catch (error) {
        console.error('Error fetching system info:', error);
        return systemInfoCache.data; // Return cached data as fallback
    }
}

module.exports = {

    // Global query counter management
    getGlobalQueryCount: function() {
        return globalQueryCount;
    },
    
    resetGlobalQueryCount: function() {
        globalQueryCount = 0;
    },
    
    incrementGlobalQueryCount: function() {
        globalQueryCount++;
        return globalQueryCount;
    },

    // Initialize system info cache
    initializeSystemInfoCache: async function() {
        try {
            const systemInfo = await SystemInfo.findOne({ name: 'mcrrc' });
            if (systemInfo) {
                systemInfoCache.data = systemInfo;
                systemInfoCache.lastUpdated = Date.now();
                console.log('✅ System info cache initialized');
            }
        } catch (error) {
            console.error('Error initializing system info cache:', error);
        }
    },

    initializeAgeGradingCache: async function() {
        try {
            const allAgeGrading = await AgeGrading.find().lean();
            
            ageGradingCache = new Map();
            
            for (const ag of allAgeGrading) {
                const key = `${ag.sex}_${ag.type}_${ag.age}_${ag.version}`;
                ageGradingCache.set(key, ag);
            }
            
            console.log(`✅ Age grading cache initialized with ${ageGradingCache.size} entries`);
        } catch (error) {
            console.error('❌ Error initializing age grading cache:', error);
            ageGradingCache = new Map(); // Fallback to empty cache
        }
    },

    refreshAgeGradingCache: async function() {
        await this.initializeAgeGradingCache();
    },

    // Invalidate system info cache
    invalidateSystemInfoCache: async function() {
        systemInfoCache.data = null;
        systemInfoCache.lastUpdated = 0;
        // console.log('System info cache invalidated');
    },
    updateSystemInfoAndInvalidateSystemInfoCache: async function(type) {
        try {
            // Update the system info document with current date for the specified type
            const currentDate = new Date();
            
            // Use findOneAndUpdate to update the specific field or create if doesn't exist
            await SystemInfo.findOneAndUpdate(
                {}, // Match any document (there should only be one)
                { 
                    $set: { 
                        [type]: currentDate 
                    } 
                },
                { 
                    upsert: true, // Create if doesn't exist
                    new: true // Return the updated document
                }
            );
            
            // Invalidate the cache after updating
            await this.invalidateSystemInfoCache();
            

            
        } catch (error) {
            console.error(`❌ Error updating system info for type '${type}':`, error);
            throw error;
        }
    },
    // Get cached system info or fetch from database if needed
    getCachedSystemInfo: async function() {
        return await getCachedSystemInfo();
    },

    // Update system info cache when changes are made
    updateSystemInfoCache: async function() {
        try {
            const systemInfo = await SystemInfo.findOne({ name: 'mcrrc' });
            if (systemInfo) {
                systemInfoCache.data = systemInfo;
                systemInfoCache.lastUpdated = Date.now();
            }
        } catch (error) {
            console.error('Error updating system info cache:', error);
        }
    },

    // Middleware to add latest resultUpdate date to response headers
    // addSystemInfoHeaders: async function(req, res, next) {
    //     console.log("addSystemInfoHeaders");
    //     try {
    //         // Get the latest system info from cache
    //         const systemInfo = await getCachedSystemInfo();
    //         if (systemInfo) {
    //             // Add the individual update dates to response headers
    //             res.set('X-Result-Update', systemInfo.resultUpdate ? systemInfo.resultUpdate.toISOString() : '');
    //             res.set('X-Race-Update', systemInfo.raceUpdate ? systemInfo.raceUpdate.toISOString() : '');
    //             res.set('X-Racetype-Update', systemInfo.racetypeUpdate ? systemInfo.racetypeUpdate.toISOString() : '');
    //             res.set('X-Member-Update', systemInfo.memberUpdate ? systemInfo.memberUpdate.toISOString() : '');
                
    //             // Calculate the latest overall update date
    //             const dates = [
    //                 systemInfo.resultUpdate,
    //                 systemInfo.raceUpdate,
    //                 systemInfo.racetypeUpdate,
    //                 systemInfo.memberUpdate
    //             ].filter(date => date); // Remove null/undefined dates
                
    //             if (dates.length > 0) {
    //                 const latestDate = new Date(Math.max(...dates.map(date => new Date(date))));
    //                 console.log("latestDate", latestDate);
    //                 res.set('X-Overall-Update', latestDate.toISOString());
    //             }
    //         }
    //         console.log("addSystemInfoHeaders");
    //         next();
    //     } catch (error) {
    //         console.error('Error adding system info headers:', error);
    //         next(); // Continue even if there's an error
    //     }
    // },

    updateMemberStats: async function (member) {
        // OPTIMIZATION: Run functions sequentially to avoid conflicts on member object
        // but use optimized versions for better performance
        // OPTIMIZATION: Use bulk processing for single member
        await this.updateMemberStatsBulk([member._id]);
        return;
        await this.updatePBsandAchivementsOptimized(member);
        await this.updateTeamRequirementStatsOptimized(member);
    },

    updateMemberStatsBulk: async function (memberIds) {
        try {
            // OPTIMIZATION: Run bulk functions sequentially to avoid conflicts
            await this.updatePBsandAchivementsBulk(memberIds);
            await this.updateTeamRequirementStatsBulk(memberIds);
            
            return { success: true, memberCount: memberIds.length };
            
        } catch (error) {
            console.error(`❌ Error in bulk member stats update:`, error);
            throw error;
        }
    },



    updatePBsandAchivements: async function (member, clear) {
        let returnRes = [];
        let bestAG = 0;
        let numberOfSaves = 0;
        const pbDistances = ["400m", "800m", "1500m", "1 mile", "2 miles", "5k", "5000m", "4 miles",
            "5 miles", "8k", "10k", "10000m", "10 miles", "Half Marathon", "20 miles",
            "Marathon", "50k", "50 miles", "100k", "100 miles"];
        const pbSurfaces = ["road", "track", "ultra", "trail"];
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

    /**
     * Optimized version of updatePBsandAchivements using processMemberAchievements to avoid code duplication
     */
    // updatePBsandAchivementsOptimized: async function (member) {
    //     try {
    //         // Fetch member results with projection for efficiency
    //         const results = await Result.find({
    //             'members._id': member._id
    //         })
    //         .populate('race')
    //         .sort('race.racedate race.order')
    //         .lean();

    //         // Use the shared processMemberAchievements function
    //         const { resultOps, memberOp } = await this.processMemberAchievements(member, results);
            
    //         // Execute bulk operations
    //         if (resultOps.length > 0) {
    //             await Result.bulkWrite(resultOps);
    //         }
            
    //         if (memberOp) {
    //             await Member.bulkWrite([memberOp]);
    //         }
            
    //         return { 
    //             "Number of saves": resultOps.length, 
    //             "Results": [] // processMemberAchievements doesn't return detailed results
    //         };
            
    //     } catch (error) {
    //         console.error(`❌ Error in updatePBsandAchivementsOptimized for ${member.firstname}:`, error);
    //         throw error;
    //     }
    // },

    // Helper function to compare achievements efficiently
    achievementsAreDifferent: function(existingAchievements, calculatedAchievements) {
        // Sort both arrays by name for consistent comparison
        const sortedExisting = existingAchievements.sort((a, b) => a.name.localeCompare(b.name));
        const sortedCalculated = calculatedAchievements.sort((a, b) => a.name.localeCompare(b.name));
        
        // Check if arrays have different lengths
        if (sortedExisting.length !== sortedCalculated.length) {
            return true;
        }
        
        // Compare each achievement by name, text, and value
        for (let i = 0; i < sortedExisting.length; i++) {
            const existing = sortedExisting[i];
            const calculated = sortedCalculated[i];
            
            // Compare name
            if (existing.name !== calculated.name) {
                return true;
            }
            
            // Compare text
            if (existing.text !== calculated.text) {
                return true;
            }
            
            // Compare value (handle different value structures)
            if (JSON.stringify(existing.value) !== JSON.stringify(calculated.value)) {
                return true;
            }
        }
        
        return false; // No differences found
    },

    updatePBsandAchivementsBulk: async function (memberIds) {
        try {
            // Convert memberIds to Set for faster lookups
            const memberIdsSet = new Set(memberIds.map(id => id.toString()));
            
            // Fetch all members with projection for efficiency
            this.incrementGlobalQueryCount();
            const members = await Member.find({ _id: { $in: memberIds } })
                .select('_id firstname lastname dateofbirth personalBests')
                .lean();
            
            // Fetch all results for all members in parallel
            this.incrementGlobalQueryCount();
            const allResults = await Result.find({
                'members._id': { $in: memberIds }
            })
            .populate('race')
            .sort('race.racedate race.order')
            .lean();
            
            // Group results by member
            const resultsByMember = {};
            for (const result of allResults) {
                for (const memberRef of result.members) {
                    const memberId = memberRef._id.toString();
                    if (memberIdsSet.has(memberId)) {
                        if (!resultsByMember[memberId]) {
                            resultsByMember[memberId] = [];
                        }
                        resultsByMember[memberId].push(result);
                    }
                }
            }
            
            // OPTIMIZATION: Process members in batches to avoid memory issues
            const batchSize = 5; // Process 5 members at a time
            const memberResults = [];
            
            for (let i = 0; i < members.length; i += batchSize) {
                const batch = members.slice(i, i + batchSize);
                
                const batchPromises = batch.map(member => 
                    this.processMemberAchievements(member, resultsByMember[member._id.toString()] || [])
                );
                
                const batchResults = await Promise.all(batchPromises);
                memberResults.push(...batchResults);
            }
            
            // Collect all bulk operations
            const resultBulkOperations = [];
            const memberBulkOperations = [];
            
            for (const { resultOps, memberOp } of memberResults) {
                resultBulkOperations.push(...resultOps);
                if (memberOp) {
                    memberBulkOperations.push(memberOp);
                }
            }
            
            // Execute bulk operations
            if (resultBulkOperations.length > 0) {
                await Result.bulkWrite(resultBulkOperations);
            }
            
            if (memberBulkOperations.length > 0) {
                await Member.bulkWrite(memberBulkOperations);
            }
            
            return { 
                success: true, 
                memberCount: members.length,
                resultUpdates: resultBulkOperations.length,
                memberUpdates: memberBulkOperations.length
            };
            
        } catch (error) {
            console.error(`❌ Error in bulk PBs and achievements update:`, error);
            throw error;
        }
    },

    processMemberAchievements: async function (member, allResults) {
        const pbDistances = ["400m", "800m", "1500m", "1 mile", "2 miles", "5k", "5000m", "4 miles",
            "5 miles", "8k", "10k", "10000m", "10 miles", "Half Marathon", "20 miles",
            "Marathon", "50k", "50 miles", "100k", "100 miles"];
        const pbSurfaces = ["road", "track", "ultra", "trail"];
        const raceNumber = [1, 10, 25, 50, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300, 325, 350, 375, 400, 425, 450, 475, 500, 525, 550, 575, 600, 625, 650, 675, 700, 725, 750, 775, 800, 825, 850, 875, 900, 925, 950, 975, 1000];
        // OPTIMIZATION: Use Sets for faster lookups
        const pbDistancesSet = new Set(pbDistances);
        const pbSurfacesSet = new Set(pbSurfaces);
        const raceNumberSet = new Set(raceNumber);
        
        const resultBulkOperations = [];
        let tmpPersonalBests = [];
        let bestAgeGrade = 0;
        
        // OPTIMIZATION: Use Map for faster PB lookups
        const pbMap = new Map();
        
        // OPTIMIZATION: Calculate what achievements SHOULD be first
        const memberIdStr = member._id.toString();
        const calculatedAchievements = new Map(); // Map<resultId, achievements>
        
        // Process results chronologically to calculate correct achievements
        let raceIndex = 0;
        for (const result of allResults) {
            const resultAchievements = [];
            
            // Check if this result is a race count milestone
            if (raceNumberSet.has(raceIndex + 1)) {
                resultAchievements.push({
                    name: "raceCount",
                    text: member.firstname + "'s " + addOrdinalSuffix(raceIndex + 1) + " race with the team!",
                    value: { raceCount: raceIndex + 1, memberId: new mongoose.Types.ObjectId(member._id) }
                });
            }
            
            // OPTIMIZATION: Pre-calculate valid PB conditions
            const isValidPB = result.isRecordEligible && 
                result.members.length === 1 && 
                pbDistancesSet.has(result.race.racetype.name) && 
                pbSurfacesSet.has(result.race.racetype.surface);
            
            // Handle personal bests
            if (isValidPB) {
                const pbKey = `${result.race.racetype.name}-${result.race.racetype.surface}`;
                const existingPB = pbMap.get(pbKey);
                
                if (existingPB) {
                    // If strictly better, update the member's PB reference
                    if (result.time < existingPB.time) {
                        const newPB = {
                            result: result,
                            name: result.race.racetype.name,
                            surface: result.race.racetype.surface,
                            distance: result.race.racetype.meters,
                            time: result.time,
                            source: "computed"
                        };
                        pbMap.set(pbKey, newPB);
                        resultAchievements.push({
                            name: "pb",
                            text: member.firstname + "'s new " + result.race.racetype.name + " (" + getSurfaceText(result.race.racetype.surface) + ") personal best with the team!",
                            value: { time: result.time, memberId: new mongoose.Types.ObjectId(member._id) }
                        });
                    } else if (result.time === existingPB.time) {
                        // Tie: keep previous PB achievement and also add PB achievement to this result
                        resultAchievements.push({
                            name: "pb",
                            text: member.firstname + "'s new " + result.race.racetype.name + " (" + getSurfaceText(result.race.racetype.surface) + ") personal best with the team!",
                            value: { time: result.time, memberId: new mongoose.Types.ObjectId(member._id) }
                        });
                    }
                } else {
                    // Create new PB
                    const newPB = {
                        result: result,
                        name: result.race.racetype.name,
                        surface: result.race.racetype.surface,
                        distance: result.race.racetype.meters,
                        time: result.time,
                        source: "computed"
                    };
                    pbMap.set(pbKey, newPB);
                    resultAchievements.push({
                        name: "pb",
                        text: member.firstname + "'s new " + result.race.racetype.name + " (" + getSurfaceText(result.race.racetype.surface) + ") personal best with the team!",
                        value: { time: result.time, memberId: new mongoose.Types.ObjectId(member._id) }
                    });
                }
            }
            
            // Handle age grade achievements
            if (result.agegrade && parseFloat(result.agegrade) > bestAgeGrade) {
                bestAgeGrade = parseFloat(result.agegrade);
                
                resultAchievements.push({
                    name: "agegrade",
                    text: member.firstname + "'s best age graded result with the team! " + result.agegrade + "%",
                    value: { agegrade: bestAgeGrade }
                });
            }
            
            calculatedAchievements.set(result._id.toString(), resultAchievements);
            raceIndex++;
        }
        
        // OPTIMIZATION: Compare calculated achievements with existing ones and only update if different
        for (const result of allResults) {
            const resultId = result._id.toString();
            const calculated = calculatedAchievements.get(resultId) || [];
            
            // Get existing member-specific achievements
            const existingMemberAchievements = result.achievements.filter(achievement => {
                if (achievement.name === "agegrade") return true;
                if (achievement.name === "raceCount" && achievement.value && achievement.value.memberId && 
                    achievement.value.memberId.toString() === memberIdStr) return true;
                if (achievement.name === "pb" && achievement.value && achievement.value.memberId && 
                    achievement.value.memberId.toString() === memberIdStr) return true;
                return false;
            });
            
            // Get non-member-specific achievements (keep these unchanged)
            const otherAchievements = result.achievements.filter(achievement => {
                if (achievement.name === "agegrade") return false;
                if (achievement.name === "raceCount" && achievement.value && achievement.value.memberId && 
                    achievement.value.memberId.toString() === memberIdStr) return false;
                if (achievement.name === "pb" && achievement.value && achievement.value.memberId && 
                    achievement.value.memberId.toString() === memberIdStr) return false;
                return true;
            });
            
            // Combine other achievements with calculated ones
            const newAchievements = [...otherAchievements, ...calculated];
            
            // OPTIMIZATION: Only update if achievements actually changed
            const achievementsChanged = this.achievementsAreDifferent(existingMemberAchievements, calculated);
            if (achievementsChanged) {                                
                resultBulkOperations.push({
                    updateOne: {
                        filter: { _id: result._id },
                        update: { $set: { achievements: newAchievements } }
                    }
                });
            }
        }
        // OPTIMIZATION: Convert Map back to array for member update
        tmpPersonalBests = Array.from(pbMap.values());
        
        // Update member's personal bests
        const memberOp = {
            updateOne: {
                filter: { _id: member._id },
                update: { $set: { personalBests: tmpPersonalBests } }
            }
        };
        
        return { resultOps: resultBulkOperations, memberOp };
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
        resultquery.and({ "race.racetype.surface": { $in: ["road", "track", "ultra", "trail"] } }); //don't deal with swim or multi sports
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
        // Determine version (existing logic)
        let version;
        if (raceSurface === "road") {
            if (new Date(raceDate).getFullYear() < 2020) {
                version = "2015";
            } else if (new Date(raceDate).getFullYear() < 2025){
                version = "2020";
            } else { 
                version = "2025";
            }
        }
        if (raceSurface === "track") {
            if (new Date(raceDate).getFullYear() < 2023) {
                version = "2005";
            } else {
                version = "2023";
            }
        }
        
        // Use cache if available
        if (ageGradingCache) {
            const key = `${sex}_${raceSurface}_${age}_${version}`;
            const cached = ageGradingCache.get(key);
            if (cached) {
                return cached;
            }
        }
        
        // Fallback to database query (for cache misses or when cache not initialized)
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
                if ( member.teamRequirementStats != undefined){
                    member.teamRequirementStats = undefined;
                    await member.save();
                }                
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
                highestAg = Math.max(...results.filter(obj => obj.agegrade !== undefined && obj.agegrade !== null).map(obj => obj.agegrade));
            }
                    
            member.teamRequirementStats = { year: currentYear, raceCount: results.length, maxAgeGrade: highestAg };
            await member.save();
            return [results.length, highestAg];
        }
        
    },

    /**
     * Optimized version of updateTeamRequirementStats using aggregation for better performance
     */
    // updateTeamRequirementStatsOptimized: async function (member) {
        
    //     if (!member) {
    //         return null;
    //     }

    //     // Only update team requirement stats for current members
    //     if (member.memberStatus === 'past') {
    //         if (member.teamRequirementStats != undefined) {
    //             member.teamRequirementStats = undefined;
    //             await member.save();
    //         }
    //         return null;
    //     }

    //     const currentYear = new Date().getFullYear();
    //     //get current year start time in epoc time
    //     const currentYearStart = new Date(currentYear, 0, 1).getTime();
    //     //get current year end time in epoc time
    //     const currentYearEnd = new Date(currentYear + 1, 0, 1).getTime();

    //     // OPTIMIZATION: Use aggregation to calculate stats in one query
    //     const statsAggregation = await Result.aggregate([
    //         {
    //             $match: {
    //                 "members._id": member._id,
    //                 "race.racedate": {
    //                     $gte: new Date(currentYearStart),
    //                     $lt: new Date(currentYearEnd)
    //                 }
    //             }
    //         },
    //         {
    //             $group: {
    //                 _id: null,
    //                 raceCount: { $sum: 1 },
    //                 maxAgeGrade: {
    //                     $max: {
    //                         $cond: [
    //                             { $and: [{ $ne: ["$agegrade", null] }, { $ne: ["$agegrade", undefined] }] },
    //                             "$agegrade",
    //                             -Infinity
    //                         ]
    //                     }
    //                 }
    //             }
    //         }
    //     ]);

    //     let raceCount = 0;
    //     let maxAgeGrade = "N/A";

    //     if (statsAggregation.length > 0) {
    //         raceCount = statsAggregation[0].raceCount;
    //         maxAgeGrade = statsAggregation[0].maxAgeGrade === -Infinity ? "N/A" : statsAggregation[0].maxAgeGrade;
    //     }

    //     // OPTIMIZATION: Only save if stats have actually changed
    //     const currentStats = member.teamRequirementStats;
    //     const statsChanged = !currentStats || 
    //         currentStats.year !== currentYear ||
    //         currentStats.raceCount !== raceCount ||
    //         currentStats.maxAgeGrade !== maxAgeGrade;

    //     if (statsChanged) {
    //         member.teamRequirementStats = { 
    //             year: currentYear, 
    //             raceCount: raceCount, 
    //             maxAgeGrade: maxAgeGrade 
    //         };
    //         await member.save();
    //     }

    //     return [raceCount, maxAgeGrade];
    // },

    updateTeamRequirementStatsBulk: async function (memberIds) {
        try {
            // Fetch all members with projection for efficiency
            const members = await Member.find({ _id: { $in: memberIds } })
                .select('_id firstname memberStatus teamRequirementStats')
                .lean();
            
            const currentYear = new Date().getFullYear();
            //get current year start time in epoc time
            const currentYearStart = new Date(currentYear, 0, 1).getTime();
            //get current year end time in epoc time
            const currentYearEnd = new Date(currentYear + 1, 0, 1).getTime();
            
            // Convert string IDs to ObjectIds if needed
            const mongoose = require('mongoose');
            const normalizedMemberIds = memberIds.map(id => {
                if (typeof id === 'string') {
                    return new mongoose.Types.ObjectId(id);
                }
                return id;
            });
            
            // OPTIMIZATION: Use aggregation to calculate stats for all members in one query
            const statsAggregation = await Result.aggregate([
                {
                    $match: {
                        "race.racedate": {
                            $gte: new Date(currentYearStart),
                            $lt: new Date(currentYearEnd)
                        }
                    }
                },
                {
                    $unwind: "$members"
                },
                {
                    $match: {
                        "members._id": { $in: normalizedMemberIds }
                    }
                },
                {
                    $group: {
                        _id: "$members._id",
                        raceCount: { $sum: 1 },
                        maxAgeGrade: {
                            $max: {
                                $cond: [
                                    { $and: [{ $ne: ["$agegrade", null] }, { $ne: ["$agegrade", undefined] }] },
                                    "$agegrade",
                                    -Infinity
                                ]
                            }
                        }
                    }
                }
            ]);
            

            
            // Create a map of member stats
            const memberStatsMap = {};
            for (const stat of statsAggregation) {
                memberStatsMap[stat._id.toString()] = {
                    raceCount: stat.raceCount,
                    maxAgeGrade: stat.maxAgeGrade === -Infinity ? "N/A" : stat.maxAgeGrade
                };
            }
            
            // Prepare bulk operations
            const bulkOperations = [];
            let updateCount = 0;
            
            for (const member of members) {
                // Handle past members
                if (member.memberStatus === 'past') {
                    if (member.teamRequirementStats !== undefined) {
                        bulkOperations.push({
                            updateOne: {
                                filter: { _id: member._id },
                                update: { $unset: { teamRequirementStats: "" } }
                            }
                        });
                        updateCount++;
                    }
                    continue;
                }
                
                // Get stats for current member
                const stats = memberStatsMap[member._id.toString()] || { raceCount: 0, maxAgeGrade: "N/A" };
                
                // Check if stats have changed
                const currentStats = member.teamRequirementStats;
                const statsChanged = !currentStats || 
                    currentStats.year !== currentYear ||
                    currentStats.raceCount !== stats.raceCount ||
                    currentStats.maxAgeGrade !== stats.maxAgeGrade;
                
                if (statsChanged) {
                    bulkOperations.push({
                        updateOne: {
                            filter: { _id: member._id },
                            update: {
                                $set: {
                                    teamRequirementStats: {
                                        year: currentYear,
                                        raceCount: stats.raceCount,
                                        maxAgeGrade: stats.maxAgeGrade
                                    }
                                }
                            }
                        }
                    });
                    updateCount++;
                }
            }
            
            // Execute bulk operation
            if (bulkOperations.length > 0) {
                await Member.bulkWrite(bulkOperations);
            }
            
            return { 
                success: true, 
                memberCount: members.length,
                updates: updateCount
            };
            
        } catch (error) {
            console.error(`❌ Error in bulk team requirement stats update:`, error);
            throw error;
        }
    },

    updateMembersInResults: async function (member) {
        if (member) {
            //update result member info
            const resultsForMemberUpdate = await Result.find({
                "members._id": member._id
            });
            for (const resultForMemberUpdate of resultsForMemberUpdate) {
                for (const memberElement of resultForMemberUpdate.members) { //itirates members if relay race
                    if (memberElement._id.equals(member._id)) {     
                        if ( memberElement.firstname !== member.firstname || memberElement.lastname !== member.lastname
                            || memberElement.username !== member.username || memberElement.sex !== member.sex || memberElement.dateofbirth.getTime() !== member.dateofbirth.getTime()
                        ) {
                            memberElement.firstname = member.firstname;
                            memberElement.lastname = member.lastname;
                            memberElement.username = member.username;
                            memberElement.sex = member.sex;
                            memberElement.dateofbirth = member.dateofbirth;
                            await resultForMemberUpdate.save();
                        }else{
                        }
                    }
                }
            }
        }
    },

    startUpUpdate: async function () {
        try {
            // Initialize system info cache
            await this.initializeSystemInfoCache();
            
            // Initialize age grading cache
            await this.initializeAgeGradingCache();
            
            // OPTIMIZATION: Use bulk processing instead of individual member updates
            const members = await Member.find().select('_id firstname memberStatus teamRequirementStats');
            
            if (members.length === 0) {
                return;
            }
            
            // Extract member IDs for bulk processing
            const memberIds = members.map(member => member._id);
            
            // OPTIMIZATION: Use bulk team requirement stats update
            await this.updateTeamRequirementStatsBulk(memberIds);
            
            // Note: updateMembersInResults is commented out as it was in the original
            // await this.updateMembersInResultsBulk(memberIds);
            
            // Note: Location achievements are commented out as they were in the original
            // await this.updateAllLocationAchievements();
            
        } catch (error) {
            console.error('❌ Error in startUpUpdate:', error);
            throw error;
        }
    },


    /**
     * Updates location achievements efficiently. If country/state are provided, only process that location.
     * Otherwise, process all locations.
     * Usage: await service.updateAllLocationAchievements(country, state);
     */
    updateAllLocationAchievements: async function (country, state) {
        try {
            let locations;
            if (country) {
                // Only process the specified location
                locations = [{ _id: { country, state: state || null } }];
            } else {
                // Get all unique locations
                locations = await Race.aggregate([
                    {
                        $group: {
                            _id: {
                                country: '$location.country',
                                state: '$location.state'
                            }
                        }
                    }
                ]);
            }


            // OPTIMIZATION: Use bulk operations for location achievements
            const processedLocations = new Set();

            for (const location of locations) {
                const locationKey = `${location._id.country}-${location._id.state || 'null'}`;
                if (processedLocations.has(locationKey)) continue;
                processedLocations.add(locationKey);
                
                // Find all races at this location, sorted by date (oldest first)
                const racesAtLocation = await Race.find({
                    'location.country': location._id.country,
                    'location.state': location._id.state
                }).sort('racedate order');

                if (racesAtLocation.length === 0) continue;

                const oldestRace = racesAtLocation[0];
                const locationName = location._id.state || location._id.country;

                // Prepare bulk operations for this location
                const bulkOperations = [];

                // Remove achievement from all races at this location
                for (const race of racesAtLocation) {
                    if (race.achievements) {
                        const newLocationIndex = race.achievements.findIndex(a => a.name === "newLocation");
                        if (newLocationIndex !== -1) {
                            const updatedAchievements = [...race.achievements];
                            updatedAchievements.splice(newLocationIndex, 1);
                            
                            bulkOperations.push({
                                updateOne: {
                                    filter: { _id: race._id },
                                    update: { $set: { achievements: updatedAchievements } }
                                }
                            });
                        }
                    }
                }

                // Add achievement only to the oldest race
                const oldestRaceAchievements = oldestRace.achievements || [];
                const achievement = {
                    name: "newLocation",
                    text: `First team race in ${locationName}!`,
                    value: {
                        country: oldestRace.location.country,
                        state: oldestRace.location.state,
                        locationName: locationName
                    }
                };

                oldestRaceAchievements.push(achievement);
                
                bulkOperations.push({
                    updateOne: {
                        filter: { _id: oldestRace._id },
                        update: { $set: { achievements: oldestRaceAchievements } }
                    }
                });
                
                // Execute bulk operations for this location
                if (bulkOperations.length > 0) {
                    await Race.bulkWrite(bulkOperations);
                }
            }

        } catch (err) {
            console.error('Error updating all location achievements:', err);
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
    },
    

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
        ['trail', 'trail'],
        ['ultra', 'ultra'],
        ['multiple', 'multi sport'],
        ['pool', 'pool'],
        ['open water', 'openwater']
    ]);
    return surfaceMap.get(surface);
}



