import { useEffect } from 'react';
import { hideBottomBanner, showBottomBanner } from './admob';

/**
 * Show the bottom banner ad while the calling component is mounted, hide
 * it on unmount. No-op on the web build. Pages that should NOT show ads
 * (Solve / Practice / Camera) simply don't call this hook.
 */
export function useBottomBanner(): void {
  useEffect(() => {
    void showBottomBanner();
    return () => {
      void hideBottomBanner();
    };
  }, []);
}
