import PropTypes from 'prop-types';

const icons = {
  total: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
    </svg>
  ),
  waiting: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  completed: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  time: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 8 14"/>
    </svg>
  ),
};

const colorConfig = {
  blue:   { accent: 'bg-blue-500',   iconBg: 'bg-blue-50 text-blue-600',   val: 'text-slate-800', strip: 'bg-blue-500' },
  orange: { accent: 'bg-amber-500',  iconBg: 'bg-amber-50 text-amber-600',  val: 'text-slate-800', strip: 'bg-amber-500' },
  green:  { accent: 'bg-emerald-500',iconBg: 'bg-emerald-50 text-emerald-600',val: 'text-slate-800', strip: 'bg-emerald-500' },
  purple: { accent: 'bg-violet-500', iconBg: 'bg-violet-50 text-violet-600', val: 'text-slate-800', strip: 'bg-violet-500' },
};

export default function StatCard({ icon, label, value, subtext, color = 'blue', iconType }) {
  const cfg = colorConfig[color] || colorConfig.blue;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-card hover:shadow-card-md p-3 sm:p-5 flex items-center gap-3 sm:gap-4 transition-all duration-200 cursor-pointer hover:-translate-y-0.5 overflow-hidden relative">
      {/* left accent strip */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${cfg.strip} rounded-l-xl`} />
      <div className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ml-1 ${cfg.iconBg}`}>
        {iconType && icons[iconType] ? icons[iconType] : <span className="text-lg">{icon}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-1">{label}</p>
        <p className={`text-2xl sm:text-3xl font-black leading-none ${cfg.val}`}>{value}</p>
        {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
      </div>
    </div>
  );
}

StatCard.propTypes = {
  icon: PropTypes.node,
  iconType: PropTypes.string,
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  subtext: PropTypes.string,
  color: PropTypes.oneOf(['blue', 'green', 'orange', 'purple'])
};
