import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import apiClient from '../services/apiClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getGameArt } from '../services/gameArt.js';
import {
  applyMemberUpdate,
  cloneMockLobby,
  getMockLobbyMessages,
  isMockLobbyId
} from '../services/mockLobbies.js';

dayjs.extend(relativeTime);

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
  const [isMockView, setIsMockView] = useState(false);
  const messagesEndRef = useRef(null);

  const loadLobby = useCallback(async () => {
    if (isMockLobbyId(lobbyId)) {
      const mockLobby = cloneMockLobby(lobbyId);
      setIsMockView(true);
      if (mockLobby) {
        setLobby(mockLobby);
      } else {
        setLobby(null);
        setFeedback('Lobby not found.');
      }
      return;
    }

    setIsMockView(false);
    try {
      const response = await apiClient.get(`/lobbies/${lobbyId}`);
      setLobby(response.data?.data?.lobby || null);
    } catch (err) {
      console.error('Failed to load lobby', err);
      setFeedback('Unable to load lobby.');
    }
  }, [lobbyId]);

  const loadMessages = useCallback(async () => {
    if (isMockLobbyId(lobbyId)) {
      setMessages(getMockLobbyMessages(lobbyId));
      return;
    }

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
    if (isMockLobbyId(lobbyId)) {
      return undefined;
    }

    const interval = setInterval(() => {
      loadLobby();
      loadMessages();
    }, 10000);

    return () => clearInterval(interval);
  }, [lobbyId, loadLobby, loadMessages]);

  const ensureMockMembership = (updater) => {
    setLobby((prev) => {
      if (!prev || !user) {
        return prev;
      }
      const members = updater(prev.members || []);
      return applyMemberUpdate(prev, members);
    });
  };

  const isMember = useMemo(() => {
    if (!lobby || !user) {
      return false;
    }
    const userId = user._id?.toString();
    return lobby.members?.some((member) => {
      const id = (member.userId?._id || member.userId)?.toString();
      const activeStatuses = ['joined', 'ready'];
      return id === userId && activeStatuses.includes(member.status);
    });
  }, [lobby, user]);

  const myMember = useMemo(() => {
    if (!lobby || !user) {
      return null;
    }
    const userId = user._id?.toString();
    return lobby.members?.find((member) => {
      const id = (member.userId?._id || member.userId)?.toString();
      return id === userId;
    });
  }, [lobby, user]);

  const handleJoin = async () => {
    if (isMockView) {
      if (!user) {
        setFeedback('Sign in to preview a lobby.');
        return;
      }
      const memberId = user._id?.toString();
      ensureMockMembership((members) => {
        const next = members.map((member) => ({ ...member }));
        const exists = next.some((member) => {
          const id = (member.userId?._id || member.userId)?.toString();
          return id === memberId;
        });
        if (!exists) {
          next.push({
            _id: `mock-${memberId}`,
            isHost: false,
            status: 'joined',
            readyStatus: false,
            joinedAt: new Date().toISOString(),
            userId: {
              _id: memberId,
              username: user.username,
              profile: {
                displayName: user.profile?.displayName || user.username,
                avatarUrl: user.profile?.avatarUrl || user.profile?.avatar
              }
            }
          });
        }
        return next;
      });
      setFeedback('Joined lobby preview');
      return;
    }

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
    if (isMockView) {
      if (!user) {
        return;
      }
      const memberId = user._id?.toString();
      ensureMockMembership((members) =>
        members
          .filter((member) => (member.userId?._id || member.userId)?.toString() !== memberId)
          .map((member) => ({ ...member }))
      );
      setFeedback('Left lobby preview');
      navigate('/lobbies');
      return;
    }

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
    if (isMockView) {
      if (!user) {
        return;
      }
      const memberId = user._id?.toString();
      ensureMockMembership((members) =>
        members.map((member) => {
          const id = (member.userId?._id || member.userId)?.toString();
          if (id === memberId) {
            const nextReady = !(member.readyStatus || member.status === 'ready');
            return {
              ...member,
              status: nextReady ? 'ready' : 'joined',
              readyStatus: nextReady,
              updatedAt: new Date().toISOString()
            };
          }
          return { ...member };
        })
      );
      return;
    }

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
    if (isMockView) {
      const mockMessage = {
        _id: `mock-msg-${Date.now()}`,
        senderId: {
          _id: user?._id,
          username: user?.username,
          profile: {
            displayName: user?.profile?.displayName || user?.username,
            avatarUrl: user?.profile?.avatarUrl || user?.profile?.avatar
          }
        },
        content: message.trim(),
        createdAt: new Date().toISOString()
      };
      setMessages((prev) => [...prev, mockMessage]);
      setMessage('');
      setSending(false);
      return;
    }

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

  const activeMembers = useMemo(() => {
    if (!lobby) {
      return [];
    }
    return (lobby.members || []).filter((member) => ['joined', 'ready'].includes(member.status));
  }, [lobby]);

  const lobbyTags = useMemo(() => {
    if (!lobby) {
      return [];
    }
    const tags = [];
    if (Array.isArray(lobby.tags)) {
      tags.push(...lobby.tags);
    }
    if (lobby.region) {
      tags.push(lobby.region);
    }
    if (lobby.settings?.isPrivate) {
      tags.push('Invite only');
    }
    if (lobby.settings?.allowSpectators) {
      tags.push('Spectators welcome');
    }
    if (lobby.settings?.customSettings) {
      const customSettings = lobby.settings.customSettings;
      if (typeof customSettings.forEach === 'function') {
        customSettings.forEach((value, key) => {
          if (typeof value === 'string') {
            tags.push(value);
          } else if (value === true) {
            tags.push(key);
          }
        });
      } else if (typeof customSettings === 'object') {
        for (const [key, value] of Object.entries(customSettings)) {
          if (typeof value === 'string') {
            tags.push(value);
          } else if (value === true) {
            tags.push(key);
          }
        }
      }
    }
    if (tags.length === 0) {
      tags.push('Voice chat friendly', 'Chill vibes', 'Looking for teammates');
    }
    return [...new Set(tags)].slice(0, 5);
  }, [lobby]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

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

  const readyCount = lobby.readyCount ?? activeMembers.filter((member) => member.readyStatus).length;
  const totalMembers = lobby.memberCount ?? activeMembers.length;
  const minCapacity = lobby.capacity?.min ?? totalMembers;
  const playersNeeded = Math.max(minCapacity - readyCount, 0);
  const heroTitle = playersNeeded > 0
    ? `Need ${playersNeeded} more for ${lobby.gameMode}`
    : `${lobby.gameMode} ready to launch`;
  const heroSubtitle = `${lobby.gameId?.name || 'Game lobby'} • ${totalMembers} player${
    totalMembers === 1 ? '' : 's'
  } in squad`;
  const hostMember = activeMembers.find((member) => member.isHost);
  const hostName =
    hostMember?.userId?.profile?.displayName || hostMember?.userId?.username || 'Host';
  const coverImage = getGameArt(lobby.gameId || {});

  const formatMemberName = (member) =>
    member.userId?.profile?.displayName || member.userId?.username || 'Player';

  const getMemberInitials = (member) => {
    const name = formatMemberName(member);
    const parts = name.split(' ');
    if (parts.length === 1) {
      return parts[0]?.charAt(0)?.toUpperCase() || '?';
    }
    return `${parts[0]?.charAt(0) || ''}${parts[parts.length - 1]?.charAt(0) || ''}`.toUpperCase();
  };

  const getMemberStatusLabel = (member) =>
    member.readyStatus || member.status === 'ready' ? 'Ready' : 'Waiting';

  const getMemberStatusMeta = (member) => {
    if (member.readyStatus || member.status === 'ready') {
      const readyTime = member.readyAt || member.updatedAt || member.joinedAt;
      return readyTime ? `Ready since ${dayjs(readyTime).format('HH:mm')}` : 'Ready to roll';
    }
    const joinedAt = member.joinedAt || member.createdAt;
    return joinedAt ? `Joined ${dayjs(joinedAt).fromNow()}` : 'Waiting to ready up';
  };

  return (
    <div className="page page--lobby">
      <div className="lobby-hero" style={{ backgroundImage: coverImage ? `url(${coverImage})` : undefined }}>
        <div className="lobby-hero__overlay" />
        <div className="lobby-hero__content">
          <span className="lobby-hero__badge">{heroTitle}</span>
          <h1 className="lobby-hero__title">{lobby.name}</h1>
          <p className="lobby-hero__subtitle">{heroSubtitle}</p>
          <div className="lobby-hero__chips">
            {lobbyTags.map((tag) => (
              <span className="lobby-chip" key={tag}>
                {tag}
              </span>
            ))}
          </div>
          <div className="lobby-hero__meta">
            <span>
              Ready {readyCount}/{totalMembers}
            </span>
            <span>
              Host: <strong>{hostName}</strong>
            </span>
          </div>
        </div>
      </div>

      {feedback ? <div className="page__feedback">{feedback}</div> : null}

      <div className="lobby-layout">
        <section className="lobby-panel lobby-panel--roster">
          <header className="lobby-panel__header">
            <h2>Squad</h2>
            <span>{totalMembers} player{totalMembers === 1 ? '' : 's'}</span>
          </header>
          <ul className="lobby-roster">
            {activeMembers.map((member) => {
              const name = formatMemberName(member);
              const memberId = (member.userId?._id || member.userId)?.toString();
              const myMemberId = (myMember?.userId?._id || myMember?.userId)?.toString();
              const isSelf = Boolean(myMemberId && memberId === myMemberId);
              const avatar = member.userId?.profile?.avatarUrl;
              const statusLabel = getMemberStatusLabel(member);
              const statusMeta = getMemberStatusMeta(member);
              const isReady = statusLabel === 'Ready';
              return (
                <li
                  className={`lobby-roster__member ${isReady ? 'is-ready' : ''} ${
                    isSelf ? 'is-self' : ''
                  }`}
                  key={member._id || member.userId?._id || member.userId}
                >
                  <div className="lobby-roster__avatar" aria-hidden="true">
                    {avatar ? <img src={avatar} alt="" /> : <span>{getMemberInitials(member)}</span>}
                  </div>
                  <div className="lobby-roster__info">
                    <div className="lobby-roster__name">
                      <span>{name}</span>
                      {member.isHost ? <span className="lobby-roster__tag">Host</span> : null}
                      {isSelf ? <span className="lobby-roster__tag">You</span> : null}
                    </div>
                    <div className="lobby-roster__status">
                      <span className={`lobby-status-badge ${isReady ? 'is-ready' : ''}`}>{statusLabel}</span>
                      <span className="lobby-roster__time">{statusMeta}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
        <section className="lobby-panel lobby-panel--chat">
          <header className="lobby-panel__header">
            <h2>Lobby chat</h2>
            <span>Updated {dayjs(lobby.updatedAt).fromNow()}</span>
          </header>
          <div className="lobby-chat__messages">
            {messages.map((msg) => {
              const sender =
                msg.senderId?.profile?.displayName || msg.senderId?.username || 'System';
              const rawSenderId = msg.senderId?._id || msg.senderId?.id || msg.senderId;
              const isSelf =
                rawSenderId && user?._id
                  ? rawSenderId.toString() === user._id.toString()
                  : false;
              return (
                <article
                  className={`lobby-chat__message ${isSelf ? 'is-self' : ''}`}
                  key={msg._id}
                >
                  <div className="lobby-chat__message-meta">
                    <span className="lobby-chat__sender">
                      {sender}
                      {isSelf ? ' (You)' : ''}
                    </span>
                    <time dateTime={msg.createdAt}>{dayjs(msg.createdAt).format('HH:mm')}</time>
                  </div>
                  <div className="lobby-chat__bubble">
                    <p>{msg.content}</p>
                  </div>
                </article>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
          {isMember ? (
            <form className="lobby-chat__input" onSubmit={handleSendMessage}>
              <input
                type="text"
                placeholder="Write a message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
              />
              <button type="submit" disabled={sending || !message.trim()}>
                Send
              </button>
            </form>
          ) : (
            <div className="lobby-chat__join-callout">Join the lobby to chat with the squad.</div>
          )}
        </section>
      </div>

      <div className="lobby-actions">
        <button type="button" className="lobby-action" onClick={() => navigate('/lobbies')}>
          Back to lobbies
        </button>
        {isMember ? (
          <>
            <button
              type="button"
              className={`lobby-action lobby-action--primary ${
                myMember?.status === 'ready' ? 'is-ready' : ''
              }`}
              onClick={toggleReady}
            >
              {myMember?.status === 'ready' ? 'Ready ✔' : 'Ready up'}
            </button>
            <button
              type="button"
              className="lobby-action lobby-action--danger"
              onClick={handleLeave}
            >
              Leave lobby
            </button>
          </>
        ) : (
          <button
            type="button"
            className="lobby-action lobby-action--primary"
            onClick={handleJoin}
          >
            Join lobby
          </button>
        )}
      </div>
    </div>
  );
};

export default LobbyDetailPage;
