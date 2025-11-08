import type { Meta, StoryObj } from '@storybook/html';

const meta: Meta = {
  title: 'Components/Client Portal/Sidebar',
  parameters: {
    layout: 'fullscreen'
  },
  argTypes: {
    isCollapsed: {
      control: 'boolean',
      description: 'Sidebar collapsed state'
    },
    activeSection: {
      control: 'select',
      options: ['profile', 'billing', 'settings', 'dashboard', 'projects', 'messages'],
      description: 'Active navigation item'
    }
  },
  args: {
    isCollapsed: false,
    activeSection: 'dashboard'
  }
};

export default meta;
type Story = StoryObj;

const createSidebar = (args: any) => {
  const { isCollapsed, activeSection } = args;

  return `
    <div style="height: 100vh; background: #f8f9fa;">
      <aside class="sidebar${isCollapsed ? ' collapsed' : ''}" id="sidebar">
        <button class="sidebar-toggle" id="sidebar-toggle">☰</button>
        <div class="sidebar-content">
          <h3>Navigation</h3>
          <div class="nav-section">
            <h4>Account</h4>
            <button 
              class="nav-btn${activeSection === 'profile' ? ' active' : ''}" 
              id="nav-profile"
              onclick="window.__STORYBOOK_ADDONS_CHANNEL__.emit('storybook/actions/action-event', {
                name: 'nav-profile-clicked',
                args: [{ section: 'profile', action: 'navigate' }]
              })"
            >👤 Profile</button>
            <button 
              class="nav-btn${activeSection === 'billing' ? ' active' : ''}" 
              id="nav-billing"
              onclick="window.__STORYBOOK_ADDONS_CHANNEL__.emit('storybook/actions/action-event', {
                name: 'nav-billing-clicked',
                args: [{ section: 'billing', action: 'navigate' }]
              })"
            >💳 Billing</button>
            <button 
              class="nav-btn${activeSection === 'settings' ? ' active' : ''}" 
              id="nav-settings"
              onclick="window.__STORYBOOK_ADDONS_CHANNEL__.emit('storybook/actions/action-event', {
                name: 'nav-settings-clicked',
                args: [{ section: 'settings', action: 'navigate' }]
              })"
            >⚙️ Settings</button>
          </div>
          <div class="nav-section">
            <h4>Projects</h4>
            <button class="nav-btn${activeSection === 'dashboard' ? ' active' : ''}" id="nav-dashboard">📊 Dashboard</button>
            <button class="nav-btn${activeSection === 'projects' ? ' active' : ''}" id="nav-projects">📁 My Projects</button>
            <button class="nav-btn${activeSection === 'messages' ? ' active' : ''}" id="nav-messages">💬 Messages</button>
          </div>
          <div class="nav-section">
            <button class="nav-btn logout-btn" id="nav-logout">🚪 Logout</button>
          </div>
        </div>
      </aside>
    </div>
  `;
};

export const Expanded: Story = {
  render: createSidebar
};

export const Collapsed: Story = {
  args: {
    isCollapsed: true
  },
  render: createSidebar
};

export const ActiveProjects: Story = {
  args: {
    activeSection: 'projects'
  },
  render: createSidebar
};

export const ActiveMessages: Story = {
  args: {
    activeSection: 'messages'
  },
  render: createSidebar
};