import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CircleHelp } from 'lucide-react';
import TutorialOverlay from './TutorialOverlay';
import TutorialWelcomeModal from './TutorialWelcomeModal';
import useTutorialRunner from './useTutorialRunner';
import {
  COMPANY_OWNER_TUTORIAL_ID,
  COMPANY_OWNER_TUTORIAL_LANGUAGE,
  tutorialRegistry,
} from './tutorialConfig';
import { buildTutorialStorageKey } from './tutorialStorage';

const TutorialContext = createContext({
  startTutorial: () => {},
  openTutorialWelcome: () => {},
});

const DEBUG_TUTORIAL_SCROLL = false;

const COMPANY_OWNER_HOME_TUTORIAL_ENABLED = false;

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

export default function TutorialProvider({ session, children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isCompanyOwner = session?.code_type === 'CompanyOwner';

  const tutorialConfig = tutorialRegistry[COMPANY_OWNER_TUTORIAL_ID];
  const { seen: seenKeyBase, completed: completedKeyBase, dismissed: dismissedKeyBase } = tutorialConfig.storageKeys;
  const seenKey = useMemo(() => buildTutorialStorageKey(seenKeyBase, session, 'user'), [seenKeyBase, session]);
  const completedKey = useMemo(() => buildTutorialStorageKey(completedKeyBase, session, 'user'), [completedKeyBase, session]);
  const dismissedKey = useMemo(() => buildTutorialStorageKey(dismissedKeyBase, session, 'user'), [dismissedKeyBase, session]);

  const [isRunning, setIsRunning] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(tutorialConfig.defaultLanguage);
  const [isDispatchDrawerOpen, setIsDispatchDrawerOpen] = useState(() => (
    typeof window !== 'undefined' && window.__dispatchDetailDrawerOpen === true
  ));

  const activeSteps = tutorialConfig.stepsByLanguage[selectedLanguage] || tutorialConfig.stepsByLanguage[tutorialConfig.defaultLanguage];
  const activeCompletionStep = tutorialConfig.completionStepsByLanguage[selectedLanguage]
    || tutorialConfig.completionStepsByLanguage[tutorialConfig.defaultLanguage];

  const {
    totalSteps,
    stepIndex,
    targetRect,
    isCompletion,
    currentStep,
    tooltipStyle,
    handleStepChange,
    setStepIndex,
    setTargetRect,
  } = useTutorialRunner({
    steps: activeSteps,
    active: isRunning,
    getCurrentTarget: (step) => step?.target,
    getScrollContainer: (step) => step?.scrollContainer || null,
  });

  const stopTutorial = useCallback(() => {
    setIsRunning(false);
    setTargetRect(null);
  }, [setTargetRect]);

  const startTutorial = useCallback((language = tutorialConfig.defaultLanguage) => {
    if (!COMPANY_OWNER_HOME_TUTORIAL_ENABLED) return;
    if (!isCompanyOwner) return;
    setSelectedLanguage(language);
    setShowWelcome(false);
    setStepIndex(0);
    setIsRunning(true);
  }, [isCompanyOwner, setStepIndex, tutorialConfig.defaultLanguage]);

  const openTutorialWelcome = useCallback(({ markSeen = false } = {}) => {
    if (!COMPANY_OWNER_HOME_TUTORIAL_ENABLED) return;
    if (!isCompanyOwner) return;
    if (markSeen) {
      localStorage.setItem(seenKey, 'true');
    }
    stopTutorial();
    setShowWelcome(true);
  }, [isCompanyOwner, seenKey, stopTutorial]);

  const startEnglishTutorial = useCallback(() => {
    startTutorial(COMPANY_OWNER_TUTORIAL_LANGUAGE.ENGLISH);
  }, [startTutorial]);

  const startPortugueseTutorial = useCallback(() => {
    startTutorial(COMPANY_OWNER_TUTORIAL_LANGUAGE.PORTUGUESE);
  }, [startTutorial]);

  const markCompleted = useCallback(() => {
    localStorage.setItem(seenKey, 'true');
    localStorage.setItem(completedKey, 'true');
  }, [completedKey, seenKey]);

  const handleSkipForNow = useCallback(() => {
    setShowWelcome(false);
    stopTutorial();
  }, [stopTutorial]);

  const handleDismissPermanently = useCallback(() => {
    localStorage.setItem(seenKey, 'true');
    localStorage.setItem(dismissedKey, 'true');
    setShowWelcome(false);
    stopTutorial();
  }, [dismissedKey, seenKey, stopTutorial]);

  const handleFinish = useCallback(() => {
    markCompleted();
    stopTutorial();
  }, [markCompleted, stopTutorial]);

  const goToNextStep = useCallback(() => {
    if (isCompletion) {
      handleFinish();
      return;
    }
    handleStepChange(stepIndex + 1);
  }, [handleFinish, handleStepChange, isCompletion, stepIndex]);

  const goToPreviousStep = useCallback(() => {
    if (isCompletion) {
      handleStepChange(totalSteps - 1);
      return;
    }
    handleStepChange(stepIndex - 1);
  }, [handleStepChange, isCompletion, stepIndex, totalSteps]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const syncDispatchDrawerOpen = (event) => {
      if (typeof event?.detail?.open === 'boolean') {
        setIsDispatchDrawerOpen(event.detail.open);
        return;
      }
      setIsDispatchDrawerOpen(window.__dispatchDetailDrawerOpen === true);
    };

    window.addEventListener('dispatch-detail-drawer-state', syncDispatchDrawerOpen);

    return () => {
      window.removeEventListener('dispatch-detail-drawer-state', syncDispatchDrawerOpen);
    };
  }, []);

  useEffect(() => {
    if (!COMPANY_OWNER_HOME_TUTORIAL_ENABLED) {
      setShowWelcome(false);
      stopTutorial();
      return;
    }

    if (!isCompanyOwner) {
      setShowWelcome(false);
      stopTutorial();
      return;
    }

    const seen = localStorage.getItem(seenKey) === 'true';
    const dismissed = localStorage.getItem(dismissedKey) === 'true';
    const completed = localStorage.getItem(completedKey) === 'true';

    if (!seen && !dismissed && !completed) {
      openTutorialWelcome({ markSeen: true });
    }
  }, [completedKey, dismissedKey, isCompanyOwner, openTutorialWelcome, seenKey, stopTutorial]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    window.__tutorialActive = isRunning;
    logTutorialScroll('tutorial active state updated', { isRunning, stepIndex, page: currentStep?.page || null, language: selectedLanguage });

    return () => {
      window.__tutorialActive = false;
      logTutorialScroll('tutorial active state cleared');
    };
  }, [currentStep?.page, isRunning, selectedLanguage, stepIndex]);

  useEffect(() => {
    if (!isRunning || isCompletion || !currentStep?.page) return;
    if (location.pathname !== currentStep.page) {
      navigate(currentStep.page);
    }
  }, [currentStep?.page, isCompletion, isRunning, location.pathname, navigate]);

  const value = useMemo(() => ({ startTutorial, openTutorialWelcome }), [openTutorialWelcome, startTutorial]);

  return (
    <TutorialContext.Provider value={value}>
      {children}

      {COMPANY_OWNER_HOME_TUTORIAL_ENABLED && isCompanyOwner && !isDispatchDrawerOpen && (
        <Button
          type="button"
          size="sm"
          variant="default"
          onClick={openTutorialWelcome}
          className="fixed bottom-5 right-5 z-[180] border border-blue-700 bg-blue-600 text-white shadow-lg hover:bg-blue-700 focus-visible:ring-blue-500"
        >
          <CircleHelp className="mr-1 h-4 w-4" />
          Tutorial
        </Button>
      )}

      <TutorialWelcomeModal
        open={showWelcome}
        onStart={startEnglishTutorial}
        onStartPortuguese={startPortugueseTutorial}
        onSkip={handleSkipForNow}
        onDismiss={handleDismissPermanently}
      />

      <TutorialOverlay
        active={isRunning}
        targetRect={targetRect}
        tooltipStyle={tooltipStyle}
        step={isCompletion ? activeCompletionStep : currentStep}
        stepIndex={stepIndex}
        totalSteps={totalSteps}
        isCompletion={isCompletion}
        onBack={goToPreviousStep}
        onNext={goToNextStep}
        onSkip={handleSkipForNow}
        onFinish={handleFinish}
        onReplay={openTutorialWelcome}
      />
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  return useContext(TutorialContext);
}