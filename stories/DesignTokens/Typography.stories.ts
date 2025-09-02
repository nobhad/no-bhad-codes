import type { Meta, StoryObj } from '@storybook/html';

const meta: Meta = {
  title: 'Design Tokens/Typography',
  parameters: {
    docs: {
      description: {
        component: 'Typography scale and font tokens used throughout the No Bhad Codes design system.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

export const FontSizes: Story = {
  render: () => `
    <div style="font-family: var(--font-family-base, system-ui); color: var(--color-text-primary, #24292f);">
      <div style="margin-bottom: 2rem;">
        <h2 style="margin-bottom: 1rem; font-size: 1.5rem; font-weight: 600;">Font Scale</h2>
        <p style="color: var(--color-text-secondary, #656d76); margin-bottom: 2rem;">
          Our typography scale follows a modular scale for consistent rhythm and hierarchy.
        </p>
      </div>
      
      <div style="display: flex; flex-direction: column; gap: 1.5rem;">
        <div style="display: flex; align-items: center; gap: 2rem; padding: 1rem; border: 1px solid var(--color-border, #d0d7de); border-radius: 6px;">
          <div style="min-width: 120px; font-size: 0.875rem; color: var(--color-text-secondary, #656d76); font-family: monospace;">
            --font-size-xs<br>0.75rem / 12px
          </div>
          <div style="font-size: var(--font-size-xs, 0.75rem);">
            Extra small text for captions and fine print
          </div>
        </div>
        
        <div style="display: flex; align-items: center; gap: 2rem; padding: 1rem; border: 1px solid var(--color-border, #d0d7de); border-radius: 6px;">
          <div style="min-width: 120px; font-size: 0.875rem; color: var(--color-text-secondary, #656d76); font-family: monospace;">
            --font-size-sm<br>0.875rem / 14px
          </div>
          <div style="font-size: var(--font-size-sm, 0.875rem);">
            Small text for secondary information and labels
          </div>
        </div>
        
        <div style="display: flex; align-items: center; gap: 2rem; padding: 1rem; border: 1px solid var(--color-border, #d0d7de); border-radius: 6px;">
          <div style="min-width: 120px; font-size: 0.875rem; color: var(--color-text-secondary, #656d76); font-family: monospace;">
            --font-size-base<br>1rem / 16px
          </div>
          <div style="font-size: var(--font-size-base, 1rem);">
            Base text size for body content and paragraphs
          </div>
        </div>
        
        <div style="display: flex; align-items: center; gap: 2rem; padding: 1rem; border: 1px solid var(--color-border, #d0d7de); border-radius: 6px;">
          <div style="min-width: 120px; font-size: 0.875rem; color: var(--color-text-secondary, #656d76); font-family: monospace;">
            --font-size-lg<br>1.125rem / 18px
          </div>
          <div style="font-size: var(--font-size-lg, 1.125rem);">
            Large text for emphasized content and lead paragraphs
          </div>
        </div>
        
        <div style="display: flex; align-items: center; gap: 2rem; padding: 1rem; border: 1px solid var(--color-border, #d0d7de); border-radius: 6px;">
          <div style="min-width: 120px; font-size: 0.875rem; color: var(--color-text-secondary, #656d76); font-family: monospace;">
            --font-size-xl<br>1.25rem / 20px
          </div>
          <div style="font-size: var(--font-size-xl, 1.25rem);">
            Extra large text for minor headings and callouts
          </div>
        </div>
        
        <div style="display: flex; align-items: center; gap: 2rem; padding: 1rem; border: 1px solid var(--color-border, #d0d7de); border-radius: 6px;">
          <div style="min-width: 120px; font-size: 0.875rem; color: var(--color-text-secondary, #656d76); font-family: monospace;">
            --font-size-2xl<br>1.5rem / 24px
          </div>
          <div style="font-size: var(--font-size-2xl, 1.5rem);">
            Double extra large for section headings
          </div>
        </div>
        
        <div style="display: flex; align-items: center; gap: 2rem; padding: 1rem; border: 1px solid var(--color-border, #d0d7de); border-radius: 6px;">
          <div style="min-width: 120px; font-size: 0.875rem; color: var(--color-text-secondary, #656d76); font-family: monospace;">
            --font-size-3xl<br>1.875rem / 30px
          </div>
          <div style="font-size: var(--font-size-3xl, 1.875rem);">
            Triple extra large for page headings
          </div>
        </div>
        
        <div style="display: flex; align-items: center; gap: 2rem; padding: 1rem; border: 1px solid var(--color-border, #d0d7de); border-radius: 6px;">
          <div style="min-width: 120px; font-size: 0.875rem; color: var(--color-text-secondary, #656d76); font-family: monospace;">
            --font-size-4xl<br>2.25rem / 36px
          </div>
          <div style="font-size: var(--font-size-4xl, 2.25rem);">
            Hero text for display purposes
          </div>
        </div>
      </div>
    </div>
  `,
};

export const FontWeights: Story = {
  render: () => `
    <div style="font-family: var(--font-family-base, system-ui); color: var(--color-text-primary, #24292f);">
      <div style="margin-bottom: 2rem;">
        <h2 style="margin-bottom: 1rem; font-size: 1.5rem; font-weight: 600;">Font Weights</h2>
        <p style="color: var(--color-text-secondary, #656d76); margin-bottom: 2rem;">
          Consistent font weights for different levels of emphasis and hierarchy.
        </p>
      </div>
      
      <div style="display: flex; flex-direction: column; gap: 1.5rem;">
        <div style="display: flex; align-items: center; gap: 2rem; padding: 1rem; border: 1px solid var(--color-border, #d0d7de); border-radius: 6px;">
          <div style="min-width: 100px; font-size: 0.875rem; color: var(--color-text-secondary, #656d76); font-family: monospace;">
            --font-weight-light<br>300
          </div>
          <div style="font-size: 1.125rem; font-weight: var(--font-weight-light, 300);">
            Light weight for subtle text and large displays
          </div>
        </div>
        
        <div style="display: flex; align-items: center; gap: 2rem; padding: 1rem; border: 1px solid var(--color-border, #d0d7de); border-radius: 6px;">
          <div style="min-width: 100px; font-size: 0.875rem; color: var(--color-text-secondary, #656d76); font-family: monospace;">
            --font-weight-normal<br>400
          </div>
          <div style="font-size: 1.125rem; font-weight: var(--font-weight-normal, 400);">
            Normal weight for body text and regular content
          </div>
        </div>
        
        <div style="display: flex; align-items: center; gap: 2rem; padding: 1rem; border: 1px solid var(--color-border, #d0d7de); border-radius: 6px;">
          <div style="min-width: 100px; font-size: 0.875rem; color: var(--color-text-secondary, #656d76); font-family: monospace;">
            --font-weight-medium<br>500
          </div>
          <div style="font-size: 1.125rem; font-weight: var(--font-weight-medium, 500);">
            Medium weight for emphasized text and navigation
          </div>
        </div>
        
        <div style="display: flex; align-items: center; gap: 2rem; padding: 1rem; border: 1px solid var(--color-border, #d0d7de); border-radius: 6px;">
          <div style="min-width: 100px; font-size: 0.875rem; color: var(--color-text-secondary, #656d76); font-family: monospace;">
            --font-weight-semibold<br>600
          </div>
          <div style="font-size: 1.125rem; font-weight: var(--font-weight-semibold, 600);">
            Semi-bold weight for headings and important information
          </div>
        </div>
        
        <div style="display: flex; align-items: center; gap: 2rem; padding: 1rem; border: 1px solid var(--color-border, #d0d7de); border-radius: 6px;">
          <div style="min-width: 100px; font-size: 0.875rem; color: var(--color-text-secondary, #656d76); font-family: monospace;">
            --font-weight-bold<br>700
          </div>
          <div style="font-size: 1.125rem; font-weight: var(--font-weight-bold, 700);">
            Bold weight for strong emphasis and call-to-action text
          </div>
        </div>
      </div>
    </div>
  `,
};

export const FontFamilies: Story = {
  render: () => `
    <div style="color: var(--color-text-primary, #24292f);">
      <div style="margin-bottom: 2rem;">
        <h2 style="margin-bottom: 1rem; font-size: 1.5rem; font-weight: 600; font-family: var(--font-family-base, system-ui);">Font Families</h2>
        <p style="color: var(--color-text-secondary, #656d76); margin-bottom: 2rem; font-family: var(--font-family-base, system-ui);">
          Carefully selected font stacks optimized for performance and readability across all platforms.
        </p>
      </div>
      
      <div style="display: flex; flex-direction: column; gap: 2rem;">
        <div style="padding: 1.5rem; border: 1px solid var(--color-border, #d0d7de); border-radius: 8px;">
          <div style="margin-bottom: 1rem;">
            <div style="font-size: 0.875rem; color: var(--color-text-secondary, #656d76); font-family: monospace; margin-bottom: 0.5rem;">
              --font-family-base
            </div>
            <div style="font-size: 0.75rem; color: var(--color-text-secondary, #656d76); font-family: monospace; margin-bottom: 1rem;">
              system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif
            </div>
          </div>
          <div style="font-family: var(--font-family-base, system-ui); font-size: 1.125rem; line-height: 1.6;">
            The quick brown fox jumps over the lazy dog. This is our primary font family used for all body text, headings, and interface elements. It provides excellent readability and consistent rendering across all operating systems.
          </div>
        </div>
        
        <div style="padding: 1.5rem; border: 1px solid var(--color-border, #d0d7de); border-radius: 8px;">
          <div style="margin-bottom: 1rem;">
            <div style="font-size: 0.875rem; color: var(--color-text-secondary, #656d76); font-family: monospace; margin-bottom: 0.5rem;">
              --font-family-mono
            </div>
            <div style="font-size: 0.75rem; color: var(--color-text-secondary, #656d76); font-family: monospace; margin-bottom: 1rem;">
              'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace
            </div>
          </div>
          <div style="font-family: var(--font-family-mono, monospace); font-size: 1rem; line-height: 1.5; background: #f6f8fa; padding: 1rem; border-radius: 4px;">
            const message = "Hello, World!";<br>
            function greet(name: string): string {<br>
            &nbsp;&nbsp;return \`Hello, \${name}!\`;<br>
            }<br><br>
            // Monospace font for code, data, and technical content
          </div>
        </div>
      </div>
    </div>
  `,
};

export const LineHeight: Story = {
  render: () => `
    <div style="font-family: var(--font-family-base, system-ui); color: var(--color-text-primary, #24292f);">
      <div style="margin-bottom: 2rem;">
        <h2 style="margin-bottom: 1rem; font-size: 1.5rem; font-weight: 600;">Line Heights</h2>
        <p style="color: var(--color-text-secondary, #656d76); margin-bottom: 2rem;">
          Consistent line heights for optimal readability and vertical rhythm.
        </p>
      </div>
      
      <div style="display: flex; flex-direction: column; gap: 1.5rem;">
        <div style="padding: 1rem; border: 1px solid var(--color-border, #d0d7de); border-radius: 6px;">
          <div style="font-size: 0.875rem; color: var(--color-text-secondary, #656d76); font-family: monospace; margin-bottom: 0.5rem;">
            --line-height-tight: 1.25
          </div>
          <div style="font-size: 1.125rem; line-height: var(--line-height-tight, 1.25);">
            Tight line height for headings and display text where vertical space is limited. This creates a more compact appearance suitable for titles and short text blocks.
          </div>
        </div>
        
        <div style="padding: 1rem; border: 1px solid var(--color-border, #d0d7de); border-radius: 6px;">
          <div style="font-size: 0.875rem; color: var(--color-text-secondary, #656d76); font-family: monospace; margin-bottom: 0.5rem;">
            --line-height-normal: 1.5
          </div>
          <div style="font-size: 1rem; line-height: var(--line-height-normal, 1.5);">
            Normal line height for most body text and interface elements. This provides good readability for longer content while maintaining a clean, professional appearance that works well across different screen sizes and devices.
          </div>
        </div>
        
        <div style="padding: 1rem; border: 1px solid var(--color-border, #d0d7de); border-radius: 6px;">
          <div style="font-size: 0.875rem; color: var(--color-text-secondary, #656d76); font-family: monospace; margin-bottom: 0.5rem;">
            --line-height-relaxed: 1.625
          </div>
          <div style="font-size: 1rem; line-height: var(--line-height-relaxed, 1.625);">
            Relaxed line height for longer form content where enhanced readability is important. This spacing works particularly well for blog posts, documentation, and other content where users will be reading for extended periods. The extra spacing reduces eye strain and improves comprehension.
          </div>
        </div>
        
        <div style="padding: 1rem; border: 1px solid var(--color-border, #d0d7de); border-radius: 6px;">
          <div style="font-size: 0.875rem; color: var(--color-text-secondary, #656d76); font-family: monospace; margin-bottom: 0.5rem;">
            --line-height-loose: 2
          </div>
          <div style="font-size: 1rem; line-height: var(--line-height-loose, 2);">
            Loose line height for maximum readability and accessibility. 
            
            This generous spacing is ideal for content that needs to be highly readable, such as legal text, terms of service, or content designed for users with visual impairments or reading difficulties.
          </div>
        </div>
      </div>
    </div>
  `,
};