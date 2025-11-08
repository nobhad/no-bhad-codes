# Storybook Configuration

This directory contains the configuration for the No Bhad Codes design system documentation using Storybook.

## 📁 Structure

- `main.ts` - Main Storybook configuration
- `preview.ts` - Global story settings and decorators
- `README.md` - This documentation file

## 🎨 Features Configured

### Addons

- **@storybook/addon-docs** - Auto-generated documentation
- **@storybook/addon-controls** - Interactive component controls
- **@storybook/addon-actions** - Action logging
- **@storybook/addon-viewport** - Responsive testing
- **@storybook/addon-backgrounds** - Background variants
- **@storybook/addon-toolbars** - Custom toolbar controls
- **@storybook/addon-measure** - Element measurement
- **@storybook/addon-outline** - Visual debugging

### Theme Support

- Light/Dark theme switcher in toolbar
- CSS custom properties integration
- Design system colors and typography

### Viewport Testing

- Mobile (375px)
- Tablet (768px)  
- Desktop (1200px)
- Large Desktop (1920px)

### Background Testing

- Light (#ffffff)
- Dark (#0d1117)
- Brand (#00ff41)

## 🚀 Usage

### Development

```bash
npm run storybook
```

Starts the development server at <http://localhost:6006>

### Build

```bash
npm run build-storybook
```

Builds static Storybook for deployment

### Deploy

The built Storybook can be deployed to:

- GitHub Pages
- Netlify
- Vercel
- Any static hosting service

## 📝 Writing Stories

### File Naming

- Component stories: `ComponentName.stories.ts`
- Design token stories: `TokenName.stories.ts`
- Documentation: `PageName.mdx`

### Story Structure

```typescript
import type { Meta, StoryObj } from '@storybook/html';

const meta: Meta = {
  title: 'Category/ComponentName',
  parameters: {
    docs: {
      description: {
        component: 'Component description here.',
      },
    },
  },
  argTypes: {
    prop: {
      control: { type: 'select' },
      options: ['option1', 'option2'],
      description: 'Prop description',
    },
  },
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  args: {
    prop: 'default-value',
  },
  render: (args) => `<div>${args.prop}</div>`,
};
```

### MDX Documentation

```mdx
import { Meta, Canvas, Story } from '@storybook/blocks';

<Meta title="Category/PageName" />

# Page Title

Content goes here...

<Canvas>
  <Story of={ComponentStories.Default} />
</Canvas>
```

## 🎯 Best Practices

### Component Stories

- Include all prop variations
- Show different states (loading, error, etc.)
- Provide interactive examples
- Add clear descriptions

### Design Token Stories

- Show visual representations
- Include usage guidelines
- Provide code examples
- Document responsive behavior

### Documentation

- Write clear, concise descriptions
- Include usage examples
- Provide do's and don'ts
- Link to related components

## 🔧 Customization

### Adding New Addons

1. Install the addon: `npm install --save-dev @storybook/addon-name`
2. Add to `main.ts` addons array
3. Configure in `preview.ts` if needed

### Custom Decorators

Add global decorators in `preview.ts`:

```typescript
decorators: [
  (story) => `<div class="custom-wrapper">${story()}</div>`,
],
```

### Theme Customization

Modify the theme variables in `preview.ts` or create custom themes.

## 📊 Performance

### Bundle Analysis

- Stories are code-split automatically
- Only load required addons
- Optimize images and assets

### Best Practices

- Keep story files small
- Use lazy loading for complex examples  
- Minimize external dependencies
- Optimize CSS custom properties

---

This configuration provides a comprehensive documentation platform for the No Bhad Codes design system.
