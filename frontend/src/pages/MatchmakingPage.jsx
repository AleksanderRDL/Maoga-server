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

const regionPreferenceOptions = [
  { value: 'strict', label: 'Strict' },
  { value: 'preferred', label: 'Preferred' },
  { value: 'any', label: 'Any' }
];

const languagePreferenceOptions = [
  { value: 'strict', label: 'Strict' },
  { value: 'preferred', label: 'Preferred' },
  { value: 'any', label: 'Any' }
];

const skillPreferenceOptions = [
  { value: 'similar', label: 'Similar skill' },
  { value: 'any', label: 'Any skill' }
];

const languageOptions = [
  { value: 'en', label: 'English' },
  { value: 'da', label: 'Danish' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'pl', label: 'Polish' },
  { value: 'sk', label: 'Slovak' },
  { value: 'es', label: 'Spanish' },
  { value: 'sv', label: 'Swedish' },
  { value: 'fr', label: 'French' }
];

const normalizeLanguageValue = (value) => {
  if (!value || typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const lowerValue = trimmed.toLowerCase();
  const directMatch = languageOptions.find((option) => option.value === lowerValue);
  if (directMatch) {
    return directMatch.value;
  }
  const labelMatch = languageOptions.find(
    (option) => option.label.toLowerCase() === lowerValue
  );
  if (labelMatch) {
    return labelMatch.value;
  }
  if (lowerValue.length >= 2 && lowerValue.length <= 5) {
    return lowerValue;
  }
  return null;
};

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

const getModeLabel = (value) => modeOptions.find((option) => option.value === value)?.label || value;

const getLanguageLabel = (value) => languageOptions.find((option) => option.value === value)?.label || value;

const getOptionLabel = (options, value) => options.find((option) => option.value === value)?.label || value;

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
  const [regionPreference, setRegionPreference] = useState('preferred');
  const [languagePreference, setLanguagePreference] = useState('any');
  const [skillPreference, setSkillPreference] = useState('similar');
  const [selectedLanguages, setSelectedLanguages] = useState(['en']);
  const [scheduledTime, setScheduledTime] = useState('');
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

    const normalizedLanguages = Array.isArray(prefs.languages)
      ? prefs.languages
          .map((language) => normalizeLanguageValue(language))
          .filter(Boolean)
      : [];

    if (normalizedLanguages.length > 0) {
      setSelectedLanguages(normalizedLanguages.slice(0, 10));
    } else {
      setSelectedLanguages(['en']);
    }

    setRegionPreference('preferred');
    setLanguagePreference('any');
    setSkillPreference('similar');
    setScheduledTime('');

    if (prefs.groupSize?.min || prefs.groupSize?.max) {
      setGroupSize({
        min: prefs.groupSize.min || 1,
        max: prefs.groupSize.max || Math.max(prefs.groupSize.min || 1, 5)
      });
    }

    setInitialFilters({
      mode: prefs.competitiveness === 'competitive' ? 'ranked' : prefs.competitiveness === 'balanced' ? 'competitive' : 'casual',
      regions: Array.isArray(prefs.regions) && prefs.regions.length > 0 ? prefs.regions : ['ANY'],
      regionPreference: 'preferred',
      languagePreference: 'any',
      skillPreference: 'similar',
      selectedLanguages:
        normalizedLanguages.length > 0 ? normalizedLanguages.slice(0, 10) : ['en'],
      scheduledTime: '',
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

  const toggleLanguage = useCallback((language) => {
    const normalized = normalizeLanguageValue(language);
    if (!normalized) {
      return;
    }
    setSelectedLanguages((prev) => {
      if (prev.includes(normalized)) {
        if (prev.length === 1) {
          return prev;
        }
        return prev.filter((item) => item !== normalized);
      }
      if (prev.length >= 10) {
        return prev;
      }
      return [...prev, normalized];
    });
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

  const userGameSuggestions = useMemo(() => {
    if (!user?.gameProfiles) {
      return [];
    }

    return user.gameProfiles
      .map((profile) => {
        const game = profile.gameId;
        if (!game?._id) {
          return null;
        }

        const normalisedModes = Array.isArray(game.gameModes) && game.gameModes.length > 0
          ? game.gameModes
          : Array.isArray(profile.gameModes)
            ? profile.gameModes
                .filter(Boolean)
                .map((mode) => (typeof mode === 'string' ? { name: mode } : mode))
            : [];

        const normalisedGenres = Array.isArray(game.genres) && game.genres.length > 0
          ? game.genres
          : Array.isArray(profile.gameGenres)
            ? profile.gameGenres
                .filter(Boolean)
                .map((genre) => (typeof genre === 'string' ? { name: genre } : genre))
            : [];

        return {
          ...game,
          gameModes: normalisedModes,
          genres: normalisedGenres
        };
      })
      .filter(Boolean);
  }, [user]);

  const mergeGameLists = useCallback((...lists) => {
    const unique = new Map();

    lists
      .filter(Array.isArray)
      .forEach((games) => {
        games.forEach((game) => {
          if (!game?._id) {
            return;
          }

          if (!unique.has(game._id)) {
            unique.set(game._id, game);
          }
        });
      });

    return Array.from(unique.values());
  }, []);

  const fetchTrending = useCallback(async () => {
    try {
      const response = await apiClient.get('/games/trending', { params: { limit: 48 } });
      const games = response.data?.data?.games || [];
      const combined = mergeGameLists(games, userGameSuggestions);
      setTrending(combined);
      if (focusGame) {
        if (focusGame._id) {
          const match = combined.find((game) => game._id === focusGame._id);
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
      if (userGameSuggestions.length > 0) {
        setTrending(userGameSuggestions);
      } else {
        setTrending([]);
      }
    }
  }, [addGame, focusGame, mergeGameLists, userGameSuggestions]);

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
        games: lockedProfile.games,
        gameMode: lockedProfile.mode,
        regionPreference: lockedProfile.regionPreference,
        regions: lockedProfile.regions,
        languagePreference: lockedProfile.languagePreference,
        languages: lockedProfile.languages,
        skillPreference: lockedProfile.skillPreference,
        groupSize: lockedProfile.groupSize
      };

      if (lockedProfile.scheduledTime) {
        payload.scheduledTime = lockedProfile.scheduledTime;
      }

      const response = await apiClient.post('/matchmaking', payload);
      setFeedback('Matchmaking request submitted!');
      setProfileNotice('Search started! We\'ll keep your profile locked while we queue.');
      if (response.data?.data?.matchRequest) {
        setStatus((prev) => ({
          request: response.data.data.matchRequest,
          queueInfo: prev?.queueInfo || null
        }));
      }
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
  }, [selectedGames, selectedLanguages, regions, regionPreference, languagePreference, skillPreference, mode, groupSize, scheduledTime]);

  const handleSaveProfile = () => {
    const scheduledISO = scheduledTime ? new Date(scheduledTime).toISOString() : '';
    setLockedProfile({
      games: selectedGames.map((game) => ({ gameId: game._id })),
      regionPreference,
      regions,
      mode,
      languagePreference,
      skillPreference,
      languages: selectedLanguages,
      groupSize,
      scheduledTime: scheduledISO
    });
    setProfileDirty(false);
    setProfileNotice('Search profile saved and locked for this queue.');
  };

  const handleResetProfile = () => {
    if (initialFilters) {
      setMode(initialFilters.mode);
      setRegions(initialFilters.regions);
      setRegionPreference(initialFilters.regionPreference);
      setLanguagePreference(initialFilters.languagePreference);
      setSkillPreference(initialFilters.skillPreference);
      setSelectedLanguages(initialFilters.selectedLanguages);
      setScheduledTime(initialFilters.scheduledTime || '');
      setGroupSize(initialFilters.groupSize);
    } else {
      setMode('casual');
      setRegions(['ANY']);
      setRegionPreference('preferred');
      setLanguagePreference('any');
      setSkillPreference('similar');
      setSelectedLanguages(['en']);
      setScheduledTime('');
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

  const availableGames = useMemo(() => {
    const base = searchResults.length > 0 ? searchResults : trending;
    return mergeGameLists(base, userGameSuggestions, selectedGames);
  }, [mergeGameLists, searchResults, selectedGames, trending, userGameSuggestions]);

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
    chips.push(`${getModeLabel(mode)} mode`);
    chips.push(`Region preference: ${getOptionLabel(regionPreferenceOptions, regionPreference)}`);
    if (regions.includes('ANY')) {
      chips.push('Any region');
    } else if (regions.length > 0) {
      chips.push(`Regions ${regions.join(', ')}`);
    }
    chips.push(`Skill: ${getOptionLabel(skillPreferenceOptions, skillPreference)}`);
    if (selectedLanguages.length > 0) {
      const displayLabels = selectedLanguages.map((language) => getLanguageLabel(language));
      const [first, ...rest] = displayLabels;
      chips.push(rest.length > 0 ? `${first} +${rest.length}` : first);
    }
    chips.push(
      `Language preference: ${getOptionLabel(languagePreferenceOptions, languagePreference)}`
    );
    chips.push(`Group ${groupSize.min}-${groupSize.max}`);
    if (scheduledTime) {
      const formatted = new Date(scheduledTime).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
      chips.push(`Scheduled: ${formatted}`);
    }
    return chips;
  }, [mode, regionPreference, regions, skillPreference, selectedLanguages, languagePreference, groupSize, scheduledTime]);

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
            <h3>Regions</h3>
            <span>Tell us where you're comfortable playing.</span>
          </div>
          <div className="chip-row">
            {regionPreferenceOptions.map((option) => {
              const active = regionPreference === option.value;
              return (
                <button
                  type="button"
                  key={option.value}
                  className={`chip ${active ? 'chip--active' : ''}`}
                  onClick={() => setRegionPreference(option.value)}
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
        </div>

        <div className="filter-card">
          <div className="filter-card__heading">
            <h3>Game mode & skill</h3>
            <span>Pick your queue style and skill flexibility.</span>
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
          <div className="chip-row">
            {skillPreferenceOptions.map((option) => {
              const active = skillPreference === option.value;
              return (
                <button
                  type="button"
                  key={option.value}
                  className={`chip ${active ? 'chip--active' : ''}`}
                  onClick={() => setSkillPreference(option.value)}
                >
                  {option.label}
                </button>
              );
            })}
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
            <span>Pick up to ten languages.</span>
          </div>
          <div className="chip-row">
            {languagePreferenceOptions.map((option) => {
              const active = languagePreference === option.value;
              return (
                <button
                  type="button"
                  key={option.value}
                  className={`chip ${active ? 'chip--active' : ''}`}
                  onClick={() => setLanguagePreference(option.value)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <div className="chip-row chip-row--wrap">
            {languageOptions.map((language) => {
              const active = selectedLanguages.includes(language.value);
              const disable = active && selectedLanguages.length === 1;
              return (
                <button
                  type="button"
                  key={language.value}
                  className={`chip ${active ? 'chip--active' : ''}`}
                  onClick={() => (!disable ? toggleLanguage(language.value) : undefined)}
                  disabled={disable}
                >
                  {language.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="filter-card">
          <div className="filter-card__heading">
            <h3>Schedule</h3>
            <span>Queue now or set a future time.</span>
          </div>
          <div className="filter-card__field">
            <label htmlFor="matchmaking-schedule">Scheduled time (optional)</label>
            <input
              type="datetime-local"
              id="matchmaking-schedule"
              value={scheduledTime}
              onChange={(event) => setScheduledTime(event.target.value)}
            />
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
