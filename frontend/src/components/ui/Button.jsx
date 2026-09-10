import PropTypes from 'prop-types';

const variants = {
  primary:   'bg-primary text-white hover:bg-primary-700 border-transparent',
  secondary: 'bg-white text-slate-700 hover:bg-slate-50 border-slate-300',
  ghost:     'bg-transparent text-slate-600 hover:bg-slate-100 border-transparent',
  danger:    'bg-danger text-white hover:bg-danger-600 border-transparent',
  success:   'bg-success text-white hover:bg-success-700 border-transparent',
};
const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

export default function Button({
  children, variant = 'secondary', size = 'md', icon = null,
  loading = false, disabled = false, className = '', type = 'button', ...rest
}) {
  const isDisabled = disabled || loading;
  return (
    <button
      type={type}
      disabled={isDisabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border font-medium
        transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant] || variants.secondary} ${sizes[size] || sizes.md} ${className}`}
      {...rest}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      )}
      {!loading && icon}
      {children}
    </button>
  );
}
Button.propTypes = {
  children: PropTypes.node,
  variant: PropTypes.oneOf(['primary', 'secondary', 'ghost', 'danger', 'success']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  icon: PropTypes.node,
  loading: PropTypes.bool,
  disabled: PropTypes.bool,
  className: PropTypes.string,
  type: PropTypes.string,
};
