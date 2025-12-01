import type { Meta, StoryObj } from '@storybook/html';

const meta: Meta = {
  title: 'Design Tokens/Colors',
  parameters: {
    docs: {
      description: {
        component:
          'Color palette and theme tokens used throughout the No Bhad Codes design system.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

export const Primary: Story = {
  render: () => `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; font-family: system-ui;">
      <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
        <div style="
          width: 120px; 
          height: 120px; 
          background: var(--color-primary, #00ff41); 
          border-radius: 8px; 
          border: 1px solid #ccc;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-secondary, #0d1117);
          font-weight: 600;
          font-size: 0.75rem;
        ">
          PRIMARY
        </div>
        <div style="text-align: center;">
          <div style="font-weight: 600; margin-bottom: 0.25rem;">Primary</div>
          <div style="font-size: 0.875rem; color: #666;">--color-primary</div>
          <div style="font-size: 0.75rem; font-family: monospace;">#00ff41</div>
        </div>
      </div>
      
      <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
        <div style="
          width: 120px; 
          height: 120px; 
          background: var(--color-secondary, #0d1117); 
          border-radius: 8px; 
          border: 1px solid #ccc;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-primary, #00ff41);
          font-weight: 600;
          font-size: 0.75rem;
        ">
          SECONDARY
        </div>
        <div style="text-align: center;">
          <div style="font-weight: 600; margin-bottom: 0.25rem;">Secondary</div>
          <div style="font-size: 0.875rem; color: #666;">--color-secondary</div>
          <div style="font-size: 0.75rem; font-family: monospace;">#0d1117</div>
        </div>
      </div>
      
      <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
        <div style="
          width: 120px; 
          height: 120px; 
          background: var(--color-accent, #ff6b6b); 
          border-radius: 8px; 
          border: 1px solid #ccc;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 600;
          font-size: 0.75rem;
        ">
          ACCENT
        </div>
        <div style="text-align: center;">
          <div style="font-weight: 600; margin-bottom: 0.25rem;">Accent</div>
          <div style="font-size: 0.875rem; color: #666;">--color-accent</div>
          <div style="font-size: 0.75rem; font-family: monospace;">#ff6b6b</div>
        </div>
      </div>
    </div>
  `,
};

export const Semantic: Story = {
  render: () => `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; font-family: system-ui;">
      <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
        <div style="
          width: 100px; 
          height: 100px; 
          background: var(--color-success, #28a745); 
          border-radius: 6px; 
          border: 1px solid #ccc;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 600;
          font-size: 0.7rem;
        ">
          SUCCESS
        </div>
        <div style="text-align: center;">
          <div style="font-weight: 600; margin-bottom: 0.25rem;">Success</div>
          <div style="font-size: 0.75rem; color: #666;">--color-success</div>
        </div>
      </div>
      
      <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
        <div style="
          width: 100px; 
          height: 100px; 
          background: var(--color-warning, #ffc107); 
          border-radius: 6px; 
          border: 1px solid #ccc;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #333;
          font-weight: 600;
          font-size: 0.7rem;
        ">
          WARNING
        </div>
        <div style="text-align: center;">
          <div style="font-weight: 600; margin-bottom: 0.25rem;">Warning</div>
          <div style="font-size: 0.75rem; color: #666;">--color-warning</div>
        </div>
      </div>
      
      <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
        <div style="
          width: 100px; 
          height: 100px; 
          background: var(--color-error, #dc3545); 
          border-radius: 6px; 
          border: 1px solid #ccc;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 600;
          font-size: 0.7rem;
        ">
          ERROR
        </div>
        <div style="text-align: center;">
          <div style="font-weight: 600; margin-bottom: 0.25rem;">Error</div>
          <div style="font-size: 0.75rem; color: #666;">--color-error</div>
        </div>
      </div>
      
      <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
        <div style="
          width: 100px; 
          height: 100px; 
          background: var(--color-info, #17a2b8); 
          border-radius: 6px; 
          border: 1px solid #ccc;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 600;
          font-size: 0.7rem;
        ">
          INFO
        </div>
        <div style="text-align: center;">
          <div style="font-weight: 600; margin-bottom: 0.25rem;">Info</div>
          <div style="font-size: 0.75rem; color: #666;">--color-info</div>
        </div>
      </div>
    </div>
  `,
};

export const Grayscale: Story = {
  render: () => `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 1rem; font-family: system-ui;">
      <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
        <div style="
          width: 80px; 
          height: 80px; 
          background: var(--color-text-primary, #24292f); 
          border-radius: 4px; 
          border: 1px solid #ccc;
        "></div>
        <div style="text-align: center;">
          <div style="font-size: 0.75rem; font-weight: 600;">Text Primary</div>
          <div style="font-size: 0.7rem; color: #666;">--color-text-primary</div>
        </div>
      </div>
      
      <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
        <div style="
          width: 80px; 
          height: 80px; 
          background: var(--color-text-secondary, #656d76); 
          border-radius: 4px; 
          border: 1px solid #ccc;
        "></div>
        <div style="text-align: center;">
          <div style="font-size: 0.75rem; font-weight: 600;">Text Secondary</div>
          <div style="font-size: 0.7rem; color: #666;">--color-text-secondary</div>
        </div>
      </div>
      
      <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
        <div style="
          width: 80px; 
          height: 80px; 
          background: var(--color-bg-primary, #ffffff); 
          border-radius: 4px; 
          border: 1px solid #ccc;
        "></div>
        <div style="text-align: center;">
          <div style="font-size: 0.75rem; font-weight: 600;">Background Primary</div>
          <div style="font-size: 0.7rem; color: #666;">--color-bg-primary</div>
        </div>
      </div>
      
      <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
        <div style="
          width: 80px; 
          height: 80px; 
          background: var(--color-bg-secondary, #f6f8fa); 
          border-radius: 4px; 
          border: 1px solid #ccc;
        "></div>
        <div style="text-align: center;">
          <div style="font-size: 0.75rem; font-weight: 600;">Background Secondary</div>
          <div style="font-size: 0.7rem; color: #666;">--color-bg-secondary</div>
        </div>
      </div>
      
      <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
        <div style="
          width: 80px; 
          height: 80px; 
          background: var(--color-border, #d0d7de); 
          border-radius: 4px; 
          border: 1px solid #ccc;
        "></div>
        <div style="text-align: center;">
          <div style="font-size: 0.75rem; font-weight: 600;">Border</div>
          <div style="font-size: 0.7rem; color: #666;">--color-border</div>
        </div>
      </div>
    </div>
  `,
};
