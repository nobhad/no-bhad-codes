/**
 * PostCSS Configuration
 *
 * Applied by Vite to every stylesheet: custom media queries from the
 * breakpoint system, then vendor prefixes. Tailwind was removed in 2026-09;
 * no utility class had ever been written.
 */
export default {
  plugins: {
    'postcss-custom-media': {
      // Custom media queries using our breakpoint system
    },
    autoprefixer: {}
  }
};
