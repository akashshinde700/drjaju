/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        primary: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          DEFAULT: '#4f46e5',
        },
        success: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          DEFAULT: '#16a34a',
        },
        warning: {
          50:  '#fffbeb',
          100: '#fef3c7',
          500: '#f59e0b',
          600: '#d97706',
          DEFAULT: '#f59e0b',
        },
        danger: {
          50:  '#fef2f2',
          100: '#fee2e2',
          500: '#ef4444',
          600: '#dc2626',
          DEFAULT: '#ef4444',
        },
        // Sidebar dark tokens
        sidebar: {
          bg:       '#0f172a',
          hover:    '#1e293b',
          active:   '#1e3a5f',
          border:   '#1e293b',
          text:     '#94a3b8',
          'text-active': '#e2e8f0',
          'text-muted':  '#475569',
        },
        // Content area
        surface: {
          DEFAULT: '#ffffff',
          muted:   '#f8fafc',
          subtle:  '#f1f5f9',
        },
      },
      boxShadow: {
        card:  '0 1px 3px 0 rgba(0,0,0,.08), 0 1px 2px -1px rgba(0,0,0,.04)',
        'card-md': '0 4px 12px -2px rgba(0,0,0,.10), 0 2px 4px -2px rgba(0,0,0,.05)',
        'card-lg': '0 10px 24px -4px rgba(0,0,0,.12), 0 4px 8px -2px rgba(0,0,0,.06)',
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      screens: {
        'xs': '360px',    /* Small phones (Galaxy, Pixel) */
        'tv': '1920px',   /* Full HD LCD / Android TV */
        '4k': '2560px',   /* QHD / 4K monitors */
        '8k': '3840px',   /* 4K UHD TV */
      },
      fontSize: {
        'tv-base': ['1.125rem', { lineHeight: '1.75rem' }],
        'tv-lg':   ['1.25rem',  { lineHeight: '1.875rem' }],
        'tv-xl':   ['1.5rem',   { lineHeight: '2rem' }],
        'tv-2xl':  ['1.875rem', { lineHeight: '2.25rem' }],
        'tv-3xl':  ['2.25rem',  { lineHeight: '2.5rem' }],
      },
      spacing: {
        'tv-touch': '3rem',   /* 48px — D-pad friendly touch targets on TV */
      },
    }
  },
  plugins: []
};
