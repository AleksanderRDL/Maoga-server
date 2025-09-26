import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { FiLogOut } from 'react-icons/fi';
import BottomNav from './BottomNav.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import StatPill from './StatPill.jsx';

const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
        <main className="app-content">
          <div key={location.pathname} className="route-transition">
            <Outlet />
          </div>
        </main>
        <BottomNav />
      </div>
    </div>
  );
};

export default DashboardLayout;
