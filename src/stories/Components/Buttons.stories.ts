import type { Meta, StoryObj } from '@storybook/html';

const meta: Meta = {
  title: 'Components/Buttons',
  parameters: {
    layout: 'centered'
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'outline', 'danger', 'success'],
      description: 'Button variant'
    },
    size: {
      control: 'select',
      options: ['small', 'medium', 'large'],
      description: 'Button size'
    },
    disabled: {
      control: 'boolean',
      description: 'Disabled state'
    },
    loading: {
      control: 'boolean',
      description: 'Loading state'
    },
    text: {
      control: 'text',
      description: 'Button text'
    },
    icon: {
      control: 'text',
      description: 'Icon (emoji or symbol)'
    }
  },
  args: {
    variant: 'primary',
    size: 'medium',
    disabled: false,
    loading: false,
    text: 'Button',
    icon: ''
  }
};

export default meta;
type Story = StoryObj;

const createButton = (args: any) => {
  const { variant, size, disabled, loading, text, icon } = args;

  const sizeClass = size !== 'medium' ? ` btn-${size}` : '';
  const loadingText = loading ? 'Loading...' : text;
  const iconHtml = icon ? `${icon} ` : '';

  return `
    <button 
      class="btn btn-${variant}${sizeClass}" 
      ${disabled ? 'disabled' : ''}
      ${loading ? 'aria-busy="true"' : ''}
      onclick="window.__STORYBOOK_ADDONS_CHANNEL__.emit('storybook/actions/action-event', {
        name: 'clicked',
        args: [{ 
          variant: '${variant}', 
          text: '${text}',
          disabled: ${disabled},
          loading: ${loading}
        }]
      })"
    >
      ${iconHtml}${loadingText}
    </button>
  `;
};

export const Primary: Story = {
  render: createButton
};

export const Secondary: Story = {
  args: {
    variant: 'secondary'
  },
  render: createButton
};

export const Outline: Story = {
  args: {
    variant: 'outline'
  },
  render: createButton
};

export const WithIcon: Story = {
  args: {
    text: 'New Project',
    icon: '+'
  },
  render: createButton
};

export const Loading: Story = {
  args: {
    loading: true,
    text: 'Save Changes'
  },
  render: createButton
};

export const Disabled: Story = {
  args: {
    disabled: true,
    text: 'Submit'
  },
  render: createButton
};

export const Small: Story = {
  args: {
    size: 'small',
    text: 'Small Button'
  },
  render: createButton
};

export const Large: Story = {
  args: {
    size: 'large',
    text: 'Large Button'
  },
  render: createButton
};

// Specific button types from the site
export const ThemeToggle: Story = {
  render: () => `
    <button 
      class="theme-button" 
      aria-label="Toggle dark/light theme"
      onclick="window.__STORYBOOK_ADDONS_CHANNEL__.emit('storybook/actions/action-event', {
        name: 'theme-toggled',
        args: [{ action: 'toggle-theme', currentTheme: document.documentElement.getAttribute('data-theme') || 'light' }]
      })"
    >
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
};

export const MenuButton: Story = {
  render: () => `
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
  `
};

export const SidebarToggle: Story = {
  render: () => `
    <button 
      class="sidebar-toggle" 
      id="sidebar-toggle"
      onclick="window.__STORYBOOK_ADDONS_CHANNEL__.emit('storybook/actions/action-event', {
        name: 'sidebar-toggled',
        args: [{ action: 'toggle-sidebar' }]
      })"
    >☰</button>
  `
};

export const HeaderButton: Story = {
  render: () => `
    <button 
      class="header-btn" 
      id="notifications-btn"
      onclick="window.__STORYBOOK_ADDONS_CHANNEL__.emit('storybook/actions/action-event', {
        name: 'notifications-clicked',
        args: [{ action: 'open-notifications' }]
      })"
    >🔔</button>
  `
};

export const NavButton: Story = {
  render: () => `
    <button class="nav-btn active" id="nav-dashboard">📊 Dashboard</button>
  `
};

export const FilterButton: Story = {
  render: () => `
    <button class="filter-btn active" data-filter="all">
      All Projects
      <span class="filter-count" data-count="all">12</span>
    </button>
  `
};

export const FormButton: Story = {
  render: () => `
    <input class="form-button" data-wait="Sending..." type="submit" value="Let's Talk">
  `
};

// Button groups
export const ButtonGroup: Story = {
  parameters: {
    layout: 'padded'
  },
  render: () => `
    <div class="action-buttons">
      <button class="btn btn-primary" id="btn-new-project">+ New Project</button>
      <button class="btn btn-secondary" id="btn-messages">View Messages</button>
      <button class="btn btn-secondary" id="btn-invoices">View Invoices</button>
    </div>
  `
};

export const AllVariants: Story = {
  parameters: {
    layout: 'padded'
  },
  render: () => `
    <div style="display: flex; flex-wrap: wrap; gap: 1rem; align-items: center;">
      <button class="btn btn-primary">Primary</button>
      <button class="btn btn-secondary">Secondary</button>
      <button class="btn btn-outline">Outline</button>
      <button class="btn btn-primary" disabled>Disabled</button>
      <button class="btn btn-primary btn-small">Small</button>
      <button class="btn btn-primary btn-large">Large</button>
      <button class="nav-btn">📊 Nav Button</button>
      <button class="filter-btn">Filter <span class="filter-count">5</span></button>
      <button class="header-btn">🔔</button>
      <button class="sidebar-toggle">☰</button>
    </div>
  `
};