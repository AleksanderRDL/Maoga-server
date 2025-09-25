import { useEffect, useMemo, useState } from 'react';
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

const friendsMock = [
  {
    id: 'fr1',
    name: 'Maria',
    handle: '@mferfly',
    status: 'Playing Baldur\'s Gate 3',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Maria',
    lastOnline: 'Online'
  },
  {
    id: 'fr2',
    name: 'Tessa',
    handle: '@myBad',
    status: 'In champion select (LoL)',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Tessa',
    lastOnline: '5m ago'
  },
  {
    id: 'fr3',
    name: 'Cassie',
    handle: '@glitchGoddess',
    status: 'Streaming Valorant customs',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Cassie',
    lastOnline: '20m ago'
  },
  {
    id: 'fr4',
    name: 'Nora',
    handle: '@thunderNeko',
    status: 'Looking for Apex squad',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Nora',
    lastOnline: 'Yesterday'
  }
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
  const [newGameTitle, setNewGameTitle] = useState('');
  const [newGameRole, setNewGameRole] = useState('');
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
            title: profile.gameId?.name || 'Game',
            role: profile.role || profile.rank || '',
            handle: profile.inGameName || ''
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

  const handleAddGame = (event) => {
    event.preventDefault();
    if (!newGameTitle.trim()) {
      return;
    }
    const nextGame = {
      id: `local-${Date.now()}`,
      title: newGameTitle,
      role: newGameRole,
      handle: ''
    };
    setLinkedGames((prev) => [nextGame, ...prev]);
    setNewGameTitle('');
    setNewGameRole('');
    setLocalNotice('Game link added locally. TODO: sync with backend game profile endpoint.');
  };

  const updateGameEntry = (gameId, field, value) => {
    setLinkedGames((prev) => prev.map((game) => (game.id === gameId ? { ...game, [field]: value } : game)));
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
            <div className="surface__header">
              <div>
                <h3>Game cards</h3>
                <p className="surface__subtitle">
                  Showcase the games you play and your roles.
                </p>
              </div>
            </div>
            <form className="game-form" onSubmit={handleAddGame}>
              <input
                type="text"
                value={newGameTitle}
                onChange={(event) => setNewGameTitle(event.target.value)}
                placeholder="Game title"
              />
              <input
                type="text"
                value={newGameRole}
                onChange={(event) => setNewGameRole(event.target.value)}
                placeholder="Role, rank or preferred lane"
              />
              <button type="submit" className="primary-button">
                Add game
              </button>
            </form>
            <div className="linked-games">
              {linkedGames.length === 0 ? (
                <p className="surface__subtitle">No game cards yet. Add your main titles above.</p>
              ) : null}
              {linkedGames.map((game) => (
                <article key={game.id} className="linked-game-card">
                  <img src={getGameArt({ name: game.title })} alt={game.title} />
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
                placeholder="Share what you\'re proud of..."
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
          <section className="surface surface--friends">
            <div className="surface__header">
              <h3>Friends &amp; chat</h3>
              <button type="button" className="link">
                View all →
              </button>
            </div>
            <ul className="friend-feed">
              {friendsMock.map((friend) => (
                <li key={friend.id}>
                  <img src={friend.avatar} alt={friend.name} />
                  <div>
                    <strong>
                      {friend.name}
                      <span>{friend.handle}</span>
                    </strong>
                    <p>{friend.status}</p>
                  </div>
                  <button type="button" className="ghost-button">
                    Chat
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="surface surface--chat">
            <div className="surface__header">
              <h3>Quick DM</h3>
              <span className="surface__subtitle">Send a ping without leaving your profile.</span>
            </div>
            <form className="chat-form">
              <select>
                {friendsMock.map((friend) => (
                  <option key={friend.id} value={friend.id}>
                    {friend.name} ({friend.lastOnline})
                  </option>
                ))}
              </select>
              <textarea placeholder="Say hi or share a clip link" />
              <button type="button" className="primary-button" disabled>
                Send (coming soon)
              </button>
            </form>
            {/* TODO: Wire quick DM composer to chat service when available. */}
          </section>
        </aside>
      </div>
    </div>
  );
};

export default ProfilePage;
