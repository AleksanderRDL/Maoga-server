import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

dayjs.extend(relativeTime);

const feedMock = [
  {
    id: 'p1',
    author: 'Sophia @starlitpico',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Sophia',
    media: 'https://images.unsplash.com/photo-1578926081170-47dc463da3f0?auto=format&fit=crop&w=600&q=80',
    content: 'OMG Gulganna is launching, so excited! #TeamRed',
    reactions: 412,
    comments: 68,
    createdAt: dayjs().subtract(20, 'minute')
  },
  {
    id: 'p2',
    author: 'Tessa @myBad',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Tessa',
    media: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=600&q=80',
    content: 'Just finished custom Aram with voice commands only. Chaos & fun! 🎙️',
    reactions: 128,
    comments: 24,
    createdAt: dayjs().subtract(45, 'minute')
  },
  {
    id: 'p3',
    author: 'Zoe @blaz3d',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Zoe',
    content: 'Finally reached Emerald in League! 🟢',
    reactions: 322,
    comments: 45,
    createdAt: dayjs().subtract(2, 'hour')
  },
  {
    id: 'p4',
    author: 'Billy @sketchstack',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Billy',
    media: 'https://images.unsplash.com/photo-1611606063065-ee7946f0785b?auto=format&fit=crop&w=600&q=80',
    content: 'New maoga fan-art drop 💜✨',
    reactions: 89,
    comments: 11,
    createdAt: dayjs().subtract(4, 'hour')
  }
];

const NewsFeedPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const displayName = user?.profile?.displayName || user?.username || 'Maogan';

  const highlights = useMemo(
    () => [
      {
        id: 'h1',
        title: 'Friends online',
        value: 9,
        caption: 'Send them a ping from chat'
      },
      {
        id: 'h2',
        title: 'New achievements',
        value: 3,
        caption: 'Claim them before reset'
      },
      {
        id: 'h3',
        title: 'Open invites',
        value: 4,
        caption: 'Join a squad in seconds'
      }
    ],
    []
  );

  return (
    <div className="page page--news">
      <section className="surface surface--hero">
        <div className="surface__header">
          <div>
            <h2>Hey {displayName}, here\'s what\'s buzzing 🪩</h2>
            <p className="surface__subtitle">Updates from your friends, favourite games and communities.</p>
          </div>
          <div className="surface__actions">
            <button type="button" className="primary-button" onClick={() => navigate('/chat')}>
              Share an update
            </button>
          </div>
        </div>
        <div className="news-highlights">
          {highlights.map((highlight) => (
            <article key={highlight.id}>
              <strong>{highlight.value}</strong>
              <span>{highlight.title}</span>
              <p>{highlight.caption}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="news-layout">
        <aside className="news-sidebar">
          <section className="surface surface--profile">
            <div className="surface__header">
              <h3>Game spotlights</h3>
              <span className="surface__subtitle">Fresh news from the titles you follow</span>
            </div>
            <ul className="news-list">
              <li>
                <strong>League of Legends</strong>
                <p>Patch 14.3 goes live tomorrow. Expect balance adjustments to enchanters.</p>
              </li>
              <li>
                <strong>Valorant</strong>
                <p>New agent teaser dropped. Ability reveal stream tonight at 19:00 CET.</p>
              </li>
              <li>
                <strong>Baldur\'s Gate 3</strong>
                <p>Community challenge unlocked: finish Act 2 with zero long rests. 👀</p>
              </li>
            </ul>
          </section>

          <section className="surface surface--friends">
            <div className="surface__header">
              <h3>Friend streaks</h3>
              <span className="surface__subtitle">Keep the energy alive</span>
            </div>
            <ul className="news-list">
              <li>
                <strong>Emily &amp; Zoe</strong>
                <p>5 days of duo queue in Apex Legends. They\'re on fire!</p>
              </li>
              <li>
                <strong>Maria</strong>
                <p>Unlocked Emerald duo streak in League of Legends.</p>
              </li>
              <li>
                <strong>Pernille</strong>
                <p>Hosting a creative Minecraft weekend build-off. RSVP open now.</p>
              </li>
            </ul>
          </section>
        </aside>

        <main className="news-feed">
          {feedMock.map((item) => (
            <article key={item.id} className="surface surface--post">
              <header>
                <img src={item.avatar} alt={item.author} />
                <div>
                  <strong>{item.author}</strong>
                  <span>{item.createdAt.fromNow()}</span>
                </div>
                <button type="button" className="icon-button" onClick={() => navigate('/profile')}>
                  ···
                </button>
              </header>
              <p>{item.content}</p>
              {item.media ? <img src={item.media} alt="Post media" className="post-media" /> : null}
              <footer>
                <button type="button">❤️ {item.reactions}</button>
                <button type="button">💬 {item.comments}</button>
                <button type="button" className="link">
                  Share
                </button>
              </footer>
            </article>
          ))}
        </main>
      </div>
      {/* TODO: Replace mock feed with backend data once feed endpoints are available. */}
    </div>
  );
};

export default NewsFeedPage;
