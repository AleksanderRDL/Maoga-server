const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const app = require('../../../src/app');
const Game = require('../../../src/modules/game/models/Game');
const User = require('../../../src/modules/auth/models/User');
const igdbService = require('../../../src/modules/game/services/igdbService');
const authService = require('../../../src/modules/auth/services/authService');
const { testUsers } = require('../../fixtures/users');

describe('Game API', () => {
  let authToken;
  let adminToken;
  let testGame;
  let sandbox;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    // Clean up collections
    await Game.deleteMany({});
    await User.deleteMany({}); // <-- Add this line to clear users

    // Create test game
    testGame = await Game.create({
      name: 'Test Game',
      slug: 'test-game',
      description: 'A test game for testing',
      genres: [{ id: 1, name: 'Action' }],
      platforms: [{ id: 48, name: 'PlayStation 4' }],
      multiplayer: { online: true, maxPlayers: 4 },
      popularity: 80,
      rating: 85,
      externalIds: { igdb: 12345 }
    });

    // Create regular user token
    const userResult = await authService.register({
      email: testUsers[0].email,
      username: testUsers[0].username,
      password: testUsers[0].password,
      role: testUsers[0].role
    });
    authToken = userResult.accessToken;

    // Create admin user token
    const adminResult = await authService.register({
      email: testUsers[2].email,
      username: testUsers[2].username,
      password: testUsers[2].password,
      role: testUsers[2].role
    });
    adminToken = adminResult.accessToken;
  });

  afterEach(() => {
    sandbox.restore(); // <--- Restore all stubs created in the sandbox
  });

  describe('GET /api/games', () => {
    beforeEach(async () => {
      // Create additional test games
      await Game.create([
        {
          name: 'Action Game',
          slug: 'action-game',
          genres: [{ id: 1, name: 'Action' }],
          platforms: [{ id: 48, name: 'PlayStation 4' }],
          multiplayer: { online: true },
          popularity: 90,
          rating: 88
        },
        {
          name: 'RPG Game',
          slug: 'rpg-game',
          genres: [{ id: 2, name: 'RPG' }],
          platforms: [{ id: 6, name: 'PC' }],
          multiplayer: { online: false },
          popularity: 70,
          rating: 92
        },
        {
          name: 'Multiplayer Shooter',
          slug: 'multiplayer-shooter',
          genres: [{ id: 1, name: 'Action' }],
          platforms: [
            { id: 48, name: 'PlayStation 4' },
            { id: 49, name: 'Xbox One' }
          ],
          multiplayer: { online: true, maxPlayers: 32 },
          popularity: 95,
          rating: 80
        }
      ]);
    });

    it('should return paginated list of games', async () => {
      const res = await request(app).get('/api/games').query({ limit: 2, page: 1 }).expect(200);

      expect(res.body.status).to.equal('success');
      expect(res.body.data.games).to.have.lengthOf(2);
      expect(res.body.data.pagination).to.deep.include({
        page: 1,
        limit: 2,
        total: 4,
        pages: 2
      });
    });

    it('should filter games by genre', async () => {
      const res = await request(app).get('/api/games').query({ genres: '1' }).expect(200);

      expect(res.body.status).to.equal('success');
      expect(res.body.data.games).to.have.lengthOf(3); // Action games
      res.body.data.games.forEach((game) => {
        expect(game.genres.some((g) => g.id === 1)).to.be.true;
      });
    });

    it('should filter games by platform', async () => {
      const res = await request(app).get('/api/games').query({ platforms: '6' }).expect(200);

      expect(res.body.status).to.equal('success');
      expect(res.body.data.games).to.have.lengthOf(1); // PC game
      expect(res.body.data.games[0].platforms.some((p) => p.id === 6)).to.be.true;
    });

    it('should filter multiplayer games', async () => {
      const res = await request(app).get('/api/games').query({ multiplayer: 'true' }).expect(200);

      expect(res.body.status).to.equal('success');
      expect(res.body.data.games).to.have.lengthOf(3);
      res.body.data.games.forEach((game) => {
        expect(game.multiplayer.online).to.be.true;
      });
    });

    it('should sort games by popularity', async () => {
      const res = await request(app).get('/api/games').query({ sort: 'popularity' }).expect(200);

      expect(res.body.status).to.equal('success');
      const popularities = res.body.data.games.map((g) => g.popularity);
      expect(popularities).to.deep.equal([...popularities].sort((a, b) => b - a));
    });

    it('should sort games by rating', async () => {
      const res = await request(app).get('/api/games').query({ sort: 'rating' }).expect(200);

      expect(res.body.status).to.equal('success');
      const ratings = res.body.data.games.map((g) => g.rating);
      expect(ratings).to.deep.equal([...ratings].sort((a, b) => b - a));
    });

    it('should validate query parameters', async () => {
      const res = await request(app)
        .get('/api/games')
        .query({ limit: 101 }) // Exceeds max
        .expect(422);

      expect(res.body.status).to.equal('error');
      expect(res.body.error.code).to.equal('VALIDATION_ERROR');
    });
  });

  describe('GET /api/games/trending', () => {
    beforeEach(async () => {
      // Create trending games
      await Game.create([
        {
          name: 'Trending Game 1',
          slug: 'trending-game-1',
          maogaData: { trending: true, playerCount: 1000 },
          popularity: 85
        },
        {
          name: 'Trending Game 2',
          slug: 'trending-game-2',
          maogaData: { trending: true, playerCount: 800 },
          popularity: 80
        }
      ]);
    });

    it('should return trending games', async () => {
      const res = await request(app).get('/api/games/trending').expect(200);

      expect(res.body.status).to.equal('success');
      expect(res.body.data.games).to.be.an('array');
      res.body.data.games.forEach((game) => {
        expect(game.maogaData.trending).to.be.true;
      });
    });

    it('should limit trending games', async () => {
      const res = await request(app).get('/api/games/trending').query({ limit: 1 }).expect(200);

      expect(res.body.status).to.equal('success');
      expect(res.body.data.games).to.have.lengthOf(1);
    });
  });

  describe('GET /api/games/:gameId', () => {
    it('should return game details', async () => {
      const res = await request(app).get(`/api/games/${testGame._id}`).expect(200);

      expect(res.body.status).to.equal('success');
      expect(res.body.data.game.name).to.equal(testGame.name);
      expect(res.body.data.game.slug).to.equal(testGame.slug);
    });

    it('should return 404 for non-existent game', async () => {
      const res = await request(app).get('/api/games/507f1f77bcf86cd799439011').expect(404);

      expect(res.body.status).to.equal('error');
      expect(res.body.error.message).to.equal('Game not found');
    });

    it('should validate game ID format', async () => {
      const res = await request(app).get('/api/games/invalid-id').expect(422);

      expect(res.body.status).to.equal('error');
      expect(res.body.error.code).to.equal('VALIDATION_ERROR');
    });
  });

  describe('POST /api/games/fetch', () => {
    beforeEach(() => {
      // Stub specific methods needed for this test block using the sandbox
      sandbox.stub(igdbService, 'searchGames');
      sandbox.stub(igdbService, 'getGameDetails');
    });

    // afterEach is handled by the top-level sandbox.restore()

    it('should fetch game from IGDB if not found locally', async () => {
      const igdbGameData = {
        // Renamed to avoid conflict if igdbService itself is referred
        id: 99999,
        name: 'New IGDB Game',
        slug: 'new-igdb-game',
        summary: 'A new game from IGDB'
      };

      igdbService.searchGames.resolves([igdbGameData]); // Use the stubbed method
      igdbService.getGameDetails.resolves(igdbGameData); // Use the stubbed method

      const res = await request(app)
        .post('/api/games/fetch')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query: 'New IGDB Game' })
        .expect(200);

      expect(res.body.status).to.equal('success');
      expect(res.body.data.game.name).to.equal('New IGDB Game');
      expect(res.body.data.game.externalIds.igdb).to.equal(99999);

      const savedGame = await Game.findOne({ 'externalIds.igdb': 99999 });
      expect(savedGame).to.exist;
    });

    it('should return existing game if found locally', async () => {
      const res = await request(app)
        .post('/api/games/fetch')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query: testGame.name })
        .expect(200);

      expect(res.body.status).to.equal('success');
      expect(res.body.data.game._id).to.equal(testGame._id.toString());
      expect(igdbService.searchGames.called).to.be.false;
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/games/fetch')
        .send({ query: 'Some Game' })
        .expect(401);

      expect(res.body.status).to.equal('error');
      expect(res.body.error.message).to.equal('No token provided');
    });

    it('should validate query parameter', async () => {
      const res = await request(app)
        .post('/api/games/fetch')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query: 'a' }) // Too short
        .expect(422);

      expect(res.body.status).to.equal('error');
      expect(res.body.error.code).to.equal('VALIDATION_ERROR');
    });
  });

  describe('POST /api/admin/games/sync', () => {
    beforeEach(() => {
      sandbox.stub(igdbService, 'getPopularGames'); // Stub specific method
    });

    // afterEach is handled by the top-level sandbox.restore()

    it('should start game sync (admin only)', async () => {
      igdbService.getPopularGames.resolves([]); // Use the stubbed method

      const res = await request(app)
        .post('/api/admin/games/sync')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ limit: 100 })
        .expect(202);

      expect(res.body.status).to.equal('success');
      expect(res.body.data.message).to.equal('Game sync started');
    });

    it('should require admin role', async () => {
      const res = await request(app)
        .post('/api/admin/games/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ limit: 100 })
        .expect(403);

      expect(res.body.status).to.equal('error');
      expect(res.body.error.message).to.equal('Insufficient permissions');
    });

    it('should validate limit parameter', async () => {
      const res = await request(app)
        .post('/api/admin/games/sync')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ limit: 10000 }) // Exceeds max
        .expect(422);

      expect(res.body.status).to.equal('error');
      expect(res.body.error.code).to.equal('VALIDATION_ERROR');
    });
  });

  describe('PATCH /api/internal/games/:gameId/stats', () => {
    it('should update game statistics (admin only)', async () => {
      const res = await request(app)
        .patch(`/api/internal/games/${testGame._id}/stats`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          playerCount: 150,
          activeLobbies: 10
        })
        .expect(200);

      expect(res.body.status).to.equal('success');
      expect(res.body.data.game.maogaData.playerCount).to.equal(150);
      expect(res.body.data.game.maogaData.activeLobbies).to.equal(10);
    });

    it('should require at least one stat field', async () => {
      const res = await request(app)
        .patch(`/api/internal/games/${testGame._id}/stats`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(422);

      expect(res.body.status).to.equal('error');
      expect(res.body.error.code).to.equal('VALIDATION_ERROR');
    });
  });
});
