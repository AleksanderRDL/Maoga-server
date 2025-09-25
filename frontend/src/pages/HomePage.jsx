import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import GameCard from '../components/GameCard.jsx';
import StatPill from '../components/StatPill.jsx';
import apiClient from '../services/apiClient.js';
import { useAuth } from '../context/AuthContext.jsx';

const friendActivityMock = [
  {
    id: 'f1',
    name: 'Maria',
    handle: '@mferfly',
    status: 'Playing Baldur\'s Gate 3 (2/4)',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Maria',
    ago: '5m ago'
  },
  {
    id: 'f2',
    name: 'Tessa',
    handle: '@myBad',
    status: 'Just queued for League of Legends',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Tessa',
    ago: '12m ago'
  },
  {
    id: 'f3',
    name: 'Cassie',
    handle: '@glitchGoddess',
    status: 'Streaming Valorant customs',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Cassie',
    ago: '22m ago'
  },
  {
    id: 'f4',
    name: 'Nora',
    handle: '@thunderNeko',
    status: 'Looking for Apex squad',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Nora',
    ago: '40m ago'
  }
];

const lobbySpotlightMock = [
  {
    id: 'l1',
    game: 'League of Legends',
    title: 'Need 2 more for Aram',
    members: '2/5',
    language: 'English'
  },
  {
    id: 'l2',
    game: 'Minecraft',
    title: 'Building the Empire State',
    members: '3/20',
    language: 'Creative'
  },
  {
    id: 'l3',
    game: 'Tetris',
    title: 'Ranked duo grind',
    members: '1/2',
    language: 'Any'
  }
];

const HomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [trending, setTrending] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [activeGame, setActiveGame] = useState(null);
  const [loadingTrending, setLoadingTrending] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const [queueStatus, setQueueStatus] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const displayName = user?.profile?.displayName || user?.username || 'Commander';

  const featuredSession = useMemo(
    () => ({
      title: 'Scheduled session',
      // TODO: Replace with real session data once backend endpoint is ready.
      startTime: dayjs().add(2, 'hour'),
      game: 'League of Legends',
      squadSize: '10/10',
      vibe: 'Weekends only',
      voice: 'Squad channel #aram'
    }),
    []
  );

  const fetchTrending = useCallback(async () => {
    setLoadingTrending(true);
    setError(null);
    try {
      const response = await apiClient.get('/games/trending', { params: { limit: 12 } });
      const games = response.data?.data?.games || [];
      setTrending(games);
      setActiveGame((prev) => prev || games[0] || null);
    } catch (err) {
      console.error('Failed to fetch trending games', err);
      setError('Unable to load trending games right now.');
    } finally {
      setLoadingTrending(false);
    }
  }, []);

  const fetchQueueStatus = useCallback(async () => {
    setCheckingStatus(true);
    try {
      const response = await apiClient.get('/matchmaking/status');
      setQueueStatus(response.data?.data || null);
    } catch (err) {
      console.error('Failed to fetch matchmaking status', err);
    } finally {
      setCheckingStatus(false);
    }
  }, []);

  useEffect(() => {
    fetchTrending();
    fetchQueueStatus();
  }, [fetchQueueStatus, fetchTrending]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return undefined;
    }

    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await apiClient.get('/games', {
          params: {
            q: searchQuery,
            limit: 12
          }
        });
        setSearchResults(response.data?.data?.games || []);
      } catch (err) {
        console.error('Game search failed', err);
        setError('Search failed. Try a different title.');
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const handleJoinMatch = (game) => {
    navigate('/matchmaking', { state: { focusGame: game } });
  };

  const queueSummary = useMemo(() => {
    if (!queueStatus) {
      return 'You are not currently queued.';
    }
    if (queueStatus.matchRequest === null) {
      return queueStatus.message || 'Queue status unavailable.';
    }
    if (queueStatus.request) {
      const queueInfo = queueStatus.queueInfo;
      const mode = queueStatus.request.criteria?.gameMode || 'match';
      const matches = queueInfo?.potentialMatches ?? 0;
      const wait = queueInfo?.estimatedWaitTime
        ? `${Math.round(queueInfo.estimatedWaitTime / 1000)}s`
        : '—';
      return `Searching ${mode} · ${matches} potential lobbies · ETA ${wait}`;
    }
    return 'Queue status unavailable.';
  }, [queueStatus]);

  const activeGameMeta = useMemo(() => {
    if (!activeGame) {
      return null;
    }
    const modes = (activeGame.gameModes || []).map((mode) => mode.name).slice(0, 3).join(' • ');
    const platforms = (activeGame.platforms || [])
      .map((platform) => platform.abbreviation || platform.name)
      .slice(0, 4)
      .join(' • ');
    const rating = activeGame.rating ? Math.round(activeGame.rating) : null;

    return {
      modes,
      platforms,
      rating,
      summary: activeGame.summary || activeGame.description || 'No summary provided yet.'
    };
  }, [activeGame]);

  return (
    <div className="page page--home">
      <div className="home-layout">
        <div className="home-main">
          <section className="surface surface--hero">
            <div className="surface__header">
              <div>
                <h2>Ready when you are, {displayName} ✨</h2>
                <p>Sync your squad, jump into matchmaking or browse what\'s trending.</p>
              </div>
              <div className="surface__actions">
                <button type="button" className="primary-button" onClick={() => navigate('/matchmaking')}>
                  Start matchmaking
                </button>
                <button type="button" className="ghost-button" onClick={fetchQueueStatus} disabled={checkingStatus}>
                  {checkingStatus ? 'Refreshing…' : 'Refresh status'}
                </button>
              </div>
            </div>
            <div className="home-quick-stats">
              <StatPill label="Queue" value={queueStatus?.request ? 'Active' : 'Idle'} variant="blue" />
              <StatPill label="Shards" value={user?.virtualCurrency ?? 0} variant="pink" />
              <StatPill label="XP" value={user?.karmaPoints ?? 0} variant="purple" />
            </div>
          </section>

          <section className="surface surface--session">
            <div className="surface__header">
              <div>
                <h3>{featuredSession.title}</h3>
                <p className="surface__subtitle">
                  {featuredSession.game} · Starts {featuredSession.startTime.fromNow()}
                </p>
              </div>
              <button type="button" className="icon-button" onClick={() => navigate('/lobbies')}>
                ➜
              </button>
            </div>
            <div className="session-grid">
              <div>
                <strong>Squad</strong>
                <p>{featuredSession.squadSize}</p>
              </div>
              <div>
                <strong>Voice</strong>
                <p>{featuredSession.voice}</p>
              </div>
              <div>
                <strong>Vibe</strong>
                <p>{featuredSession.vibe}</p>
              </div>
            </div>
            <p className="session-note">
              Waiting on 2 teammates to ready up. Share the invite or jump to the lobby page to hype them up.
            </p>
          </section>

          <section className="surface surface--queue">
            <div className="surface__header">
              <div>
                <h3>Matchmaking tracker</h3>
                <p className="surface__subtitle">Live status of your current queue</p>
              </div>
              <button type="button" className="link" onClick={() => navigate('/matchmaking')}>
                Manage queue →
              </button>
            </div>
            <div className="queue-summary">{queueSummary}</div>
            {queueStatus?.request ? (
              <div className="queue-meta">
                <StatPill
                  label="Mode"
                  value={queueStatus.request.criteria?.gameMode || '—'}
                  variant="purple"
                />
                <StatPill
                  label="Regions"
                  value={(queueStatus.request.criteria?.regions || ['Global']).join(', ')}
                  variant="blue"
                />
                <StatPill
                  label="Players"
                  value={`${queueStatus.request.criteria?.groupSize?.min || 1}-${
                    queueStatus.request.criteria?.groupSize?.max || 5
                  }`}
                  variant="pink"
                />
              </div>
            ) : null}
            <p className="queue-note">
              We will auto-redirect you to the lobby hub once a match is locked in.
              {/* TODO: Trigger automatic lobby navigation when backend exposes match identifiers. */}
            </p>
          </section>

          <section className="surface surface--library">
            <div className="surface__header surface__header--stack">
              <div>
                <h3>Search for a game</h3>
                <p className="surface__subtitle">Browse the library and jump into a lobby when you are ready.</p>
              </div>
              <div className="search-box">
                <input
                  type="search"
                  placeholder="League of Legends, Valorant, It Takes Two…"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
                <span>{searching ? 'Searching…' : '🔍'}</span>
              </div>
            </div>
            {error ? <div className="page__error">{error}</div> : null}
            <div className="surface__header">
              <h4>Trending now</h4>
              <span>{loadingTrending ? 'Loading…' : `${trending.length} games`}</span>
            </div>
            <div className="game-grid">
              {trending.map((game) => (
                <GameCard
                  key={game._id}
                  game={game}
                  onSelect={() => setActiveGame(game)}
                  isActive={activeGame?._id === game._id}
                  actionSlot={
                    <button type="button" onClick={() => handleJoinMatch(game)}>
                      Matchmake
                    </button>
                  }
                />
              ))}
            </div>
            {searchResults.length > 0 ? (
              <>
                <div className="surface__header">
                  <h4>Search results</h4>
                  <span>{searchResults.length} matches</span>
                </div>
                <div className="game-grid">
                  {searchResults.map((game) => (
                    <GameCard
                      key={game._id}
                      game={game}
                      onSelect={() => setActiveGame(game)}
                      actionSlot={
                        <button type="button" onClick={() => handleJoinMatch(game)}>
                          Queue up
                        </button>
                      }
                    />
                  ))}
                </div>
              </>
            ) : null}
            {activeGameMeta ? (
              <div className="surface surface--nested">
                <div className="surface__header">
                  <h4>{activeGame.name}</h4>
                  <button type="button" className="link" onClick={() => handleJoinMatch(activeGame)}>
                    Start matchmaking →
                  </button>
                </div>
                <p>{activeGameMeta.summary}</p>
                <div className="queue-meta">
                  {activeGameMeta.rating ? (
                    <StatPill label="Rating" value={`${activeGameMeta.rating}%`} variant="purple" />
                  ) : null}
                  {activeGameMeta.modes ? (
                    <StatPill label="Modes" value={activeGameMeta.modes} variant="blue" />
                  ) : null}
                  {activeGameMeta.platforms ? (
                    <StatPill label="Platforms" value={activeGameMeta.platforms} variant="pink" />
                  ) : null}
                </div>
              </div>
            ) : null}
          </section>
        </div>

        <aside className="home-sidebar">
          <section className="surface surface--profile">
            <div className="surface__header">
              <h3>Personal overview</h3>
              <span className="surface__subtitle">Tweak matchmaking preferences in your profile</span>
            </div>
            <div className="profile-overview">
              <div>
                <span className="label">Playstyle</span>
                <strong>{user?.gamingPreferences?.competitiveness || 'Balanced'}</strong>
              </div>
              <div>
                <span className="label">Regions</span>
                <strong>
                  {(user?.gamingPreferences?.regions || ['Global'])
                    .slice(0, 2)
                    .join(', ')}
                </strong>
              </div>
              <div>
                <span className="label">Languages</span>
                <strong>
                  {(user?.gamingPreferences?.languages || ['English'])
                    .slice(0, 2)
                    .join(', ')}
                </strong>
              </div>
            </div>
            <button type="button" className="ghost-button" onClick={() => navigate('/profile')}>
              Adjust profile
            </button>
          </section>

          <section className="surface surface--friends">
            <div className="surface__header">
              <h3>Friend activity</h3>
              <button type="button" className="link" onClick={() => navigate('/chat')}>
                Open messages →
              </button>
            </div>
            <ul className="friend-feed">
              {friendActivityMock.map((friend) => (
                <li key={friend.id}>
                  <img src={friend.avatar} alt={friend.name} />
                  <div>
                    <strong>
                      {friend.name}
                      <span>{friend.handle}</span>
                    </strong>
                    <p>{friend.status}</p>
                  </div>
                  <span className="timestamp">{friend.ago}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="surface surface--lobbies">
            <div className="surface__header">
              <h3>Quick lobbies</h3>
              <span className="surface__subtitle">What your community is hosting</span>
            </div>
            <ul className="lobby-spotlight">
              {lobbySpotlightMock.map((lobby) => (
                <li key={lobby.id}>
                  <div>
                    <strong>{lobby.title}</strong>
                    <p>
                      {lobby.game} · {lobby.members}
                    </p>
                  </div>
                  <button type="button" onClick={() => navigate('/lobbies')}>
                    Join
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
};

export default HomePage;
