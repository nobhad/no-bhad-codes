import type { StorybookConfig } from '@storybook/html-vite';

const config: StorybookConfig = {
  stories: [
    '../src/**/*.mdx',
    '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
    '../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)',
    '../stories/**/*.mdx'
  ],
  
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-controls',
    '@storybook/addon-actions',
    '@storybook/addon-viewport',
    '@storybook/addon-backgrounds',
    '@storybook/addon-toolbars',
    '@storybook/addon-measure',
    '@storybook/addon-outline'
  ],
  
  framework: {
    name: '@storybook/html-vite',
    options: {}
  },
  
  features: {
    storyStoreV7: true
  },
  
  typescript: {
    check: false,
    reactDocgen: false
  },
  
  docs: {
    autodocs: 'tag'
  }
};

export default config;