import { useState, memo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  FiHome, FiUsers, FiClipboard, FiDollarSign, FiBarChart2,
  FiActivity, FiSettings, FiUser, FiX, FiCalendar,
  FiCloud, FiClock, FiDownload, FiZap, FiChevronDown,
  FiChevronUp, FiLogOut
} from 'react-icons/fi';

/* ── Navigation config ──────────────────────────────────── */
const primaryNavItems = [
  { label: 'Dashboard',    icon: FiHome,     to: '/doctor-dashboard' },
  { label: 'Staff',        icon: FiUsers,    to: '/staff-dashboard',  staffOnly: true },
  { label: 'Queue',        icon: FiClock,    to: '/queue' },
  { label: 'Patients',     icon: FiUsers,    to: '/patients' },
  { label: 'Appointments', icon: FiCalendar, to: '/appointments' },
];

const secondaryNavItems = [
  { label: 'Billing',         icon: FiDollarSign, to: '/billing' },
  { label: 'Clinical',        icon: FiClipboard,  to: '/clinical' },
  { label: 'Analytics',       icon: FiBarChart2,  to: '/analytics' },
  { label: 'ABHA',            icon: FiActivity,   to: '/abha',              badge: 'New' },
  { label: 'Doctor Settings', icon: FiSettings,   to: '/doctor-settings',   doctorOnly: true },
  { label: 'User Mgmt',       icon: FiUser,       to: '/user-management',   adminOnly: true },
  { label: 'Doctor Export',   icon: FiDownload,   to: '/doctor-export',     adminOnly: true },
  { label: 'Settings',        icon: FiSettings,   to: '/settings' },
  { label: 'Backup',          icon: FiCloud,      to: '/backup',            adminOnly: true },
];

const ROLE_CHIP = {
  admin:    { label: 'Admin',  cls: 'bg-violet-500/20 text-violet-300' },
  doctor:   { label: 'Doctor', cls: 'bg-blue-500/20   text-blue-300'   },
  subadmin: { label: 'Sub',    cls: 'bg-indigo-500/20 text-indigo-300' },
  staff:    { label: 'Staff',  cls: 'bg-emerald-500/20 text-emerald-300' },
};

/* ── Single nav item ────────────────────────────────────── */
const NavItem = memo(function NavItem({ item, onClose, compact = false }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      onClick={onClose}
      className={({ isActive }) =>
        `group flex items-center gap-3 px-3 rounded-lg transition-all duration-150 border-l-4 ${
          compact ? 'py-2' : 'py-2.5'
        } ${
          isActive
            ? 'bg-white/10 text-white border-white/60'
            : 'text-white/90 hover:bg-white/6 hover:text-white border-transparent'
        }`
      }
    >
      <div className={`w-8 h-8 flex items-center justify-center rounded-md bg-white/6 text-white/95 flex-shrink-0`}> 
        <Icon size={14} />
      </div>
      <span className={`text-xs font-medium leading-none flex-1`}>{item.label}</span>
      {item.badge && (
        <span className="text-[10px] bg-indigo-500/30 text-white px-2 py-0.5 rounded font-semibold">
          {item.badge}
        </span>
      )}
    </NavLink>
  );
});

/* ── Main Sidebar ───────────────────────────────────────── */
export default memo(function Sidebar({ onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const userRole = user?.role || 'staff';

  const [doctorMode, setDoctorMode] = useState(() =>
    localStorage.getItem('doctorMode') === 'true'
  );
  const [showMore, setShowMore] = useState(false);

  const toggleDoctorMode = () => {
    const next = !doctorMode;
    setDoctorMode(next);
    localStorage.setItem('doctorMode', String(next));
    if (next) setShowMore(false);
  };

  const handleLogout = () => {
    logout?.();
    navigate('/login');
  };

  const filterByRole = (items) => items.filter(item => {
    if (item.adminOnly  && userRole !== 'admin')  return false;
    if (item.doctorOnly && userRole !== 'doctor') return false;
    if (item.staffOnly  && userRole === 'doctor') return false;
    return true;
  });

  const primaryItems   = filterByRole(primaryNavItems);
  const secondaryItems = filterByRole(secondaryNavItems);

  const chip = ROLE_CHIP[userRole] || ROLE_CHIP.staff;
  const initials = (user?.name || 'U').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <aside
      className="w-64 flex flex-col h-full select-none bg-[#2533A5] px-4 py-5 shadow-xl"
    >
      {/* ── Logo ──────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/20">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg"
            style={{ background: '#2533A5' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" className="w-4 h-4">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
          <div>
            <div className="text-white font-bold text-base leading-tight">Dr Jaju Care</div>
            <div className="text-white/75 text-[11px] font-medium tracking-widest uppercase">Health System</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold bg-white/10 text-white/80 px-2 py-0.5 rounded tracking-wider">PRO</span>
          <button
            onClick={onClose}
            className="md:hidden p-1 rounded text-white/70 hover:text-white hover:bg-white/6 transition-colors"
          >
            <FiX size={17} />
          </button>
        </div>
      </div>

      {/* ── User card ─────────────────────────────── */}
      <div className="mx-3 mt-3 px-3 py-2.5 rounded-xl bg-white/6 flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow"
          style={{ background: '#2533A5' }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white text-sm font-semibold truncate leading-snug">
            {user?.name || 'User'}
          </div>
          <div className="text-white/75 text-[11px] truncate">{user?.email || ''}</div>
        </div>
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${chip.cls}`}>
          {chip.label}
        </span>
      </div>

      {/* ── Doctor Mode ───────────────────────────── */}
      <div className="mx-3 mt-2">
        <button
          onClick={toggleDoctorMode}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
            doctorMode
              ? 'bg-white/10 text-white'
              : 'bg-white/6 text-white/80 hover:bg-white/10 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-3">
            <FiZap size={14} className="text-white/90" />
            <span className="text-xs font-medium">Doctor Mode</span>
          </div>
          <div
            className="w-8 h-4 rounded-full relative transition-colors duration-200"
            style={{ background: doctorMode ? '#6366f1' : '#334155' }}
          >
            <div
              className="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all duration-200"
              style={{ left: doctorMode ? '17px' : '2px' }}
            />
          </div>
        </button>
      </div>

      {/* ── Navigation ───────────────────────────── */}
      <nav className="flex-1 px-3 pt-3 pb-2 overflow-y-auto sidebar-scroll space-y-1 text-xs">
        {primaryItems.map(item => (
          <NavItem key={item.to} item={item} onClose={onClose} />
        ))}

          <div className="my-2 h-px bg-white/6 mx-3 rounded" />

        {!doctorMode && secondaryItems.length > 0 && (
          <>
            <div className="pt-3 pb-1">
              <span className="px-3 text-[10px] text-white/60 font-semibold tracking-widest uppercase">
                More
              </span>
            </div>
            {secondaryItems.map(item => (
              <NavItem key={item.to} item={item} onClose={onClose} compact />
            ))}
          </>
        )}

        {doctorMode && (
          <>
            <button
              onClick={() => setShowMore(!showMore)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 mt-1 rounded-lg text-white/80 hover:text-white hover:bg-white/6 transition-all text-xs font-medium"
            >
              {showMore
                ? <><FiChevronUp size={12}/> Hide more</>
                : <><FiChevronDown size={12}/> Show more</>
              }
            </button>
            {showMore && (
              <div className="space-y-0.5 pt-1 border-t border-slate-800">
                {secondaryItems.map(item => (
                  <NavItem key={item.to} item={item} onClose={onClose} compact />
                ))}
              </div>
            )}
          </>
        )}
      </nav>

      {/* ── Footer ───────────────────────────────── */}
      <div className="px-3 py-3 border-t border-white/20 space-y-1">
        <NavLink
          to="/profile"
          onClick={onClose}
            className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              isActive ? 'text-white bg-white/10' : 'text-white/80 hover:text-white hover:bg-white/6'
            }`
          }
        >
          <FiUser size={14} />
          <span>My Profile</span>
        </NavLink>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-white/80 hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <FiLogOut size={14} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
});
