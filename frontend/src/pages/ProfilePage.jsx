import { useEffect, useState } from 'react';
import apiClient from '../services/apiClient.js';
import { useAuth } from '../context/AuthContext.jsx';

const ProfilePage = () => {
  const { user, refreshProfile, logout } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [competitiveness, setCompetitiveness] = useState('balanced');
  const [regions, setRegions] = useState('');
  const [languages, setLanguages] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.profile?.displayName || '');
      setBio(user.profile?.bio || '');
      setCompetitiveness(user.gamingPreferences?.competitiveness || 'balanced');
      setRegions((user.gamingPreferences?.regions || []).join(', '));
      setLanguages((user.gamingPreferences?.languages || []).join(', '));
    }
  }, [user]);

  const saveProfile = async (event) => {
    event.preventDefault();
    setUpdating(true);
    setFeedback(null);
    try {
      await apiClient.patch('/users/me', {
        displayName: displayName || undefined,
        bio: bio || undefined
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

  if (!user) {
    return null;
  }

  return (
    <div className="page page--profile">
      <section className="section">
        <div className="section__header">
          <h3>Your profile</h3>
          <button type="button" className="link" onClick={logout}>
            Log out
          </button>
        </div>
        {feedback ? <div className="page__feedback">{feedback}</div> : null}
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
          <button type="submit" className="primary-button" disabled={updating}>
            Save profile
          </button>
        </form>
      </section>

      <section className="section">
        <div className="section__header">
          <h3>Gaming preferences</h3>
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

      <section className="section">
        <div className="section__header">
          <h3>Game profiles</h3>
        </div>
        <div className="profile-game-grid">
          {(user.gameProfiles || []).map((profile) => (
            <div className="profile-game-card" key={profile._id}>
              <strong>{profile.gameId?.name || 'Game'}</strong>
              <span>{profile.inGameName || 'IGN not set'}</span>
              <span>{profile.rank || 'Rank not set'}</span>
            </div>
          ))}
          {(!user.gameProfiles || user.gameProfiles.length === 0) && (
            <p>No game profiles added yet. Add them via the API to see them here.</p>
          )}
        </div>
      </section>
    </div>
  );
};

export default ProfilePage;
