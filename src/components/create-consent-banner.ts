import { ConsentBanner, ConsentBannerProps } from './consent-banner';

/**
 * Mounts a ConsentBanner component to the given DOM node.
 * Returns the instance for further control.
 */
export async function createConsentBanner(props: ConsentBannerProps, mountNode?: HTMLElement): Promise<ConsentBanner> {
  const node = mountNode || document.body;
  const banner = new ConsentBanner(props);
  banner.mount(node);
  return banner;
}
