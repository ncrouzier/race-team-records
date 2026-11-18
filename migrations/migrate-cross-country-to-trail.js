/**
 * Migration Script: Update "cross country" to "trail" in database
 * 
 * This script migrates all instances of "cross country" surface type to "trail"
 * across the racetypes, results, and races collections.
 * 
 * Usage: node migrations/migrate-cross-country-to-trail.js
 */

const { MongoClient } = require('mongodb');

// Configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mcrrcrecords';
const DATABASE_NAME = process.env.DATABASE_NAME || 'mcrrcrecords';

async function migrateCrossCountryToTrail() {
    let client;
    
    try {
        console.log('🚀 Starting migration: "cross country" → "trail"');
        console.log(`📊 Connecting to database: ${DATABASE_NAME}`);
        
        // Connect to MongoDB
        client = new MongoClient(MONGODB_URI);
        await client.connect();
        
        const db = client.db(DATABASE_NAME);
        
        // Migration statistics
        const stats = {
            racetypes: { updated: 0, total: 0 },
            results: { updated: 0, total: 0 },
            races: { updated: 0, total: 0 },
            members: { updated: 0, total: 0 }
        };
        
        // 1. Migrate racetypes collection
        console.log('\n📋 Migrating racetypes collection...');
        const racetypesCollection = db.collection('racetypes');
        
        // Count total racetypes with "cross country"
        const racetypesWithCrossCountry = await racetypesCollection.countDocuments({
            surface: 'cross country'
        });
        stats.racetypes.total = racetypesWithCrossCountry;
        
        if (racetypesWithCrossCountry > 0) {
            const racetypesResult = await racetypesCollection.updateMany(
                { surface: 'cross country' },
                { $set: { surface: 'trail' } }
            );
            stats.racetypes.updated = racetypesResult.modifiedCount;
            console.log(`✅ Updated ${racetypesResult.modifiedCount} racetypes`);
        } else {
            console.log('ℹ️  No racetypes found with "cross country" surface');
        }
        
        // 2. Migrate results collection
        console.log('\n🏃 Migrating results collection...');
        const resultsCollection = db.collection('results');
        
        // Count total results with "cross country" in race.racetype.surface
        const resultsWithCrossCountry = await resultsCollection.countDocuments({
            'race.racetype.surface': 'cross country'
        });
        stats.results.total = resultsWithCrossCountry;
        
        if (resultsWithCrossCountry > 0) {
            const resultsResult = await resultsCollection.updateMany(
                { 'race.racetype.surface': 'cross country' },
                { $set: { 'race.racetype.surface': 'trail' } }
            );
            stats.results.updated = resultsResult.modifiedCount;
            console.log(`✅ Updated ${resultsResult.modifiedCount} results`);
        } else {
            console.log('ℹ️  No results found with "cross country" surface');
        }
        
        // 3. Migrate races collection
        console.log('\n🏁 Migrating races collection...');
        const racesCollection = db.collection('races');
        
        // Count total races with "cross country" in racetype.surface
        const racesWithCrossCountry = await racesCollection.countDocuments({
            'racetype.surface': 'cross country'
        });
        stats.races.total = racesWithCrossCountry;
        
        if (racesWithCrossCountry > 0) {
            const racesResult = await racesCollection.updateMany(
                { 'racetype.surface': 'cross country' },
                { $set: { 'racetype.surface': 'trail' } }
            );
            stats.races.updated = racesResult.modifiedCount;
            console.log(`✅ Updated ${racesResult.modifiedCount} races`);
        } else {
            console.log('ℹ️  No races found with "cross country" surface');
        }
        
        // 4. Migrate members collection (personal bests)
        console.log('\n👥 Migrating members collection (personal bests)...');
        const membersCollection = db.collection('members');
        
        // Count total members with "cross country" in personalBests
        const membersWithCrossCountry = await membersCollection.countDocuments({
            'personalBests.surface': 'cross country'
        });
        stats.members.total = membersWithCrossCountry;
        
        if (membersWithCrossCountry > 0) {
            // Use aggregation pipeline to update all matching elements in arrays
            const membersResult = await membersCollection.updateMany(
                { 'personalBests.surface': 'cross country' },
                [
                    {
                        $set: {
                            personalBests: {
                                $map: {
                                    input: '$personalBests',
                                    as: 'pb',
                                    in: {
                                        $cond: {
                                            if: { $eq: ['$$pb.surface', 'cross country'] },
                                            then: { $mergeObjects: ['$$pb', { surface: 'trail' }] },
                                            else: '$$pb'
                                        }
                                    }
                                }
                            }
                        }
                    }
                ]
            );
            stats.members.updated = membersResult.modifiedCount;
            console.log(`✅ Updated ${membersResult.modifiedCount} members`);
        } else {
            console.log('ℹ️  No members found with "cross country" personal bests');
        }
        
        // 5. Verify migration
        console.log('\n🔍 Verifying migration...');
        
        const remainingCrossCountry = {
            racetypes: await racetypesCollection.countDocuments({ surface: 'cross country' }),
            results: await resultsCollection.countDocuments({ 'race.racetype.surface': 'cross country' }),
            races: await racesCollection.countDocuments({ 'racetype.surface': 'cross country' }),
            members: await membersCollection.countDocuments({ 'personalBests.surface': 'cross country' })
        };
        
        const newTrailCount = {
            racetypes: await racetypesCollection.countDocuments({ surface: 'trail' }),
            results: await resultsCollection.countDocuments({ 'race.racetype.surface': 'trail' }),
            races: await racesCollection.countDocuments({ 'racetype.surface': 'trail' }),
            members: await membersCollection.countDocuments({ 'personalBests.surface': 'trail' })
        };
        
        // 6. Print summary
        console.log('\n📊 Migration Summary:');
        console.log('='.repeat(50));
        console.log('Collection    | Updated | Remaining "cross country" | New "trail" count');
        console.log('-'.repeat(70));
        console.log(`racetypes     | ${stats.racetypes.updated.toString().padStart(7)} | ${remainingCrossCountry.racetypes.toString().padStart(23)} | ${newTrailCount.racetypes.toString().padStart(16)}`);
        console.log(`results       | ${stats.results.updated.toString().padStart(7)} | ${remainingCrossCountry.results.toString().padStart(23)} | ${newTrailCount.results.toString().padStart(16)}`);
        console.log(`races         | ${stats.races.updated.toString().padStart(7)} | ${remainingCrossCountry.races.toString().padStart(23)} | ${newTrailCount.races.toString().padStart(16)}`);
        console.log(`members       | ${stats.members.updated.toString().padStart(7)} | ${remainingCrossCountry.members.toString().padStart(23)} | ${newTrailCount.members.toString().padStart(16)}`);
        console.log('='.repeat(50));
        
        // 7. Check for any remaining "cross country" references
        const totalRemaining = remainingCrossCountry.racetypes + remainingCrossCountry.results + remainingCrossCountry.races + remainingCrossCountry.members;
        
        if (totalRemaining === 0) {
            console.log('\n🎉 Migration completed successfully!');
            console.log('✅ All "cross country" references have been updated to "trail"');
        } else {
            console.log('\n⚠️  Migration completed with warnings:');
            console.log(`⚠️  ${totalRemaining} documents still contain "cross country" references`);
            console.log('⚠️  Please review these documents manually');
        }
        
        // 7. Create backup log
        const migrationLog = {
            timestamp: new Date(),
            migration: 'cross-country-to-trail',
            stats: stats,
            verification: {
                remainingCrossCountry,
                newTrailCount
            },
            success: totalRemaining === 0
        };
        
        // Save migration log to database
        const migrationsCollection = db.collection('migrations');
        await migrationsCollection.insertOne(migrationLog);
        console.log('\n📝 Migration log saved to database');
        
    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    } finally {
        if (client) {
            await client.close();
            console.log('\n🔌 Database connection closed');
        }
    }
}

// Run migration if this script is executed directly
if (require.main === module) {
    migrateCrossCountryToTrail()
        .then(() => {
            console.log('\n✨ Migration script completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Migration script failed:', error);
            process.exit(1);
        });
}

module.exports = { migrateCrossCountryToTrail }; 