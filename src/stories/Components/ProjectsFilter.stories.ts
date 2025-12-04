import type { Meta, StoryObj } from '@storybook/html';

const meta: Meta = {
  title: 'Components/Projects Filter',
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    activeFilter: {
      control: 'select',
      options: ['all', 'websites', 'applications', 'ecommerce', 'extensions'],
      description: 'Active filter',
    },
  },
  args: {
    activeFilter: 'all',
  },
};

export default meta;
type Story = StoryObj;

const createProjectsFilter = (args: any) => {
  const { activeFilter } = args;

  const filters = [
    { key: 'all', label: 'All Projects', count: 12 },
    { key: 'websites', label: 'Websites', count: 5 },
    { key: 'applications', label: 'Applications', count: 3 },
    { key: 'ecommerce', label: 'E-Commerce', count: 2 },
    { key: 'extensions', label: 'Extensions', count: 2 },
  ];

  return `
    <section class="projects-filter">
      <div class="container">
        <div class="filter-wrapper">
          <div class="filter-group" role="group" aria-label="Project filters">
            ${filters
              .map(
                (filter) => `
              <button class="filter-btn${activeFilter === filter.key ? ' active' : ''}" data-filter="${filter.key}">
                ${filter.label}
                <span class="filter-count" data-count="${filter.key}">${filter.count}</span>
              </button>
            `
              )
              .join('')}
          </div>
        </div>
      </div>
    </section>
  `;
};

export const AllProjects: Story = {
  render: createProjectsFilter,
};

export const WebsitesActive: Story = {
  args: {
    activeFilter: 'websites',
  },
  render: createProjectsFilter,
};

export const ApplicationsActive: Story = {
  args: {
    activeFilter: 'applications',
  },
  render: createProjectsFilter,
};

export const ExtensionsActive: Story = {
  args: {
    activeFilter: 'extensions',
  },
  render: createProjectsFilter,
};
