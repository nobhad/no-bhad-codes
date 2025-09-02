import type { Meta, StoryObj } from '@storybook/html';

const meta: Meta = {
  title: 'Design Tokens/Spacing',
  parameters: {
    docs: {
      description: {
        component: 'Consistent spacing scale for margins, padding, and layout throughout the design system.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

export const SpacingScale: Story = {
  render: () => `
    <div style="font-family: var(--font-family-base, system-ui); color: var(--color-text-primary, #24292f);">
      <div style="margin-bottom: 2rem;">
        <h2 style="margin-bottom: 1rem; font-size: 1.5rem; font-weight: 600;">Spacing Scale</h2>
        <p style="color: var(--color-text-secondary, #656d76); margin-bottom: 2rem;">
          Our spacing system follows a consistent scale based on 0.25rem (4px) increments for precise alignment.
        </p>
      </div>
      
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        <!-- Space 0 -->
        <div style="display: flex; align-items: center; gap: 2rem; padding: 1rem; border: 1px solid var(--color-border, #d0d7de); border-radius: 6px;">
          <div style="min-width: 100px; font-size: 0.875rem; color: var(--color-text-secondary, #656d76); font-family: monospace;">
            --space-0<br>0rem / 0px
          </div>
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div style="width: 0px; height: 20px; background: var(--color-primary, #00ff41);"></div>
            <span style="font-size: 0.875rem;">No space - for touching elements</span>
          </div>
        </div>

        <!-- Space 1 -->
        <div style="display: flex; align-items: center; gap: 2rem; padding: 1rem; border: 1px solid var(--color-border, #d0d7de); border-radius: 6px;">
          <div style="min-width: 100px; font-size: 0.875rem; color: var(--color-text-secondary, #656d76); font-family: monospace;">
            --space-1<br>0.25rem / 4px
          </div>
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div style="width: 4px; height: 20px; background: var(--color-primary, #00ff41);"></div>
            <span style="font-size: 0.875rem;">Minimal space for fine adjustments</span>
          </div>
        </div>

        <!-- Space 2 -->
        <div style="display: flex; align-items: center; gap: 2rem; padding: 1rem; border: 1px solid var(--color-border, #d0d7de); border-radius: 6px;">
          <div style="min-width: 100px; font-size: 0.875rem; color: var(--color-text-secondary, #656d76); font-family: monospace;">
            --space-2<br>0.5rem / 8px
          </div>
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div style="width: 8px; height: 20px; background: var(--color-primary, #00ff41);"></div>
            <span style="font-size: 0.875rem;">Small space for tight layouts</span>
          </div>
        </div>

        <!-- Space 3 -->
        <div style="display: flex; align-items: center; gap: 2rem; padding: 1rem; border: 1px solid var(--color-border, #d0d7de); border-radius: 6px;">
          <div style="min-width: 100px; font-size: 0.875rem; color: var(--color-text-secondary, #656d76); font-family: monospace;">
            --space-3<br>0.75rem / 12px
          </div>
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div style="width: 12px; height: 20px; background: var(--color-primary, #00ff41);"></div>
            <span style="font-size: 0.875rem;">Small-medium space</span>
          </div>
        </div>

        <!-- Space 4 -->
        <div style="display: flex; align-items: center; gap: 2rem; padding: 1rem; border: 1px solid var(--color-border, #d0d7de); border-radius: 6px;">
          <div style="min-width: 100px; font-size: 0.875rem; color: var(--color-text-secondary, #656d76); font-family: monospace;">
            --space-4<br>1rem / 16px
          </div>
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div style="width: 16px; height: 20px; background: var(--color-primary, #00ff41);"></div>
            <span style="font-size: 0.875rem;">Base unit - most common spacing</span>
          </div>
        </div>

        <!-- Space 5 -->
        <div style="display: flex; align-items: center; gap: 2rem; padding: 1rem; border: 1px solid var(--color-border, #d0d7de); border-radius: 6px;">
          <div style="min-width: 100px; font-size: 0.875rem; color: var(--color-text-secondary, #656d76); font-family: monospace;">
            --space-5<br>1.25rem / 20px
          </div>
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div style="width: 20px; height: 20px; background: var(--color-primary, #00ff41);"></div>
            <span style="font-size: 0.875rem;">Medium space for component padding</span>
          </div>
        </div>

        <!-- Space 6 -->
        <div style="display: flex; align-items: center; gap: 2rem; padding: 1rem; border: 1px solid var(--color-border, #d0d7de); border-radius: 6px;">
          <div style="min-width: 100px; font-size: 0.875rem; color: var(--color-text-secondary, #656d76); font-family: monospace;">
            --space-6<br>1.5rem / 24px
          </div>
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div style="width: 24px; height: 20px; background: var(--color-primary, #00ff41);"></div>
            <span style="font-size: 0.875rem;">Large space for section separation</span>
          </div>
        </div>

        <!-- Space 8 -->
        <div style="display: flex; align-items: center; gap: 2rem; padding: 1rem; border: 1px solid var(--color-border, #d0d7de); border-radius: 6px;">
          <div style="min-width: 100px; font-size: 0.875rem; color: var(--color-text-secondary, #656d76); font-family: monospace;">
            --space-8<br>2rem / 32px
          </div>
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div style="width: 32px; height: 20px; background: var(--color-primary, #00ff41);"></div>
            <span style="font-size: 0.875rem;">Extra large space for major sections</span>
          </div>
        </div>

        <!-- Space 10 -->
        <div style="display: flex; align-items: center; gap: 2rem; padding: 1rem; border: 1px solid var(--color-border, #d0d7de); border-radius: 6px;">
          <div style="min-width: 100px; font-size: 0.875rem; color: var(--color-text-secondary, #656d76); font-family: monospace;">
            --space-10<br>2.5rem / 40px
          </div>
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div style="width: 40px; height: 20px; background: var(--color-primary, #00ff41);"></div>
            <span style="font-size: 0.875rem;">Large layout spacing</span>
          </div>
        </div>

        <!-- Space 12 -->
        <div style="display: flex; align-items: center; gap: 2rem; padding: 1rem; border: 1px solid var(--color-border, #d0d7de); border-radius: 6px;">
          <div style="min-width: 100px; font-size: 0.875rem; color: var(--color-text-secondary, #656d76); font-family: monospace;">
            --space-12<br>3rem / 48px
          </div>
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div style="width: 48px; height: 20px; background: var(--color-primary, #00ff41);"></div>
            <span style="font-size: 0.875rem;">Page-level spacing</span>
          </div>
        </div>

        <!-- Space 16 -->
        <div style="display: flex; align-items: center; gap: 2rem; padding: 1rem; border: 1px solid var(--color-border, #d0d7de); border-radius: 6px;">
          <div style="min-width: 100px; font-size: 0.875rem; color: var(--color-text-secondary, #656d76); font-family: monospace;">
            --space-16<br>4rem / 64px
          </div>
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div style="width: 64px; height: 20px; background: var(--color-primary, #00ff41);"></div>
            <span style="font-size: 0.875rem;">Maximum spacing for large sections</span>
          </div>
        </div>
      </div>
    </div>
  `,
};

export const SpacingExamples: Story = {
  render: () => `
    <div style="font-family: var(--font-family-base, system-ui); color: var(--color-text-primary, #24292f);">
      <div style="margin-bottom: 2rem;">
        <h2 style="margin-bottom: 1rem; font-size: 1.5rem; font-weight: 600;">Spacing Examples</h2>
        <p style="color: var(--color-text-secondary, #656d76); margin-bottom: 2rem;">
          Common use cases for different spacing values in real components and layouts.
        </p>
      </div>
      
      <div style="display: flex; flex-direction: column; gap: 2rem;">
        <!-- Button Spacing Example -->
        <div style="padding: 1.5rem; border: 1px solid var(--color-border, #d0d7de); border-radius: 8px;">
          <h3 style="margin-bottom: 1rem; font-size: 1.125rem; font-weight: 600;">Button Group (space-4)</h3>
          <div style="display: flex; gap: var(--space-4, 1rem);">
            <button style="
              padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
              background: var(--color-primary, #00ff41);
              color: var(--color-secondary, #0d1117);
              border: none;
              border-radius: 6px;
              font-weight: 500;
              cursor: pointer;
            ">Primary</button>
            <button style="
              padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
              background: transparent;
              color: var(--color-primary, #00ff41);
              border: 1px solid var(--color-primary, #00ff41);
              border-radius: 6px;
              font-weight: 500;
              cursor: pointer;
            ">Secondary</button>
          </div>
        </div>

        <!-- Card Spacing Example -->
        <div style="padding: 1.5rem; border: 1px solid var(--color-border, #d0d7de); border-radius: 8px;">
          <h3 style="margin-bottom: 1rem; font-size: 1.125rem; font-weight: 600;">Card Layout (space-6 padding)</h3>
          <div style="
            padding: var(--space-6, 1.5rem);
            background: var(--color-bg-secondary, #f6f8fa);
            border: 1px solid var(--color-border, #d0d7de);
            border-radius: 8px;
            max-width: 400px;
          ">
            <h4 style="margin: 0 0 var(--space-3, 0.75rem) 0; font-size: 1rem; font-weight: 600;">Card Title</h4>
            <p style="margin: 0 0 var(--space-4, 1rem) 0; color: var(--color-text-secondary, #656d76);">
              This card uses space-6 for internal padding and space-3/space-4 for content spacing.
            </p>
            <button style="
              padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
              background: var(--color-primary, #00ff41);
              color: var(--color-secondary, #0d1117);
              border: none;
              border-radius: 4px;
              font-size: 0.875rem;
              font-weight: 500;
              cursor: pointer;
            ">Action</button>
          </div>
        </div>

        <!-- Form Spacing Example -->
        <div style="padding: 1.5rem; border: 1px solid var(--color-border, #d0d7de); border-radius: 8px;">
          <h3 style="margin-bottom: 1rem; font-size: 1.125rem; font-weight: 600;">Form Layout (space-5 between fields)</h3>
          <div style="max-width: 300px;">
            <div style="margin-bottom: var(--space-5, 1.25rem);">
              <label style="display: block; margin-bottom: var(--space-2, 0.5rem); font-weight: 500; font-size: 0.875rem;">Email</label>
              <input type="email" style="
                width: 100%;
                padding: var(--space-3, 0.75rem);
                border: 1px solid var(--color-border, #d0d7de);
                border-radius: 6px;
                font-size: 1rem;
                box-sizing: border-box;
              " placeholder="your@email.com">
            </div>
            <div style="margin-bottom: var(--space-5, 1.25rem);">
              <label style="display: block; margin-bottom: var(--space-2, 0.5rem); font-weight: 500; font-size: 0.875rem;">Password</label>
              <input type="password" style="
                width: 100%;
                padding: var(--space-3, 0.75rem);
                border: 1px solid var(--color-border, #d0d7de);
                border-radius: 6px;
                font-size: 1rem;
                box-sizing: border-box;
              " placeholder="••••••••">
            </div>
            <button style="
              width: 100%;
              padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
              background: var(--color-primary, #00ff41);
              color: var(--color-secondary, #0d1117);
              border: none;
              border-radius: 6px;
              font-weight: 500;
              cursor: pointer;
            ">Sign In</button>
          </div>
        </div>
      </div>
    </div>
  `,
};