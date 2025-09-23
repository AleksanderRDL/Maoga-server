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

  const activeLobbies = useMemo(
    () => lobbies.filter((lobby) => lobby.status === 'forming' || lobby.status === 'ready'),
    [lobbies]
  );

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
          <h3>Active lobbies</h3>
          <span>{activeLobbies.length}</span>
        </div>
        <div className="lobby-list">
          {activeLobbies.map((lobby) => {
            const memberCount = lobby.memberCount ?? lobby.members?.length ?? 0;
            const readyCount = lobby.readyCount ?? 0;
            const currentMember = lobby.members?.find((member) => {
              const id = member.userId?._id || member.userId;
              return id?.toString() === user?._id;
            });
            const isReady = currentMember?.status === 'ready' || currentMember?.readyStatus;
            const host = lobby.members?.find((member) => member.isHost);
            const gameName = lobby.gameId?.name || 'Unknown game';

            return (
              <div className="lobby-card" key={lobby._id}>
                <div>
                  <h4>{lobby.name}</h4>
                  <p>
                    {gameName} • {lobby.gameMode}
                  </p>
                </div>
                <div className="lobby-card__meta">
                  <span>
                    {readyCount}/{memberCount} ready
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
          {activeLobbies.length === 0 && !loading ? (
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
