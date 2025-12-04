import type { Meta, StoryObj } from '@storybook/html';

const meta: Meta = {
  title: 'Components/Footer',
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    year: {
      control: 'number',
      description: 'Copyright year',
    },
    siteName: {
      control: 'text',
      description: 'Site name',
    },
  },
  args: {
    year: 2025,
    siteName: 'NO BHAD CODES',
  },
};

export default meta;
type Story = StoryObj;

const createFooter = (args: any) => {
  const { year, siteName } = args;

  return `
    <footer class="footer">
      <div class="container is--full">
        <p class="footer-text">© <span id="current-year">${year}</span> ${siteName}. All rights reserved.</p>
      </div>
    </footer>
  `;
};

export const Default: Story = {
  render: createFooter,
};

export const CustomText: Story = {
  args: {
    year: 2024,
    siteName: 'Custom Company',
  },
  render: createFooter,
};
