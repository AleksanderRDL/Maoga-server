const { expect } = require('chai');
const sinon = require('sinon');
const matchAlgorithmService = require('../../../../../src/modules/matchmaking/services/matchAlgorithmService');
const MatchRequest = require('../../../../../src/modules/matchmaking/models/MatchRequest');
const MatchHistory = require('../../../../../src/modules/matchmaking/models/MatchHistory');
const User = require('../../../../../src/modules/auth/models/User');
const { mockMatchmakingScenarios } = require('../../../../fixtures/matchmaking');

describe('MatchAlgorithmService', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('calculateCompatibility', () => {
    it('should return perfect score for identical criteria', () => {
      const scenario = mockMatchmakingScenarios.perfectMatch;
      const enrichedUser1 = {
        request: {
          criteria: scenario.users[0].criteria,
          relaxationLevel: 0
        },
        user: {
          _id: scenario.users[0].userId,
          gameProfiles: scenario.users[0].gameProfiles
        }
      };
      const enrichedUser2 = {
        request: {
          criteria: scenario.users[1].criteria,
          relaxationLevel: 0
        },
        user: {
          _id: scenario.users[1].userId,
          gameProfiles: scenario.users[1].gameProfiles
        }
      };

      const score = matchAlgorithmService.calculateCompatibility(
        enrichedUser1,
        enrichedUser2,
        '507f1f77bcf86cd799439011'
      );

      expect(score).to.be.closeTo(scenario.expectedScore, 0.1);
    });

    it('should return 0 for incompatible game modes', () => {
      const scenario = mockMatchmakingScenarios.noMatch;
      const enrichedUser1 = {
        request: { criteria: scenario.users[0].criteria },
        user: { _id: scenario.users[0].userId }
      };
      const enrichedUser2 = {
        request: { criteria: scenario.users[1].criteria },
        user: { _id: scenario.users[1].userId }
      };

      const score = matchAlgorithmService.calculateCompatibility(
        enrichedUser1,
        enrichedUser2,
        '507f1f77bcf86cd799439011'
      );

      expect(score).to.equal(0);
    });
  });

  describe('calculateRegionScore', () => {
    it('should return 1.0 for matching regions', () => {
      const criteria1 = {
        regions: ['NA', 'EU'],
        regionPreference: 'preferred'
      };
      const criteria2 = {
        regions: ['NA'],
        regionPreference: 'strict'
      };

      const score = matchAlgorithmService.calculateRegionScore(criteria1, criteria2);
      expect(score).to.equal(1.0);
    });

    it('should return 0 for strict preference with no common regions', () => {
      const criteria1 = {
        regions: ['NA'],
        regionPreference: 'strict'
      };
      const criteria2 = {
        regions: ['EU'],
        regionPreference: 'preferred'
      };

      const score = matchAlgorithmService.calculateRegionScore(criteria1, criteria2);
      expect(score).to.equal(0);
    });

    it('should return 0.5 for any preference with no common regions', () => {
      const criteria1 = {
        regions: ['NA'],
        regionPreference: 'any'
      };
      const criteria2 = {
        regions: ['EU'],
        regionPreference: 'any'
      };

      const score = matchAlgorithmService.calculateRegionScore(criteria1, criteria2);
      expect(score).to.equal(0.5);
    });
  });

  describe('calculateSkillScore', () => {
    it('should return high score for similar skill levels', () => {
      const enriched1 = {
        user: {
          gameProfiles: [{ gameId: '507f1f77bcf86cd799439011', skillLevel: 50 }]
        },
        request: { relaxationLevel: 0, criteria: { skillPreference: 'similar' } }
      };
      const enriched2 = {
        user: {
          gameProfiles: [{ gameId: '507f1f77bcf86cd799439011', skillLevel: 52 }]
        },
        request: { relaxationLevel: 0, criteria: { skillPreference: 'similar' } }
      };

      const score = matchAlgorithmService.calculateSkillScore(
        enriched1,
        enriched2,
        '507f1f77bcf86cd799439011'
      );

      expect(score).to.be.greaterThan(0.7);
    });

    it('should return 0.5 when no skill data is available', () => {
      const enriched1 = {
        user: { gameProfiles: [] },
        request: { criteria: { skillPreference: 'similar' } }
      };
      const enriched2 = {
        user: { gameProfiles: [] },
        request: { criteria: { skillPreference: 'similar' } }
      };

      const score = matchAlgorithmService.calculateSkillScore(
        enriched1,
        enriched2,
        '507f1f77bcf86cd799439011'
      );

      expect(score).to.equal(0.5);
    });

    it('should allow wider skill range with higher relaxation level', () => {
      const enriched1 = {
        user: {
          gameProfiles: [{ gameId: '507f1f77bcf86cd799439011', skillLevel: 50 }]
        },
        request: { relaxationLevel: 3, criteria: { skillPreference: 'similar' } }
      };
      const enriched2 = {
        user: {
          gameProfiles: [{ gameId: '507f1f77bcf86cd799439011', skillLevel: 55 }]
        },
        request: { relaxationLevel: 0, criteria: { skillPreference: 'similar' } }
      };

      const score = matchAlgorithmService.calculateSkillScore(
        enriched1,
        enriched2,
        '507f1f77bcf86cd799439011'
      );

      expect(score).to.be.greaterThan(0.5);
    });
  });

  describe('createMatch', () => {
    it('should create match history and update requests', async () => {
      const participants = [
        {
          user: { _id: '507f1f77bcf86cd799439011', username: 'player1' },
          request: {
            _id: '507f1f77bcf86cd799439012',
            searchDuration: 30000,
            relaxationLevel: 0
          }
        },
        {
          user: { _id: '507f1f77bcf86cd799439013', username: 'player2' },
          request: {
            _id: '507f1f77bcf86cd799439014',
            searchDuration: 45000,
            relaxationLevel: 1
          }
        }
      ];

      const mockMatchHistory = {
        _id: '507f1f77bcf86cd799439015',
        save: sandbox.stub().resolves(),
        calculateMetrics: sandbox.stub().resolves()
      };

      sandbox.stub(MatchHistory.prototype, 'save').resolves(mockMatchHistory);
      sandbox.stub(MatchHistory.prototype, 'calculateMetrics').resolves();
      sandbox.stub(MatchRequest, 'updateMany').resolves();

      const result = await matchAlgorithmService.createMatch(
        participants,
        '507f1f77bcf86cd799439011',
        'competitive',
        'NA'
      );

      expect(result).to.have.property('matchHistory');
      expect(result.participants).to.have.lengthOf(2);
      expect(MatchRequest.updateMany.calledOnce).to.be.true;
      expect(MatchRequest.updateMany.firstCall.args[1].status).to.equal('matched');
    });
  });

  describe('applyCriteriaRelaxation', () => {
    it('should increase relaxation level based on wait time', async () => {
      const request = {
        _id: '507f1f77bcf86cd799439011',
        searchDuration: 65000, // 65 seconds
        relaxationLevel: 0,
        save: sandbox.stub().resolves()
      };

      const result = await matchAlgorithmService.applyCriteriaRelaxation(request);

      expect(result).to.be.true;
      expect(request.relaxationLevel).to.equal(2);
      expect(request.save.calledOnce).to.be.true;
    });

    it('should not change relaxation level if wait time is too short', async () => {
      const request = {
        _id: '507f1f77bcf86cd799439011',
        searchDuration: 20000, // 20 seconds
        relaxationLevel: 0,
        save: sandbox.stub().resolves()
      };

      const result = await matchAlgorithmService.applyCriteriaRelaxation(request);

      expect(result).to.be.false;
      expect(request.relaxationLevel).to.equal(0);
      expect(request.save.called).to.be.false;
    });
  });

  describe('calculateMatchQuality', () => {
    it('should calculate overall match quality correctly', () => {
      const participants = [
        {
          request: {
            criteria: { regions: ['NA'], languages: ['en'] },
            getPrimaryGame: () => ({ gameId: '507f1f77bcf86cd799439011' })
          },
          user: {
            gameProfiles: [{ gameId: '507f1f77bcf86cd799439011', skillLevel: 50 }]
          }
        },
        {
          request: {
            criteria: { regions: ['NA'], languages: ['en'] },
            getPrimaryGame: () => ({ gameId: '507f1f77bcf86cd799439011' })
          },
          user: {
            gameProfiles: [{ gameId: '507f1f77bcf86cd799439011', skillLevel: 52 }]
          }
        }
      ];

      const quality = matchAlgorithmService.calculateMatchQuality(participants);

      expect(quality).to.have.property('regionCompatibility');
      expect(quality).to.have.property('languageCompatibility');
      expect(quality).to.have.property('skillBalance');
      expect(quality).to.have.property('overallScore');
      expect(quality.overallScore).to.be.greaterThan(80);
    });
  });
});
