import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

const defaultFeed = [
  {
    id: 'feed1',
    title: 'Reached Platinum support',
    description: 'Thanks to the squad! Time to learn jungle next.',
    timestamp: '2h ago'
  },
  {
    id: 'feed2',
    title: 'Unlocked Riot buddy pass',
    description: 'Invite sent to Maria. 1 more token available.',
    timestamp: '1d ago'
  }
];

const PersonalPostPage = () => {
  const { user } = useAuth();
  const [feedEntries, setFeedEntries] = useState(defaultFeed);
  const [feedDraft, setFeedDraft] = useState('');
  const [notice, setNotice] = useState(null);

  const displayName = user?.profile?.displayName || user?.username || 'Commander';

  const handleAddFeedEntry = (event) => {
    event.preventDefault();
    const draft = feedDraft.trim();
    if (!draft) {
      return;
    }
    setFeedEntries((prev) => [
      {
        id: `feed-${Date.now()}`,
        title: draft,
        description: 'Shared just now',
        timestamp: 'Just now'
      },
      ...prev
    ]);
    setFeedDraft('');
    setNotice('Saved locally for now. Feed service integration coming soon.');
  };

  return (
    <div className="page page--personal-post">
      <section className="surface">
        <div className="surface__header">
          <div>
            <h2>Personal post</h2>
            <p className="surface__subtitle">Track your highlights before you share them broadly.</p>
          </div>
        </div>
        {notice ? <div className="page__notice">{notice}</div> : null}
        <form className="feed-form" onSubmit={handleAddFeedEntry}>
          <textarea
            value={feedDraft}
            onChange={(event) => setFeedDraft(event.target.value)}
            placeholder={`Share what you're proud of, ${displayName}.`}
          />
          <button type="submit" className="primary-button">
            Post update
          </button>
        </form>
        <ul className="feed-list">
          {feedEntries.map((entry) => (
            <li key={entry.id}>
              <strong>{entry.title}</strong>
              <p>{entry.description}</p>
              <span>{entry.timestamp}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default PersonalPostPage;
