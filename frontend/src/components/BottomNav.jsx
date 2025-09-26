import { NavLink } from 'react-router-dom';
import { PiCompassFill } from 'react-icons/pi';
import { RiTeamFill } from 'react-icons/ri';
import { TbSwords } from 'react-icons/tb';
import { FaUserAstronaut, FaUserFriends } from 'react-icons/fa';
import { MdOutlineNewspaper, MdOutlineEditNote } from 'react-icons/md';

const navItems = [
  { label: 'Home', icon: PiCompassFill, to: '/' },
  { label: 'Matchmaking', icon: TbSwords, to: '/matchmaking' },
  { label: 'Lobbies', icon: RiTeamFill, to: '/lobbies' },
  { label: 'Feed', icon: MdOutlineNewspaper, to: '/feed' },
  { label: 'Friends', icon: FaUserFriends, to: '/friends' },
  { label: 'Personal post', icon: MdOutlineEditNote, to: '/personal-post' },
  { label: 'Profile', icon: FaUserAstronaut, to: '/profile' }
];

const BottomNav = () => {
  return (
    <nav className="bottom-nav">
      {navItems.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} end={to === '/'} className="bottom-nav__item">
          {({ isActive }) => (
            <div className={`bottom-nav__button ${isActive ? 'bottom-nav__button--active' : ''}`}>
              <Icon size={22} />
              <span>{label}</span>
            </div>
          )}
        </NavLink>
      ))}
    </nav>
  );
};

export default BottomNav;
