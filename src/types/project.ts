/**
 * ===============================================
 * PROJECT TYPE DEFINITIONS
 * ===============================================
 * @file src/types/project.ts
 *
 * Type definitions for portfolio projects and related data structures.
 */

export type ProjectCategory = 'websites' | 'applications' | 'e-commerce' | 'extensions';
export type ProjectStatus = 'completed' | 'in-progress' | 'planned';

export interface Project {
  id: string;
  title: string;
  slug: string; // URL-friendly version of title
  description: string;
  longDescription?: string;
  category: ProjectCategory;
  technologies: string[];
  date: string; // ISO date string
  status: ProjectStatus;
  featured: boolean;
  images: ProjectImage[];
  liveUrl?: string;
  codeUrl?: string;
  clientName?: string;
  testimonial?: string;
  challenges?: string[];
  solutions?: string[];
  results?: ProjectResult[];
}

export interface ProjectImage {
  url: string;
  alt: string;
  caption?: string;
  isHero?: boolean;
  isThumbnail?: boolean;
}

export interface ProjectResult {
  metric: string;
  value: string;
  description?: string;
}

export interface ProjectFilter {
  category?: ProjectCategory;
  status?: ProjectStatus;
  featured?: boolean;
  technologies?: string[];
  searchQuery?: string;
}

export interface ProjectCollection {
  projects: Project[];
  categories: ProjectCategoryInfo[];
  totalCount: number;
  featuredCount: number;
}

export interface ProjectCategoryInfo {
  id: ProjectCategory;
  name: string;
  description: string;
  count: number;
  icon?: string;
}

// Sample project data structure
export const PROJECT_CATEGORIES: ProjectCategoryInfo[] = [
  {
    id: 'websites',
    name: 'Websites',
    description: 'Custom websites and landing pages',
    count: 0,
    icon: '🌐'
  },
  {
    id: 'applications',
    name: 'Applications',
    description: 'Web applications and SaaS platforms',
    count: 0,
    icon: '💻'
  },
  {
    id: 'e-commerce',
    name: 'E-Commerce',
    description: 'Online stores and marketplace solutions',
    count: 0,
    icon: '🛒'
  },
  {
    id: 'extensions',
    name: 'Extensions',
    description: 'Browser extensions and plugins',
    count: 0,
    icon: '🧩'
  }
];

// Helper function to generate slug from title
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Helper function to format date
export function formatProjectDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric'
  }).format(date);
}

// Helper function to get category info
export function getCategoryInfo(categoryId: ProjectCategory): ProjectCategoryInfo | undefined {
  return PROJECT_CATEGORIES.find((cat) => cat.id === categoryId);
}
