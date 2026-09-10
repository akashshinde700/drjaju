import PropTypes from 'prop-types';

export default function Card({ children, title, actions, padding = true, className = '', ...rest }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`} {...rest}>
      {(title || actions) && (
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-100">
          {title && <h3 className="text-sm font-semibold text-slate-800">{title}</h3>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={padding ? 'p-4 sm:p-5' : ''}>{children}</div>
    </div>
  );
}
Card.propTypes = {
  children: PropTypes.node,
  title: PropTypes.node,
  actions: PropTypes.node,
  padding: PropTypes.bool,
  className: PropTypes.string,
};
