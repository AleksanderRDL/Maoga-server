const now = Date.now();

const minutesAgo = (minutes) => new Date(now - minutes * 60 * 1000).toISOString();

const createMember = ({
  id,
  displayName,
  username,
  avatar,
  ready = false,
  isHost = false,
  joinedMinutesAgo = 30
}) => ({
  _id: `${id}-member`,
  isHost,
  status: ready ? 'ready' : 'joined',
  readyStatus: ready,
  joinedAt: minutesAgo(joinedMinutesAgo),
  userId: {
    _id: id,
    username,
    profile: {
      displayName,
      avatarUrl: avatar
    }
  }
});

const baseMockLobbies = [
  {
    _id: 'mock-aram-1',
    isMock: true,
    name: 'Twilight Howlers',
    status: 'forming',
    gameId: { name: 'League of Legends' },
    gameMode: 'ARAM',
    region: 'NA East',
    capacity: { min: 5, max: 5 },
    tags: ['Voice chat', 'Age 18-26', 'English', 'Weekends only'],
    members: [
      createMember({
        id: 'mock-emily',
        displayName: 'Emily',
        username: 'shadowSiren',
        avatar: 'https://i.pravatar.cc/120?img=5',
        ready: true,
        isHost: true,
        joinedMinutesAgo: 42
      }),
      createMember({
        id: 'mock-nora',
        displayName: 'Nora',
        username: 'arcaneBlitz',
        avatar: 'https://i.pravatar.cc/120?img=12',
        ready: true,
        joinedMinutesAgo: 28
      }),
      createMember({
        id: 'mock-pernille',
        displayName: 'Pernille',
        username: 'pacassa',
        avatar: 'https://i.pravatar.cc/120?img=47',
        ready: false,
        joinedMinutesAgo: 12
      })
    ]
  },
  {
    _id: 'mock-valorant-1',
    isMock: true,
    name: 'Radiant Rush',
    status: 'forming',
    gameId: { name: 'Valorant' },
    gameMode: 'Competitive - Ascent',
    region: 'EU West',
    capacity: { min: 5, max: 5 },
    tags: ['Voice chat', 'Calm comms', 'Any rank welcome'],
    members: [
      createMember({
        id: 'mock-felix',
        displayName: 'Felix',
        username: 'peakBreaker',
        avatar: 'https://i.pravatar.cc/120?img=23',
        ready: true,
        isHost: true,
        joinedMinutesAgo: 65
      }),
      createMember({
        id: 'mock-alina',
        displayName: 'Alina',
        username: 'smokegirl',
        avatar: 'https://i.pravatar.cc/120?img=15',
        joinedMinutesAgo: 34
      })
    ]
  },
  {
    _id: 'mock-destiny-1',
    isMock: true,
    name: 'Nightfall Vanguard',
    status: 'forming',
    gameId: { name: 'Destiny 2' },
    gameMode: 'Nightfall strike',
    region: 'Global',
    capacity: { min: 6, max: 6 },
    tags: ['Mic required', 'Power 1810+', 'Experienced only'],
    members: [
      createMember({
        id: 'mock-cato',
        displayName: 'Cato',
        username: 'orbwalker',
        avatar: 'https://i.pravatar.cc/120?img=31',
        ready: true,
        isHost: true,
        joinedMinutesAgo: 85
      }),
      createMember({
        id: 'mock-rhea',
        displayName: 'Rhea',
        username: 'suncaller',
        avatar: 'https://i.pravatar.cc/120?img=9',
        ready: true,
        joinedMinutesAgo: 44
      }),
      createMember({
        id: 'mock-jules',
        displayName: 'Jules',
        username: 'titanfall',
        avatar: 'https://i.pravatar.cc/120?img=54',
        joinedMinutesAgo: 20
      })
    ]
  }
];

const clone = (value) => JSON.parse(JSON.stringify(value));

const computeCounts = (members = []) => {
  const active = members.filter((member) => ['joined', 'ready'].includes(member.status));
  const ready = active.filter((member) => member.readyStatus || member.status === 'ready');
  return {
    memberCount: active.length,
    readyCount: ready.length
  };
};

const withCounts = (lobby) => {
  const cloned = clone(lobby);
  const { memberCount, readyCount } = computeCounts(cloned.members);
  cloned.memberCount = memberCount;
  cloned.readyCount = readyCount;
  return cloned;
};

export const MOCK_ACTIVE_LOBBIES = baseMockLobbies.map(withCounts);

export const cloneMockLobby = (lobbyId) => {
  const lobby = baseMockLobbies.find((item) => item._id === lobbyId);
  return lobby ? withCounts(lobby) : null;
};

export const isMockLobbyId = (lobbyId) => typeof lobbyId === 'string' && lobbyId.startsWith('mock-');

export const getMockLobbyMessages = (lobbyId) => {
  const messages = mockMessages[lobbyId];
  return messages ? messages.map((msg) => ({ ...msg })) : [];
};

export const applyMemberUpdate = (lobby, members) => {
  const nextLobby = { ...lobby, members: clone(members) };
  const { memberCount, readyCount } = computeCounts(nextLobby.members);
  nextLobby.memberCount = memberCount;
  nextLobby.readyCount = readyCount;
  return nextLobby;
};

const mockMessages = {
  'mock-aram-1': [
    {
      _id: 'mock-msg-1',
      senderId: clone(baseMockLobbies[0].members[0].userId),
      content: 'Hey everyone!',
      createdAt: minutesAgo(5)
    },
    {
      _id: 'mock-msg-2',
      senderId: clone(baseMockLobbies[0].members[2].userId),
      content: 'Hey Pernille. Add you on Discord',
      createdAt: minutesAgo(4)
    },
    {
      _id: 'mock-msg-3',
      senderId: clone(baseMockLobbies[0].members[2].userId),
      content: 'Do you have channel, that we all can talk in?',
      createdAt: minutesAgo(3)
    }
  ],
  'mock-valorant-1': [
    {
      _id: 'mock-msg-4',
      senderId: clone(baseMockLobbies[1].members[0].userId),
      content: 'Need anchors who can call rotations.',
      createdAt: minutesAgo(12)
    }
  ],
  'mock-destiny-1': [
    {
      _id: 'mock-msg-5',
      senderId: clone(baseMockLobbies[2].members[0].userId),
      content: 'Bring arc and void builds please.',
      createdAt: minutesAgo(18)
    }
  ]
};

export default MOCK_ACTIVE_LOBBIES;
