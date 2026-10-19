// Segmented "With Letterhead | Plain Paper" switch used on every billing screen.
// `size="sm"` fits inline toolbars; default size is for modal headers.
export default function LetterheadToggle({ value, onChange, size = 'md', className = '' }) {
  const pad = size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm';
  const option = (active) =>
    `${pad} flex items-center gap-1.5 rounded-md font-medium transition whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
      active ? 'bg-white text-primary shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'
    }`;

  return (
    <div
      role="radiogroup"
      aria-label="Print format"
      className={`inline-flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5 ${className}`}
    >
      <button
        type="button"
        role="radio"
        aria-checked={value}
        onClick={() => onChange(true)}
        className={option(value)}
        title="Print the clinic header & footer (for plain paper, PDF and WhatsApp)"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="3" width="16" height="18" rx="2" strokeWidth="2" />
          <path d="M4 8h16" strokeWidth="2" />
          <path d="M8 13h8M8 17h5" strokeWidth="2" strokeLinecap="round" />
        </svg>
        With Letterhead
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={!value}
        onClick={() => onChange(false)}
        className={option(!value)}
        title="Leave the top blank for the clinic's pre-printed letterhead paper"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="3" width="16" height="18" rx="2" strokeWidth="2" />
          <path d="M8 13h8M8 17h5" strokeWidth="2" strokeLinecap="round" />
        </svg>
        Plain Paper
      </button>
    </div>
  );
}
