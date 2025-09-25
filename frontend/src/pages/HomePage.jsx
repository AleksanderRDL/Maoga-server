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
    status: "Playing Baldur's Gate 3 (2/4)",
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

const buzzHighlights = [
  {
    id: 'h1',
    title: 'Friends online',
    value: 9,
    caption: 'Send them a ping from the friends hub'
  },
  {
    id: 'h2',
    title: 'New achievements',
    value: 3,
    caption: 'Claim them before reset'
  },
  {
    id: 'h3',
    title: 'Open invites',
    value: 4,
    caption: 'Jump in before they fill up'
  }
];

const gameSpotlights = [
  {
    id: 'g1',
    title: 'League of Legends',
    description: 'Patch 14.3 lands tomorrow. Expect balance changes to support mains.'
  },
  {
    id: 'g2',
    title: 'Valorant',
    description: 'New agent teaser dropped. Ability reveal stream tonight at 19:00 CET.'
  },
  {
    id: 'g3',
    title: "Baldur's Gate 3",
    description: 'Community challenge unlocked: finish Act 2 with zero long rests. 👀'
  }
];

const friendSpotlights = [
  {
    id: 'fs1',
    title: 'Emily & Zoe',
    description: '5 days of duo queue in Apex Legends. They are on fire!'
  },
  {
    id: 'fs2',
    title: 'Maria',
    description: 'Unlocked Emerald duo streak in League of Legends.'
  },
  {
    id: 'fs3',
    title: 'Pernille',
    description: 'Hosting a creative Minecraft weekend build-off. RSVP open now.'
  }
];

const HomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [trending, setTrending] = useState([]);
  const [activeGame, setActiveGame] = useState(null);
  const [loadingTrending, setLoadingTrending] = useState(false);
  const [error, setError] = useState(null);

  const displayName = user?.profile?.displayName || user?.username || 'Commander';

  const favouriteGames = useMemo(() => {
    const games = (user?.gameProfiles || [])
      .map((profile) => profile.gameId?.name)
      .filter(Boolean)
      .slice(0, 2);
    return games.join(', ');
  }, [user]);

  const featuredSession = useMemo(
    () => ({
      title: 'Scheduled session',
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
      const response = await apiClient.get('/games/trending', { params: { limit: 8 } });
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

  useEffect(() => {
    fetchTrending();
  }, [fetchTrending]);

  const handleJoinMatch = (game) => {
    navigate('/matchmaking', { state: { focusGame: game } });
  };

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
                <p>Sync your squad, jump into matchmaking or browse what's trending.</p>
              </div>
              <div className="surface__actions">
                <button type="button" className="primary-button" onClick={() => navigate('/matchmaking')}>
                  Start matchmaking
                </button>
                <button type="button" className="ghost-button" onClick={() => navigate('/friends')}>
                  Check friends
                </button>
              </div>
            </div>
            <div className="home-quick-stats">
              <StatPill label="Shards" value={user?.virtualCurrency ?? 0} variant="pink" />
              <StatPill label="XP" value={user?.karmaPoints ?? 0} variant="purple" />
              <StatPill
                label="Preferred regions"
                value={(user?.gamingPreferences?.regions || ['Global']).slice(0, 2).join(', ')}
                variant="blue"
              />
            </div>
          </section>

          <section className="surface surface--buzz">
            <div className="surface__header">
              <div>
                <h3>What's buzzing</h3>
                <p className="surface__subtitle">Quick hits from across your network</p>
              </div>
            </div>
            <div className="buzz-grid">
              {buzzHighlights.map((highlight) => (
                <article key={highlight.id}>
                  <strong>{highlight.value}</strong>
                  <span>{highlight.title}</span>
                  <p>{highlight.caption}</p>
                </article>
              ))}
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

          <section className="surface surface--library">
            <div className="surface__header surface__header--stack">
              <div>
                <h3>Trending games</h3>
                <p className="surface__subtitle">Tap into the hottest queues right now</p>
              </div>
              <button type="button" className="link" onClick={() => navigate('/matchmaking')}>
                Open matchmaking →
              </button>
            </div>
            {error ? <div className="page__error">{error}</div> : null}
            <div className="game-grid">
              {loadingTrending
                ? Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="game-card game-card--placeholder" />
                  ))
                : trending.map((game) => (
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
              <span className="surface__subtitle">Tune your matchmaking defaults in your profile</span>
            </div>
            <div className="profile-overview">
              <div>
                <span className="label">Playstyle</span>
                <strong>{user?.gamingPreferences?.competitiveness || 'Balanced'}</strong>
              </div>
              <div>
                <span className="label">Languages</span>
                <strong>
                  {(user?.gamingPreferences?.languages || ['English']).slice(0, 2).join(', ')}
                </strong>
              </div>
              <div>
                <span className="label">Favourite games</span>
                <strong>{favouriteGames || 'Add in profile'}</strong>
              </div>
            </div>
            <button type="button" className="ghost-button" onClick={() => navigate('/profile')}>
              Adjust profile
            </button>
          </section>

          <section className="surface surface--spotlight">
            <div className="surface__header">
              <h3>Game spotlights</h3>
            </div>
            <ul className="news-list">
              {gameSpotlights.map((spotlight) => (
                <li key={spotlight.id}>
                  <strong>{spotlight.title}</strong>
                  <p>{spotlight.description}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="surface surface--friends">
            <div className="surface__header">
              <h3>Friend spotlights</h3>
              <button type="button" className="link" onClick={() => navigate('/friends')}>
                Visit friends →
              </button>
            </div>
            <ul className="news-list">
              {friendSpotlights.map((spotlight) => (
                <li key={spotlight.id}>
                  <strong>{spotlight.title}</strong>
                  <p>{spotlight.description}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="surface surface--friends">
            <div className="surface__header">
              <h3>Friend activity</h3>
              <button type="button" className="link" onClick={() => navigate('/friends')}>
                Say hi →
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
        </aside>
      </div>
    </div>
  );
};

export default HomePage;
