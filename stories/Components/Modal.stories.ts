import type { Meta, StoryObj } from '@storybook/html';

const meta: Meta = {
  title: 'Components/Modal',
  parameters: {
    docs: {
      description: {
        component: 'A modal dialog component for displaying content in an overlay.',
      },
    },
  },
  argTypes: {
    size: {
      control: { type: 'select' },
      options: ['small', 'medium', 'large', 'full'],
      description: 'Modal size variant',
    },
    closeable: {
      control: { type: 'boolean' },
      description: 'Whether the modal can be closed',
    },
    title: {
      control: { type: 'text' },
      description: 'Modal title',
    },
    content: {
      control: { type: 'text' },
      description: 'Modal content',
    },
  },
};

export default meta;
type Story = StoryObj;

const createModal = (args: any) => {
  const {
    size = 'medium',
    closeable = true,
    title = 'Modal Title',
    content = 'This is the modal content.',
  } = args;

  const modalId = `modal-${Math.random().toString(36).substr(2, 9)}`;

  const styles = `
    <style>
      .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        opacity: 0;
        animation: fadeIn 0.2s ease-out forwards;
      }
      
      .modal {
        background: var(--color-bg-primary, #ffffff);
        border-radius: 8px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        max-height: 90vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        transform: scale(0.95);
        animation: slideIn 0.2s ease-out forwards;
      }
      
      .modal--small {
        width: 90%;
        max-width: 400px;
      }
      
      .modal--medium {
        width: 90%;
        max-width: 600px;
      }
      
      .modal--large {
        width: 90%;
        max-width: 800px;
      }
      
      .modal--full {
        width: 95%;
        height: 95%;
        max-width: none;
        max-height: none;
      }
      
      .modal__header {
        padding: 1.5rem;
        border-bottom: 1px solid var(--color-border, #d0d7de);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      
      .modal__title {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--color-text-primary, #24292f);
      }
      
      .modal__close {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: var(--color-text-secondary, #656d76);
        padding: 0.25rem;
        border-radius: 4px;
        transition: all 0.2s ease;
      }
      
      .modal__close:hover {
        color: var(--color-text-primary, #24292f);
        background: var(--color-bg-secondary, #f6f8fa);
      }
      
      .modal__body {
        padding: 1.5rem;
        overflow-y: auto;
        flex: 1;
      }
      
      .modal__footer {
        padding: 1.5rem;
        border-top: 1px solid var(--color-border, #d0d7de);
        display: flex;
        gap: 0.75rem;
        justify-content: flex-end;
      }
      
      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.5rem 1rem;
        border: 1px solid transparent;
        border-radius: 6px;
        font-family: var(--font-family-base, system-ui);
        font-weight: 500;
        text-decoration: none;
        cursor: pointer;
        transition: all 0.2s ease-in-out;
        font-size: 0.875rem;
      }
      
      .btn--primary {
        background-color: var(--color-primary, #00ff41);
        color: var(--color-secondary, #0d1117);
        border-color: var(--color-primary, #00ff41);
      }
      
      .btn--ghost {
        background-color: transparent;
        color: var(--color-text-primary, #24292f);
        border-color: var(--color-border, #d0d7de);
      }
      
      @keyframes fadeIn {
        to { opacity: 1; }
      }
      
      @keyframes slideIn {
        to { transform: scale(1); }
      }
    </style>
  `;

  return `
    ${styles}
    <div class="modal-overlay" onclick="document.getElementById('${modalId}').style.display='none'">
      <div class="modal modal--${size}" id="${modalId}" onclick="event.stopPropagation()">
        <div class="modal__header">
          <h2 class="modal__title">${title}</h2>
          ${closeable ? `<button class="modal__close" onclick="document.getElementById('${modalId}').style.display='none'">&times;</button>` : ''}
        </div>
        <div class="modal__body">
          <p>${content}</p>
        </div>
        <div class="modal__footer">
          <button class="btn btn--ghost" onclick="document.getElementById('${modalId}').style.display='none'">Cancel</button>
          <button class="btn btn--primary">Confirm</button>
        </div>
      </div>
    </div>
  `;
};

export const Default: Story = {
  args: {
    title: 'Confirm Action',
    content: 'Are you sure you want to perform this action? This cannot be undone.',
  },
  render: createModal,
};

export const Small: Story = {
  args: {
    size: 'small',
    title: 'Quick Confirmation',
    content: 'This is a small modal for simple confirmations.',
  },
  render: createModal,
};

export const Large: Story = {
  args: {
    size: 'large',
    title: 'Detailed Information',
    content: 'This is a large modal that can contain more detailed information, forms, or complex content layouts.',
  },
  render: createModal,
};

export const NonCloseable: Story = {
  args: {
    title: 'Important Notice',
    content: 'This modal cannot be closed by clicking the X button or clicking outside.',
    closeable: false,
  },
  render: createModal,
};