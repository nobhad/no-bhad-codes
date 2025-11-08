import type { Meta, StoryObj } from '@storybook/html';

const meta: Meta = {
  title: 'Components/Navigation',
  parameters: {
    layout: 'fullscreen'
  },
  argTypes: {
    isOpen: {
      control: 'boolean',
      description: 'Navigation open state'
    }
  },
  args: {
    isOpen: false
  }
};

export default meta;
type Story = StoryObj;

const createNavigation = (args: any) => {
  const { isOpen } = args;

  return `
    <nav data-nav="${isOpen ? 'open' : 'closed'}" class="nav">
      <div data-menu-toggle="" class="overlay"></div>
      <div class="menu">
        <div class="menu-bg">
          <div class="bg-panel first"></div>
          <div class="bg-panel second"></div>
          <div class="bg-panel"></div>
        </div>
        <div class="menu-inner">
          <ul class="menu-list">
            <li class="menu-list-item">
              <a href="/" class="menu-link" onclick="event.preventDefault(); window.__STORYBOOK_ADDONS_CHANNEL__.emit('storybook/actions/action-event', {
                name: 'navigation-link-clicked',
                args: [{ link: 'home', eyebrow: '00', disabled: false, href: '/' }]
              })">
                <p class="menu-link-heading" data-text="home">home</p>
                <p class="eyebrow">00</p>
                <div class="menu-link-bg"></div>
              </a>
            </li>
            <li class="menu-list-item">
              <a href="#about" class="menu-link" onclick="event.preventDefault(); window.__STORYBOOK_ADDONS_CHANNEL__.emit('storybook/actions/action-event', {
                name: 'navigation-link-clicked',
                args: [{ link: 'about', eyebrow: '01', disabled: false, href: '#about' }]
              })">
                <p class="menu-link-heading" data-text="about">about</p>
                <p class="eyebrow">01</p>
                <div class="menu-link-bg"></div>
              </a>
            </li>
            <li class="menu-list-item">
              <a href="#contact" class="menu-link" onclick="event.preventDefault(); window.__STORYBOOK_ADDONS_CHANNEL__.emit('storybook/actions/action-event', {
                name: 'navigation-link-clicked',
                args: [{ link: 'contact', eyebrow: '02', disabled: false, href: '#contact' }]
              })">
                <p class="menu-link-heading" data-text="contact">contact</p>
                <p class="eyebrow">02</p>
                <div class="menu-link-bg"></div>
              </a>
            </li>
            <li class="menu-list-item">
              <a href="/projects" class="menu-link disabled" onclick="event.preventDefault(); window.__STORYBOOK_ADDONS_CHANNEL__.emit('storybook/actions/action-event', {
                name: 'disabled-link-clicked',
                args: [{ link: 'portfolio', eyebrow: '03', disabled: true, comingSoon: true, href: '/projects' }]
              })">
                <p class="menu-link-heading" data-text="portfolio">portfolio</p>
                <p class="eyebrow">03</p>
                <div class="coming-soon-banner">Coming Soon</div>
                <div class="menu-link-bg"></div>
              </a>
            </li>
            <li class="menu-list-item">
              <a href="/client/portal" class="menu-link" onclick="event.preventDefault(); window.__STORYBOOK_ADDONS_CHANNEL__.emit('storybook/actions/action-event', {
                name: 'navigation-link-clicked',
                args: [{ link: 'client portal', eyebrow: '04', disabled: false, href: '/client/portal' }]
              })">
                <p class="menu-link-heading" data-text="client portal">client portal</p>
                <p class="eyebrow">04</p>
                <div class="menu-link-bg"></div>
              </a>
            </li>
          </ul>
        </div>
      </div>
    </nav>
    
    <style>
      /* Enhanced navigation hover states for Storybook demo */
      .nav[data-nav="open"] .menu-link:not(.disabled):hover {
        color: var(--color-primary, #00ff41);
        transition: color 0.3s ease;
      }
      
      .nav[data-nav="open"] .menu-link:not(.disabled):hover .menu-link-heading {
        transform: translateX(10px);
        transition: transform 0.3s ease;
      }
      
      .nav[data-nav="open"] .menu-link:not(.disabled):hover .eyebrow {
        color: var(--color-primary, #00ff41);
        transform: scale(1.1);
        transition: all 0.3s ease;
      }
      
      .nav[data-nav="open"] .menu-link:not(.disabled):hover .menu-link-bg {
        opacity: 0.1;
        background-color: var(--color-primary, #00ff41);
        transform: scaleX(1);
        transition: all 0.3s ease;
      }
      
      .nav[data-nav="open"] .menu-link.disabled:hover {
        cursor: not-allowed;
      }
      
      .nav[data-nav="open"] .menu-link.disabled .coming-soon-banner {
        animation: pulse 2s ease-in-out infinite;
      }
      
      @keyframes pulse {
        0%, 100% { opacity: 0.7; }
        50% { opacity: 1; }
      }
      
      /* Ensure menu is visible when open */
      .nav[data-nav="open"] .menu {
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
      }
      
      /* Initial menu styles for closed state */
      .nav[data-nav="closed"] .menu {
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
      }
    </style>
  `;
};

export const Closed: Story = {
  render: createNavigation
};

export const Open: Story = {
  args: {
    isOpen: true
  },
  render: createNavigation
};

export const InteractiveDemo: Story = {
  args: {
    isOpen: true
  },
  parameters: {
    docs: {
      description: {
        story: 'Hover over the navigation links to see the interactive effects. Click links to see actions logged.'
      }
    }
  },
  render: (args) => `
    ${createNavigation(args)}
    
    <div style="position: fixed; bottom: 20px; right: 20px; background: rgba(0,0,0,0.8); color: white; padding: 1rem; border-radius: 8px; font-size: 0.875rem; max-width: 300px;">
      <h4 style="margin: 0 0 0.5rem 0;">Navigation Demo</h4>
      <ul style="margin: 0; padding-left: 1rem; font-size: 0.8rem;">
        <li>Hover over menu links to see effects</li>
        <li>Active links highlight in green</li>
        <li>Text slides right on hover</li>
        <li>Eyebrow numbers scale up</li>
        <li>Disabled "Portfolio" has pulse effect</li>
        <li>Click links to log actions</li>
      </ul>
    </div>
  `
};