import type { Meta, StoryObj } from '@storybook/html';

const meta: Meta = {
  title: 'Components/Menu Links',
  parameters: {
    layout: 'centered'
  },
  argTypes: {
    state: {
      control: 'select',
      options: ['normal', 'hover', 'active', 'disabled'],
      description: 'Link state'
    },
    eyebrow: {
      control: 'text',
      description: 'Eyebrow number'
    },
    text: {
      control: 'text',
      description: 'Link text'
    },
    comingSoon: {
      control: 'boolean',
      description: 'Show coming soon banner'
    }
  },
  args: {
    state: 'normal',
    eyebrow: '00',
    text: 'home',
    comingSoon: false
  }
};

export default meta;
type Story = StoryObj;

const createMenuLink = (args: any) => {
  const { state, eyebrow, text, comingSoon } = args;

  const stateClass = state === 'hover' ? ' menu-link-hover' :
    state === 'active' ? ' menu-link-active' :
      state === 'disabled' ? ' disabled' : '';

  return `
    <div style="background: #000; padding: 2rem; width: 300px;">
      <div class="menu-list-item">
        <a 
          href="#" 
          class="menu-link${stateClass}"
          onclick="event.preventDefault(); window.__STORYBOOK_ADDONS_CHANNEL__.emit('storybook/actions/action-event', {
            name: 'menu-link-clicked',
            args: [{ 
              text: '${text}', 
              eyebrow: '${eyebrow}',
              state: '${state}',
              disabled: ${state === 'disabled'},
              comingSoon: ${comingSoon}
            }]
          })"
        >
          <p class="menu-link-heading" data-text="${text}">
            ${text}
          </p>
          <p class="eyebrow">${eyebrow}</p>
          ${comingSoon ? '<div class="coming-soon-banner">Coming Soon</div>' : ''}
          <div class="menu-link-bg"></div>
        </a>
      </div>
    </div>
  `;
};

export const Normal: Story = {
  render: createMenuLink
};

export const Hover: Story = {
  args: {
    state: 'hover'
  },
  render: createMenuLink
};

export const Active: Story = {
  args: {
    state: 'active'
  },
  render: createMenuLink
};

export const Disabled: Story = {
  args: {
    state: 'disabled',
    text: 'portfolio',
    eyebrow: '03',
    comingSoon: true
  },
  render: createMenuLink
};

export const About: Story = {
  args: {
    text: 'about',
    eyebrow: '01'
  },
  render: createMenuLink
};

export const Contact: Story = {
  args: {
    text: 'contact',
    eyebrow: '02'
  },
  render: createMenuLink
};

export const ClientPortal: Story = {
  args: {
    text: 'client portal',
    eyebrow: '04'
  },
  render: createMenuLink
};

// Full menu demonstration
export const FullMenu: Story = {
  parameters: {
    layout: 'fullscreen'
  },
  render: () => `
    <div style="background: #000; min-height: 100vh; padding: 2rem;">
      <div class="menu-inner">
        <ul class="menu-list">
          <li class="menu-list-item">
            <a href="/" class="menu-link">
              <p class="menu-link-heading" data-text="home">home</p>
              <p class="eyebrow">00</p>
              <div class="menu-link-bg"></div>
            </a>
          </li>
          <li class="menu-list-item">
            <a href="#about" class="menu-link menu-link-hover">
              <p class="menu-link-heading" data-text="about">about</p>
              <p class="eyebrow">01</p>
              <div class="menu-link-bg"></div>
            </a>
          </li>
          <li class="menu-list-item">
            <a href="#contact" class="menu-link">
              <p class="menu-link-heading" data-text="contact">contact</p>
              <p class="eyebrow">02</p>
              <div class="menu-link-bg"></div>
            </a>
          </li>
          <li class="menu-list-item">
            <a href="/projects" class="menu-link disabled">
              <p class="menu-link-heading" data-text="portfolio">portfolio</p>
              <p class="eyebrow">03</p>
              <div class="coming-soon-banner">Coming Soon</div>
              <div class="menu-link-bg"></div>
            </a>
          </li>
          <li class="menu-list-item">
            <a href="/client/portal" class="menu-link menu-link-active">
              <p class="menu-link-heading" data-text="client portal">client portal</p>
              <p class="eyebrow">04</p>
              <div class="menu-link-bg"></div>
            </a>
          </li>
        </ul>
      </div>
    </div>
  `
};

// Interactive hover states demo
export const HoverStates: Story = {
  parameters: {
    layout: 'padded'
  },
  render: () => `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; background: #000; padding: 2rem; border-radius: 8px;">
      <div class="menu-list-item">
        <a href="#" class="menu-link">
          <p class="menu-link-heading" data-text="normal state">normal state</p>
          <p class="eyebrow">01</p>
          <div class="menu-link-bg"></div>
        </a>
      </div>
      <div class="menu-list-item">
        <a href="#" class="menu-link menu-link-hover">
          <p class="menu-link-heading" data-text="hover state">hover state</p>
          <p class="eyebrow">02</p>
          <div class="menu-link-bg"></div>
        </a>
      </div>
      <div class="menu-list-item">
        <a href="#" class="menu-link menu-link-active">
          <p class="menu-link-heading" data-text="active state">active state</p>
          <p class="eyebrow">03</p>
          <div class="menu-link-bg"></div>
        </a>
      </div>
      <div class="menu-list-item">
        <a href="#" class="menu-link disabled">
          <p class="menu-link-heading" data-text="disabled state">disabled state</p>
          <p class="eyebrow">04</p>
          <div class="coming-soon-banner">Coming Soon</div>
          <div class="menu-link-bg"></div>
        </a>
      </div>
    </div>
    <style>
      .menu-link-hover .menu-link-heading,
      .menu-link:hover .menu-link-heading {
        color: var(--color-primary, #00ff41) !important;
        transform: translateX(10px);
      }
      
      .menu-link-active .menu-link-heading {
        color: var(--color-primary, #00ff41) !important;
        transform: translateX(10px);
      }
      
      .menu-link-hover .menu-link-bg,
      .menu-link:hover .menu-link-bg {
        transform: scaleX(1);
        background: var(--color-primary, #00ff41);
        opacity: 0.1;
      }
      
      .menu-link-active .menu-link-bg {
        transform: scaleX(1);
        background: var(--color-primary, #00ff41);
        opacity: 0.2;
      }
    </style>
  `
};