/**
 * PostCSS Configuration
 *
 * NOTE: Tailwind is removed from global PostCSS to avoid conflicts
 * with existing @layer directives. React components use the existing
 * portal CSS classes and CSS variables instead.
 */
export default {
  plugins: {
    'postcss-custom-media': {
      // Custom media queries using our breakpoint system
    },
    autoprefixer: {},
  },
};
