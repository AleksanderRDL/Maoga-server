import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import SplashScreen from '../components/SplashScreen.jsx';

const AuthPage = ({ mode = 'login' }) => {
  const navigate = useNavigate();
  const { login, register, isLoading, isAuthenticated } = useAuth();
  const [formMode, setFormMode] = useState(mode);
  const [formData, setFormData] = useState({
    credential: '',
    password: '',
    email: '',
    username: '',
    displayName: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setFormMode(mode);
  }, [mode]);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading) {
    return <SplashScreen message="Checking session..." />;
  }

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (formMode === 'login') {
        await login({ credential: formData.credential.trim(), password: formData.password });
      } else {
        await register({
          email: formData.email.trim(),
          username: formData.username.trim(),
          password: formData.password,
          displayName: formData.displayName.trim() || undefined
        });
      }
      navigate('/', { replace: true });
    } catch (err) {
      const message = err.response?.data?.message || err.response?.data?.error || err.message;
      setError(message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const isLogin = formMode === 'login';

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-card__header">
          <h1>Welcome to Maoga</h1>
          <p>Connect, compete and belong.</p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          {isLogin ? (
            <>
              <label>
                <span>Email or username</span>
                <input
                  type="text"
                  name="credential"
                  placeholder="emily@maoga.gg"
                  value={formData.credential}
                  onChange={handleChange}
                  required
                />
              </label>
            </>
          ) : (
            <>
              <label>
                <span>Email</span>
                <input
                  type="email"
                  name="email"
                  placeholder="emily@maoga.gg"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </label>
              <label>
                <span>Username</span>
                <input
                  type="text"
                  name="username"
                  placeholder="shadowSiren"
                  value={formData.username}
                  onChange={handleChange}
                  required
                />
              </label>
              <label>
                <span>Display name (optional)</span>
                <input
                  type="text"
                  name="displayName"
                  placeholder="Emily"
                  value={formData.displayName}
                  onChange={handleChange}
                />
              </label>
            </>
          )}
          <label>
            <span>Password</span>
            <input
              type="password"
              name="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </label>
          {error ? <div className="auth-form__error">{error}</div> : null}
          <button type="submit" className="primary-button" disabled={submitting}>
            {submitting ? 'Loading...' : isLogin ? 'Log in' : 'Create account'}
          </button>
        </form>
        <div className="auth-card__footer">
          {isLogin ? (
            <p>
              Need an account?{' '}
              <Link to="/register" onClick={() => setFormMode('register')}>
                Join Maoga
              </Link>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <Link to="/login" onClick={() => setFormMode('login')}>
                Log in
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
