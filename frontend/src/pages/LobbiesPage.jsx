import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/apiClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { MOCK_ACTIVE_LOBBIES } from '../services/mockLobbies.js';
import getGameArt from '../services/gameArt.js';

const LobbiesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [lobbies, setLobbies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [includeHistory, setIncludeHistory] = useState(false);
  const [joinId, setJoinId] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [joiningLobbyId, setJoiningLobbyId] = useState(null);

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

  const joinLobby = useCallback(
    async (lobbyId) => {
      const trimmedId = lobbyId?.trim();
      if (!trimmedId) {
        return false;
      }

      setJoiningLobbyId(trimmedId);
      setFeedback(null);

      try {
        await apiClient.post(`/lobbies/${trimmedId}/join`, {});
        navigate(`/lobbies/${trimmedId}`);
        return true;
      } catch (err) {
        const message = err.response?.data?.message || err.response?.data?.error || err.message;
        setFeedback(message || 'Failed to join lobby');
        return false;
      } finally {
        setJoiningLobbyId(null);
      }
    },
    [navigate]
  );

  const handleJoinById = async (event) => {
    event.preventDefault();
    if (!joinId.trim()) {
      return;
    }

    const success = await joinLobby(joinId);
    if (success) {
      setJoinId('');
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

  const showMockLobbies = prioritizedLobbies.length === 0 && !loading;
  const displayLobbies = showMockLobbies ? MOCK_ACTIVE_LOBBIES : prioritizedLobbies;

  return (
    <div className="page">
      <section className="section">
        <div className="section__header">
          <h3>Your squads</h3>
          <button type="button" className="link" onClick={fetchLobbies} disabled={loading}>
            Refresh
          </button>
        </div>
        <form className="form-inline" onSubmit={handleJoinById}>
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
          <span>{displayLobbies.length}</span>
        </div>
        <div className="lobby-list">
          {displayLobbies.map((lobby) => {
            const memberCount = lobby.memberCount ?? lobby.members?.length ?? 0;
            const readyCount = lobby.readyCount ?? 0;
            const playersNeeded = Math.max(memberCount - readyCount, 0);
            const currentMember = lobby.members?.find((member) => {
              const id = member.userId?._id || member.userId;
              return id?.toString() === user?._id;
            });
            const isMember = Boolean(currentMember);
            const host = lobby.members?.find((member) => member.isHost);
            const gameName = lobby.gameId?.name || 'Unknown game';
            const isPreferred = preferredGameNames.some((name) => gameName.toLowerCase().includes(name));
            const isMock = lobby.isMock;
            const gameArt = getGameArt(lobby.gameId || {});
            const isJoining = joiningLobbyId === lobby._id;
            const handleJoinLobby = () => {
              if (isMock) {
                return;
              }
              if (isMember) {
                navigate(`/lobbies/${lobby._id}`);
                return;
              }
              if (isJoining) {
                return;
              }
              joinLobby(lobby._id);
            };
            const buttonLabel = isMock
              ? 'Preview only'
              : isMember
              ? 'Enter lobby'
              : isJoining
              ? 'Joining…'
              : 'Join lobby';

            return (
              <div
                className={`lobby-card ${isPreferred ? 'lobby-card--preferred' : ''} ${
                  isMock ? 'lobby-card--mock' : ''
                }`}
                key={lobby._id}
              >
                <div className="lobby-card__art">
                  <img src={gameArt} alt={`${gameName} key art`} loading="lazy" />
                </div>
                <div className="lobby-card__body">
                  <div className="lobby-card__header">
                    <h4>{lobby.name}</h4>
                    <span className="lobby-card__game">{gameName}</span>
                    <span className="lobby-card__mode">{lobby.gameMode}</span>
                  </div>
                  {Array.isArray(lobby.tags) && lobby.tags.length ? (
                    <ul className="lobby-card__tags">
                      {lobby.tags.map((tag) => (
                        <li key={tag}>{tag}</li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="lobby-card__meta">
                    <span>{playersNeeded} player{playersNeeded === 1 ? '' : 's'} needed</span>
                    <span>
                      Ready: {readyCount}/{memberCount}
                    </span>
                    <span>Host: {host?.userId?.profile?.displayName || host?.userId?.username}</span>
                  </div>
                  <button
                    type="button"
                    className="primary-button lobby-card__join"
                    onClick={handleJoinLobby}
                    aria-disabled={isMock || (!isMember && isJoining)}
                  >
                    {buttonLabel}
                  </button>
                </div>
              </div>
            );
          })}
          {displayLobbies.length === 0 && !loading ? (
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
