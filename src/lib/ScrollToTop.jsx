import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const DEBUG_TUTORIAL_SCROLL = true;

const logTutorialScroll = (...args) => {
  if (!DEBUG_TUTORIAL_SCROLL) return;
  if (typeof window !== 'undefined') {
    window.__tutorialScrollDebugSeq = (window.__tutorialScrollDebugSeq || 0) + 1;
    const now = typeof performance !== 'undefined' ? performance.now().toFixed(1) : 'n/a';
    // eslint-disable-next-line no-console
    console.log(`[TutorialScroll][#${window.__tutorialScrollDebugSeq}][t=${now}]`, ...args);
    return;
  }
  // eslint-disable-next-line no-console
  console.log('[TutorialScroll]', ...args);
};

export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    const tutorialActive = typeof window !== 'undefined' && window.__tutorialActive === true;

    logTutorialScroll('route scroll reset triggered', {
      pathname,
      tutorialActive,
      scrollYBefore: typeof window !== 'undefined' ? window.scrollY : 0,
    });

    if (tutorialActive) {
      logTutorialScroll('route scroll reset skipped because tutorial is active', { pathname });
      return;
    }

    window.scrollTo(0, 0);

    logTutorialScroll('route scroll reset applied', {
      pathname,
      scrollYAfter: window.scrollY,
    });
  }, [pathname]);

  return null;
}
