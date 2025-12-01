import type { Meta, StoryObj } from '@storybook/html';

const meta: Meta = {
  title: 'Components/Client Portal/Dashboard Content',
  parameters: {
    layout: 'padded'
  },
  argTypes: {
    showWelcomeMessage: {
      control: 'boolean',
      description: 'Show welcome message'
    },
    cardCount: {
      control: { type: 'range', min: 1, max: 6, step: 1 },
      description: 'Number of content cards'
    }
  },
  args: {
    showWelcomeMessage: true,
    cardCount: 2
  }
};

export default meta;
type Story = StoryObj;

const createDashboardContent = (args: any) => {
  const { showWelcomeMessage, cardCount } = args;

  const cards = [];
  const cardTypes = [
    {
      title: 'Recent Activity',
      description: 'Your latest project updates will appear here',
      buttonText: 'View All'
    },
    {
      title: 'Quick Actions',
      description: 'Common tasks and shortcuts',
      buttonText: 'Get Started'
    },
    {
      title: 'Active Projects',
      description: 'Your ongoing projects and their status',
      buttonText: 'Manage Projects'
    },
    {
      title: 'Messages',
      description: 'Recent communications and updates',
      buttonText: 'View Messages'
    },
    {
      title: 'Invoices',
      description: 'Billing and payment information',
      buttonText: 'View Invoices'
    },
    {
      title: 'Support',
      description: 'Get help and find documentation',
      buttonText: 'Contact Support'
    }
  ];

  for (let i = 0; i < Math.min(cardCount, cardTypes.length); i++) {
    const card = cardTypes[i];
    cards.push(`
      <div class="card">
        <h3>${card.title}</h3>
        <p>${card.description}</p>
        <button class="btn btn-outline">${card.buttonText}</button>
      </div>
    `);
  }

  return `
    <div class="content-area">
      ${
  showWelcomeMessage
    ? `
        <div class="page-header">
          <h1>Dashboard</h1>
          <p>Welcome to your client dashboard</p>
        </div>
      `
    : ''
}
      
      <div class="action-buttons">
        <button 
          class="btn btn-primary" 
          id="btn-new-project"
          onclick="window.__STORYBOOK_ADDONS_CHANNEL__.emit('storybook/actions/action-event', {
            name: 'new-project-clicked',
            args: [{ action: 'new-project', section: 'dashboard' }]
          })"
        >+ New Project</button>
        <button 
          class="btn btn-secondary" 
          id="btn-messages"
          onclick="window.__STORYBOOK_ADDONS_CHANNEL__.emit('storybook/actions/action-event', {
            name: 'messages-clicked',
            args: [{ action: 'view-messages', section: 'dashboard' }]
          })"
        >View Messages</button>
        <button 
          class="btn btn-secondary" 
          id="btn-invoices"
          onclick="window.__STORYBOOK_ADDONS_CHANNEL__.emit('storybook/actions/action-event', {
            name: 'invoices-clicked',
            args: [{ action: 'view-invoices', section: 'dashboard' }]
          })"
        >View Invoices</button>
      </div>
      
      <div class="content-cards">
        ${cards.join('')}
      </div>
    </div>
  `;
};

export const Default: Story = {
  render: createDashboardContent
};

export const WithoutWelcome: Story = {
  args: {
    showWelcomeMessage: false
  },
  render: createDashboardContent
};

export const ManyCards: Story = {
  args: {
    cardCount: 4
  },
  render: createDashboardContent
};

export const MinimalContent: Story = {
  args: {
    showWelcomeMessage: false,
    cardCount: 1
  },
  render: createDashboardContent
};
