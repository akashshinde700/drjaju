import PropTypes from 'prop-types';

export default function EmptyState({ icon = null, title = 'Nothing here yet', description = '', action = null, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-12 px-4 ${className}`}>
      {icon && <div className="text-slate-300 mb-3 text-4xl">{icon}</div>}
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {description && <p className="text-sm text-slate-500 mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
EmptyState.propTypes = {
  icon: PropTypes.node,
  title: PropTypes.string,
  description: PropTypes.string,
  action: PropTypes.node,
  className: PropTypes.string,
};
