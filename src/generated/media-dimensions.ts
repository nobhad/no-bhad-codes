/**
 * GENERATED — do not edit. Run `npm run media:dimensions`.
 *
 * Intrinsic pixel size of every image referenced by public/data/portfolio.json,
 * so the case-study renderer can put width/height on its lazy <img> tags and
 * the browser reserves the right box before the file arrives.
 *
 * Keys are the paths exactly as they appear in the data, with {theme} already
 * expanded to each variant.
 */
export const MEDIA_DIMENSIONS: Readonly<Record<string, readonly [number, number]>> = {
  '/images/tv/title-cards/hedgewitch.webp': [2850, 2186],
  '/images/tv/title-cards/hedgewitch_bg.webp': [2850, 2186],
  '/images/tv/title-cards/no-bhad-codes.webp': [2850, 2186],
  '/images/tv/title-cards/no-bhad-codes_bg.webp': [2850, 2186],
  '/images/tv/title-cards/the-backend.webp': [2850, 2186],
  '/images/tv/title-cards/the-backend_bg.webp': [2850, 2186],
  '/portfolio/hedgewitch-horticulture/home-hero.gif': [760, 475],
  '/portfolio/nobhad-codes/intro-dark.gif': [700, 438],
  '/portfolio/nobhad-codes/intro-light.gif': [700, 438],
  '/portfolio/the-backend/pdfs/contract.png': [612, 792],
  '/portfolio/the-backend/pdfs/receipt.png': [612, 792],
  '/portfolio/the-backend/pdfs/sow.png': [612, 792],
  '/portfolio/the-backend/portal-login-dark.png': [1440, 900],
  '/portfolio/the-backend/portal-login-light.png': [1440, 900]
};

/** width/height attributes for an <img>, or '' when the file is not in the map. */
export function mediaSizeAttrs(path: string): string {
  const size = MEDIA_DIMENSIONS[path];
  return size ? ` width="${size[0]}" height="${size[1]}"` : '';
}
