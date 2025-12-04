import type { Meta, StoryObj } from '@storybook/html';

const meta: Meta = {
  title: 'Components/Client Portal/Dashboard Header',
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    hasNotifications: {
      control: 'boolean',
      description: 'Show notification indicator',
    },
    userName: {
      control: 'text',
      description: 'User name or initial',
    },
  },
  args: {
    hasNotifications: false,
    userName: '👤',
  },
};

export default meta;
type Story = StoryObj;

const createDashboardHeader = (args: any) => {
  const { hasNotifications, userName } = args;

  return `
    <header class="dashboard-header">
      <div class="header-content">
        <div class="header-left">
          <h1 class="logo">NO BHAD CODES</h1>
        </div>
        <div class="header-right">
          <button class="header-btn${hasNotifications ? ' has-notification' : ''}" id="notifications-btn">
            🔔
            ${hasNotifications ? '<span class="notification-dot"></span>' : ''}
          </button>
          <button class="header-btn" id="theme-toggle">🌓</button>
          <div class="user-menu">
            <button class="user-avatar" id="user-menu-toggle">${userName}</button>
          </div>
        </div>
      </div>
    </header>
  `;
};

export const Default: Story = {
  render: createDashboardHeader,
};

export const WithNotifications: Story = {
  args: {
    hasNotifications: true,
  },
  render: createDashboardHeader,
};

export const CustomUser: Story = {
  args: {
    userName: 'JD',
  },
  render: createDashboardHeader,
};
