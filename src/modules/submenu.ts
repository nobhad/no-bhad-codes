/**
 * ===============================================
 * SUBMENU MODULE
 * ===============================================
 * @file src/modules/submenu.ts
 * @extends BaseModule
 *
 * Handles dropdown submenu functionality with smooth animations.
 * Manages open/close state and handles click interactions.
 */

import { BaseModule } from './base';
import type { ModuleOptions } from '../types/modules';

export class SubmenuModule extends BaseModule {
  private submenuToggles: NodeListOf<Element> | null = null;
  private currentOpenSubmenu: Element | null = null;
  private documentClickHandler: (event: Event) => void;

  constructor(options: ModuleOptions = {}) {
    super('SubmenuModule', options);
    this.documentClickHandler = this.handleDocumentClick.bind(this);
  }

  protected override async onInit(): Promise<void> {
    // Get all submenu toggle elements
    this.submenuToggles = document.querySelectorAll('[data-submenu-toggle]');

    if (this.submenuToggles) {
      this.setupSubmenuToggles();
    }

    // Close submenu when clicking outside
    document.addEventListener('click', this.documentClickHandler);
  }

  /**
   * Setup submenu toggle functionality
   */
  private setupSubmenuToggles(): void {
    if (!this.submenuToggles) return;

    this.submenuToggles.forEach((toggle) => {
      this.addEventListener(toggle, 'click', (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        this.toggleSubmenu(toggle);
      });
    });
  }

  /**
   * Toggle submenu open/closed state
   */
  private toggleSubmenu(toggle: Element): void {
    const menuItem = toggle.closest('.has-submenu');
    if (!menuItem) return;

    const isCurrentlyOpen = menuItem.classList.contains('submenu-open');

    // Close any currently open submenu
    if (this.currentOpenSubmenu && this.currentOpenSubmenu !== menuItem) {
      this.closeSubmenu(this.currentOpenSubmenu);
    }

    if (isCurrentlyOpen) {
      this.closeSubmenu(menuItem);
    } else {
      this.openSubmenu(menuItem);
    }
  }

  /**
   * Open submenu with animation
   */
  private openSubmenu(menuItem: Element): void {
    menuItem.classList.add('submenu-open');
    this.currentOpenSubmenu = menuItem;

    const submenu = menuItem.querySelector('.submenu') as HTMLElement;
    if (submenu) {
      // Calculate the actual height needed
      const submenuInner = submenu.querySelector('.submenu-inner') as HTMLElement;
      if (submenuInner) {
        const height = submenuInner.scrollHeight;
        submenu.style.maxHeight = `${height}px`;
      }
    }

    this.log('Submenu opened');
  }

  /**
   * Close submenu with animation
   */
  private closeSubmenu(menuItem: Element): void {
    menuItem.classList.remove('submenu-open');

    if (this.currentOpenSubmenu === menuItem) {
      this.currentOpenSubmenu = null;
    }

    const submenu = menuItem.querySelector('.submenu') as HTMLElement;
    if (submenu) {
      submenu.style.maxHeight = '0px';
    }

    this.log('Submenu closed');
  }

  /**
   * Handle clicks outside submenu to close it
   */
  private handleDocumentClick(event: Event): void {
    const target = event.target as Element;

    // If clicked outside of any submenu area, close open submenu
    if (!target.closest('.has-submenu') && this.currentOpenSubmenu) {
      this.closeSubmenu(this.currentOpenSubmenu);
    }
  }

  /**
   * Close all submenus (useful when main menu closes)
   */
  public closeAllSubmenus(): void {
    const openSubmenus = document.querySelectorAll('.has-submenu.submenu-open');
    openSubmenus.forEach(submenu => {
      this.closeSubmenu(submenu);
    });
    this.currentOpenSubmenu = null;
  }

  /**
   * Get currently open submenu
   */
  public getOpenSubmenu(): Element | null {
    return this.currentOpenSubmenu;
  }

  /**
   * Check if any submenu is open
   */
  public hasOpenSubmenu(): boolean {
    return this.currentOpenSubmenu !== null;
  }

  /**
   * Cleanup
   */
  protected override onDestroy(): void {
    // Remove document event listener
    document.removeEventListener('click', this.documentClickHandler);
    this.currentOpenSubmenu = null;
  }
}