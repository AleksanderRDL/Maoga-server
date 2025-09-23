import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import apiClient from '../services/apiClient.js';
import { useAuth } from '../context/AuthContext.jsx';

const LobbyDetailPage = () => {
  const { lobbyId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [lobby, setLobby] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);
  const [sending, setSending] = useState(false);

  const loadLobby = useCallback(async () => {
    try {
      const response = await apiClient.get(`/lobbies/${lobbyId}`);
      setLobby(response.data?.data?.lobby || null);
    } catch (err) {
      console.error('Failed to load lobby', err);
      setFeedback('Unable to load lobby.');
    }
  }, [lobbyId]);

  const loadMessages = useCallback(async () => {
    try {
      const response = await apiClient.get(`/chat/lobby/${lobbyId}/messages`, {
        params: { limit: 75 }
      });
      setMessages(response.data?.data?.messages || []);
    } catch (err) {
      console.error('Failed to load chat history', err);
    }
  }, [lobbyId]);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      await Promise.all([loadLobby(), loadMessages()]);
      setLoading(false);
    };

    fetchAll();
  }, [loadLobby, loadMessages]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadLobby();
      loadMessages();
    }, 10000);

    return () => clearInterval(interval);
  }, [loadLobby, loadMessages]);

  const isMember = useMemo(() => {
    if (!lobby || !user) {
      return false;
    }
    return lobby.members?.some((member) => {
      const id = member.userId?._id || member.userId;
      const activeStatuses = ['joined', 'ready'];
      return id?.toString() === user._id && activeStatuses.includes(member.status);
    });
  }, [lobby, user]);

  const myMember = useMemo(() => {
    if (!lobby || !user) {
      return null;
    }
    return lobby.members?.find((member) => {
      const id = member.userId?._id || member.userId;
      return id?.toString() === user._id;
    });
  }, [lobby, user]);

  const handleJoin = async () => {
    try {
      await apiClient.post(`/lobbies/${lobbyId}/join`, {});
      setFeedback('Joined lobby');
      loadLobby();
    } catch (err) {
      const message = err.response?.data?.message || err.response?.data?.error || err.message;
      setFeedback(message || 'Could not join lobby');
    }
  };

  const handleLeave = async () => {
    try {
      await apiClient.post(`/lobbies/${lobbyId}/leave`);
      setFeedback('Left lobby');
      loadLobby();
      navigate('/lobbies');
    } catch (err) {
      const message = err.response?.data?.message || err.response?.data?.error || err.message;
      setFeedback(message || 'Could not leave lobby');
    }
  };

  const toggleReady = async () => {
    try {
      await apiClient.post(`/lobbies/${lobbyId}/ready`, { ready: !(myMember?.status === 'ready') });
      loadLobby();
    } catch (err) {
      const message = err.response?.data?.message || err.response?.data?.error || err.message;
      setFeedback(message || 'Could not update ready status');
    }
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();
    if (!message.trim()) {
      return;
    }
    setSending(true);
    try {
      await apiClient.post(`/chat/lobby/${lobbyId}/messages`, { content: message.trim() });
      setMessage('');
      loadMessages();
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message;
      setFeedback(msg || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div className="panel">
          <div className="panel__content">
            <p>Loading lobby…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!lobby) {
    return (
      <div className="page">
        <div className="panel">
          <div className="panel__content">
            <p>Lobby not found.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page page--lobby">
      <section className="section">
        <div className="section__header">
          <h3>{lobby.name}</h3>
          <div className="section__actions">
            {isMember ? (
              <>
                <button type="button" onClick={toggleReady}>
                  {myMember?.status === 'ready' ? 'Ready ✔' : 'Set ready'}
                </button>
                <button type="button" className="danger-button" onClick={handleLeave}>
                  Leave lobby
                </button>
              </>
            ) : (
              <button type="button" className="primary-button" onClick={handleJoin}>
                Join lobby
              </button>
            )}
          </div>
        </div>
        {feedback ? <div className="page__feedback">{feedback}</div> : null}
        <div className="panel">
          <div className="panel__content">
            <p>
              Game: <strong>{lobby.gameId?.name}</strong>
            </p>
            <p>
              Mode: <strong>{lobby.gameMode}</strong>
            </p>
            <p>
              Region: <strong>{lobby.region || 'Global'}</strong>
            </p>
            <p>
              Status: <strong>{lobby.status}</strong>
            </p>
            <p>
              Members ready: <strong>{lobby.readyCount}/{lobby.memberCount}</strong>
            </p>
          </div>
        </div>
        <div className="panel">
          <div className="panel__content panel__content--columns">
            <div>
              <h4>Roster</h4>
              <ul className="roster">
                {lobby.members?.map((member) => {
                  const name =
                    member.userId?.profile?.displayName || member.userId?.username || 'Player';
                  const status = member.status === 'ready' ? 'Ready' : 'Waiting';
                  return (
                    <li key={member._id || member.userId?._id || member.userId}>
                      <span>{name}</span>
                      <span>{status}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="chat-panel">
              <div className="chat-panel__messages">
                {messages.map((msg) => {
                  const sender = msg.senderId?.profile?.displayName || msg.senderId?.username || 'System';
                  return (
                    <div className="chat-message" key={msg._id}>
                      <div className="chat-message__meta">
                        <span>{sender}</span>
                        <span>{dayjs(msg.createdAt).format('HH:mm')}</span>
                      </div>
                      <p>{msg.content}</p>
                    </div>
                  );
                })}
              </div>
              {isMember ? (
                <form className="chat-panel__input" onSubmit={handleSendMessage}>
                  <input
                    type="text"
                    placeholder="Write a message"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                  />
                  <button type="submit" disabled={sending}>
                    Send
                  </button>
                </form>
              ) : (
                <p className="chat-panel__hint">Join the lobby to chat.</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LobbyDetailPage;
