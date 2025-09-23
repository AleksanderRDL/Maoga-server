import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import apiClient from '../services/apiClient.js';

const regionOptions = ['NA', 'EU', 'AS', 'SA', 'OC', 'AF', 'ANY'];
const modeOptions = [
  { value: 'casual', label: 'Casual' },
  { value: 'competitive', label: 'Competitive' },
  { value: 'ranked', label: 'Ranked' },
  { value: 'custom', label: 'Custom' }
];

const formatDuration = (ms) => {
  if (!ms || Number.isNaN(ms)) {
    return '—';
  }
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
  }
  return `${seconds}s`;
};

const MatchmakingPage = () => {
  const location = useLocation();
  const focusGame = location.state?.focusGame;

  const [trending, setTrending] = useState([]);
  const [selectedGames, setSelectedGames] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [mode, setMode] = useState('casual');
  const [regions, setRegions] = useState(['ANY']);
  const [languageInput, setLanguageInput] = useState('en');
  const [groupSize, setGroupSize] = useState({ min: 1, max: 5 });
  const [schedule, setSchedule] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const addGame = useCallback(
    (game) => {
      setSelectedGames((prev) => {
        if (prev.some((entry) => entry.game._id === game._id)) {
          return prev;
        }
        return [...prev, { game, weight: 5 }];
      });
    },
    [setSelectedGames]
  );

  const removeGame = (gameId) => {
    setSelectedGames((prev) => prev.filter((entry) => entry.game._id !== gameId));
  };

  const updateWeight = (gameId, weight) => {
    setSelectedGames((prev) =>
      prev.map((entry) =>
        entry.game._id === gameId ? { ...entry, weight: Number(weight) } : entry
      )
    );
  };

  const fetchTrending = useCallback(async () => {
    try {
      const response = await apiClient.get('/games/trending', { params: { limit: 9 } });
      const games = response.data?.data?.games || [];
      setTrending(games);
      if (focusGame) {
        const match = games.find((game) => game._id === focusGame._id);
        if (match) {
          addGame(match);
        } else {
          addGame(focusGame);
        }
      }
    } catch (err) {
      console.error('Failed to load trending games', err);
    }
  }, [addGame, focusGame]);

  useEffect(() => {
    fetchTrending();
  }, [fetchTrending]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return undefined;
    }

    const timeout = setTimeout(async () => {
      try {
        const response = await apiClient.get('/games', {
          params: { q: searchQuery, limit: 10 }
        });
        setSearchResults(response.data?.data?.games || []);
      } catch (err) {
        console.error('Search failed', err);
      }
    }, 400);

    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const fetchStatus = useCallback(async () => {
    setCheckingStatus(true);
    try {
      const response = await apiClient.get('/matchmaking/status');
      setStatus(response.data?.data || null);
    } catch (err) {
      console.error('Failed to fetch matchmaking status', err);
    } finally {
      setCheckingStatus(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const submitRequest = async (event) => {
    event.preventDefault();
    if (selectedGames.length === 0) {
      setFeedback('Select at least one game.');
      return;
    }
    setLoading(true);
    setFeedback(null);
    try {
      const payload = {
        games: selectedGames.map((entry) => ({ gameId: entry.game._id, weight: entry.weight })),
        gameMode: mode,
        regions,
        languages: languageInput.split(',').map((lang) => lang.trim()).filter(Boolean),
        groupSize,
        scheduledTime: schedule ? new Date(schedule).toISOString() : undefined
      };
      await apiClient.post('/matchmaking', payload);
      setFeedback('Matchmaking request submitted!');
      fetchStatus();
    } catch (err) {
      const message = err.response?.data?.message || err.response?.data?.error || err.message;
      setFeedback(message || 'Failed to submit matchmaking request');
    } finally {
      setLoading(false);
    }
  };

  const cancelRequest = async () => {
    const requestId = status?.request?._id || status?.matchRequest?._id;
    if (!requestId) {
      return;
    }
    try {
      await apiClient.delete(`/matchmaking/${requestId}`);
      setFeedback('Cancelled matchmaking request');
      fetchStatus();
    } catch (err) {
      const message = err.response?.data?.message || err.response?.data?.error || err.message;
      setFeedback(message || 'Failed to cancel matchmaking');
    }
  };

  const statusSummary = useMemo(() => {
    if (!status) {
      return 'No active matchmaking request.';
    }
    if (status.matchRequest === null) {
      return status.message || 'No active matchmaking request.';
    }
    if (status.request) {
      const queue = status.queueInfo;
      return `Searching for ${status.request.criteria?.gameMode} lobby. Potential matches: ${queue?.potentialMatches ?? 0}. Estimated wait: ${formatDuration(queue?.estimatedWaitTime)}.`;
    }
    return 'Matchmaking status unavailable.';
  }, [status]);

  return (
    <div className="page page--matchmaking">
      <section className="section">
        <div className="section__header">
          <h3>Create lobby request</h3>
          <button type="button" className="link" onClick={fetchStatus} disabled={checkingStatus}>
            {checkingStatus ? 'Checking…' : 'Check status'}
          </button>
        </div>
        {feedback ? <div className="page__feedback">{feedback}</div> : null}
        <p className="status-summary">{statusSummary}</p>
        {status?.request ? (
          <button type="button" className="danger-button" onClick={cancelRequest}>
            Cancel current request
          </button>
        ) : null}
      </section>

      <form className="section matchmaking-form" onSubmit={submitRequest}>
        <div className="section__header">
          <h3>Choose your games</h3>
        </div>
        <div className="game-selection">
          <div className="game-selection__panel">
            <label>
              <span>Search games</span>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Type to search"
              />
            </label>
            <div className="game-selection__list">
              {(searchResults.length > 0 ? searchResults : trending).map((game) => {
                const isSelected = selectedGames.some((entry) => entry.game._id === game._id);
                return (
                  <button
                    type="button"
                    key={game._id}
                    className={`game-selection__item ${isSelected ? 'game-selection__item--active' : ''}`}
                    onClick={() => addGame(game)}
                  >
                    <strong>{game.name}</strong>
                    <span>{game.gameModes?.[0]?.name || 'Mode TBD'}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="game-selection__panel">
            <h4>Selected</h4>
            {selectedGames.length === 0 ? <p>No games selected yet.</p> : null}
            <ul className="selected-games">
              {selectedGames.map((entry) => (
                <li key={entry.game._id}>
                  <div>
                    <strong>{entry.game.name}</strong>
                    <span>{entry.game.gameModes?.[0]?.name}</span>
                  </div>
                  <div className="selected-games__controls">
                    <label>
                      Weight
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={entry.weight}
                        onChange={(event) => updateWeight(entry.game._id, event.target.value)}
                      />
                    </label>
                    <span>{entry.weight}</span>
                    <button type="button" onClick={() => removeGame(entry.game._id)}>
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="matchmaking-grid">
          <label>
            <span>Game mode</span>
            <select value={mode} onChange={(event) => setMode(event.target.value)}>
              {modeOptions.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Regions</span>
            <div className="pill-group">
              {regionOptions.map((region) => {
                const active = regions.includes(region);
                return (
                  <button
                    type="button"
                    key={region}
                    className={`pill ${active ? 'pill--active' : ''}`}
                    onClick={() =>
                      setRegions((prev) =>
                        prev.includes(region)
                          ? prev.filter((item) => item !== region)
                          : [...prev, region]
                      )
                    }
                  >
                    {region}
                  </button>
                );
              })}
            </div>
          </label>
          <label>
            <span>Languages (comma separated)</span>
            <input
              type="text"
              value={languageInput}
              onChange={(event) => setLanguageInput(event.target.value)}
            />
          </label>
          <label>
            <span>Group size</span>
            <div className="group-size">
              <input
                type="number"
                min="1"
                max="10"
                value={groupSize.min}
                onChange={(event) =>
                  setGroupSize((prev) => ({ ...prev, min: Number(event.target.value) }))
                }
              />
              <span>to</span>
              <input
                type="number"
                min={groupSize.min}
                max="10"
                value={groupSize.max}
                onChange={(event) =>
                  setGroupSize((prev) => ({ ...prev, max: Number(event.target.value) }))
                }
              />
            </div>
          </label>
          <label>
            <span>Scheduled time (optional)</span>
            <input
              type="datetime-local"
              value={schedule}
              onChange={(event) => setSchedule(event.target.value)}
            />
          </label>
        </div>

        <button type="submit" className="primary-button primary-button--lg" disabled={loading}>
          {loading ? 'Submitting…' : 'Start matchmaking'}
        </button>
      </form>
    </div>
  );
};

export default MatchmakingPage;
