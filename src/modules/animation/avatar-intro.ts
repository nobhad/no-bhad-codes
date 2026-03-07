/**
 * Avatar SVG Introduction Animation
 * @file src/modules/animation/avatar-intro.ts
 *
 * Displays the coyote avatar SVG with a fade-in animation.
 * Extracted from terminal-intake-ui.ts for use by the about-hero module.
 */

import { gsap } from 'gsap';

const AVATAR_FADE_DURATION = 0.5;
const AVATAR_FADE_DELAY = 500;

function scrollToBottom(container: HTMLElement): void {
  container.scrollTop = container.scrollHeight;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Show the avatar introduction animation.
 * Fetches the SVG, inlines it for path animation, and fades it in.
 */
export async function showAvatarIntro(chatContainer: HTMLElement): Promise<void> {
  const avatarContainer = document.createElement('div');
  avatarContainer.className = 'terminal-avatar-intro';

  const wrapper = document.createElement('div');
  wrapper.className = 'terminal-avatar-wrapper';
  avatarContainer.appendChild(wrapper);

  avatarContainer.style.opacity = '0';
  chatContainer.appendChild(avatarContainer);
  scrollToBottom(chatContainer);

  try {
    const response = await fetch('/images/avatar_terminal.svg');
    const svgText = await response.text();

    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
    const svgElement = svgDoc.querySelector('svg');

    if (svgElement) {
      svgElement.classList.add('terminal-avatar-img');

      // Fix relative image paths to absolute paths when SVG is inlined
      const images = svgElement.querySelectorAll('image');
      images.forEach((img) => {
        const href = img.getAttribute('xlink:href') || img.getAttribute('href');
        if (
          href &&
          !href.startsWith('/') &&
          !href.startsWith('data:') &&
          !href.startsWith('http')
        ) {
          img.setAttribute('xlink:href', `/images/${href}`);
          img.setAttribute('href', `/images/${href}`);
        }
      });

      wrapper.appendChild(svgElement);

      gsap.to(avatarContainer, {
        opacity: 1,
        duration: AVATAR_FADE_DURATION,
        ease: 'power2.out'
      });

      await delay(AVATAR_FADE_DELAY);
    }
  } catch {
    wrapper.innerHTML =
      '<img src="/images/avatar_terminal.svg" alt="No Bhad Codes" class="terminal-avatar-img" />';
    gsap.to(avatarContainer, {
      opacity: 1,
      duration: AVATAR_FADE_DURATION,
      ease: 'power2.out'
    });
    await delay(AVATAR_FADE_DELAY);
  }
}
