import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const transitionDelayMs = 520;

const StartPage = () => {
  const navigate = useNavigate();
  const [isLeaving, setIsLeaving] = useState(false);
  const timeoutRef = useRef(null);

  const proceed = useCallback(() => {
    if (isLeaving) {
      return;
    }
    setIsLeaving(true);
    timeoutRef.current = window.setTimeout(() => navigate('/login'), transitionDelayMs);
  }, [isLeaving, navigate]);


  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      proceed();
    }
  };

  return (
    <div
      className={`start-page ${isLeaving ? 'start-page--leaving' : ''}`}
      role="button"
      tabIndex={0}
      onClick={proceed}
      onKeyDown={handleKeyDown}
      aria-label="Enter Maoga"
    >
      <div className="start-page__backdrop">
        <span className="start-page__halo" aria-hidden="true" />
        <div className="start-page__glyph" aria-hidden="true" />
      </div>
      <h1 className="start-page__title">Maoga</h1>
      <p className="start-page__lead">
        Rally your crew, discover new teammates and drop into games that match your vibe.
      </p>
      <p className="start-page__hint">Tap or press enter to continue</p>
    </div>
  );
};

export default StartPage;
