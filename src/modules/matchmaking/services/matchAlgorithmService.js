const MatchRequest = require('../models/MatchRequest');
const MatchHistory = require('../models/MatchHistory');
const User = require('../../auth/models/User');
const logger = require('../../../utils/logger');

class MatchAlgorithmService {
  constructor() {
    // Configuration for matching
    this.config = {
      minGroupSize: 2,
      maxGroupSize: 10,
      skillRangeTiers: [2, 4, 6, 10, 15], // Adjusted: More lenient initial tier
      compatibilityThreshold: 0.5, // Minimum compatibility score
      batchSize: 100 // Max requests to process at once
    };
  }

  /**
   * Process match requests for a specific queue
   */
  async processQueue(gameId, gameMode, region, requests) {
    try {
      if (!requests || requests.length < this.config.minGroupSize) {
        return [];
      }

      logger.info('Processing match queue', {
        gameId,
        gameMode,
        region,
        requestCount: requests.length
      });

      // Load user data for all requests
      const enrichedRequests = await this.enrichRequests(requests);

      // Find compatible matches
      const matches = await this.findMatches(enrichedRequests, gameId, gameMode, region);

      logger.info('Match processing completed', {
        gameId,
        gameMode,
        region,
        matchesFound: matches.length
      });

      return matches;
    } catch (error) {
      logger.error('Failed to process match queue', {
        error: error.message,
        gameId,
        gameMode,
        region
      });
      throw error;
    }
  }

  /**
   * Enrich requests with user data
   */
  async enrichRequests(requests) {
    const userIds = requests.map((req) => req.userId);
    const users = await User.find({ _id: { $in: userIds } })
      .select('username profile gameProfiles gamingPreferences')
      .lean();

    const userMap = new Map(users.map((user) => [user._id.toString(), user]));

    return requests.map((request) => ({
      request,
      user: userMap.get(request.userId.toString())
    }));
  }

  /**
   * Find compatible matches from enriched requests
   */
  async findMatches(enrichedRequests, gameId, gameMode, region) {
    const matches = [];
    const processed = new Set();

    // Sort by wait time (oldest first)
    enrichedRequests.sort((a, b) => a.request.searchStartTime - b.request.searchStartTime);

    for (const primary of enrichedRequests) {
      if (processed.has(primary.request._id.toString())) {
        continue;
      }

      const compatiblePartners = this.findCompatiblePartners(
        primary,
        enrichedRequests,
        processed,
        gameId
      );

      // Ensure we have enough for a match INCLUDING the primary player
      if (compatiblePartners.length >= this.config.minGroupSize - 1) {
        // Correctly form the participants array for the match
        const matchParticipants = [primary, ...compatiblePartners];

        // Ensure we don't exceed max group size (if you form a match with only a subset of compatiblePartners)
        // For now, assuming we use all found compatiblePartners that fit within minGroupSize logic.
        // If you want to form smaller groups out of a larger pool of compatible partners, logic here would be more complex.

        if (
          matchParticipants.length >= this.config.minGroupSize &&
          matchParticipants.length <=
            (primary.request.criteria.groupSize?.max || this.config.maxGroupSize)
        ) {
          const match = await this.createMatch(matchParticipants, gameId, gameMode, region);
          matches.push(match);

          // Mark all participants in the formed match as processed
          matchParticipants.forEach((p) => {
            processed.add(p.request._id.toString());
          });
        }
      }
    }

    return matches;
  }

  /**
   * Find compatible partners for a primary request
   */
  findCompatiblePartners(primary, candidates, processed, gameId) {
    const partners = [];
    const maxSize = Math.min(
      primary.request.criteria.groupSize?.max || this.config.maxGroupSize,
      this.config.maxGroupSize
    );

    for (const candidate of candidates) {
      // Skip if already processed or same user
      if (
        processed.has(candidate.request._id.toString()) ||
        candidate.request._id.toString() === primary.request._id.toString()
      ) {
        continue;
      }

      // Calculate compatibility
      const compatibility = this.calculateCompatibility(primary, candidate, gameId);

      if (compatibility >= this.config.compatibilityThreshold) {
        partners.push({
          ...candidate,
          compatibility
        });

        // Check if we have enough partners
        if (partners.length >= maxSize - 1) {
          break;
        }
      }
    }

    // Sort by compatibility and return best matches
    return partners.sort((a, b) => b.compatibility - a.compatibility).slice(0, maxSize - 1);
  }

  /**
   * Calculate compatibility between two requests
   */
  calculateCompatibility(request1, request2, gameId) {
    const scores = {
      game: 0,
      gameMode: 0,
      region: 0,
      language: 0,
      skill: 0
    };

    // Game compatibility (must match for Sprint 5)
    const game1 = request1.request.criteria.games.find(
      (g) => g.gameId.toString() === gameId.toString()
    );
    const game2 = request2.request.criteria.games.find(
      (g) => g.gameId.toString() === gameId.toString()
    );

    if (!game1 || !game2) {
      return 0;
    }
    scores.game = 1.0;

    // Game mode compatibility (must match)
    if (request1.request.criteria.gameMode === request2.request.criteria.gameMode) {
      scores.gameMode = 1.0;
    } else {
      return 0; // Different game modes cannot match
    }

    // Region compatibility
    scores.region = this.calculateRegionScore(request1.request.criteria, request2.request.criteria);

    // Language compatibility (simplified for Sprint 5)
    scores.language = this.calculateLanguageScore(
      request1.request.criteria,
      request2.request.criteria
    );

    // Skill compatibility
    scores.skill = this.calculateSkillScore(request1, request2, gameId);

    // Calculate weighted average
    const weights = {
      game: 0.3,
      gameMode: 0.2,
      region: 0.2,
      language: 0.1,
      skill: 0.2
    };

    const totalScore =
      scores.game * weights.game +
      scores.gameMode * weights.gameMode +
      scores.region * weights.region +
      scores.language * weights.language +
      scores.skill * weights.skill;

    return totalScore;
  }

  /**
   * Calculate region compatibility score
   */
  calculateRegionScore(criteria1, criteria2) {
    const regions1 = new Set(criteria1.regions);
    const regions2 = new Set(criteria2.regions);

    // Check for common regions
    const commonRegions = [...regions1].filter((r) => regions2.has(r));

    if (commonRegions.length === 0) {
      // No common regions
      if (criteria1.regionPreference === 'strict' || criteria2.regionPreference === 'strict') {
        return 0;
      }
      if (criteria1.regionPreference === 'any' && criteria2.regionPreference === 'any') {
        return 0.5;
      }
      return 0.25;
    }

    // Has common regions
    return 1.0;
  }

  /**
   * Calculate language compatibility score
   */
  calculateLanguageScore(criteria1, criteria2) {
    // Simplified for Sprint 5
    if (criteria1.languagePreference === 'any' || criteria2.languagePreference === 'any') {
      return 1.0;
    }

    const langs1 = new Set(criteria1.languages || []);
    const langs2 = new Set(criteria2.languages || []);

    if (langs1.size === 0 || langs2.size === 0) {
      return 0.5; // No language specified
    }

    const commonLangs = [...langs1].filter((l) => langs2.has(l));
    return commonLangs.length > 0 ? 1.0 : 0.25;
  }

  /**
   * Calculate skill compatibility score
   */
  calculateSkillScore(enriched1, enriched2, gameId) {
    const user1 = enriched1.user;
    const user2 = enriched2.user;

    if (!user1 || !user2) {
      return 0.5;
    }

    // Get game profiles
    const profile1 = user1.gameProfiles?.find((p) => p.gameId.toString() === gameId.toString());
    const profile2 = user2.gameProfiles?.find((p) => p.gameId.toString() === gameId.toString());

    if (!profile1?.skillLevel || !profile2?.skillLevel) {
      return 0.5; // No skill data available
    }

    // Calculate skill difference
    const skillDiff = Math.abs(profile1.skillLevel - profile2.skillLevel);
    const relaxationLevel = Math.max(
      enriched1.request.relaxationLevel,
      enriched2.request.relaxationLevel
    );

    // Get allowed skill range based on relaxation
    const allowedRange =
      this.config.skillRangeTiers[
        Math.min(relaxationLevel, this.config.skillRangeTiers.length - 1)
      ];

    if (skillDiff <= allowedRange) {
      // Within range - higher score for closer skills
      // Ensure allowedRange is not zero to prevent division by zero, though tiers start at 2 now.
      return allowedRange > 0 ? 1.0 - (skillDiff / allowedRange) * 0.5 : 0.5;
    }

    // Check skill preference
    if (
      enriched1.request.criteria.skillPreference === 'any' ||
      enriched2.request.criteria.skillPreference === 'any'
    ) {
      return 0.3; // Allow but with lower score
    }

    return 0; // Too far apart
  }

  /**
   * Create a match from compatible participants
   */
  async createMatch(participants, gameId, gameMode, region) {
    try {
      // Calculate match quality metrics
      const matchQuality = this.calculateMatchQuality(participants);

      // Create match history entry
      const matchHistory = new MatchHistory({
        gameId,
        gameMode,
        region,
        matchQuality,
        participants: participants.map((p) => ({
          userId: p.user._id,
          requestId: p.request._id
        }))
      });

      // Calculate and set metrics
      await matchHistory.calculateMetrics(participants.map((p) => p.request));

      await matchHistory.save();

      // Update match requests
      const requestIds = participants.map((p) => p.request._id);
      await MatchRequest.updateMany(
        { _id: { $in: requestIds } },
        {
          status: 'matched',
          matchedLobbyId: null // Will be set when lobby is created
        }
      );

      logger.info('Match created', {
        matchId: matchHistory._id,
        gameId,
        gameMode,
        region,
        participantCount: participants.length,
        matchQuality: matchQuality.overallScore
      });

      return {
        matchHistory,
        participants: participants.map((p) => ({
          userId: p.user._id,
          username: p.user.username,
          requestId: p.request._id
        }))
      };
    } catch (error) {
      logger.error('Failed to create match', {
        error: error.message,
        participantCount: participants.length
      });
      throw error;
    }
  }

  /**
   * Calculate overall match quality
   */
  calculateMatchQuality(participants) {
    let totalSkillBalance = 0;
    let totalRegionCompat = 0;
    let totalLangCompat = 0;
    let comparisons = 0;

    // Compare all pairs
    participants.forEach((p1, index) => {
      participants.slice(index + 1).forEach((p2) => {
        // Ensure p1.request and p2.request, and their criteria are defined
        if (!p1.request || !p1.request.criteria || !p2.request || !p2.request.criteria) {
          logger.warn(
            'Skipping participant pair due to missing request/criteria in calculateMatchQuality',
            { p1_id: p1.user?._id, p2_id: p2.user?._id }
          );
          return;
        }
        // Ensure primary game can be determined for skill score calculation
        const primaryGame1 = p1.request.getPrimaryGame ? p1.request.getPrimaryGame() : null;
        const primaryGame2 = p2.request.getPrimaryGame ? p2.request.getPrimaryGame() : null;

        if (
          !primaryGame1 ||
          !primaryGame1.gameId ||
          !primaryGame2 ||
          !primaryGame2.gameId ||
          primaryGame1.gameId.toString() !== primaryGame2.gameId.toString()
        ) {
          logger.warn(
            'Skipping skill score in calculateMatchQuality due to missing or mismatched primary game IDs',
            { p1_game: primaryGame1?.gameId, p2_game: primaryGame2?.gameId }
          );
          totalSkillBalance += 0.5; // Neutral score if games mismatch or no info
        } else {
          totalSkillBalance += this.calculateSkillScore(p1, p2, primaryGame1.gameId);
        }

        // Calculate individual compatibility scores
        totalRegionCompat += this.calculateRegionScore(p1.request.criteria, p2.request.criteria);
        totalLangCompat += this.calculateLanguageScore(p1.request.criteria, p2.request.criteria);
        comparisons++;
      });
    });

    const avgRegion = comparisons > 0 ? totalRegionCompat / comparisons : 0;
    const avgLang = comparisons > 0 ? totalLangCompat / comparisons : 0;
    const avgSkill = comparisons > 0 ? totalSkillBalance / comparisons : 0;

    return {
      regionCompatibility: Math.round(avgRegion * 100),
      languageCompatibility: Math.round(avgLang * 100),
      skillBalance: Math.round(avgSkill * 100),
      overallScore: Math.round(((avgRegion + avgLang + avgSkill) / 3) * 100)
    };
  }

  /**
   * Apply criteria relaxation to long-waiting requests
   */
  async applyCriteriaRelaxation(request) {
    const waitTime = request.searchDuration; // This is a virtual, ensure it's accessed correctly
    const relaxationIntervals = [30000, 60000, 120000, 180000, 300000]; // 30s, 1m, 2m, 3m, 5m

    let newRelaxationLevel = 0;
    relaxationIntervals.forEach((interval, index) => {
      if (waitTime >= interval) {
        newRelaxationLevel = index + 1;
      }
    });

    if (newRelaxationLevel > request.relaxationLevel) {
      request.relaxationLevel = newRelaxationLevel;
      request.relaxationTimestamp = new Date();
      await request.save();

      logger.info('Applied criteria relaxation', {
        requestId: request._id,
        userId: request.userId,
        oldLevel: request.relaxationLevel, // This will show the newLevel because it was just updated
        newLevel: newRelaxationLevel,
        waitTime: Math.round(waitTime / 1000) + 's'
      });

      return true;
    }

    return false;
  }

  /**
   * Get match statistics for analytics
   */
  async getMatchStatistics(timeRange = { hours: 24 }) {
    try {
      const since = new Date(Date.now() - timeRange.hours * 60 * 60 * 1000);

      const matches = await MatchHistory.find({
        formedAt: { $gte: since }
      });

      const stats = {
        totalMatches: matches.length,
        averageGroupSize: 0,
        averageWaitTime: 0,
        averageMatchQuality: 0
      };

      const matchesByGame = new Map();
      const matchesByMode = new Map();
      const relaxationLevels = new Map();

      const incrementCount = (map, key) => {
        if (key === undefined || key === null) {
          return;
        }
        const current = map.get(key) || 0;
        map.set(key, current + 1);
      };

      if (matches.length === 0) {
        return {
          ...stats,
          matchesByGame: {},
          matchesByMode: {},
          relaxationLevelsUsed: {}
        };
      }

      let totalParticipants = 0;
      let totalWaitTime = 0;
      let totalQuality = 0;

      matches.forEach((match) => {
        // Group size
        totalParticipants += match.participants.length;

        // Wait time
        if (match.matchingMetrics?.totalSearchTime) {
          totalWaitTime += match.matchingMetrics.totalSearchTime;
        }

        // Match quality
        if (match.matchQuality?.overallScore) {
          totalQuality += match.matchQuality.overallScore;
        }

        incrementCount(matchesByGame, match.gameId?.toString());
        incrementCount(matchesByMode, match.gameMode);

        if (match.matchingMetrics?.relaxationLevelsUsed) {
          match.matchingMetrics.relaxationLevelsUsed.forEach((level) => {
            incrementCount(relaxationLevels, level);
          });
        }
      });

      stats.averageGroupSize = totalParticipants / matches.length;
      stats.averageWaitTime = totalWaitTime / matches.length;
      stats.averageMatchQuality = totalQuality / matches.length;

      return {
        ...stats,
        matchesByGame: Object.fromEntries(matchesByGame),
        matchesByMode: Object.fromEntries(matchesByMode),
        relaxationLevelsUsed: Object.fromEntries(relaxationLevels)
      };
    } catch (error) {
      logger.error('Failed to get match statistics', { error: error.message });
      throw error;
    }
  }
}

module.exports = new MatchAlgorithmService();
