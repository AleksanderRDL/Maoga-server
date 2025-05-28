const { expect } = require('chai');
const sinon = require('sinon');
const gameService = require('../../../../../src/modules/game/services/gameService');
const Game = require('../../../../../src/modules/game/models/Game');
const igdbService = require('../../../../../src/modules/game/services/igdbService');
const cacheService = require('../../../../../src/modules/game/services/cacheService');
const { NotFoundError, BadRequestError } = require('../../../../../src/utils/errors');

describe('GameService', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getGameById', () => {
    it('should return game from cache if available', async () => {
      const mockGame = {
        _id: 'gameId123',
        name: 'Test Game',
        slug: 'test-game'
      };

      sandbox.stub(cacheService, 'get').resolves(mockGame);
      sandbox.stub(Game, 'findById');

      const result = await gameService.getGameById('gameId123');

      expect(cacheService.get.calledWith('game:gameId123')).to.be.true;
      expect(Game.findById.called).to.be.false;
      expect(result).to.deep.equal(mockGame);
    });

    it('should fetch from database and cache if not in cache', async () => {
      const mockGame = {
        _id: 'gameId123',
        name: 'Test Game',
        slug: 'test-game'
      };

      sandbox.stub(cacheService, 'get').resolves(null);
      sandbox.stub(cacheService, 'set').resolves(true);
      sandbox.stub(Game, 'findById').resolves(mockGame);

      const result = await gameService.getGameById('gameId123');

      expect(cacheService.get.calledWith('game:gameId123')).to.be.true;
      expect(Game.findById.calledWith('gameId123')).to.be.true;
      expect(cacheService.set.calledWith('game:gameId123', mockGame, 3600)).to.be.true;
      expect(result).to.deep.equal(mockGame);
    });

    it('should throw NotFoundError if game not found', async () => {
      sandbox.stub(cacheService, 'get').resolves(null);
      sandbox.stub(Game, 'findById').resolves(null);

      try {
        await gameService.getGameById('nonexistent');
        expect.fail('Should have thrown NotFoundError');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundError);
        expect(error.message).to.equal('Game not found');
      }
    });
  });

  describe('searchGames', () => {
    it('should search games with filters', async () => {
      const mockGames = [
        { _id: '1', name: 'Game 1' },
        { _id: '2', name: 'Game 2' }
      ];

      const searchOptions = {
        query: 'test',
        genres: [1, 2],
        platforms: [48],
        multiplayer: true,
        page: 1,
        limit: 20,
        sortBy: 'popularity'
      };

      sandbox.stub(cacheService, 'get').resolves(null);
      sandbox.stub(cacheService, 'set').resolves(true);
      sandbox.stub(Game, 'searchGames').resolves(mockGames);
      sandbox.stub(Game, 'countDocuments').resolves(2);

      const result = await gameService.searchGames(searchOptions);

      expect(Game.searchGames.calledOnce).to.be.true;
      expect(result.games).to.deep.equal(mockGames);
      expect(result.pagination).to.deep.equal({
        page: 1,
        limit: 20,
        total: 2,
        pages: 1
      });
    });

    it('should return cached results for popular searches', async () => {
      const cachedResult = {
        games: [{ _id: '1', name: 'Cached Game' }],
        pagination: { page: 1, limit: 20, total: 1, pages: 1 }
      };

      sandbox.stub(cacheService, 'get').resolves(cachedResult);
      sandbox.stub(Game, 'searchGames');

      const result = await gameService.searchGames({ page: 1, sortBy: 'popularity' });

      expect(cacheService.get.calledOnce).to.be.true;
      expect(Game.searchGames.called).to.be.false;
      expect(result).to.deep.equal(cachedResult);
    });

    it('should validate limit parameter', async () => {
      try {
        await gameService.searchGames({ limit: 101 });
        expect.fail('Should have thrown BadRequestError');
      } catch (error) {
        expect(error).to.be.instanceOf(BadRequestError);
        expect(error.message).to.equal('Limit cannot exceed 100');
      }
    });
  });

  describe('getOrFetchGame', () => {
    it('should return game from local database if found', async () => {
      const mockGame = {
        _id: 'gameId123',
        name: 'Local Game',
        slug: 'local-game'
      };

      sandbox.stub(Game, 'findOne').resolves(mockGame);
      sandbox.stub(igdbService, 'searchGames');

      const result = await gameService.getOrFetchGame('Local Game');

      expect(Game.findOne.calledOnce).to.be.true;
      expect(igdbService.searchGames.called).to.be.false;
      expect(result).to.deep.equal(mockGame);
    });

    it('should fetch from IGDB if not found locally', async () => {
      const igdbGame = {
        id: 12345,
        name: 'IGDB Game',
        slug: 'igdb-game'
      };

      const transformedGame = {
        _id: 'newGameId',
        name: 'IGDB Game',
        slug: 'igdb-game',
        externalIds: { igdb: 12345 }
      };

      sandbox.stub(Game, 'findOne').resolves(null);
      sandbox.stub(igdbService, 'searchGames').resolves([igdbGame]);
      sandbox.stub(igdbService, 'getGameDetails').resolves(igdbGame);
      sandbox.stub(gameService, 'createGameFromIGDB').resolves(transformedGame);

      const result = await gameService.getOrFetchGame('IGDB Game');

      expect(Game.findOne.calledOnce).to.be.true;
      expect(igdbService.searchGames.calledWith('IGDB Game', 1)).to.be.true;
      expect(igdbService.getGameDetails.calledWith(12345)).to.be.true;
      expect(result).to.deep.equal(transformedGame);
    });

    it('should throw NotFoundError if game not found anywhere', async () => {
      sandbox.stub(Game, 'findOne').resolves(null);
      sandbox.stub(igdbService, 'searchGames').resolves([]);

      try {
        await gameService.getOrFetchGame('Nonexistent Game');
        expect.fail('Should have thrown NotFoundError');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundError);
        expect(error.message).to.equal('Game not found');
      }
    });
  });

  describe('syncPopularGames', () => {
    it('should sync games from IGDB', async () => {
      const mockIGDBGames = [
        { id: 1, name: 'Game 1' },
        { id: 2, name: 'Game 2' }
      ];

      sandbox.stub(igdbService, 'getPopularGames').resolves(mockIGDBGames);
      sandbox.stub(gameService, 'createOrUpdateGameFromIGDB').resolves();

      const result = await gameService.syncPopularGames(2);

      expect(igdbService.getPopularGames.calledWith(2)).to.be.true;
      expect(gameService.createOrUpdateGameFromIGDB.callCount).to.equal(2);
      expect(result).to.deep.equal({
        synced: 2,
        failed: 0,
        total: 2
      });
    });

    it('should handle sync failures gracefully', async () => {
      const mockIGDBGames = [
        { id: 1, name: 'Game 1' },
        { id: 2, name: 'Game 2' }
      ];

      sandbox.stub(igdbService, 'getPopularGames').resolves(mockIGDBGames);
      const createStub = sandbox.stub(gameService, 'createOrUpdateGameFromIGDB');
      createStub.onFirstCall().resolves();
      createStub.onSecondCall().rejects(new Error('Sync failed'));

      const result = await gameService.syncPopularGames(2);

      expect(result).to.deep.equal({
        synced: 1,
        failed: 1,
        total: 2
      });
    });
  });

  describe('updateGameStats', () => {
    it('should update game statistics', async () => {
      const updatedGame = {
        _id: 'gameId123',
        maogaData: {
          playerCount: 100,
          activeLobbies: 5,
          lastActivity: new Date()
        }
      };

      sandbox.stub(Game, 'findByIdAndUpdate').resolves(updatedGame);
      sandbox.stub(cacheService, 'del').resolves();

      const result = await gameService.updateGameStats('gameId123', {
        playerCount: 100,
        activeLobbies: 5
      });

      expect(Game.findByIdAndUpdate.calledOnce).to.be.true;
      const updateCall = Game.findByIdAndUpdate.getCall(0);
      expect(updateCall.args[0]).to.equal('gameId123');
      expect(updateCall.args[1].$set['maogaData.playerCount']).to.equal(100);
      expect(updateCall.args[1].$set['maogaData.activeLobbies']).to.equal(5);
      expect(cacheService.del.calledWith('game:gameId123')).to.be.true;
      expect(result).to.deep.equal(updatedGame);
    });

    it('should throw NotFoundError if game not found', async () => {
      sandbox.stub(Game, 'findByIdAndUpdate').resolves(null);

      try {
        await gameService.updateGameStats('nonexistent', { playerCount: 0 });
        expect.fail('Should have thrown NotFoundError');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundError);
        expect(error.message).to.equal('Game not found');
      }
    });
  });

  describe('_transformIGDBGame', () => {
    it('should transform IGDB game data correctly', () => {
      const igdbGame = {
        id: 12345,
        name: 'Test Game',
        slug: 'test-game',
        summary: 'A test game',
        cover: { image_id: 'cover123' },
        screenshots: [{ image_id: 'screen1' }],
        videos: [{ name: 'Trailer', video_id: 'yt123' }],
        genres: [{ id: 1, name: 'Action' }],
        platforms: [{ id: 48, name: 'PlayStation 4' }],
        game_modes: [{ id: 1, name: 'Single player' }],
        rating: 85.5,
        rating_count: 100,
        popularity: 50.5,
        first_release_date: 1640995200
      };

      const result = gameService._transformIGDBGame(igdbGame);

      expect(result.name).to.equal('Test Game');
      expect(result.slug).to.equal('test-game');
      expect(result.coverImage.url).to.include('cover123');
      expect(result.screenshots).to.have.lengthOf(1);
      expect(result.videos).to.have.lengthOf(1);
      expect(result.genres).to.deep.equal(igdbGame.genres);
      expect(result.externalIds.igdb).to.equal(12345);
      expect(result.firstReleaseDate).to.be.instanceOf(Date);
    });
  });
});
