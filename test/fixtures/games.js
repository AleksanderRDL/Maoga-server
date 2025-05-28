const testGames = [
  {
    name: 'Counter-Strike 2',
    slug: 'counter-strike-2',
    description: 'The next evolution of Counter-Strike',
    summary: 'A competitive tactical shooter',
    coverImage: {
      url: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1234.jpg',
      thumbnailUrl: 'https://images.igdb.com/igdb/image/upload/t_thumb/co1234.jpg'
    },
    genres: [
      { id: 5, name: 'Shooter' },
      { id: 14, name: 'Sport' }
    ],
    platforms: [{ id: 6, name: 'PC (Microsoft Windows)' }],
    gameModes: [
      { id: 2, name: 'Multiplayer' },
      { id: 3, name: 'Co-operative' }
    ],
    releaseDate: new Date('2023-09-27'),
    rating: 85,
    ratingCount: 1000,
    popularity: 95,
    externalIds: {
      igdb: 123456,
      steam: '730'
    },
    multiplayer: {
      online: true,
      offline: false,
      maxPlayers: 10,
      minPlayers: 2,
      coop: false
    },
    features: {
      singlePlayer: false,
      multiPlayer: true,
      coop: false,
      competitive: true,
      crossPlatform: false
    }
  },
  {
    name: 'The Legend of Zelda: Tears of the Kingdom',
    slug: 'the-legend-of-zelda-tears-of-the-kingdom',
    description: 'The sequel to The Legend of Zelda: Breath of the Wild',
    summary: 'An open-world action-adventure game',
    coverImage: {
      url: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co5678.jpg',
      thumbnailUrl: 'https://images.igdb.com/igdb/image/upload/t_thumb/co5678.jpg'
    },
    genres: [
      { id: 31, name: 'Adventure' },
      { id: 12, name: 'Role-playing (RPG)' }
    ],
    platforms: [{ id: 130, name: 'Nintendo Switch' }],
    gameModes: [{ id: 1, name: 'Single player' }],
    releaseDate: new Date('2023-05-12'),
    rating: 96,
    ratingCount: 5000,
    popularity: 98,
    externalIds: {
      igdb: 119388
    },
    multiplayer: {
      online: false,
      offline: false,
      maxPlayers: 1,
      minPlayers: 1,
      coop: false
    },
    features: {
      singlePlayer: true,
      multiPlayer: false,
      coop: false,
      competitive: false,
      crossPlatform: false
    }
  },
  {
    name: 'Fortnite',
    slug: 'fortnite',
    description: 'A battle royale game where 100 players fight to be the last one standing',
    summary: 'Popular battle royale game with building mechanics',
    coverImage: {
      url: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co9999.jpg',
      thumbnailUrl: 'https://images.igdb.com/igdb/image/upload/t_thumb/co9999.jpg'
    },
    genres: [
      { id: 5, name: 'Shooter' },
      { id: 31, name: 'Adventure' }
    ],
    platforms: [
      { id: 6, name: 'PC (Microsoft Windows)' },
      { id: 48, name: 'PlayStation 4' },
      { id: 49, name: 'Xbox One' },
      { id: 130, name: 'Nintendo Switch' }
    ],
    gameModes: [
      { id: 2, name: 'Multiplayer' },
      { id: 3, name: 'Co-operative' },
      { id: 5, name: 'Battle Royale' }
    ],
    releaseDate: new Date('2017-07-25'),
    rating: 78,
    ratingCount: 10000,
    popularity: 99,
    externalIds: {
      igdb: 1905,
      epic: 'fortnite'
    },
    multiplayer: {
      online: true,
      offline: false,
      maxPlayers: 100,
      minPlayers: 1,
      coop: true
    },
    features: {
      singlePlayer: false,
      multiPlayer: true,
      coop: true,
      competitive: true,
      crossPlatform: true
    },
    maogaData: {
      playerCount: 5000,
      activeLobbies: 250,
      trending: true,
      lastActivity: new Date()
    }
  },
  {
    name: 'Minecraft',
    slug: 'minecraft',
    description: 'A sandbox game where players can build and explore in a blocky 3D world',
    summary: 'The best-selling video game of all time',
    coverImage: {
      url: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1111.jpg',
      thumbnailUrl: 'https://images.igdb.com/igdb/image/upload/t_thumb/co1111.jpg'
    },
    genres: [
      { id: 31, name: 'Adventure' },
      { id: 13, name: 'Simulator' },
      { id: 30, name: 'Puzzle' }
    ],
    platforms: [
      { id: 6, name: 'PC (Microsoft Windows)' },
      { id: 48, name: 'PlayStation 4' },
      { id: 49, name: 'Xbox One' },
      { id: 130, name: 'Nintendo Switch' },
      { id: 34, name: 'Android' },
      { id: 39, name: 'iOS' }
    ],
    gameModes: [
      { id: 1, name: 'Single player' },
      { id: 2, name: 'Multiplayer' },
      { id: 3, name: 'Co-operative' }
    ],
    releaseDate: new Date('2011-11-18'),
    rating: 93,
    ratingCount: 50000,
    popularity: 100,
    externalIds: {
      igdb: 121
    },
    multiplayer: {
      online: true,
      offline: true,
      maxPlayers: 30,
      minPlayers: 1,
      coop: true
    },
    features: {
      singlePlayer: true,
      multiPlayer: true,
      coop: true,
      competitive: false,
      crossPlatform: true
    },
    maogaData: {
      playerCount: 8000,
      activeLobbies: 400,
      trending: true,
      lastActivity: new Date()
    }
  }
];

// Mock IGDB response format
const mockIGDBGames = [
  {
    id: 123456,
    name: 'Counter-Strike 2',
    slug: 'counter-strike-2',
    summary: 'A competitive tactical shooter',
    cover: { image_id: 'co1234' },
    screenshots: [{ image_id: 'sc1234' }, { image_id: 'sc5678' }],
    videos: [{ name: 'Launch Trailer', video_id: 'abc123' }],
    genres: [{ id: 5, name: 'Shooter' }],
    platforms: [{ id: 6, name: 'PC (Microsoft Windows)' }],
    game_modes: [{ id: 2, name: 'Multiplayer' }],
    release_dates: [{ date: 1695772800 }], // Unix timestamp
    rating: 85,
    rating_count: 1000,
    popularity: 95,
    multiplayer_modes: [
      {
        onlinemax: 10,
        onlinemin: 2,
        offlinemax: 0
      }
    ]
  }
];

module.exports = {
  testGames,
  mockIGDBGames
};
