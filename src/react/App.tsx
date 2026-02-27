import type { ReactNode } from 'react';

interface AppProps {
  children?: ReactNode;
}

/**
 * Root React application component
 * This serves as the entry point for React components mounted in the portal
 */
export function App({ children }: AppProps) {
  return <>{children}</>;
}

export default App;
