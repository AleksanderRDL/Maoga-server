import { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/apiClient.js';
import { useAuth } from '../context/AuthContext.jsx';

const mockFriends = [
  {
    id: 'fr1',
    name: 'Maria',
    handle: '@mferfly',
    status: 'Playing Baldur\'s Gate 3',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Maria',
    favouriteGame: 'Baldur\'s Gate 3',
    lastOnline: dayjs().subtract(4, 'minute')
  },
  {
    id: 'fr2',
    name: 'Tessa',
    handle: '@myBad',
    status: 'In champion select (LoL)',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Tessa',
    favouriteGame: 'League of Legends',
    lastOnline: dayjs().subtract(11, 'minute')
  },
  {
    id: 'fr3',
    name: 'Cassie',
    handle: '@glitchGoddess',
    status: 'Streaming Valorant customs',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Cassie',
    favouriteGame: 'Valorant',
    lastOnline: dayjs().subtract(2, 'hour')
  },
  {
    id: 'fr4',
    name: 'Nora',
    handle: '@thunderNeko',
    status: 'Looking for Apex squad',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Nora',
    favouriteGame: 'Apex Legends',
    lastOnline: dayjs().subtract(1, 'day')
  }
];

const FriendsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [friends, setFriends] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [friendMessages, setFriendMessages] = useState({});
  const [messageDraft, setMessageDraft] = useState('');
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [notice, setNotice] = useState(null);

  const loadFriends = useCallback(async () => {
    setLoadingFriends(true);
    try {
      const response = await apiClient.get('/friends');
      const data = response.data?.data?.friends || [];
      if (data.length > 0) {
        setFriends(
          data.map((friend) => ({
            id: friend.friendshipId || friend._id,
            name: friend.profile?.displayName || friend.username,
            handle: `@${friend.username || friend.profile?.displayName || 'friend'}`,
            status: friend.statusMessage || 'Ready to game',
            avatar:
              friend.profile?.avatarSeed
                ? `https://api.dicebear.com/7.x/bottts/svg?seed=${friend.profile.avatarSeed}`
                : 'https://api.dicebear.com/7.x/bottts/svg?seed=Maoga',
            favouriteGame: friend.favoriteGame || friend.primaryGame || 'Multiplayer',
            lastOnline: dayjs(friend.lastOnline || new Date())
          }))
        );
      } else {
        setFriends(mockFriends);
      }
    } catch (err) {
      console.info('Falling back to mock friends. Friend API not ready yet.', err.message);
      setFriends(mockFriends);
    } finally {
      setLoadingFriends(false);
    }
  }, []);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  useEffect(() => {
    if (friends.length > 0 && !selectedFriend) {
      setSelectedFriend(friends[0]);
    }
  }, [friends, selectedFriend]);


  const selectedMessages = useMemo(() => {
    if (!selectedFriend) {
      return [];
    }
    return friendMessages[selectedFriend.id] || [
      {
        id: `${selectedFriend.id}-seed`,
        sender: selectedFriend.name,
        content: 'Hey! Ready for a duo queue later tonight?',
        timestamp: dayjs().subtract(32, 'minute')
      }
    ];
  }, [friendMessages, selectedFriend]);

  const handleSendMessage = (event) => {
    event.preventDefault();
    if (!messageDraft.trim() || !selectedFriend) {
      return;
    }
    const newMessage = {
      id: `${selectedFriend.id}-${Date.now()}`,
      sender: user?.profile?.displayName || user?.username || 'You',
      content: messageDraft.trim(),
      timestamp: dayjs()
    };
    setFriendMessages((prev) => ({
      ...prev,
      [selectedFriend.id]: [...(prev[selectedFriend.id] || selectedMessages), newMessage]
    }));
    setMessageDraft('');
    setNotice('Message queued. Chat service integration coming soon.');
  };


  const handleNavigateToMatchmaking = () => {
    if (!selectedFriend) {
      return;
    }
    navigate('/matchmaking', {
      state: {
        focusGame: { name: selectedFriend.favouriteGame }
      }
    });
  };

  return (
    <div className="page page--friends">
      <div className="friends-layout">
        <aside className="friends-sidebar">
          <div className="section__header">
            <h3>Your circle</h3>
            <span>{loadingFriends ? 'Loading…' : `${friends.length} friends`}</span>
          </div>
          <ul className="friends-list">
            {friends.map((friend) => {
              const isActive = selectedFriend?.id === friend.id;
              return (
                <li key={friend.id}>
                  <button
                    type="button"
                    className={`friends-list__item ${isActive ? 'friends-list__item--active' : ''}`}
                    onClick={() => setSelectedFriend(friend)}
                  >
                    <img src={friend.avatar} alt={friend.name} />
                    <div>
                      <strong>{friend.name}</strong>
                      <span>{friend.status}</span>
                    </div>
                    <span className="timestamp">{friend.lastOnline.fromNow()}</span>
                  </button>
                </li>
              );
            })}
            {friends.length === 0 && !loadingFriends ? (
              <li className="friends-list__empty">No friends yet. Start by sending a few invites!</li>
            ) : null}
          </ul>
        </aside>

        <main className="friends-main">
          {selectedFriend ? (
            <>
              <section className="surface friend-profile">
                <header>
                  <div className="friend-profile__meta">
                    <img src={selectedFriend.avatar} alt={selectedFriend.name} />
                    <div>
                      <h2>{selectedFriend.name}</h2>
                      <span>{selectedFriend.handle}</span>
                      <p>{selectedFriend.status}</p>
                    </div>
                  </div>
                  <div className="friend-profile__actions">
                    <button type="button" className="ghost-button" onClick={handleNavigateToMatchmaking}>
                      Queue together
                    </button>
                    <button type="button" className="primary-button" onClick={() => navigate('/lobbies')}>
                      Invite to lobby
                    </button>
                  </div>
                </header>
                <div className="friend-profile__details">
                  <div>
                    <span className="label">Favourite game</span>
                    <strong>{selectedFriend.favouriteGame}</strong>
                  </div>
                  <div>
                    <span className="label">Last online</span>
                    <strong>{selectedFriend.lastOnline.fromNow()}</strong>
                  </div>
                  <div>
                    <span className="label">Mutual communities</span>
                    <strong>{user?.gameProfiles?.length || 0} shared games</strong>
                  </div>
                </div>
              </section>

              <section className="surface friend-chat">
                <div className="surface__header">
                  <div>
                    <h3>Chat</h3>
                    <p className="surface__subtitle">Keep the hype going with quick updates</p>
                  </div>
                </div>
                <div className="friend-chat__messages">
                  {selectedMessages.map((message) => (
                    <article key={message.id} className="chat-message">
                      <div className="chat-message__meta">
                        <strong>{message.sender}</strong>
                        <span>{message.timestamp.fromNow()}</span>
                      </div>
                      <p>{message.content}</p>
                    </article>
                  ))}
                </div>
                <form className="friend-chat__input" onSubmit={handleSendMessage}>
                  <input
                    type="text"
                    value={messageDraft}
                    onChange={(event) => setMessageDraft(event.target.value)}
                    placeholder={`Message ${selectedFriend.name}`}
                  />
                  <button type="submit" className="primary-button">
                    Send
                  </button>
                </form>
              </section>
            </>
          ) : (
            <section className="surface friend-placeholder">
              <p>Select a friend to see their profile and chat.</p>
            </section>
          )}
          {notice ? <div className="page__notice">{notice}</div> : null}
        </main>

      </div>
    </div>
  );
};

export default FriendsPage;
