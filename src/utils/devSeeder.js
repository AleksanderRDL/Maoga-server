const config = require('../config');
const baseLogger = require('./logger');
const User = require('../modules/auth/models/User');
const Game = require('../modules/game/models/Game');
const Lobby = require('../modules/lobby/models/Lobby');
const MatchRequest = require('../modules/matchmaking/models/MatchRequest');

const logger = baseLogger.forModule('dev:seeder');

let hasSeeded = false;

function minutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60000);
}

function minutesFromNow(minutes) {
  return new Date(Date.now() + minutes * 60000);
}

const GAME_SEEDS = [
  {
    name: 'Valorant',
    slug: 'valorant',
    summary: '5v5 tactical shooter focused on precise gunplay and agent abilities.',
    description:
      'Valorant is a competitive tactical shooter where coordinated teams of five agents battle using unique abilities and tight gunplay.',
    coverImage: {
      url: 'https://static.maoga.dev/dev-seed/valorant-cover.jpg',
      thumbnailUrl: 'https://static.maoga.dev/dev-seed/valorant-thumb.jpg'
    },
    genres: [
      { id: 5, name: 'Shooter' },
      { id: 30, name: 'Tactical' }
    ],
    platforms: [{ id: 6, name: 'PC', abbreviation: 'PC' }],
    gameModes: [
      { id: 1, name: 'Competitive' },
      { id: 2, name: 'Unrated' },
      { id: 3, name: 'Swiftplay' }
    ],
    multiplayer: {
      online: true,
      offline: false,
      maxPlayers: 10,
      minPlayers: 10,
      coop: false
    },
    maogaData: {
      playerCount: 28500,
      activeLobbies: 112,
      lastActivity: minutesAgo(5),
      trending: true
    },
    popularity: 94,
    rating: 87,
    ratingCount: 12800,
    externalIds: {
      igdb: 131414
    }
  },
  {
    name: 'League of Legends',
    slug: 'league-of-legends',
    summary: '5v5 competitive MOBA with deep champion roster and strategic gameplay.',
    description:
      'League of Legends is a multiplayer online battle arena with a massive champion roster, strategic team play, and regular seasonal events.',
    coverImage: {
      url: 'https://static.maoga.dev/dev-seed/lol-cover.jpg',
      thumbnailUrl: 'https://static.maoga.dev/dev-seed/lol-thumb.jpg'
    },
    genres: [
      { id: 36, name: 'MOBA' },
      { id: 10, name: 'Strategy' }
    ],
    platforms: [{ id: 6, name: 'PC', abbreviation: 'PC' }],
    gameModes: [
      { id: 4, name: 'Ranked' },
      { id: 5, name: 'Normals' },
      { id: 6, name: 'ARAM' }
    ],
    multiplayer: {
      online: true,
      offline: false,
      maxPlayers: 10,
      minPlayers: 10,
      coop: true
    },
    maogaData: {
      playerCount: 45210,
      activeLobbies: 164,
      lastActivity: minutesAgo(3),
      trending: true
    },
    popularity: 97,
    rating: 90,
    ratingCount: 24100,
    externalIds: {
      igdb: 987
    }
  },
  {
    name: 'Apex Legends',
    slug: 'apex-legends',
    summary: 'Hero-based battle royale featuring squads of three legends.',
    description:
      'Apex Legends is a squad-based battle royale where legendary characters with powerful abilities team up to fight for glory and fortune.',
    coverImage: {
      url: 'https://static.maoga.dev/dev-seed/apex-cover.jpg',
      thumbnailUrl: 'https://static.maoga.dev/dev-seed/apex-thumb.jpg'
    },
    genres: [
      { id: 5, name: 'Shooter' },
      { id: 31, name: 'Battle Royale' }
    ],
    platforms: [
      { id: 6, name: 'PC', abbreviation: 'PC' },
      { id: 48, name: 'PlayStation 5', abbreviation: 'PS5' },
      { id: 49, name: 'Xbox Series', abbreviation: 'XS' }
    ],
    gameModes: [
      { id: 7, name: 'Trios' },
      { id: 8, name: 'Ranked' },
      { id: 9, name: 'Duos' }
    ],
    multiplayer: {
      online: true,
      offline: false,
      maxPlayers: 60,
      minPlayers: 3,
      coop: true
    },
    maogaData: {
      playerCount: 17890,
      activeLobbies: 58,
      lastActivity: minutesAgo(9),
      trending: false
    },
    popularity: 89,
    rating: 85,
    ratingCount: 9800,
    externalIds: {
      igdb: 109123
    }
  },
  {
    name: 'Fortnite',
    slug: 'fortnite',
    summary: 'Fast-paced battle royale with creative building mechanics and live events.',
    description:
      'Fortnite drops players onto an ever-changing island where building skills and sharp shooting decide who earns the Victory Royale.',
    coverImage: {
      url: 'https://static.maoga.dev/dev-seed/fortnite-cover.jpg',
      thumbnailUrl: 'https://static.maoga.dev/dev-seed/fortnite-thumb.jpg'
    },
    genres: [
      { id: 5, name: 'Shooter' },
      { id: 31, name: 'Battle Royale' }
    ],
    platforms: [
      { id: 6, name: 'PC', abbreviation: 'PC' },
      { id: 48, name: 'PlayStation 5', abbreviation: 'PS5' },
      { id: 49, name: 'Xbox Series', abbreviation: 'XS' },
      { id: 130, name: 'Nintendo Switch', abbreviation: 'NS' }
    ],
    gameModes: [
      { id: 10, name: 'Zero Build' },
      { id: 11, name: 'Battle Royale' },
      { id: 12, name: 'Creative' }
    ],
    multiplayer: {
      online: true,
      offline: false,
      maxPlayers: 100,
      minPlayers: 1,
      coop: true
    },
    maogaData: {
      playerCount: 52300,
      activeLobbies: 210,
      lastActivity: minutesAgo(2),
      trending: true
    },
    popularity: 98,
    rating: 86,
    ratingCount: 30120,
    externalIds: {
      igdb: 1905
    }
  },
  {
    name: 'Overwatch 2',
    slug: 'overwatch-2',
    summary: 'Team-based hero shooter with dynamic objectives and seasonal content.',
    description:
      'Overwatch 2 brings 5v5 hero-focused combat to new maps and modes with regular seasonal updates and cooperative PvE missions.',
    coverImage: {
      url: 'https://static.maoga.dev/dev-seed/overwatch2-cover.jpg',
      thumbnailUrl: 'https://static.maoga.dev/dev-seed/overwatch2-thumb.jpg'
    },
    genres: [
      { id: 5, name: 'Shooter' },
      { id: 15, name: 'Action' }
    ],
    platforms: [
      { id: 6, name: 'PC', abbreviation: 'PC' },
      { id: 48, name: 'PlayStation 5', abbreviation: 'PS5' },
      { id: 49, name: 'Xbox Series', abbreviation: 'XS' }
    ],
    gameModes: [
      { id: 13, name: 'Quick Play' },
      { id: 14, name: 'Competitive' },
      { id: 15, name: 'Arcade' }
    ],
    multiplayer: {
      online: true,
      offline: false,
      maxPlayers: 10,
      minPlayers: 10,
      coop: true
    },
    maogaData: {
      playerCount: 16250,
      activeLobbies: 44,
      lastActivity: minutesAgo(11),
      trending: false
    },
    popularity: 84,
    rating: 80,
    ratingCount: 7540,
    externalIds: {
      igdb: 204921
    }
  }
];

const USER_SEEDS = [
  {
    email: 'brimstone@maoga.test',
    username: 'brimstone',
    password: 'PlayTogether123!',
    role: 'user',
    profile: {
      displayName: 'Liam "Brimstone" Briggs',
      bio: 'Tactical leader focused on coordinated team play across shooters and MOBAs.',
      profileImage: 'https://static.maoga.dev/dev-seed/users/brimstone.png'
    },
    preferences: {
      competitiveness: 'competitive',
      regions: ['NA'],
      languages: ['English'],
      playTimePreferences: {
        weekdays: { start: '18:00', end: '23:30' },
        weekends: { start: '14:00', end: '02:00' },
        timezone: 'America/New_York'
      }
    },
    gameProfiles: [
      {
        slug: 'valorant',
        inGameName: 'BrimCommander#NA1',
        rank: 'Immortal II',
        skillLevel: 88,
        stats: {
          favoriteAgent: 'Brimstone',
          headshotPercentage: 23
        },
        updatedAt: minutesAgo(20)
      },
      {
        slug: 'league-of-legends',
        inGameName: 'HexTechBrim',
        rank: 'Diamond I',
        skillLevel: 82,
        stats: {
          primaryRole: 'Top',
          favoriteChampion: 'Garen'
        },
        updatedAt: minutesAgo(42)
      }
    ],
    preferredGames: [
      { slug: 'valorant', weight: 80 },
      { slug: 'league-of-legends', weight: 65 }
    ],
    karmaPoints: 240,
    virtualCurrency: 1250,
    lastActive: minutesAgo(6)
  },
  {
    email: 'aurora@maoga.test',
    username: 'aurora',
    password: 'PlayTogether123!',
    role: 'user',
    profile: {
      displayName: 'Aurora Feldmann',
      bio: 'Shot-caller who enjoys strategic macro play and relaxed weekend sessions.',
      profileImage: 'https://static.maoga.dev/dev-seed/users/aurora.png'
    },
    preferences: {
      competitiveness: 'balanced',
      regions: ['EU'],
      languages: ['English', 'German'],
      playTimePreferences: {
        weekdays: { start: '19:00', end: '22:30' },
        weekends: { start: '12:00', end: '01:00' },
        timezone: 'Europe/Berlin'
      }
    },
    gameProfiles: [
      {
        slug: 'league-of-legends',
        inGameName: 'AuroraMid',
        rank: 'Master IV',
        skillLevel: 90,
        stats: {
          primaryRole: 'Mid',
          shotcalling: 'High'
        },
        updatedAt: minutesAgo(15)
      },
      {
        slug: 'overwatch-2',
        inGameName: 'Aurora#EU',
        rank: 'Diamond',
        skillLevel: 76,
        stats: {
          favoriteRole: 'Support'
        },
        updatedAt: minutesAgo(55)
      }
    ],
    preferredGames: [
      { slug: 'league-of-legends', weight: 85 },
      { slug: 'overwatch-2', weight: 50 }
    ],
    karmaPoints: 320,
    virtualCurrency: 900,
    lastActive: minutesAgo(12)
  },
  {
    email: 'viper@maoga.test',
    username: 'viper',
    password: 'PlayTogether123!',
    role: 'user',
    profile: {
      displayName: 'Selina "Viper" Cruz',
      bio: 'Aggressive entry fragger who flexes between battle royales and tactical FPS.',
      profileImage: 'https://static.maoga.dev/dev-seed/users/viper.png'
    },
    preferences: {
      competitiveness: 'competitive',
      regions: ['NA'],
      languages: ['English', 'Spanish'],
      playTimePreferences: {
        weekdays: { start: '21:00', end: '01:30' },
        weekends: { start: '16:00', end: '03:00' },
        timezone: 'America/Chicago'
      }
    },
    gameProfiles: [
      {
        slug: 'valorant',
        inGameName: 'VenomStrike#NA',
        rank: 'Radiant',
        skillLevel: 94,
        stats: {
          favoriteAgent: 'Viper',
          clutchRate: 48
        },
        updatedAt: minutesAgo(10)
      },
      {
        slug: 'apex-legends',
        inGameName: 'VenomStrike',
        rank: 'Master',
        skillLevel: 88,
        stats: {
          favoriteLegend: 'Wraith'
        },
        updatedAt: minutesAgo(34)
      }
    ],
    preferredGames: [
      { slug: 'valorant', weight: 90 },
      { slug: 'apex-legends', weight: 70 }
    ],
    karmaPoints: 410,
    virtualCurrency: 540,
    lastActive: minutesAgo(4)
  },
  {
    email: 'pixelwave@maoga.test',
    username: 'pixelwave',
    password: 'PlayTogether123!',
    role: 'user',
    profile: {
      displayName: 'Jin Park',
      bio: 'Support main and spreadsheet wizard who loves steady improvement and meetup nights.',
      profileImage: 'https://static.maoga.dev/dev-seed/users/pixelwave.png'
    },
    preferences: {
      competitiveness: 'balanced',
      regions: ['AS', 'OC'],
      languages: ['English', 'Korean'],
      playTimePreferences: {
        weekdays: { start: '20:00', end: '23:00' },
        weekends: { start: '10:00', end: '03:00' },
        timezone: 'Asia/Seoul'
      }
    },
    gameProfiles: [
      {
        slug: 'overwatch-2',
        inGameName: 'PixelWave#KR',
        rank: 'Master',
        skillLevel: 83,
        stats: {
          favoriteRole: 'Support',
          healingPer10: 14500
        },
        updatedAt: minutesAgo(18)
      },
      {
        slug: 'valorant',
        inGameName: 'PixelWave#KR',
        rank: 'Ascendant II',
        skillLevel: 75,
        stats: {
          favoriteAgent: 'Sage'
        },
        updatedAt: minutesAgo(60)
      }
    ],
    preferredGames: [
      { slug: 'overwatch-2', weight: 75 },
      { slug: 'valorant', weight: 55 }
    ],
    karmaPoints: 285,
    virtualCurrency: 1120,
    lastActive: minutesAgo(9)
  },
  {
    email: 'supportive@maoga.test',
    username: 'supportive',
    password: 'PlayTogether123!',
    role: 'user',
    profile: {
      displayName: 'Camille Leroux',
      bio: 'Community builder who fills the healer slot and keeps team morale high.',
      profileImage: 'https://static.maoga.dev/dev-seed/users/supportive.png'
    },
    preferences: {
      competitiveness: 'casual',
      regions: ['EU'],
      languages: ['English', 'French'],
      playTimePreferences: {
        weekdays: { start: '17:30', end: '21:30' },
        weekends: { start: '11:00', end: '00:30' },
        timezone: 'Europe/Paris'
      }
    },
    gameProfiles: [
      {
        slug: 'league-of-legends',
        inGameName: 'CamilleSupport',
        rank: 'Platinum I',
        skillLevel: 68,
        stats: {
          favoriteRole: 'Support'
        },
        updatedAt: minutesAgo(28)
      },
      {
        slug: 'fortnite',
        inGameName: 'FortniteCam',
        rank: 'Champion League',
        skillLevel: 72,
        stats: {
          favoriteMode: 'Zero Build'
        },
        updatedAt: minutesAgo(90)
      }
    ],
    preferredGames: [
      { slug: 'league-of-legends', weight: 60 },
      { slug: 'fortnite', weight: 50 }
    ],
    karmaPoints: 365,
    virtualCurrency: 820,
    lastActive: minutesAgo(14)
  },
  {
    email: 'shotcaller@maoga.test',
    username: 'shotcaller',
    password: 'PlayTogether123!',
    role: 'user',
    profile: {
      displayName: 'Diego Martins',
      bio: 'Shotcalling IGL who loves rotating through battle royale metas with friends.',
      profileImage: 'https://static.maoga.dev/dev-seed/users/shotcaller.png'
    },
    preferences: {
      competitiveness: 'competitive',
      regions: ['SA', 'NA'],
      languages: ['English', 'Portuguese'],
      playTimePreferences: {
        weekdays: { start: '19:30', end: '00:30' },
        weekends: { start: '15:00', end: '03:30' },
        timezone: 'America/Sao_Paulo'
      }
    },
    gameProfiles: [
      {
        slug: 'fortnite',
        inGameName: 'ShotCallerBR',
        rank: 'Elite Division',
        skillLevel: 86,
        stats: {
          favoriteMode: 'Fours'
        },
        updatedAt: minutesAgo(7)
      },
      {
        slug: 'apex-legends',
        inGameName: 'ShotCallerBR',
        rank: 'Diamond IV',
        skillLevel: 79,
        stats: {
          favoriteLegend: 'Bangalore'
        },
        updatedAt: minutesAgo(38)
      }
    ],
    preferredGames: [
      { slug: 'fortnite', weight: 85 },
      { slug: 'apex-legends', weight: 60 }
    ],
    karmaPoints: 298,
    virtualCurrency: 1330,
    lastActive: minutesAgo(5)
  }
];

const LOBBY_SEEDS = [
  {
    name: 'Valorant Night Ranked',
    status: 'forming',
    gameSlug: 'valorant',
    gameMode: 'competitive',
    hostUsername: 'brimstone',
    members: [
      {
        username: 'brimstone',
        status: 'ready',
        isHost: true,
        readyStatus: true,
        joinedMinutesAgo: 25
      },
      { username: 'viper', status: 'joined', readyStatus: false, joinedMinutesAgo: 22 },
      { username: 'pixelwave', status: 'joined', readyStatus: false, joinedMinutesAgo: 18 },
      { username: 'supportive', status: 'ready', readyStatus: true, joinedMinutesAgo: 15 }
    ],
    capacity: { min: 5, max: 5 },
    settings: {
      isPrivate: false,
      allowSpectators: false,
      autoStart: true,
      autoClose: true
    },
    region: 'NA',
    formedAt: minutesAgo(30)
  },
  {
    name: "Summoner's Rift Flex Squad",
    status: 'ready',
    gameSlug: 'league-of-legends',
    gameMode: 'ranked',
    hostUsername: 'aurora',
    members: [
      {
        username: 'aurora',
        status: 'ready',
        isHost: true,
        readyStatus: true,
        joinedMinutesAgo: 35
      },
      { username: 'supportive', status: 'ready', readyStatus: true, joinedMinutesAgo: 32 },
      { username: 'brimstone', status: 'ready', readyStatus: true, joinedMinutesAgo: 28 },
      { username: 'shotcaller', status: 'joined', readyStatus: false, joinedMinutesAgo: 22 }
    ],
    capacity: { min: 5, max: 5 },
    settings: {
      isPrivate: true,
      allowSpectators: false,
      autoStart: false,
      autoClose: true
    },
    region: 'EU',
    formedAt: minutesAgo(40),
    readyAt: minutesAgo(12)
  },
  {
    name: 'Fortnite Zero Build Friday',
    status: 'active',
    gameSlug: 'fortnite',
    gameMode: 'casual',
    hostUsername: 'shotcaller',
    members: [
      {
        username: 'shotcaller',
        status: 'ready',
        isHost: true,
        readyStatus: true,
        joinedMinutesAgo: 50
      },
      { username: 'supportive', status: 'ready', readyStatus: true, joinedMinutesAgo: 47 },
      { username: 'pixelwave', status: 'ready', readyStatus: true, joinedMinutesAgo: 44 }
    ],
    capacity: { min: 2, max: 4 },
    settings: {
      isPrivate: false,
      allowSpectators: true,
      autoStart: true,
      autoClose: false
    },
    region: 'SA',
    formedAt: minutesAgo(55),
    readyAt: minutesAgo(35),
    activeAt: minutesAgo(20)
  },
  {
    name: 'Apex Legends Warmup',
    status: 'forming',
    gameSlug: 'apex-legends',
    gameMode: 'competitive',
    hostUsername: 'viper',
    members: [
      { username: 'viper', status: 'ready', isHost: true, readyStatus: true, joinedMinutesAgo: 16 },
      { username: 'shotcaller', status: 'joined', readyStatus: false, joinedMinutesAgo: 14 }
    ],
    capacity: { min: 3, max: 3 },
    settings: {
      isPrivate: false,
      allowSpectators: false,
      autoStart: false,
      autoClose: false
    },
    region: 'NA',
    formedAt: minutesAgo(18)
  }
];

const MATCH_REQUEST_SEEDS = [
  {
    username: 'pixelwave',
    status: 'searching',
    criteria: {
      games: [
        { slug: 'valorant', weight: 8 },
        { slug: 'overwatch-2', weight: 4 }
      ],
      gameMode: 'competitive',
      groupSize: { min: 1, max: 5 },
      regionPreference: 'preferred',
      regions: ['AS', 'OC'],
      languagePreference: 'preferred',
      languages: ['English', 'Korean'],
      skillPreference: 'similar'
    },
    preselectedUsernames: ['viper'],
    searchStartTime: minutesAgo(8),
    matchExpireTime: minutesFromNow(5),
    relaxationLevel: 2,
    relaxationTimestamp: minutesAgo(2),
    matchAttempts: 1
  },
  {
    username: 'supportive',
    status: 'searching',
    criteria: {
      games: [
        { slug: 'league-of-legends', weight: 7 },
        { slug: 'fortnite', weight: 3 }
      ],
      gameMode: 'ranked',
      groupSize: { min: 2, max: 5 },
      regionPreference: 'preferred',
      regions: ['EU'],
      languagePreference: 'strict',
      languages: ['English', 'French'],
      skillPreference: 'similar'
    },
    preselectedUsernames: ['aurora'],
    searchStartTime: minutesAgo(14),
    matchExpireTime: minutesFromNow(3),
    relaxationLevel: 1,
    matchAttempts: 0
  },
  {
    username: 'viper',
    status: 'searching',
    criteria: {
      games: [
        { slug: 'valorant', weight: 9 },
        { slug: 'apex-legends', weight: 6 }
      ],
      gameMode: 'competitive',
      groupSize: { min: 1, max: 3 },
      regionPreference: 'strict',
      regions: ['NA'],
      languagePreference: 'preferred',
      languages: ['English', 'Spanish'],
      skillPreference: 'similar'
    },
    searchStartTime: minutesAgo(5),
    matchExpireTime: minutesFromNow(7),
    relaxationLevel: 0,
    matchAttempts: 2,
    lastProcessedAt: minutesAgo(1)
  },
  {
    username: 'shotcaller',
    status: 'searching',
    criteria: {
      games: [
        { slug: 'fortnite', weight: 8 },
        { slug: 'apex-legends', weight: 5 }
      ],
      gameMode: 'casual',
      groupSize: { min: 2, max: 4 },
      regionPreference: 'preferred',
      regions: ['SA', 'NA'],
      languagePreference: 'any',
      languages: ['English', 'Portuguese'],
      skillPreference: 'any'
    },
    preselectedUsernames: ['supportive'],
    searchStartTime: minutesAgo(11),
    matchExpireTime: minutesFromNow(9),
    relaxationLevel: 3,
    relaxationTimestamp: minutesAgo(4),
    matchAttempts: 1
  },
  {
    username: 'brimstone',
    status: 'matched',
    criteria: {
      games: [{ slug: 'valorant', weight: 9 }],
      gameMode: 'competitive',
      groupSize: { min: 5, max: 5 },
      regionPreference: 'preferred',
      regions: ['NA'],
      languagePreference: 'preferred',
      languages: ['English'],
      skillPreference: 'similar'
    },
    matchedLobbyName: 'Valorant Night Ranked',
    preselectedUsernames: ['viper', 'pixelwave'],
    searchStartTime: minutesAgo(16),
    matchExpireTime: minutesFromNow(2),
    relaxationLevel: 1,
    relaxationTimestamp: minutesAgo(6),
    matchAttempts: 3
  }
];

function shouldRunSeeder() {
  if (process.env.SKIP_DEV_SEED === 'true') {
    logger.info('Skipping dev data seed because SKIP_DEV_SEED flag is set');
    return false;
  }
  if (config.env === 'development') {
    return true;
  }
  if (process.env.ENABLE_DEV_SEED === 'true') {
    logger.warn('Dev data seed forced by ENABLE_DEV_SEED flag', { env: config.env });
    return true;
  }
  logger.debug('Dev data seed skipped for environment', { env: config.env });
  return false;
}

function ensureGame(gameMap, slug) {
  const game = gameMap.get(slug);
  if (!game) {
    throw new Error(`Missing seeded game for slug "${slug}"`);
  }
  return game;
}

function ensureUser(userMap, username) {
  const user = userMap.get(username);
  if (!user) {
    throw new Error(`Missing seeded user for username "${username}"`);
  }
  return user;
}

async function seedGames() {
  const gameMap = new Map();
  for (const seed of GAME_SEEDS) {
    let doc = await Game.findOne({ slug: seed.slug });
    if (!doc) {
      doc = new Game(seed);
    } else {
      doc.set(seed);
    }
    if (!doc.lastSyncedAt) {
      doc.lastSyncedAt = new Date();
    }
    if (!doc.syncStatus) {
      doc.syncStatus = 'synced';
    }
    if (!doc.maogaData) {
      doc.maogaData = {};
    }
    if (!doc.maogaData.lastActivity) {
      doc.maogaData.lastActivity = new Date();
    }
    await doc.save();
    gameMap.set(seed.slug, doc);
  }
  logger.info('Seeded dev games', { count: gameMap.size });
  return gameMap;
}

async function seedUsers(gameMap) {
  const userMap = new Map();

  for (const seed of USER_SEEDS) {
    const preferredGames = seed.preferredGames.map((pref) => ({
      gameId: ensureGame(gameMap, pref.slug)._id,
      weight: pref.weight
    }));

    const gameProfiles = seed.gameProfiles.map((profile) => {
      const payload = {
        gameId: ensureGame(gameMap, profile.slug)._id,
        inGameName: profile.inGameName,
        rank: profile.rank,
        skillLevel: profile.skillLevel,
        updatedAt: profile.updatedAt || new Date()
      };
      if (profile.stats) {
        payload.stats = new Map(Object.entries(profile.stats));
      }
      return payload;
    });

    let doc = await User.findOne({ email: seed.email });
    if (!doc) {
      doc = new User({
        email: seed.email,
        username: seed.username,
        hashedPassword: seed.password,
        role: seed.role,
        profile: seed.profile,
        gamingPreferences: {
          competitiveness: seed.preferences.competitiveness,
          preferredGames,
          regions: seed.preferences.regions,
          languages: seed.preferences.languages,
          playTimePreferences: seed.preferences.playTimePreferences
        },
        gameProfiles,
        karmaPoints: seed.karmaPoints,
        virtualCurrency: seed.virtualCurrency,
        status: 'active',
        lastActive: seed.lastActive
      });
    } else {
      doc.set('profile', seed.profile);
      doc.set('gamingPreferences', {
        competitiveness: seed.preferences.competitiveness,
        preferredGames,
        regions: seed.preferences.regions,
        languages: seed.preferences.languages,
        playTimePreferences: seed.preferences.playTimePreferences
      });
      doc.set('gameProfiles', gameProfiles);
      doc.set('role', seed.role);
      doc.set('status', 'active');
      doc.set('karmaPoints', seed.karmaPoints);
      doc.set('virtualCurrency', seed.virtualCurrency);
      doc.set('lastActive', seed.lastActive);
      doc.markModified('gamingPreferences');
      doc.markModified('gameProfiles');
    }

    await doc.save();
    userMap.set(seed.username, doc);
  }

  logger.info('Seeded dev users', { count: userMap.size });
  return userMap;
}

async function seedLobbies(userMap, gameMap) {
  const lobbyMap = new Map();

  for (const seed of LOBBY_SEEDS) {
    const game = ensureGame(gameMap, seed.gameSlug);
    const host = ensureUser(userMap, seed.hostUsername);

    const members = seed.members.map((member) => {
      const userDoc = ensureUser(userMap, member.username);
      const joinedAt =
        member.joinedAt ||
        (typeof member.joinedMinutesAgo === 'number'
          ? minutesAgo(member.joinedMinutesAgo)
          : new Date());
      const leftAt =
        typeof member.leftMinutesAgo === 'number'
          ? minutesAgo(member.leftMinutesAgo)
          : member.leftAt;
      return {
        userId: userDoc._id,
        status: member.status,
        isHost: Boolean(member.isHost),
        readyStatus: member.readyStatus ?? member.status === 'ready',
        joinedAt,
        leftAt
      };
    });

    let lobby = await Lobby.findOne({ name: seed.name, gameId: game._id });
    if (!lobby) {
      lobby = new Lobby({
        name: seed.name,
        status: seed.status,
        gameId: game._id,
        gameMode: seed.gameMode,
        hostId: host._id,
        members,
        capacity: seed.capacity,
        settings: seed.settings,
        region: seed.region,
        formedAt: seed.formedAt || new Date(),
        readyAt: seed.readyAt,
        activeAt: seed.activeAt,
        closedAt: seed.closedAt,
        autoMessages: seed.autoMessages !== undefined ? seed.autoMessages : true
      });
    } else {
      lobby.set({
        status: seed.status,
        gameMode: seed.gameMode,
        hostId: host._id,
        members,
        capacity: seed.capacity,
        settings: seed.settings,
        region: seed.region,
        formedAt: seed.formedAt || lobby.formedAt || new Date(),
        readyAt: seed.readyAt,
        activeAt: seed.activeAt,
        closedAt: seed.closedAt,
        autoMessages: seed.autoMessages !== undefined ? seed.autoMessages : lobby.autoMessages
      });
      lobby.gameId = game._id;
      lobby.markModified('members');
      lobby.markModified('capacity');
      lobby.markModified('settings');
    }

    await lobby.save();
    lobbyMap.set(seed.name, lobby);
  }

  logger.info('Seeded dev lobbies', { count: lobbyMap.size });
  return lobbyMap;
}

async function seedMatchRequests(userMap, gameMap, lobbyMap) {
  const matchRequests = [];

  for (const seed of MATCH_REQUEST_SEEDS) {
    const user = ensureUser(userMap, seed.username);
    const criteriaGames = seed.criteria.games.map((game) => ({
      gameId: ensureGame(gameMap, game.slug)._id,
      weight: game.weight
    }));

    const criteria = {
      games: criteriaGames,
      gameMode: seed.criteria.gameMode,
      groupSize: seed.criteria.groupSize,
      regionPreference: seed.criteria.regionPreference,
      regions: seed.criteria.regions,
      languagePreference: seed.criteria.languagePreference,
      languages: seed.criteria.languages,
      skillPreference: seed.criteria.skillPreference,
      scheduledTime: seed.criteria.scheduledTime
    };

    const preselectedUsers = (seed.preselectedUsernames || []).map(
      (username) => ensureUser(userMap, username)._id
    );

    const matchedLobbyId = seed.matchedLobbyName
      ? lobbyMap.get(seed.matchedLobbyName)?._id
      : undefined;

    let request = await MatchRequest.findOne({
      userId: user._id,
      status: seed.status
    });

    if (!request) {
      request = new MatchRequest({
        userId: user._id,
        status: seed.status,
        criteria,
        preselectedUsers,
        searchStartTime: seed.searchStartTime,
        matchExpireTime: seed.matchExpireTime,
        relaxationLevel: seed.relaxationLevel,
        relaxationTimestamp: seed.relaxationTimestamp,
        matchedLobbyId,
        matchAttempts: seed.matchAttempts ?? 0,
        lastProcessedAt: seed.lastProcessedAt
      });
    } else {
      request.set({
        status: seed.status,
        criteria,
        preselectedUsers,
        searchStartTime: seed.searchStartTime,
        matchExpireTime: seed.matchExpireTime,
        relaxationLevel: seed.relaxationLevel,
        relaxationTimestamp: seed.relaxationTimestamp,
        matchedLobbyId,
        matchAttempts: seed.matchAttempts ?? request.matchAttempts,
        lastProcessedAt: seed.lastProcessedAt
      });
      request.markModified('criteria');
      request.markModified('preselectedUsers');
      if (!matchedLobbyId) {
        request.matchedLobbyId = undefined;
      }
    }

    await request.save();
    matchRequests.push(request);
  }

  logger.info('Seeded dev match requests', { count: matchRequests.length });
}

async function seedDevData() {
  if (hasSeeded) {
    return;
  }

  if (!shouldRunSeeder()) {
    hasSeeded = true;
    return;
  }

  try {
    logger.info('Seeding baseline development data');
    const games = await seedGames();
    const users = await seedUsers(games);
    const lobbies = await seedLobbies(users, games);
    await seedMatchRequests(users, games, lobbies);
    logger.info('Baseline development data ready');
  } catch (error) {
    logger.error('Dev data seeding failed', { error: error.message, stack: error.stack });
    if (process.env.FAIL_ON_DEV_SEED_ERROR === 'true') {
      throw error;
    }
  } finally {
    hasSeeded = true;
  }
}

module.exports = { seedDevData };
