/**
 * ===============================================
 * PORTFOLIO DATA FETCH
 * ===============================================
 * @file src/services/portfolio-data.ts
 *
 * One request for /data/portfolio.json at a time, however many modules ask.
 * DataService and ProjectsModule both load the file during start-up and each
 * used to call fetch() itself, so a projects deep link fetched it two or three
 * times in a row — every one a round trip, even when the answer was a 304.
 * Callers that arrive while a request is in flight share it; a caller that
 * arrives after it has settled makes a fresh request, which the HTTP cache
 * answers (Vercel serves /data/*.json with max-age=3600). Nothing is kept
 * across requests, so a test that swaps the fetch response between cases sees
 * exactly what it stubbed.
 */

export const PORTFOLIO_DATA_URL = '/data/portfolio.json';

let inFlight: Promise<Response> | null = null;

export function fetchPortfolioJson(): Promise<Response> {
  if (!inFlight) {
    const request = fetch(PORTFOLIO_DATA_URL);
    inFlight = request;
    request.then(
      () => {
        if (inFlight === request) {
          inFlight = null;
        }
      },
      () => {
        if (inFlight === request) {
          inFlight = null;
        }
      }
    );
  }
  // Each caller reads its own copy — a Response body can be consumed once.
  // (Test doubles are plain objects without clone(); hand those over as-is.)
  return inFlight.then((res) => (typeof res.clone === 'function' ? res.clone() : res));
}
