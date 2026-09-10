import PropTypes from 'prop-types';

export default function PageHeader({ title, subtitle, actions, className = '' }) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-3 mb-5 ${className}`}>
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
PageHeader.propTypes = {
  title: PropTypes.node.isRequired,
  subtitle: PropTypes.node,
  actions: PropTypes.node,
  className: PropTypes.string,
};
