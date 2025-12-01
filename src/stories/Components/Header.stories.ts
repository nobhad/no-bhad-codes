import type { Meta, StoryObj } from '@storybook/html';

const meta: Meta = {
  title: 'Components/Header',
  parameters: {
    layout: 'fullscreen'
  },
  argTypes: {
    showThemeToggle: {
      control: 'boolean',
      description: 'Show theme toggle button'
    },
    logoText: {
      control: 'text',
      description: 'Logo text'
    }
  },
  args: {
    showThemeToggle: true,
    logoText: 'no bhad codes'
  }
};

export default meta;
type Story = StoryObj;

const createHeader = (args: any) => {
  const { showThemeToggle, logoText } = args;

  return `
    <header class="header">
      <div class="container is--full">
        <nav class="nav-row">
          <a href="/" aria-label="home" class="nav-logo-row">
            ${logoText}
          </a>
          <div class="nav-row__right">
            ${
  showThemeToggle
    ? `
              <button id="toggle-theme" class="theme-button" aria-label="Toggle dark/light theme">
                <div class="icon-wrap">
                  <svg class="theme-icon sun-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="2"></circle>
                    <path d="M12 2V4M12 20V22M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="2"></path>
                  </svg>
                  <svg class="theme-icon moon-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                   <path d="M21 12.79A9 9 0 1 1 11.21 3A7 7 0 0 0 21 12.79z"></path>
                  </svg>
                </div>
              </button>
            `
    : ''
}
            <button role="button" data-menu-toggle="" class="menu-button">
              <div class="menu-button-text">
                <p class="p-large">Menu</p>
                <p class="p-large">Close</p>
              </div>
              <div class="icon-wrap">
                <svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 16 16" fill="none" class="menu-button-icon">
                  <path d="M7.33333 16L7.33333 -3.2055e-07L8.66667 -3.78832e-07L8.66667 16L7.33333 16Z" fill="currentColor"></path>
                  <path d="M16 8.66667L-2.62269e-07 8.66667L-3.78832e-07 7.33333L16 7.33333L16 8.66667Z" fill="currentColor"></path>
                  <path d="M6 7.33333L7.33333 7.33333L7.33333 6C7.33333 6.73637 6.73638 7.33333 6 7.33333Z" fill="currentColor"></path>
                  <path d="M10 7.33333L8.66667 7.33333L8.66667 6C8.66667 6.73638 9.26362 7.33333 10 7.33333Z" fill="currentColor"></path>
                  <path d="M6 8.66667L7.33333 8.66667L7.33333 10C7.33333 9.26362 6.73638 8.66667 6 8.66667Z" fill="currentColor"></path>
                  <path d="M10 8.66667L8.66667 8.66667L8.66667 10C8.66667 9.26362 9.26362 8.66667 10 8.66667Z" fill="currentColor"></path>
                </svg>
              </div>
            </button>
          </div>
        </nav>
      </div>
    </header>
  `;
};

export const Default: Story = {
  render: createHeader
};

export const WithoutThemeToggle: Story = {
  args: {
    showThemeToggle: false
  },
  render: createHeader
};

export const CustomLogo: Story = {
  args: {
    logoText: 'Custom Logo'
  },
  render: createHeader
};
