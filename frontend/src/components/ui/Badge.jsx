import PropTypes from 'prop-types';

// Status-aware pill. Pass either `status` (auto-maps common workflow states)
// or `variant` for a fixed color.
const variantClasses = {
  neutral: 'bg-slate-100 text-slate-700',
  info:    'bg-blue-100 text-blue-800',
  primary: 'bg-primary-100 text-primary-800',
  warning: 'bg-amber-100 text-amber-800',
  success: 'bg-emerald-100 text-emerald-800',
  danger:  'bg-red-100 text-red-800',
};
const statusMap = {
  scheduled: 'primary', waiting: 'warning', called: 'info',
  in_progress: 'info', 'in-progress': 'info', 'in progress': 'info', serving: 'info', 'being served': 'info',
  completed: 'success', paid: 'success', active: 'success',
  cancelled: 'danger', 'no-show': 'danger', 'no show': 'danger', failed: 'danger', overdue: 'danger',
  pending: 'warning', partial: 'warning', draft: 'neutral',
};

export default function Badge({ children, status, variant, className = '' }) {
  const key = status ? (statusMap[String(status).toLowerCase()] || 'neutral') : (variant || 'neutral');
  const label = children ?? (status ? String(status).replace(/[-_]/g, ' ') : '');
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
      ${variantClasses[key]} ${className}`}>
      {label}
    </span>
  );
}
Badge.propTypes = {
  children: PropTypes.node,
  status: PropTypes.string,
  variant: PropTypes.oneOf(['neutral', 'info', 'primary', 'warning', 'success', 'danger']),
  className: PropTypes.string,
};
