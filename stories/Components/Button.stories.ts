import type { Meta, StoryObj } from '@storybook/html';

const meta: Meta = {
  title: 'Components/Button',
  parameters: {
    docs: {
      description: {
        component: 'A versatile button component with multiple variants, sizes, and states.',
      },
    },
  },
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['primary', 'secondary', 'ghost', 'danger'],
      description: 'Button visual style variant',
    },
    size: {
      control: { type: 'select' },
      options: ['small', 'medium', 'large'],
      description: 'Button size',
    },
    disabled: {
      control: { type: 'boolean' },
      description: 'Whether the button is disabled',
    },
    loading: {
      control: { type: 'boolean' },
      description: 'Whether the button shows loading state',
    },
    fullWidth: {
      control: { type: 'boolean' },
      description: 'Whether the button takes full width',
    },
    children: {
      control: { type: 'text' },
      description: 'Button text content',
    },
  },
};

export default meta;
type Story = StoryObj;

const createButton = (args: any) => {
  const {
    variant = 'primary',
    size = 'medium',
    disabled = false,
    loading = false,
    fullWidth = false,
    children = 'Button',
  } = args;

  const classNames = [
    'btn',
    `btn--${variant}`,
    `btn--${size}`,
    disabled ? 'btn--disabled' : '',
    loading ? 'btn--loading' : '',
    fullWidth ? 'btn--full-width' : '',
  ].filter(Boolean).join(' ');

  const styles = \`
    <style>
      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        border: 1px solid transparent;
        border-radius: 6px;
        font-family: var(--font-family-base, system-ui);
        font-weight: var(--font-weight-medium, 500);
        text-decoration: none;
        cursor: pointer;
        transition: all 0.2s ease-in-out;
        user-select: none;
        white-space: nowrap;
        position: relative;
      }
      
      .btn:focus-visible {
        outline: 2px solid var(--color-primary, #00ff41);
        outline-offset: 2px;
      }
      
      /* Sizes */
      .btn--small {
        padding: 0.375rem 0.75rem;
        font-size: var(--font-size-sm, 0.875rem);
        min-height: 2rem;
      }
      
      .btn--medium {
        padding: 0.5rem 1rem;
        font-size: var(--font-size-base, 1rem);
        min-height: 2.5rem;
      }
      
      .btn--large {
        padding: 0.75rem 1.5rem;
        font-size: var(--font-size-lg, 1.125rem);
        min-height: 3rem;
      }
      
      /* Variants */
      .btn--primary {
        background-color: var(--color-primary, #00ff41);
        color: var(--color-secondary, #0d1117);
        border-color: var(--color-primary, #00ff41);
      }
      
      .btn--primary:hover:not(.btn--disabled):not(.btn--loading) {
        background-color: #00e639;
        border-color: #00e639;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 255, 65, 0.3);
      }
      
      .btn--secondary {
        background-color: transparent;
        color: var(--color-primary, #00ff41);
        border-color: var(--color-primary, #00ff41);
      }
      
      .btn--secondary:hover:not(.btn--disabled):not(.btn--loading) {
        background-color: var(--color-primary, #00ff41);
        color: var(--color-secondary, #0d1117);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 255, 65, 0.2);
      }
      
      .btn--ghost {
        background-color: transparent;
        color: var(--color-text-primary, #24292f);
        border-color: transparent;
      }
      
      .btn--ghost:hover:not(.btn--disabled):not(.btn--loading) {
        background-color: var(--color-bg-secondary, #f6f8fa);
        transform: translateY(-1px);
      }
      
      .btn--danger {
        background-color: var(--color-error, #dc3545);
        color: white;
        border-color: var(--color-error, #dc3545);
      }
      
      .btn--danger:hover:not(.btn--disabled):not(.btn--loading) {
        background-color: #c82333;
        border-color: #c82333;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
      }
      
      /* States */
      .btn--disabled {
        opacity: 0.5;
        cursor: not-allowed;
        pointer-events: none;
      }
      
      .btn--loading {
        cursor: not-allowed;
        color: transparent;
      }
      
      .btn--loading::after {
        content: '';
        position: absolute;
        width: 1rem;
        height: 1rem;
        border: 2px solid transparent;
        border-top: 2px solid currentColor;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      
      .btn--full-width {
        width: 100%;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    </style>
  \`;

  return \`
    \${styles}
    <button 
      class="\${classNames}" 
      \${disabled ? 'disabled' : ''}
      type="button"
    >
      \${children}
    </button>
  \`;
};

export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'Primary Button',
  },
  render: createButton,
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Secondary Button',
  },
  render: createButton,
};

export const Ghost: Story = {
  args: {
    variant: 'ghost',
    children: 'Ghost Button',
  },
  render: createButton,
};

export const Danger: Story = {
  args: {
    variant: 'danger',
    children: 'Danger Button',
  },
  render: createButton,
};

export const Sizes: Story = {
  render: () => \`
    \${createButton({ size: 'small', children: 'Small Button' })}
    \${createButton({ size: 'medium', children: 'Medium Button' })}
    \${createButton({ size: 'large', children: 'Large Button' })}
    <style>
      body > div { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; }
    </style>
  \`,
};

export const States: Story = {
  render: () => \`
    \${createButton({ children: 'Normal' })}
    \${createButton({ disabled: true, children: 'Disabled' })}
    \${createButton({ loading: true, children: 'Loading' })}
    <style>
      body > div { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; }
    </style>
  \`,
};

export const AllVariants: Story = {
  render: () => \`
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; max-width: 800px;">
      \${createButton({ variant: 'primary', children: 'Primary' })}
      \${createButton({ variant: 'secondary', children: 'Secondary' })}
      \${createButton({ variant: 'ghost', children: 'Ghost' })}
      \${createButton({ variant: 'danger', children: 'Danger' })}
    </div>
  \`,
};

export const FullWidth: Story = {
  args: {
    fullWidth: true,
    children: 'Full Width Button',
  },
  render: createButton,
};

export const Interactive: Story = {
  args: {
    variant: 'primary',
    size: 'medium',
    disabled: false,
    loading: false,
    fullWidth: false,
    children: 'Click Me',
  },
  render: createButton,
};