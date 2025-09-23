import { useCallback, useEffect, useState } from 'react';
import dayjs from 'dayjs';
import apiClient from '../services/apiClient.js';
import { useAuth } from '../context/AuthContext.jsx';

const ChatPage = () => {
  const { user } = useAuth();
  const [lobbies, setLobbies] = useState([]);
  const [selectedLobby, setSelectedLobby] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const fetchLobbies = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/lobbies', { params: { includeHistory: false } });
      const data = response.data?.data?.lobbies || [];
      setLobbies(data);
      if (!selectedLobby && data.length > 0) {
        setSelectedLobby(data[0]);
      } else if (selectedLobby) {
        const updated = data.find((lobby) => lobby._id === selectedLobby._id);
        setSelectedLobby(updated || data[0] || null);
      }
    } catch (err) {
      console.error('Failed to load lobby chats', err);
    } finally {
      setLoading(false);
    }
  }, [selectedLobby]);

  const fetchMessages = useCallback(async () => {
    if (!selectedLobby) {
      setMessages([]);
      return;
    }
    try {
      const response = await apiClient.get(`/chat/lobby/${selectedLobby._id}/messages`, {
        params: { limit: 75 }
      });
      setMessages(response.data?.data?.messages || []);
    } catch (err) {
      console.error('Failed to load chat history', err);
    }
  }, [selectedLobby]);

  useEffect(() => {
    fetchLobbies();
  }, [fetchLobbies]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(() => {
      fetchMessages();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  const handleSendMessage = async (event) => {
    event.preventDefault();
    if (!selectedLobby || !message.trim()) {
      return;
    }
    setSending(true);
    try {
      await apiClient.post(`/chat/lobby/${selectedLobby._id}/messages`, { content: message.trim() });
      setMessage('');
      fetchMessages();
    } catch (err) {
      console.error('Failed to send chat message', err);
    } finally {
      setSending(false);
    }
  };

  const isMember = (lobby) =>
    lobby?.members?.some((member) => {
      const id = member.userId?._id || member.userId;
      return id?.toString() === user?._id;
    });

  return (
    <div className="page page--chat">
      <section className="section">
        <div className="section__header">
          <h3>Lobby chat</h3>
          <button type="button" className="link" onClick={fetchLobbies} disabled={loading}>
            Refresh
          </button>
        </div>
        <div className="chat-layout">
          <aside className="chat-sidebar">
            {lobbies.map((lobby) => {
              const isActive = selectedLobby?._id === lobby._id;
              return (
                <button
                  type="button"
                  key={lobby._id}
                  onClick={() => setSelectedLobby(lobby)}
                  className={`chat-sidebar__item ${isActive ? 'chat-sidebar__item--active' : ''}`}
                >
                  <div>
                    <strong>{lobby.gameId?.name}</strong>
                    <span>{lobby.name}</span>
                  </div>
                </button>
              );
            })}
            {lobbies.length === 0 && !loading ? (
              <p className="chat-sidebar__empty">No active lobbies yet.</p>
            ) : null}
          </aside>
          <div className="chat-window">
            {selectedLobby ? (
              <>
                <div className="chat-window__header">
                  <div>
                    <h4>{selectedLobby.name}</h4>
                    <span>{selectedLobby.gameMode}</span>
                  </div>
                  <span>
                    {selectedLobby.readyCount}/{selectedLobby.memberCount} ready
                  </span>
                </div>
                <div className="chat-window__messages">
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
                  {messages.length === 0 ? <p className="chat-window__empty">No messages yet.</p> : null}
                </div>
                {isMember(selectedLobby) ? (
                  <form className="chat-window__input" onSubmit={handleSendMessage}>
                    <input
                      type="text"
                      placeholder="Send a message"
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                    />
                    <button type="submit" disabled={sending}>
                      Send
                    </button>
                  </form>
                ) : (
                  <p className="chat-window__hint">Join this lobby to chat with players.</p>
                )}
              </>
            ) : (
              <div className="chat-window__empty">
                <p>Select a lobby to view messages.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default ChatPage;
