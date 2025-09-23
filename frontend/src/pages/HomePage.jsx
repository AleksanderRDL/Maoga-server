import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/apiClient.js';
import GameCard from '../components/GameCard.jsx';
import StatPill from '../components/StatPill.jsx';

const HomePage = () => {
  const navigate = useNavigate();
  const [trending, setTrending] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [activeGame, setActiveGame] = useState(null);
  const [loadingTrending, setLoadingTrending] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTrending = async () => {
      setLoadingTrending(true);
      try {
        const response = await apiClient.get('/games/trending', { params: { limit: 12 } });
        const games = response.data?.data?.games || [];
        setTrending(games);
        setActiveGame((prev) => prev || games[0] || null);
      } catch (err) {
        console.error('Failed to fetch trending games', err);
        setError('Unable to load trending games right now.');
      } finally {
        setLoadingTrending(false);
      }
    };

    fetchTrending();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return undefined;
    }

    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await apiClient.get('/games', {
          params: {
            q: searchQuery,
            limit: 12
          }
        });
        setSearchResults(response.data?.data?.games || []);
      } catch (err) {
        console.error('Game search failed', err);
        setError('Search failed. Try a different title.');
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const handleJoinMatch = (game) => {
    navigate('/matchmaking', { state: { focusGame: game } });
  };

  const meta = useMemo(() => {
    if (!activeGame) {
      return null;
    }
    const modes = (activeGame.gameModes || []).map((mode) => mode.name).slice(0, 3).join(' • ');
    const platforms = (activeGame.platforms || [])
      .map((platform) => platform.abbreviation || platform.name)
      .slice(0, 4)
      .join(' • ');

    return {
      modes,
      platforms,
      rating: activeGame.rating ? Math.round(activeGame.rating) : null
    };
  }, [activeGame]);

  return (
    <div className="page page--home">
      <div className="panel panel--accent">
        <div className="panel__content">
          <div>
            <h2>Search for a game</h2>
            <p>Browse the library and jump into a lobby when you are ready.</p>
          </div>
          <div className="search-box">
            <input
              type="search"
              placeholder="League of Legends, Valorant, It Takes Two..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <span>{searching ? 'Searching…' : '🔍'}</span>
          </div>
        </div>
        {meta ? (
          <div className="panel__meta">
            {meta.rating ? <StatPill label="Rating" value={`${meta.rating}%`} variant="purple" /> : null}
            {meta.modes ? <StatPill label="Modes" value={meta.modes} variant="blue" /> : null}
            {meta.platforms ? (
              <StatPill label="Platforms" value={meta.platforms} variant="pink" />
            ) : null}
          </div>
        ) : null}
      </div>

      {error ? <div className="page__error">{error}</div> : null}

      <section className="section">
        <div className="section__header">
          <h3>Trending now</h3>
          <span>{loadingTrending ? 'Loading…' : `${trending.length} games`}</span>
        </div>
        <div className="game-grid">
          {trending.map((game) => (
            <GameCard
              key={game._id}
              game={game}
              onSelect={() => setActiveGame(game)}
              isActive={activeGame?._id === game._id}
              actionSlot={
                <button type="button" onClick={() => handleJoinMatch(game)}>
                  Matchmake
                </button>
              }
            />
          ))}
        </div>
      </section>

      {searchResults.length > 0 ? (
        <section className="section">
          <div className="section__header">
            <h3>Search results</h3>
            <span>{searchResults.length} matches</span>
          </div>
          <div className="game-grid">
            {searchResults.map((game) => (
              <GameCard
                key={game._id}
                game={game}
                onSelect={() => setActiveGame(game)}
                actionSlot={
                  <button type="button" onClick={() => handleJoinMatch(game)}>
                    Queue up
                  </button>
                }
              />
            ))}
          </div>
        </section>
      ) : null}

      {activeGame ? (
        <section className="section">
          <div className="section__header">
            <h3>{activeGame.name}</h3>
            <button type="button" className="link" onClick={() => handleJoinMatch(activeGame)}>
              Start matchmaking →
            </button>
          </div>
          <div className="panel">
            <div className="panel__content panel__content--columns">
              <div>
                <p>{activeGame.summary || activeGame.description || 'No summary provided yet.'}</p>
              </div>
              <div className="panel__artwork">
                {activeGame.coverImage?.url ? (
                  <img src={activeGame.coverImage.url} alt={`${activeGame.name} cover`} />
                ) : (
                  <div className="panel__placeholder">{activeGame.name.slice(0, 2)}</div>
                )}
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
};

export default HomePage;
