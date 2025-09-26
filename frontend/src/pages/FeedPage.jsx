import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useMemo } from 'react';

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
    content: 'New Maoga fan-art drop 💜✨',
    reactions: 89,
    comments: 11,
    createdAt: dayjs().subtract(4, 'hour')
  }
];

const FeedPage = () => {
  const feed = useMemo(() => feedMock, []);

  return (
    <div className="page page--feed">
      <main className="news-feed">
        {feed.map((item) => (
          <article key={item.id} className="surface surface--post">
            <header>
              <img src={item.avatar} alt={item.author} />
              <div>
                <strong>{item.author}</strong>
                <span>{item.createdAt.fromNow()}</span>
              </div>
              <button type="button" className="icon-button">
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
      {/* TODO: Replace mock feed with backend data once feed endpoints are available. */}
    </div>
  );
};

export default FeedPage;
