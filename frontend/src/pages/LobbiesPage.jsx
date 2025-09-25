import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/apiClient.js';
import { useAuth } from '../context/AuthContext.jsx';

const LobbiesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [lobbies, setLobbies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [includeHistory, setIncludeHistory] = useState(false);
  const [joinId, setJoinId] = useState('');
  const [feedback, setFeedback] = useState(null);

  const fetchLobbies = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const response = await apiClient.get('/lobbies', {
        params: { includeHistory }
      });
      setLobbies(response.data?.data?.lobbies || []);
    } catch (err) {
      console.error('Failed to load lobbies', err);
      setFeedback('Could not load your lobbies.');
    } finally {
      setLoading(false);
    }
  }, [includeHistory]);

  useEffect(() => {
    fetchLobbies();
  }, [fetchLobbies]);

  const handleJoinLobby = async (event) => {
    event.preventDefault();
    if (!joinId.trim()) {
      return;
    }

    try {
      await apiClient.post(`/lobbies/${joinId.trim()}/join`, {});
      setFeedback('Joined lobby successfully!');
      setJoinId('');
      fetchLobbies();
    } catch (err) {
      const message = err.response?.data?.message || err.response?.data?.error || err.message;
      setFeedback(message || 'Failed to join lobby');
    }
  };

  const handleToggleReady = async (lobbyId, ready) => {
    try {
      await apiClient.post(`/lobbies/${lobbyId}/ready`, { ready: !ready });
      fetchLobbies();
    } catch (err) {
      console.error('Failed to toggle ready', err);
      setFeedback('Could not update ready status');
    }
  };

  const handleLeaveLobby = async (lobbyId) => {
    try {
      await apiClient.post(`/lobbies/${lobbyId}/leave`);
      fetchLobbies();
    } catch (err) {
      console.error('Failed to leave lobby', err);
      setFeedback('Could not leave lobby');
    }
  };

  const preferredGameNames = useMemo(
    () =>
      (user?.gameProfiles || [])
        .map((profile) => profile.gameId?.name?.toLowerCase())
        .filter(Boolean),
    [user]
  );

  const activeLobbies = useMemo(
    () =>
      lobbies.filter((lobby) => {
        const memberCount = lobby.memberCount ?? lobby.members?.length ?? 0;
        const readyCount = lobby.readyCount ?? 0;
        const needsPlayers = memberCount - readyCount;
        return (lobby.status === 'forming' || lobby.status === 'ready') && needsPlayers > 0;
      }),
    [lobbies]
  );

  const prioritizedLobbies = useMemo(() => {
    const computePriority = (lobby) => {
      const gameName = lobby.gameId?.name?.toLowerCase() || '';
      const memberCount = lobby.memberCount ?? lobby.members?.length ?? 0;
      const readyCount = lobby.readyCount ?? 0;
      const playersNeeded = Math.max(memberCount - readyCount, 0);
      const matchesPreference = preferredGameNames.some((name) => gameName.includes(name));
      return {
        lobby,
        matchesPreference,
        playersNeeded
      };
    };

    return activeLobbies
      .map((lobby) => computePriority(lobby))
      .sort((a, b) => {
        if (a.matchesPreference !== b.matchesPreference) {
          return a.matchesPreference ? -1 : 1;
        }
        if (a.playersNeeded !== b.playersNeeded) {
          return b.playersNeeded - a.playersNeeded;
        }
        return 0;
      })
      .map((entry) => entry.lobby);
  }, [activeLobbies, preferredGameNames]);

  return (
    <div className="page">
      <section className="section">
        <div className="section__header">
          <h3>Your squads</h3>
          <button type="button" className="link" onClick={fetchLobbies} disabled={loading}>
            Refresh
          </button>
        </div>
        <form className="form-inline" onSubmit={handleJoinLobby}>
          <label>
            <span>Join by lobby ID</span>
            <input
              type="text"
              value={joinId}
              onChange={(event) => setJoinId(event.target.value)}
              placeholder="Paste lobby ID"
            />
          </label>
          <button type="submit" className="primary-button">
            Join lobby
          </button>
        </form>
        <label className="toggle">
          <input
            type="checkbox"
            checked={includeHistory}
            onChange={(event) => setIncludeHistory(event.target.checked)}
          />
          <span>Include recent history</span>
        </label>
        {feedback ? <div className="page__feedback">{feedback}</div> : null}
      </section>

      <section className="section">
        <div className="section__header">
          <h3>Active lobbies needing players</h3>
          <span>{prioritizedLobbies.length}</span>
        </div>
        <div className="lobby-list">
          {prioritizedLobbies.map((lobby) => {
            const memberCount = lobby.memberCount ?? lobby.members?.length ?? 0;
            const readyCount = lobby.readyCount ?? 0;
            const playersNeeded = Math.max(memberCount - readyCount, 0);
            const currentMember = lobby.members?.find((member) => {
              const id = member.userId?._id || member.userId;
              return id?.toString() === user?._id;
            });
            const isReady = currentMember?.status === 'ready' || currentMember?.readyStatus;
            const host = lobby.members?.find((member) => member.isHost);
            const gameName = lobby.gameId?.name || 'Unknown game';
            const isPreferred = preferredGameNames.some((name) => gameName.toLowerCase().includes(name));

            return (
              <div className={`lobby-card ${isPreferred ? 'lobby-card--preferred' : ''}`} key={lobby._id}>
                <div>
                  <h4>{lobby.name}</h4>
                  <p>
                    {gameName} • {lobby.gameMode}
                  </p>
                </div>
                <div className="lobby-card__meta">
                  <span>{playersNeeded} player{playersNeeded === 1 ? '' : 's'} needed</span>
                  <span>
                    Ready: {readyCount}/{memberCount}
                  </span>
                  <span>Host: {host?.userId?.profile?.displayName || host?.userId?.username}</span>
                </div>
                <div className="lobby-card__actions">
                  <button type="button" onClick={() => navigate(`/lobbies/${lobby._id}`)}>
                    View lobby
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleReady(lobby._id, isReady)}
                    className={isReady ? 'secondary-button' : ''}
                  >
                    {isReady ? 'Mark not ready' : 'Mark ready'}
                  </button>
                  <button type="button" className="danger-button" onClick={() => handleLeaveLobby(lobby._id)}>
                    Leave
                  </button>
                </div>
              </div>
            );
          })}
          {prioritizedLobbies.length === 0 && !loading ? (
            <div className="empty-state">
              <p>No active lobbies yet. Join a match to get started!</p>
            </div>
          ) : null}
        </div>
      </section>

      {includeHistory ? (
        <section className="section">
          <div className="section__header">
            <h3>Recent lobbies</h3>
            <span>{lobbies.length - activeLobbies.length}</span>
          </div>
          <div className="lobby-list lobby-list--compact">
            {lobbies
              .filter((lobby) => lobby.status === 'closed')
              .map((lobby) => (
                <div className="lobby-card lobby-card--compact" key={lobby._id}>
                  <div>
                    <h4>{lobby.name}</h4>
                    <p>{lobby.gameId?.name}</p>
                  </div>
                  <button type="button" onClick={() => navigate(`/lobbies/${lobby._id}`)}>
                    Inspect
                  </button>
                </div>
              ))}
          </div>
        </section>
      ) : null}
    </div>
  );
};

export default LobbiesPage;
