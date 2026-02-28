/** @type {import('tailwindcss').Config} */
export default {
  // Only scan React components to avoid conflicts with existing CSS
  content: ['./src/react/**/*.{ts,tsx}'],

  // Prefix all Tailwind classes to avoid conflicts with existing CSS
  prefix: 'tw-',

  theme: {
    extend: {
      // Map existing CSS variables to Tailwind colors
      colors: {
        // Brand colors
        brand: {
          primary: 'var(--color-brand-primary)',
          'primary-hover': 'var(--color-interactive-primary-hover)',
          'primary-active': 'var(--color-interactive-primary-active)',
          secondary: 'var(--color-brand-secondary)',
          accent: 'var(--color-brand-accent)',
        },

        // Portal background colors
        portal: {
          'bg-darkest': 'var(--portal-bg-darkest)',
          'bg-darker': 'var(--portal-bg-darker)',
          'bg-dark': 'var(--portal-bg-dark)',
          'bg-medium': 'var(--portal-bg-medium)',
          'bg-light': 'var(--portal-bg-light)',
          'bg-lighter': 'var(--portal-bg-lighter)',
          'bg-hover': 'var(--portal-bg-hover)',
          'bg-readonly': 'var(--portal-bg-readonly)',

          // Portal text colors
          'text-primary': 'var(--portal-text-primary)',
          'text-secondary': 'var(--portal-text-secondary)',
          'text-muted': 'var(--portal-text-muted)',
          'text-dark': 'var(--portal-text-dark)',
          'text-light': 'var(--portal-text-light)',

          // Portal border colors (all variants)
          border: 'var(--portal-border)',
          'border-dark': 'var(--portal-border-dark)',
          'border-medium': 'var(--portal-border-medium)',
          'border-light': 'var(--portal-border-light)',
          'border-subtle': 'var(--portal-border-subtle)',
        },

        // Status colors
        status: {
          active: 'var(--status-active)',
          'active-bg': 'var(--status-active-bg)',
          pending: 'var(--status-pending)',
          'pending-bg': 'var(--status-pending-bg)',
          completed: 'var(--status-completed)',
          'completed-bg': 'var(--status-completed-bg)',
          cancelled: 'var(--status-cancelled)',
          'cancelled-bg': 'var(--status-cancelled-bg)',
          qualified: 'var(--status-qualified)',
          'qualified-bg': 'var(--status-qualified-bg)',
          inactive: 'var(--status-inactive)',
          'inactive-bg': 'var(--status-inactive-bg)',
          new: 'var(--status-new)',
          'new-bg': 'var(--status-new-bg)',
          'on-hold': 'var(--status-on-hold)',
          'on-hold-bg': 'var(--status-on-hold-bg)',
          warning: 'var(--status-warning)',
          'warning-bg': 'var(--status-warning-bg)',
          info: 'var(--status-info)',
          'info-bg': 'var(--status-info-bg)',
          danger: 'var(--status-danger)',
          'danger-bg': 'var(--status-danger-bg)',
        },

        // Gray scale
        gray: {
          50: 'var(--color-gray-50)',
          100: 'var(--color-gray-100)',
          200: 'var(--color-gray-200)',
          300: 'var(--color-gray-300)',
          400: 'var(--color-gray-400)',
          500: 'var(--color-gray-500)',
          600: 'var(--color-gray-600)',
          700: 'var(--color-gray-700)',
          800: 'var(--color-gray-800)',
          900: 'var(--color-gray-900)',
          950: 'var(--color-gray-950)',
        },

        // Functional colors
        success: {
          DEFAULT: 'var(--color-success)',
          dark: 'var(--color-success-dark)',
          light: 'var(--color-success-light)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          dark: 'var(--color-warning-dark)',
          light: 'var(--color-warning-light)',
        },
        error: {
          DEFAULT: 'var(--color-error)',
          dark: 'var(--color-error-dark)',
          light: 'var(--color-error-light)',
        },
        info: {
          DEFAULT: 'var(--color-info)',
          dark: 'var(--color-info-dark)',
          light: 'var(--color-info-light)',
        },
        danger: {
          DEFAULT: 'var(--color-danger)',
          dark: 'var(--color-danger-dark)',
          bg: 'var(--color-danger-bg)',
          hover: 'var(--color-danger-hover)',
        },

        // Semantic background/surface colors
        surface: {
          primary: 'var(--color-surface-primary)',
          secondary: 'var(--color-surface-secondary)',
          tertiary: 'var(--color-surface-tertiary)',
          elevated: 'var(--color-surface-elevated)',
        },
        background: {
          primary: 'var(--color-bg-primary)',
          secondary: 'var(--color-bg-secondary)',
          tertiary: 'var(--color-bg-tertiary)',
          inverse: 'var(--color-bg-inverse)',
          overlay: 'var(--color-bg-overlay)',
        },

        // Text colors
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          tertiary: 'var(--color-text-tertiary)',
          disabled: 'var(--color-text-disabled)',
          inverse: 'var(--color-text-inverse)',
          brand: 'var(--color-text-brand)',
        },

        // Border colors
        border: {
          primary: 'var(--color-border-primary)',
          secondary: 'var(--color-border-secondary)',
          tertiary: 'var(--color-border-tertiary)',
          focus: 'var(--color-border-focus)',
          error: 'var(--color-border-error)',
        },
      },

      // Border radius - minimal/portal design (squared edges)
      borderRadius: {
        none: '0',
        xs: '0',
        sm: '0',
        md: '0',
        lg: '0',
        xl: '0',
        pill: '0',
        full: '50%', // Only for circular elements like close buttons
      },

      // Use Tailwind's default spacing scale (rem-based)
      // DO NOT override - the default scale is:
      // 1 = 0.25rem (4px), 2 = 0.5rem (8px), 4 = 1rem (16px), etc.

      // Font family - monospace for portal aesthetic
      fontFamily: {
        mono: [
          'Inconsolata',
          'Courier',
          '"Lucida Sans Typewriter"',
          '"Lucida Typewriter"',
          'monospace',
        ],
        sans: ['Inconsolata', 'monospace'],
      },

      // Font sizes
      fontSize: {
        xs: ['12px', { lineHeight: '1.4' }],
        sm: ['14px', { lineHeight: '1.4' }],
        base: ['15px', { lineHeight: '1.5' }],
        lg: ['16px', { lineHeight: '1.5' }],
        xl: ['18px', { lineHeight: '1.4' }],
        '2xl': ['24px', { lineHeight: '1.3' }],
        '3xl': ['32px', { lineHeight: '1.2' }],
      },

      // Box shadows - minimal/flat design (mostly none)
      boxShadow: {
        none: 'none',
        card: 'none',
        content: 'none',
        sidebar: 'none',
        panel: 'none',
        inset: 'none',
        'inset-light': 'none',
        spread: 'none',
        'elevated-sm': 'none',
        'elevated-md': 'none',
        'elevated-lg': 'none',
        'elevated-xl': 'none',
        dropdown: 'none',
        'dropdown-xl': 'none',
        terminal: 'none',
        'elevated-dark': 'none',
        button: 'none',
        'button-dark': 'none',
        'button-pressed': 'none',
      },

      // Transitions using existing tokens
      transitionDuration: {
        faster: 'var(--duration-faster)',
        fast: 'var(--duration-fast)',
        medium: 'var(--duration-medium)',
        slow: 'var(--duration-slow)',
        slower: 'var(--duration-slower)',
      },

      // Z-index using existing tokens
      zIndex: {
        header: 'var(--z-header)',
        nav: 'var(--z-nav)',
        modal: 'var(--z-modal)',
      },

      // Animation for Shadcn components
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'collapsible-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-collapsible-content-height)' },
        },
        'collapsible-up': {
          from: { height: 'var(--radix-collapsible-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'collapsible-down': 'collapsible-down 0.2s ease-out',
        'collapsible-up': 'collapsible-up 0.2s ease-out',
      },
    },
  },
  plugins: [],
};
