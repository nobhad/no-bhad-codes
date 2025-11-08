import type { Preview } from '@storybook/html-vite';

// Import ALL CSS files from the site
import '../src/styles/main-new.css';
import '../src/styles/pages/client-portal.css';
import '../src/styles/components/navigation.css';
import '../src/styles/components/form.css';
import '../src/styles/admin-dashboard.css';

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    
    docs: {
      extractComponentDescription: (component, { notes }) => {
        if (notes) {
          return typeof notes === 'string' ? notes : notes.markdown || notes.text;
        }
        return null;
      },
    },
    
    backgrounds: {
      default: 'light',
      values: [
        {
          name: 'light',
          value: '#f8f9fa',
        },
        {
          name: 'dark', 
          value: '#3a3a3a',
        },
        {
          name: 'brand',
          value: '#00ff41',
        },
      ],
    },
    
    viewport: {
      viewports: {
        mobile: {
          name: 'Mobile',
          styles: {
            width: '375px',
            height: '667px',
          },
        },
        tablet: {
          name: 'Tablet',
          styles: {
            width: '768px',
            height: '1024px',
          },
        },
        desktop: {
          name: 'Desktop',
          styles: {
            width: '1200px',
            height: '800px',
          },
        },
        largeDesktop: {
          name: 'Large Desktop',
          styles: {
            width: '1920px',
            height: '1080px',
          },
        },
      },
    },
  },
  
  globalTypes: {
    theme: {
      description: 'Global theme for components',
      defaultValue: 'light',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: [
          { value: 'light', title: 'Light', icon: 'sun' },
          { value: 'dark', title: 'Dark', icon: 'moon' },
        ],
        dynamicTitle: true,
      },
    },
  },
  
  decorators: [
    (story, context) => {
      const theme = context.globals.theme || 'light';
      
      return `
        <html data-theme="${theme}">
          <body style="
            margin: 0; 
            padding: 0; 
            font-family: system-ui, -apple-system, sans-serif;
            background: var(--color-neutral-100);
            color: var(--color-dark);
            min-height: 100vh;
          ">
            ${story()}
          </body>
        </html>
      `;
    },
  ],
};

export default preview;