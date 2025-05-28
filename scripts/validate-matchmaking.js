#!/usr/bin/env node

/**
 * Matchmaking Algorithm Validation Script
 *
 * This script tests the matchmaking algorithm with various scenarios
 * to ensure it's working correctly before deployment.
 */

const mongoose = require('mongoose');
const config = require('../src/config');
const matchAlgorithmService = require('../src/modules/matchmaking/services/matchAlgorithmService');
const MatchRequest = require('../src/modules/matchmaking/models/MatchRequest');
const User = require('../src/modules/auth/models/User');
const Game = require('../src/modules/game/models/Game');
const logger = require('../src/utils/logger');

// Test scenarios
const scenarios = {
    perfect2v2: {
        name: 'Perfect 2v2 Match',
        description: 'Four players with identical preferences should form two matches',
        gameId: new mongoose.Types.ObjectId(),
        requests: [
            { username: 'player1', skillLevel: 50, regions: ['NA'], gameMode: 'competitive' },
            { username: 'player2', skillLevel: 52, regions: ['NA'], gameMode: 'competitive' },
            { username: 'player3', skillLevel: 48, regions: ['NA'], gameMode: 'competitive' },
            { username: 'player4', skillLevel: 51, regions: ['NA'], gameMode: 'competitive' }
        ],
        expectedMatches: 2
    },

    mixedRegions: {
        name: 'Mixed Region Compatibility',
        description: 'Players with overlapping regions should match',
        gameId: new mongoose.Types.ObjectId(),
        requests: [
            { username: 'naPlayer', skillLevel: 50, regions: ['NA'], regionPref: 'preferred' },
            { username: 'euPlayer', skillLevel: 50, regions: ['EU'], regionPref: 'any' },
            { username: 'flexPlayer', skillLevel: 50, regions: ['NA', 'EU'], regionPref: 'any' }
        ],
        expectedMatches: 1
    },

    skillGaps: {
        name: 'Skill Gap Handling',
        description: 'Players with large skill gaps should not match initially',
        gameId: new mongoose.Types.ObjectId(),
        requests: [
            { username: 'proPlayer', skillLevel: 90, regions: ['NA'], skillPref: 'similar' },
            { username: 'newPlayer', skillLevel: 20, regions: ['NA'], skillPref: 'similar' }
        ],
        expectedMatches: 0
    },

    relaxation: {
        name: 'Criteria Relaxation',
        description: 'Long-waiting players should have relaxed criteria',
        gameId: new mongoose.Types.ObjectId(),
        requests: [
            {
                username: 'waitingPlayer',
                skillLevel: 50,
                regions: ['NA'],
                waitTime: 180000, // 3 minutes
                skillPref: 'similar'
            },
            {
                username: 'differentSkill',
                skillLevel: 65,
                regions: ['NA'],
                skillPref: 'similar'
            }
        ],
        expectedMatches: 1 // Should match after relaxation
    }
};

async function connectDatabase() {
    try {
        await mongoose.connect(config.database.uri, config.database.options);
        logger.info('Connected to test database');
    } catch (error) {
        logger.error('Failed to connect to database', { error: error.message });
        process.exit(1);
    }
}

async function cleanupDatabase() {
    await MatchRequest.deleteMany({});
    await User.deleteMany({ username: /^test_/ });
    await Game.deleteMany({ name: /^TestGame_/ });
}

async function createTestData(scenario) {
    // Create test game
    const game = await Game.create({
        _id: scenario.gameId,
        name: `TestGame_${scenario.name}`,
        slug: `testgame-${Date.now()}`,
        multiplayer: { online: true }
    });

    // Create test users and match requests
    const requests = [];

    for (const requestData of scenario.requests) {
        // Create user
        const user = await User.create({
            username: `test_${requestData.username}_${Date.now()}`,
            email: `${requestData.username}@test.com`,
            hashedPassword: 'test',
            gameProfiles: [{
                gameId: game._id,
                skillLevel: requestData.skillLevel
            }],
            gamingPreferences: {
                regions: requestData.regions,
                languages: ['en']
            }
        });

        // Create match request
        const searchStartTime = requestData.waitTime
            ? new Date(Date.now() - requestData.waitTime)
            : new Date();

        const request = await MatchRequest.create({
            userId: user._id,
            status: 'searching',
            criteria: {
                games: [{ gameId: game._id, weight: 10 }],
                gameMode: requestData.gameMode || 'competitive',
                regions: requestData.regions,
                regionPreference: requestData.regionPref || 'preferred',
                skillPreference: requestData.skillPref || 'similar'
            },
            searchStartTime,
            relaxationLevel: 0
        });

        requests.push(request);
    }

    return { game, requests };
}

async function runScenario(scenario) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Scenario: ${scenario.name}`);
    console.log(`Description: ${scenario.description}`);
    console.log(`${'='.repeat(60)}`);

    try {
        // Create test data
        const { game, requests } = await createTestData(scenario);
        console.log(`✓ Created ${requests.length} test requests`);

        // Apply relaxation if needed
        for (const request of requests) {
            if (request.searchDuration > 30000) {
                await matchAlgorithmService.applyCriteriaRelaxation(request);
            }
        }

        // Run matching algorithm
        const matches = await matchAlgorithmService.processQueue(
            game._id,
            'competitive',
            'NA',
            requests
        );

        console.log(`✓ Algorithm processed, found ${matches.length} matches`);

        // Validate results
        const success = matches.length === scenario.expectedMatches;

        if (success) {
            console.log(`✅ SUCCESS: Expected ${scenario.expectedMatches} matches, got ${matches.length}`);

            // Print match details
            matches.forEach((match, index) => {
                console.log(`\nMatch ${index + 1}:`);
                console.log(`- Participants: ${match.participants.length}`);
                console.log(`- Quality Score: ${match.matchHistory.matchQuality.overallScore}%`);
                console.log(`- Avg Wait Time: ${Math.round(match.matchHistory.matchingMetrics.totalSearchTime / 1000)}s`);
            });
        } else {
            console.log(`❌ FAILURE: Expected ${scenario.expectedMatches} matches, got ${matches.length}`);
        }

        return success;
    } catch (error) {
        console.error(`❌ ERROR: ${error.message}`);
        return false;
    }
}

async function main() {
    console.log('🎮 Matchmaking Algorithm Validation Tool');
    console.log(`Environment: ${config.env}`);

    await connectDatabase();

    let totalScenarios = 0;
    let passedScenarios = 0;

    for (const [key, scenario] of Object.entries(scenarios)) {
        totalScenarios++;

        // Clean up before each scenario
        await cleanupDatabase();

        const success = await runScenario(scenario);
        if (success) passedScenarios++;

        // Wait a bit between scenarios
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`FINAL RESULTS: ${passedScenarios}/${totalScenarios} scenarios passed`);
    console.log(`${'='.repeat(60)}`);

    // Cleanup and disconnect
    await cleanupDatabase();
    await mongoose.disconnect();

    process.exit(passedScenarios === totalScenarios ? 0 : 1);
}

// Run validation
main().catch(error => {
    console.error('Validation script failed:', error);
    process.exit(1);
});