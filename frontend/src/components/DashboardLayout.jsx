import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { FiLogOut } from 'react-icons/fi';
import BottomNav from './BottomNav.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import StatPill from './StatPill.jsx';

const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const displayName = user?.profile?.displayName || user?.username || 'Player';
  const subtitleMap = {
    '/': 'Connect, compete and belong',
    '/news': 'Catch up with your crew',
    '/lobbies': 'Coordinate with your squads',
    '/matchmaking': 'Tune your vibe and find the perfect lobby',
    '/chat': 'Keep the hype going',
    '/profile': 'Fine-tune your presence'
  };

  const subtitle = subtitleMap[location.pathname] || 'Welcome back';

  return (
    <div className="app-shell">
      <div className="app-shell__inner">
        <header className="app-header">
          <div className="app-header__title" onClick={() => navigate('/')}>Maoga</div>
          <div className="app-header__meta">
            <StatPill label="XP" value={user?.karmaPoints ?? 0} variant="blue" />
            <StatPill label="Shards" value={user?.virtualCurrency ?? 0} variant="pink" />
            <button className="icon-button" type="button" onClick={logout} title="Log out">
              <FiLogOut size={18} />
            </button>
          </div>
        </header>
        <section className="app-hero">
          <div>
            <h1 className="app-hero__title">Hey {displayName}! 👾</h1>
            <p className="app-hero__subtitle">{subtitle}</p>
          </div>
        </section>
        <main className="app-content">
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </div>
  );
};

export default DashboardLayout;
