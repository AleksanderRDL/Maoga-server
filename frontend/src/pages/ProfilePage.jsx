import { useCallback, useEffect, useMemo, useState } from 'react';
import apiClient from '../services/apiClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getGameArt } from '../services/gameArt.js';

const avatarSeeds = ['NovaFox', 'PixelMage', 'StarKnight', 'VoidSong', 'GlitchSprite', 'AuraBloom'];

const socialPlatforms = [
  { id: 'discord', label: 'Discord', placeholder: 'username#0000' },
  { id: 'riot', label: 'Riot ID', placeholder: 'summoner#EUW' },
  { id: 'steam', label: 'Steam', placeholder: 'steamcommunity.com/id/you' },
  { id: 'xbox', label: 'Xbox', placeholder: 'Gamertag' },
  { id: 'psn', label: 'PlayStation', placeholder: 'PSN ID' }
];

const defaultFeed = [
  {
    id: 'feed1',
    title: 'Reached Platinum support',
    description: 'Thanks to the squad! Time to learn jungle next.',
    timestamp: '2h ago'
  },
  {
    id: 'feed2',
    title: 'Unlocked Riot buddy pass',
    description: 'Invite sent to Maria. 1 more token available.',
    timestamp: '1d ago'
  }
];

const profileTips = [
  {
    id: 'tip1',
    title: 'Complete your bio',
    description: 'A few personal lines help squadmates connect faster.'
  },
  {
    id: 'tip2',
    title: 'Add more languages',
    description: 'Broaden your matchmaking pool with secondary languages.'
  },
  {
    id: 'tip3',
    title: 'Link socials',
    description: 'Make it easier for friends to coordinate outside Maoga.'
  }
];

const ProfilePage = () => {
  const { user, refreshProfile, logout } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [competitiveness, setCompetitiveness] = useState('balanced');
  const [regions, setRegions] = useState('');
  const [languages, setLanguages] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(avatarSeeds[0]);
  const [socials, setSocials] = useState(() =>
    socialPlatforms.reduce((acc, platform) => ({ ...acc, [platform.id]: '' }), {})
  );
  const [linkedGames, setLinkedGames] = useState([]);
  const [gameSuggestions, setGameSuggestions] = useState([]);
  const [gameOptions, setGameOptions] = useState([]);
  const [gameSearch, setGameSearch] = useState('');
  const [loadingGameOptions, setLoadingGameOptions] = useState(false);
  const [gameSearchError, setGameSearchError] = useState(null);
  const [feedEntries, setFeedEntries] = useState(defaultFeed);
  const [feedDraft, setFeedDraft] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [localNotice, setLocalNotice] = useState(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.profile?.displayName || '');
      setBio(user.profile?.bio || '');
      setCompetitiveness(user.gamingPreferences?.competitiveness || 'balanced');
      setRegions((user.gamingPreferences?.regions || []).join(', '));
      setLanguages((user.gamingPreferences?.languages || []).join(', '));
      if (user.profile?.avatarSeed) {
        setSelectedAvatar(user.profile.avatarSeed);
      }
      if (user.socials) {
        setSocials((prev) => ({ ...prev, ...user.socials }));
      }
      if (Array.isArray(user.gameProfiles) && user.gameProfiles.length > 0) {
        setLinkedGames(
          user.gameProfiles.map((profile) => ({
            id: profile._id,
            gameId: profile.gameId?._id,
            title: profile.gameId?.name || 'Game',
            role: profile.role || profile.rank || '',
            handle: profile.inGameName || '',
            gameData: profile.gameId || { name: profile.gameId?.name }
          }))
        );
      }
    }
  }, [user]);

  const avatarOptions = useMemo(
    () =>
      avatarSeeds.map((seed) => ({
        seed,
        url: `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}`
      })),
    []
  );

  const loadTrendingGames = useCallback(async () => {
    try {
      const response = await apiClient.get('/games/trending', { params: { limit: 8 } });
      const games = response.data?.data?.games || [];
      setGameSuggestions(games);
      setGameOptions(games);
    } catch (err) {
      console.error('Failed to load trending games', err);
    }
  }, []);

  useEffect(() => {
    loadTrendingGames();
  }, [loadTrendingGames]);

  useEffect(() => {
    const query = gameSearch.trim();
    if (query.length < 2) {
      setGameOptions(gameSuggestions);
      setGameSearchError(null);
      return undefined;
    }

    const timeout = setTimeout(async () => {
      setLoadingGameOptions(true);
      try {
        const response = await apiClient.get('/games', {
          params: { q: query, limit: 12 }
        });
        const games = response.data?.data?.games || [];
        setGameOptions(games);
        setGameSearchError(games.length === 0 ? 'No games found. Try another title.' : null);
      } catch (err) {
        console.error('Game search failed', err);
        setGameSearchError('Unable to search games right now.');
      } finally {
        setLoadingGameOptions(false);
      }
    }, 350);

    return () => clearTimeout(timeout);
  }, [gameSearch, gameSuggestions]);

  const saveProfile = async (event) => {
    event.preventDefault();
    setUpdating(true);
    setFeedback(null);
    try {
      await apiClient.patch('/users/me', {
        displayName: displayName || undefined,
        bio: bio || undefined,
        avatarSeed: selectedAvatar
      });
      await refreshProfile();
      setFeedback('Profile updated successfully');
    } catch (err) {
      const message = err.response?.data?.message || err.response?.data?.error || err.message;
      setFeedback(message || 'Failed to update profile');
    } finally {
      setUpdating(false);
    }
  };

  const savePreferences = async (event) => {
    event.preventDefault();
    setUpdating(true);
    setFeedback(null);
    try {
      await apiClient.patch('/users/me/preferences', {
        competitiveness,
        regions: regions
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        languages: languages
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      });
      await refreshProfile();
      setFeedback('Preferences saved');
    } catch (err) {
      const message = err.response?.data?.message || err.response?.data?.error || err.message;
      setFeedback(message || 'Failed to save preferences');
    } finally {
      setUpdating(false);
    }
  };

  const handleSocialChange = (platformId, value) => {
    setSocials((prev) => ({ ...prev, [platformId]: value }));
  };

  const handleSaveSocials = (event) => {
    event.preventDefault();
    setLocalNotice('Social links saved locally. TODO: persist to backend when endpoint is available.');
  };

  const handleSelectGame = (game) => {
    if (!game?._id) {
      return;
    }
    setLinkedGames((prev) => {
      if (prev.some((entry) => entry.gameId === game._id)) {
        setLocalNotice('That game is already in your showcase.');
        return prev;
      }
      const nextGame = {
        id: `local-${Date.now()}`,
        gameId: game._id,
        title: game.name,
        role: '',
        handle: '',
        gameData: game
      };
      setLocalNotice('Game added to your showcase. Sync coming soon.');
      return [nextGame, ...prev];
    });
  };

  const updateGameEntry = (gameId, field, value) => {
    setLinkedGames((prev) =>
      prev.map((game) => (game.id === gameId ? { ...game, [field]: value } : game))
    );
  };

  const removeGameEntry = (gameId) => {
    setLinkedGames((prev) => prev.filter((game) => game.id !== gameId));
  };

  const addFeedEntry = (event) => {
    event.preventDefault();
    if (!feedDraft.trim()) {
      return;
    }
    setFeedEntries((prev) => [
      {
        id: `feed-${Date.now()}`,
        title: feedDraft,
        description: 'Shared just now',
        timestamp: 'Just now'
      },
      ...prev
    ]);
    setFeedDraft('');
    setLocalNotice('Posted to your personal feed locally. TODO: connect to social feed service.');
  };

  if (!user) {
    return null;
  }

  return (
    <div className="page page--profile">
      <div className="profile-layout">
        <div className="profile-main">
          <section className="surface surface--hero">
            <div className="surface__header">
              <div>
                <h2>Shape your vibe</h2>
                <p className="surface__subtitle">
                  Update your identity, connect socials and share your highlights.
                </p>
              </div>
              <button type="button" className="icon-button" onClick={logout}>
                ⇦
              </button>
            </div>
            {feedback ? <div className="page__feedback">{feedback}</div> : null}
            {localNotice ? <div className="page__notice">{localNotice}</div> : null}
          </section>

          <section className="surface">
            <div className="surface__header">
              <h3>Profile basics</h3>
            </div>
            <form className="profile-form" onSubmit={saveProfile}>
              <label>
                <span>Display name</span>
                <input
                  type="text"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Your name"
                />
              </label>
              <label>
                <span>Bio</span>
                <textarea
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  placeholder="Tell your squad about you"
                />
              </label>
              <div className="avatar-grid">
                {avatarOptions.map((option) => (
                  <button
                    type="button"
                    key={option.seed}
                    className={`avatar-option ${selectedAvatar === option.seed ? 'avatar-option--active' : ''}`}
                    onClick={() => setSelectedAvatar(option.seed)}
                  >
                    <img src={option.url} alt={option.seed} />
                    <span>{option.seed}</span>
                  </button>
                ))}
              </div>
              <button type="submit" className="primary-button" disabled={updating}>
                Save profile
              </button>
            </form>
          </section>

          <section className="surface">
            <div className="surface__header">
              <h3>Matchmaking preferences</h3>
            </div>
            <form className="profile-form" onSubmit={savePreferences}>
              <label>
                <span>Competitiveness</span>
                <select value={competitiveness} onChange={(event) => setCompetitiveness(event.target.value)}>
                  <option value="casual">Casual</option>
                  <option value="balanced">Balanced</option>
                  <option value="competitive">Competitive</option>
                </select>
              </label>
              <label>
                <span>Preferred regions</span>
                <input
                  type="text"
                  value={regions}
                  onChange={(event) => setRegions(event.target.value)}
                  placeholder="NA, EU, OC"
                />
              </label>
              <label>
                <span>Languages</span>
                <input
                  type="text"
                  value={languages}
                  onChange={(event) => setLanguages(event.target.value)}
                  placeholder="en, es"
                />
              </label>
              <button type="submit" className="primary-button" disabled={updating}>
                Save preferences
              </button>
            </form>
          </section>

          <section className="surface">
            <div className="surface__header">
              <h3>Linked socials</h3>
            </div>
            <form className="profile-form" onSubmit={handleSaveSocials}>
              {socialPlatforms.map((platform) => (
                <label key={platform.id}>
                  <span>{platform.label}</span>
                  <input
                    type="text"
                    value={socials[platform.id] || ''}
                    onChange={(event) => handleSocialChange(platform.id, event.target.value)}
                    placeholder={platform.placeholder}
                  />
                </label>
              ))}
              <button type="submit" className="ghost-button">
                Save links
              </button>
            </form>
          </section>

          <section className="surface">
            <div className="surface__header surface__header--stack">
              <div>
                <h3>Game showcase</h3>
                <p className="surface__subtitle">Highlight the titles and roles that define your playstyle.</p>
              </div>
            </div>
            <div className="game-form">
              <label>
                <span>Find a game</span>
                <input
                  type="search"
                  value={gameSearch}
                  onChange={(event) => setGameSearch(event.target.value)}
                  placeholder="League of Legends, Valorant, Apex Legends…"
                />
              </label>
              {loadingGameOptions ? <span className="surface__subtitle">Searching…</span> : null}
              {gameSearchError ? <span className="page__error">{gameSearchError}</span> : null}
            </div>
            <div className="game-suggestion-grid">
              {gameOptions.map((game) => (
                <button
                  type="button"
                  key={game._id}
                  className="game-suggestion"
                  onClick={() => handleSelectGame(game)}
                >
                  <img src={getGameArt(game)} alt={game.name} />
                  <div>
                    <strong>{game.name}</strong>
                    <span>{game.genres?.[0]?.name || game.gameModes?.[0]?.name || 'Multiplayer'}</span>
                  </div>
                </button>
              ))}
              {gameOptions.length === 0 && !loadingGameOptions ? (
                <p className="surface__subtitle">No games to show right now.</p>
              ) : null}
            </div>
            <div className="linked-games">
              {linkedGames.length === 0 ? (
                <p className="surface__subtitle">No game cards yet. Add your main titles above.</p>
              ) : null}
              {linkedGames.map((game) => (
                <article key={game.id} className="linked-game-card">
                  <img src={getGameArt(game.gameData || { name: game.title })} alt={game.title} />
                  <div>
                    <input
                      type="text"
                      value={game.title}
                      onChange={(event) => updateGameEntry(game.id, 'title', event.target.value)}
                      placeholder="Game"
                    />
                    <input
                      type="text"
                      value={game.role}
                      onChange={(event) => updateGameEntry(game.id, 'role', event.target.value)}
                      placeholder="Role / rank"
                    />
                    <input
                      type="text"
                      value={game.handle}
                      onChange={(event) => updateGameEntry(game.id, 'handle', event.target.value)}
                      placeholder="In-game name"
                    />
                  </div>
                  <button type="button" className="danger-button" onClick={() => removeGameEntry(game.id)}>
                    Remove
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section className="surface">
            <div className="surface__header">
              <div>
                <h3>Personal feed</h3>
                <p className="surface__subtitle">Share highlights and achievements with your friends.</p>
              </div>
            </div>
            <form className="feed-form" onSubmit={addFeedEntry}>
              <textarea
                value={feedDraft}
                onChange={(event) => setFeedDraft(event.target.value)}
                placeholder="Share what you're proud of..."
              />
              <button type="submit" className="primary-button">
                Post update
              </button>
            </form>
            <ul className="feed-list">
              {feedEntries.map((entry) => (
                <li key={entry.id}>
                  <strong>{entry.title}</strong>
                  <p>{entry.description}</p>
                  <span>{entry.timestamp}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="profile-sidebar">
          <section className="surface surface--profile">
            <div className="surface__header">
              <h3>Matchmaking defaults</h3>
              <span className="surface__subtitle">Used as the baseline for quick searches.</span>
            </div>
            <ul className="profile-overview">
              <li>
                <span className="label">Competitiveness</span>
                <strong>{competitiveness}</strong>
              </li>
              <li>
                <span className="label">Regions</span>
                <strong>{regions || 'Set your regions'}</strong>
              </li>
              <li>
                <span className="label">Languages</span>
                <strong>{languages || 'Add a language'}</strong>
              </li>
            </ul>
          </section>

          <section className="surface surface--spotlight">
            <div className="surface__header">
              <h3>Profile tips</h3>
            </div>
            <ul className="news-list">
              {profileTips.map((tip) => (
                <li key={tip.id}>
                  <strong>{tip.title}</strong>
                  <p>{tip.description}</p>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
};

export default ProfilePage;
