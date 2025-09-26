import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiCheck, FiRefreshCw, FiSearch, FiStar } from 'react-icons/fi';
import apiClient from '../services/apiClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import getGameArt from '../services/gameArt.js';
import defaultGameArt from '../assets/games/default-game.svg';

const regionOptions = ['NA', 'EU', 'AS', 'SA', 'OC', 'AF', 'ANY'];
const modeOptions = [
  { value: 'casual', label: 'Casual' },
  { value: 'competitive', label: 'Competitive' },
  { value: 'ranked', label: 'Ranked' },
  { value: 'custom', label: 'Custom' }
];

const playerPreferenceOptions = [
  { id: 'voice-chat', label: 'Voice chat' },
  { id: 'competitive', label: 'Competitive' },
  { id: 'verified', label: 'Verified' },
  { id: 'crossplay', label: 'Crossplay' }
];

const languageOptions = ['English', 'Danish', 'German', 'Italian', 'Polish', 'Slovak', 'Spanish', 'Swedish', 'French'];

const behaviourScoreOptions = ['+1000', '+3000', '+5000', '+7000', '+9000'];

const extraFilterOptions = [
  { id: 'crossplay-enabled', label: 'Crossplay Enabled' },
  { id: 'weekends-only', label: 'Weekends only' },
  { id: 'time-flexible', label: 'Time flexible' },
  { id: 'quick-games', label: 'Quick games' },
  { id: 'coach', label: 'Coach' },
  { id: 'pc', label: 'PC' },
  { id: 'console', label: 'Console' },
  { id: 'mobile', label: 'Mobile' }
];

const AGE_MIN = 13;
const AGE_MAX = 70;

const formatDuration = (ms) => {
  if (!ms || Number.isNaN(ms)) {
    return '-';
  }
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
  }
  return `${seconds}s`;
};

const findLabel = (collection, id) => collection.find((item) => item.id === id)?.label || id;

const getModeLabel = (value) => modeOptions.find((option) => option.value === value)?.label || value;

const MatchmakingPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const focusGame = location.state?.focusGame;

  const [activeStep, setActiveStep] = useState(focusGame ? 'filters' : 'games');
  const [trending, setTrending] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedGames, setSelectedGames] = useState([]);
  const [favoriteGameIds, setFavoriteGameIds] = useState([]);
  const [mode, setMode] = useState('casual');
  const [regions, setRegions] = useState(['ANY']);
  const [selectedLanguages, setSelectedLanguages] = useState(['English']);
  const [playerPreferences, setPlayerPreferences] = useState([]);
  const [behaviourScore, setBehaviourScore] = useState(behaviourScoreOptions[0]);
  const [extraFilters, setExtraFilters] = useState([]);
  const [ageRange, setAgeRange] = useState({ min: 18, max: 32 });
  const [groupSize, setGroupSize] = useState({ min: 1, max: 5 });
  const [feedback, setFeedback] = useState(null);
  const [profileNotice, setProfileNotice] = useState(null);
  const [status, setStatus] = useState(null);
  const [lockedProfile, setLockedProfile] = useState(null);
  const [profileDirty, setProfileDirty] = useState(true);
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [initialFilters, setInitialFilters] = useState(null);

  useEffect(() => {
    if (!user) {
      return;
    }

    const prefs = user.gamingPreferences || {};

    if (prefs.competitiveness === 'competitive') {
      setMode('ranked');
    } else if (prefs.competitiveness === 'balanced') {
      setMode('competitive');
    } else if (prefs.competitiveness === 'casual') {
      setMode('casual');
    }

    if (Array.isArray(prefs.regions) && prefs.regions.length > 0) {
      setRegions(prefs.regions);
    }

    if (Array.isArray(prefs.languages) && prefs.languages.length > 0) {
      setSelectedLanguages(prefs.languages.slice(0, 5));
    }

    if (prefs.groupSize?.min || prefs.groupSize?.max) {
      setGroupSize({
        min: prefs.groupSize.min || 1,
        max: prefs.groupSize.max || Math.max(prefs.groupSize.min || 1, 5)
      });
    }

    if (prefs.ageRange?.min || prefs.ageRange?.max) {
      setAgeRange({
        min: Math.max(AGE_MIN, prefs.ageRange.min || AGE_MIN),
        max: Math.min(AGE_MAX, prefs.ageRange.max || AGE_MAX)
      });
    }

    if (typeof prefs.behaviourScore === 'string' && behaviourScoreOptions.includes(prefs.behaviourScore)) {
      setBehaviourScore(prefs.behaviourScore);
    }

    if (Array.isArray(prefs.playerPreferences)) {
      setPlayerPreferences(prefs.playerPreferences);
    }

    if (Array.isArray(prefs.extraFilters)) {
      setExtraFilters(prefs.extraFilters);
    }

    setInitialFilters({
      mode: prefs.competitiveness === 'competitive' ? 'ranked' : prefs.competitiveness === 'balanced' ? 'competitive' : 'casual',
      regions: Array.isArray(prefs.regions) && prefs.regions.length > 0 ? prefs.regions : ['ANY'],
      selectedLanguages: Array.isArray(prefs.languages) && prefs.languages.length > 0 ? prefs.languages.slice(0, 5) : ['English'],
      ageRange: prefs.ageRange?.min || prefs.ageRange?.max
        ? {
            min: Math.max(AGE_MIN, prefs.ageRange.min || AGE_MIN),
            max: Math.min(AGE_MAX, prefs.ageRange.max || AGE_MAX)
          }
        : { min: 18, max: 32 },
      behaviourScore:
        typeof prefs.behaviourScore === 'string' && behaviourScoreOptions.includes(prefs.behaviourScore)
          ? prefs.behaviourScore
          : behaviourScoreOptions[0],
      playerPreferences: Array.isArray(prefs.playerPreferences) ? prefs.playerPreferences : [],
      extraFilters: Array.isArray(prefs.extraFilters) ? prefs.extraFilters : [],
      groupSize: {
        min: prefs.groupSize?.min || 1,
        max: prefs.groupSize?.max || Math.max(prefs.groupSize?.min || 1, 5)
      }
    });
  }, [user]);

  const addGame = useCallback((game) => {
    setSelectedGames((prev) => {
      if (prev.some((selected) => selected._id === game._id)) {
        return prev;
      }
      return [...prev, game].slice(0, 5);
    });
  }, []);

  const removeGame = useCallback((gameId) => {
    setSelectedGames((prev) => prev.filter((selected) => selected._id !== gameId));
  }, []);


  const toggleGameSelection = useCallback(
    (game) => {
      setSelectedGames((prev) => {
        if (prev.some((selected) => selected._id === game._id)) {
          return prev.filter((selected) => selected._id !== game._id);
        }
        if (prev.length >= 5) {
          return prev;
        }
        return [...prev, game];
      });
    },
    []
  );

  const toggleFavorite = useCallback((gameId) => {
    setFavoriteGameIds((prev) =>
      prev.includes(gameId) ? prev.filter((id) => id !== gameId) : [...prev, gameId]
    );
  }, []);

  const togglePreference = useCallback((id) => {
    setPlayerPreferences((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }, []);

  const toggleLanguage = useCallback((language) => {
    setSelectedLanguages((prev) => {
      if (prev.includes(language)) {
        if (prev.length === 1) {
          return prev;
        }
        return prev.filter((item) => item !== language);
      }
      if (prev.length >= 5) {
        return prev;
      }
      return [...prev, language];
    });
  }, []);

  const toggleExtraFilter = useCallback((id) => {
    setExtraFilters((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }, []);

  const toggleRegion = useCallback((region) => {
    setRegions((prev) => {
      if (region === 'ANY') {
        return ['ANY'];
      }
      const withoutAny = prev.filter((item) => item !== 'ANY');
      if (withoutAny.includes(region)) {
        const next = withoutAny.filter((item) => item !== region);
        return next.length > 0 ? next : ['ANY'];
      }
      return [...withoutAny, region];
    });
  }, []);

  const fetchTrending = useCallback(async () => {
    try {
      const response = await apiClient.get('/games/trending', { params: { limit: 12 } });
      const games = response.data?.data?.games || [];
      setTrending(games);
      if (focusGame) {
        if (focusGame._id) {
          const match = games.find((game) => game._id === focusGame._id);
          if (match) {
            addGame(match);
            setActiveStep('filters');
          } else {
            addGame(focusGame);
            setActiveStep('filters');
          }
        } else if (focusGame.name) {
          setSearchQuery(focusGame.name);
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
          params: { q: searchQuery, limit: 12 }
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
      setFeedback('Select at least one game to start matchmaking.');
      return;
    }
    if (!lockedProfile || profileDirty) {
      setProfileNotice('Save your search profile before starting the search.');
      return;
    }

    setLoading(true);
    setFeedback(null);
    try {
      const payload = {
        games: selectedGames.map((game) => ({ gameId: game._id })),
        gameMode: mode,
        regions,
        languages: selectedLanguages,
        groupSize
      };

      await apiClient.post('/matchmaking', payload);
      setActiveStep('games');
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

  useEffect(() => {
    setProfileDirty(true);
  }, [selectedGames, playerPreferences, selectedLanguages, behaviourScore, extraFilters, ageRange, regions, mode, groupSize]);

  const handleSaveProfile = () => {
    setLockedProfile({
      games: selectedGames.map((game) => ({ gameId: game._id })),
      playerPreferences,
      behaviourScore,
      extraFilters,
      ageRange,
      regions,
      mode,
      languages: selectedLanguages,
      groupSize
    });
    setProfileDirty(false);
    setProfileNotice('Search profile saved and locked for this queue.');
  };

  const handleResetProfile = () => {
    if (initialFilters) {
      setMode(initialFilters.mode);
      setRegions(initialFilters.regions);
      setSelectedLanguages(initialFilters.selectedLanguages);
      setAgeRange(initialFilters.ageRange);
      setBehaviourScore(initialFilters.behaviourScore);
      setPlayerPreferences(initialFilters.playerPreferences);
      setExtraFilters(initialFilters.extraFilters);
      setGroupSize(initialFilters.groupSize);
    } else {
      setMode('casual');
      setRegions(['ANY']);
      setSelectedLanguages(['English']);
      setAgeRange({ min: 18, max: 32 });
      setBehaviourScore(behaviourScoreOptions[0]);
      setPlayerPreferences([]);
      setExtraFilters([]);
      setGroupSize({ min: 1, max: 5 });
    }
    setLockedProfile(null);
    setProfileDirty(true);
    setProfileNotice('Filters reset to your defaults.');
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

  const hasActiveRequest = Boolean(status?.request);

  const availableGames = searchResults.length > 0 ? searchResults : trending;

  const sortedAvailableGames = useMemo(() => {
    if (favoriteGameIds.length === 0) {
      return availableGames;
    }
    return [...availableGames].sort((a, b) => {
      const aFav = favoriteGameIds.includes(a._id);
      const bFav = favoriteGameIds.includes(b._id);
      if (aFav && !bFav) {
        return -1;
      }
      if (bFav && !aFav) {
        return 1;
      }
      return 0;
    });
  }, [availableGames, favoriteGameIds]);

  const identity = useMemo(() => {
    const primaryName = user?.profile?.displayName?.trim() || user?.username || 'You';
    const initials = primaryName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'U';
    return {
      name: primaryName,
      handle: user?.username ? `@${user.username}` : '',
      initials
    };
  }, [user]);

  const previewChips = useMemo(() => {
    const chips = [];
    playerPreferenceOptions.forEach((option) => {
      if (playerPreferences.includes(option.id)) {
        chips.push(option.label);
      }
    });
    chips.push(`${getModeLabel(mode)} mode`);
    chips.push(`Age ${ageRange.min}-${ageRange.max}`);
    if (selectedLanguages.length > 0) {
      const [firstLanguage, ...restLanguages] = selectedLanguages;
      chips.push(
        restLanguages.length > 0 ? `${firstLanguage} +${restLanguages.length}` : firstLanguage
      );
    }
    chips.push(`Group ${groupSize.min}-${groupSize.max}`);
    chips.push(`Behaviour ${behaviourScore}`);
    if (regions.includes('ANY')) {
      chips.push('Any region');
    } else if (regions.length > 0) {
      chips.push(`Regions ${regions.join(', ')}`);
    }
    extraFilters.forEach((filterId) => {
      chips.push(findLabel(extraFilterOptions, filterId));
    });
    return chips;
  }, [playerPreferences, mode, ageRange, selectedLanguages, groupSize, behaviourScore, regions, extraFilters]);

  const renderStatusCard = () => (
    <div className={`matchmaking-status-card ${hasActiveRequest ? 'matchmaking-status-card--active' : ''}`}>
      <div className="matchmaking-status-card__copy">
        <span className="matchmaking-status-card__label">
          {hasActiveRequest ? 'Active search' : 'Status'}
        </span>
        <p>{statusSummary}</p>
      </div>
      <div className="matchmaking-status-card__actions">
        {hasActiveRequest ? (
          <button type="button" className="danger-button" onClick={cancelRequest}>
            Cancel search
          </button>
        ) : (
          <button
            type="button"
            className="ghost-button"
            onClick={fetchStatus}
            disabled={checkingStatus}
          >
            <FiRefreshCw size={16} />
            {checkingStatus ? ' Checking…' : ' Refresh status'}
          </button>
        )}
      </div>
    </div>
  );

  const renderGameSelection = () => (
    <div className="matchmaking-stage">
      <div className="matchmaking-stage__header">
        <button type="button" className="ghost-button" onClick={() => navigate(-1)}>
          <FiArrowLeft size={16} /> Back
        </button>
      </div>
      {renderStatusCard()}
      <div className="matchmaking-stage__search">
        <div className="matchmaking-search">
          <FiSearch size={18} />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search for a game"
          />
        </div>
      </div>
      <div className="game-gallery">
        {sortedAvailableGames.map((game) => {
          const isSelected = selectedGames.some((selected) => selected._id === game._id);
          const isFavorite = favoriteGameIds.includes(game._id);
          const art = getGameArt(game) || defaultGameArt;
          return (
            <button
              type="button"
              key={game._id}
              className={`game-tile ${isSelected ? 'game-tile--active' : ''}`}
              onClick={() => toggleGameSelection(game)}
            >
              <span
                className={`game-tile__favorite ${isFavorite ? 'game-tile__favorite--active' : ''}`}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleFavorite(game._id);
                }}
              >
                <FiStar size={16} />
              </span>
              {isSelected ? (
                <span className="game-tile__check">
                  <FiCheck size={16} />
                </span>
              ) : null}
              <div className="game-tile__media">
                <img
                  src={art}
                  alt={game.name}
                  loading="lazy"
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = defaultGameArt;
                  }}
                />
              </div>
              <div className="game-tile__body">
                <strong>{game.name}</strong>
                <span>{game.gameModes?.[0]?.name || game.genres?.[0]?.name || 'Mode TBD'}</span>
              </div>
            </button>
          );
        })}
        {sortedAvailableGames.length === 0 ? (
          <div className="game-gallery__empty">No games found. Try a different search.</div>
        ) : null}
      </div>
      <div className="matchmaking-stage__footer">
        <div className="matchmaking-stage__hint">
          {selectedGames.length > 0
            ? `${selectedGames.length} game${selectedGames.length > 1 ? 's' : ''} selected`
            : 'Pick a game to continue'}
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={() => setActiveStep('filters')}
          disabled={selectedGames.length === 0}
        >
          Choose filters
        </button>
      </div>
    </div>
  );

  const renderFilters = () => (
    <form className="matchmaking-stage matchmaking-stage--filters" onSubmit={submitRequest}>
      <div className="matchmaking-stage__header">
        <button type="button" className="ghost-button" onClick={() => setActiveStep('games')}>
          <FiArrowLeft size={16} /> Games
        </button>
        <div className="matchmaking-stage__heading">
          <h2>Choose filters</h2>
          <p>Lock in your search profile before you queue.</p>
        </div>
        <button
          type="button"
          className="ghost-button"
          onClick={fetchStatus}
          disabled={checkingStatus}
        >
          <FiRefreshCw size={16} />
          {checkingStatus ? ' Checking…' : ' Refresh status'}
        </button>
      </div>
      {feedback ? <div className="page__feedback page__feedback--floating">{feedback}</div> : null}
      {profileNotice ? <div className="matchmaking-inline-notice">{profileNotice}</div> : null}
      {renderStatusCard()}
      <div className="filters-grid">
        <div className="filter-card">
          <div className="filter-card__heading">
            <h3>Player preferences</h3>
            <span>Dial in who you want to queue with.</span>
          </div>
          <div className="age-range">
            <div className="age-range__labels">
              <span>{ageRange.min}</span>
              <span>{ageRange.max}</span>
            </div>
            <div className="age-range__slider">
              <input
                type="range"
                min={AGE_MIN}
                max={Math.max(AGE_MIN, ageRange.max - 1)}
                value={ageRange.min}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setAgeRange((prev) => ({ min: Math.min(value, prev.max - 1), max: prev.max }));
                }}
              />
              <input
                type="range"
                min={Math.min(AGE_MAX, ageRange.min + 1)}
                max={AGE_MAX}
                value={ageRange.max}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setAgeRange((prev) => ({ min: prev.min, max: Math.max(value, prev.min + 1) }));
                }}
              />
            </div>
          </div>
          <div className="chip-row">
            {playerPreferenceOptions.map((option) => {
              const active = playerPreferences.includes(option.id);
              return (
                <button
                  type="button"
                  key={option.id}
                  className={`chip ${active ? 'chip--active' : ''}`}
                  onClick={() => togglePreference(option.id)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <div className="chip-row chip-row--wrap">
            {regionOptions.map((region) => {
              const active = regions.includes(region);
              return (
                <button
                  type="button"
                  key={region}
                  className={`chip ${active ? 'chip--active' : ''}`}
                  onClick={() => toggleRegion(region)}
                >
                  {region}
                </button>
              );
            })}
          </div>
          <div className="filter-card__field">
            <label htmlFor="matchmaking-mode">Game mode</label>
            <select
              id="matchmaking-mode"
              value={mode}
              onChange={(event) => setMode(event.target.value)}
            >
              {modeOptions.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-card__field">
            <label>Group size</label>
            <div className="group-size group-size--compact">
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
          </div>
        </div>

        <div className="filter-card">
          <div className="filter-card__heading">
            <h3>Languages</h3>
            <span>Pick up to five languages.</span>
          </div>
          <div className="chip-row chip-row--wrap">
            {languageOptions.map((language) => {
              const active = selectedLanguages.includes(language);
              const disable = active && selectedLanguages.length === 1;
              return (
                <button
                  type="button"
                  key={language}
                  className={`chip ${active ? 'chip--active' : ''}`}
                  onClick={() => (!disable ? toggleLanguage(language) : undefined)}
                  disabled={disable}
                >
                  {language}
                </button>
              );
            })}
          </div>
        </div>

        <div className="filter-card">
          <div className="filter-card__heading">
            <h3>Behaviour score</h3>
            <span>Keep things friendly.</span>
          </div>
          <div className="chip-row">
            {behaviourScoreOptions.map((score) => {
              const active = behaviourScore === score;
              return (
                <button
                  type="button"
                  key={score}
                  className={`chip ${active ? 'chip--active' : ''}`}
                  onClick={() => setBehaviourScore(score)}
                >
                  {score}
                </button>
              );
            })}
          </div>
        </div>

        <div className="filter-card">
          <div className="filter-card__heading">
            <h3>Extra filters</h3>
            <span>Fine-tune your vibe.</span>
          </div>
          <div className="chip-row chip-row--wrap">
            {extraFilterOptions.map((option) => {
              const active = extraFilters.includes(option.id);
              return (
                <button
                  type="button"
                  key={option.id}
                  className={`chip ${active ? 'chip--active' : ''}`}
                  onClick={() => toggleExtraFilter(option.id)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="matchmaking-stage__footer matchmaking-stage__footer--profile">
        <div className="matchmaking-stage__profile">
          <div className="filter-card__heading">
            <h3>Search profile</h3>
            <span>This is what other players will see.</span>
          </div>
          <div className="search-preview">
            <div className="search-preview__header">
              <div className="search-preview__avatar">{identity.initials}</div>
              <div className="search-preview__title">
                <strong>{identity.name}</strong>
                {identity.handle ? <span>{identity.handle}</span> : null}
              </div>
              <span className="search-preview__status">
                <span className="dot dot--online" />
                {hasActiveRequest ? 'In queue' : 'Ready'}
              </span>
            </div>
            <div className="search-preview__chips">
              {previewChips.length > 0 ? (
                previewChips.map((chip) => (
                  <span key={chip} className="chip chip--ghost">
                    {chip}
                  </span>
                ))
              ) : (
                <span className="surface__subtitle">Add filters to build your profile.</span>
              )}
            </div>
            <div className="search-preview__games">
              {selectedGames.length > 0 ? (
                selectedGames.map((game) => (
                  <div key={game._id} className="search-preview__game">
                    <div className="search-preview__game-info">
                      <img
                        src={getGameArt(game) || defaultGameArt}
                        alt={game.name}
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.onerror = null;
                          event.currentTarget.src = defaultGameArt;
                        }}
                      />
                      <div>
                        <span>{game.name}</span>
                        <small>{game.gameModes?.[0]?.name || 'Mode TBD'}</small>
                      </div>
                    </div>
                    <button type="button" className="ghost-button" onClick={() => removeGame(game._id)}>
                      Remove
                    </button>
                  </div>
                ))
              ) : (
                <span className="surface__subtitle">Select at least one game to build a profile.</span>
              )}
            </div>
          </div>
        </div>
        <div className="matchmaking-stage__controls">
          <div className="matchmaking-stage__hint">
            {lockedProfile && !profileDirty
              ? 'Profile locked. Ready when you are!'
              : 'Save your profile before starting the search.'}
          </div>
          <div className="matchmaking-stage__buttons">
            <button type="button" className="ghost-button" onClick={handleResetProfile}>
              Reset
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={handleSaveProfile}
              disabled={selectedGames.length === 0}
            >
              Save profile
            </button>
            <button
              type="submit"
              className="primary-button primary-button--lg"
              disabled={loading || selectedGames.length === 0 || profileDirty}
            >
              {loading ? 'Submitting.' : 'Start search'}
            </button>
          </div>
        </div>
      </div>
    </form>
  );

  return (
    <div className="matchmaking-screen">
      {activeStep === 'games' ? renderGameSelection() : renderFilters()}
    </div>
  );
};

export default MatchmakingPage;
