import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const isStandaloneMode = () => {
  if (typeof window === 'undefined') return false;

  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer?.startsWith('android-app://')
  );
};

const isIosDevice = () => {
  if (typeof navigator === 'undefined') return false;

  const userAgent = navigator.userAgent || navigator.vendor || '';
  const iOSByUA = /iPad|iPhone|iPod/.test(userAgent);
  const iPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;

  return iOSByUA || iPadOs;
};

const isIosSafari = () => {
  if (!isIosDevice() || typeof navigator === 'undefined') return false;

  const userAgent = navigator.userAgent || '';
  const isWebkit = /WebKit/i.test(userAgent);
  const isOtherIOSBrowser = /(CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo)/i.test(userAgent);

  return isWebkit && !isOtherIOSBrowser;
};

const isMobileOrTabletDevice = () => {
  if (typeof navigator === 'undefined') return false;

  const userAgent = navigator.userAgent || navigator.vendor || '';
  const mobileOrTabletByUA =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(userAgent);

  return mobileOrTabletByUA || isIosDevice();
};

const isDesktopEnvironment = () => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (isMobileOrTabletDevice()) return false;

  const isLargeScreen = window.matchMedia?.('(min-width: 1024px)').matches;
  const hasDesktopInputs =
    window.matchMedia?.('(hover: hover)').matches && window.matchMedia?.('(pointer: fine)').matches;

  return Boolean(isLargeScreen && hasDesktopInputs);
};

export default function InstallPromptBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isEligibleIosSafari, setIsEligibleIosSafari] = useState(false);
  const [isHidden, setIsHidden] = useState(true);
  const [isReadyToShow, setIsReadyToShow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (isStandaloneMode() || isDesktopEnvironment()) {
      return;
    }

    setIsEligibleIosSafari(isIosSafari());

    const revealTimer = window.setTimeout(() => {
      setIsReadyToShow(true);
      setIsHidden(false);
    }, 800);

    const onBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };

    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setIsHidden(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.clearTimeout(revealTimer);
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const mode = useMemo(() => {
    if (deferredPrompt) return 'android';
    if (isEligibleIosSafari) return 'ios';
    return null;
  }, [deferredPrompt, isEligibleIosSafari]);

  if (!isReadyToShow || isHidden || !mode) {
    return null;
  }

  const dismiss = () => {
    setIsHidden(true);
  };

  const onInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    setDeferredPrompt(null);

    setIsHidden(choiceResult?.outcome === 'accepted');
  };

  const isIosContent = mode === 'ios';

  return (
    <div className="fixed inset-x-3 bottom-3 z-[60] sm:inset-x-auto sm:right-6 sm:bottom-6 sm:max-w-sm">
      <div className="rounded-xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">
              {isIosContent ? 'Install this app on your iPhone' : 'Install App'}
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              {isIosContent
                ? 'Tap Share, click View More, then Add to Home Screen.'
                : 'Install this app for faster access and a full-screen experience.'}
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Dismiss install prompt"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex gap-2">
          {!isIosContent && (
            <Button size="sm" onClick={onInstallClick} className="text-xs">
              Install App
            </Button>
          )}
          {isIosContent && (
            <Button size="sm" variant="secondary" onClick={dismiss} className="text-xs">
              Got it
            </Button>
          )}
          {!isIosContent && (
            <Button size="sm" variant="ghost" onClick={dismiss} className="text-xs">
              Not now
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
