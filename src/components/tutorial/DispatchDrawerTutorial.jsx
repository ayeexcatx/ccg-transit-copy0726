import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CircleHelp } from 'lucide-react';
import TutorialOverlay from './TutorialOverlay';
import TutorialWelcomeModal from './TutorialWelcomeModal';
import useTutorialRunner from './useTutorialRunner';
import {
  DISPATCH_DRAWER_TUTORIAL_LANGUAGE,
  tutorialRegistry,
} from './tutorialConfig';
import { buildTutorialStorageKey } from './tutorialStorage';

export default function DispatchDrawerTutorial({ isOwner, drawerOpen, dispatchStatus, session }) {
  const tutorialConfig = tutorialRegistry.dispatchDrawer;
  const { seen: seenKeyBase, completed: completedKeyBase } = tutorialConfig.storageKeys;
  const seenKey = useMemo(() => buildTutorialStorageKey(seenKeyBase, session, 'user'), [seenKeyBase, session]);
  const completedKey = useMemo(() => buildTutorialStorageKey(completedKeyBase, session, 'user'), [completedKeyBase, session]);

  const [isRunning, setIsRunning] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(tutorialConfig.defaultLanguage);

  const activeSteps = tutorialConfig.stepsByLanguage[selectedLanguage]
    || tutorialConfig.stepsByLanguage[tutorialConfig.defaultLanguage];
  const activeCompletionStep = tutorialConfig.completionStepsByLanguage[selectedLanguage]
    || tutorialConfig.completionStepsByLanguage[tutorialConfig.defaultLanguage];

  const {
    totalSteps,
    stepIndex,
    targetRect,
    isCompletion,
    currentStep,
    handleStepChange,
    setStepIndex,
    setTargetRect,
    setTooltipVerticalLimit,
  } = useTutorialRunner({
    steps: activeSteps,
    active: isRunning,
    getCurrentTarget: (step) => step?.target,
    getScrollContainer: (step) => step?.scrollContainer || '[data-tutorial-scroll="drawer"]',
  });

  const stopTutorial = useCallback(() => {
    setIsRunning(false);
    setTargetRect(null);
  }, [setTargetRect]);

  const openTutorialWelcome = useCallback(({ markSeen = false } = {}) => {
    if (!isOwner || !drawerOpen) return;
    if (markSeen) {
      localStorage.setItem(seenKey, 'true');
    }
    stopTutorial();
    setShowWelcome(true);
  }, [drawerOpen, isOwner, seenKey, stopTutorial]);

  const startTutorial = useCallback((language = tutorialConfig.defaultLanguage) => {
    if (!isOwner || !drawerOpen) return;
    localStorage.setItem(seenKey, 'true');
    setSelectedLanguage(language);
    setShowWelcome(false);
    setStepIndex(0);
    setIsRunning(true);
  }, [drawerOpen, isOwner, seenKey, setStepIndex, tutorialConfig.defaultLanguage]);

  const startEnglishTutorial = useCallback(() => {
    startTutorial(DISPATCH_DRAWER_TUTORIAL_LANGUAGE.ENGLISH);
  }, [startTutorial]);

  const startPortugueseTutorial = useCallback(() => {
    startTutorial(DISPATCH_DRAWER_TUTORIAL_LANGUAGE.PORTUGUESE);
  }, [startTutorial]);

  const handleFinish = useCallback(() => {
    localStorage.setItem(seenKey, 'true');
    localStorage.setItem(completedKey, 'true');
    stopTutorial();
  }, [completedKey, seenKey, stopTutorial]);

  const handleSkipForNow = useCallback(() => {
    setShowWelcome(false);
    stopTutorial();
  }, [stopTutorial]);

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
    const isEligibleStatus = dispatchStatus !== 'Scheduled';
    if (!isOwner || !drawerOpen || !isEligibleStatus || isRunning || showWelcome) return;
    const seen = localStorage.getItem(seenKey) === 'true';
    if (!seen) {
      openTutorialWelcome({ markSeen: true });
    }
  }, [dispatchStatus, drawerOpen, isOwner, isRunning, openTutorialWelcome, seenKey, showWelcome]);

  useEffect(() => {
    if (!drawerOpen) {
      setShowWelcome(false);
      stopTutorial();
    }
  }, [drawerOpen, stopTutorial]);

  const tooltipStyle = useMemo(() => setTooltipVerticalLimit(260), [setTooltipVerticalLimit]);

  return (
    <>
      {isOwner && (
        <Button
          type="button"
          size="sm"
          variant="default"
          onClick={openTutorialWelcome}
          className="fixed bottom-5 right-4 z-50 h-9 rounded-full border border-blue-700 bg-blue-600 px-3 text-xs text-white shadow-md hover:bg-blue-700 focus-visible:ring-blue-500 sm:bottom-6 sm:right-5"
          data-tour="dispatch-tutorial-trigger"
        >
          <CircleHelp className="mr-1 h-3.5 w-3.5" />
          Tutorial
        </Button>
      )}

      <TutorialWelcomeModal
        open={showWelcome}
        title="Welcome to the Dispatch Detail Drawer Tutorial"
        description="This quick tour will walk you through the main actions and details available in the dispatch detail drawer."
        portugueseLabel="Inciar Tour em Portugues"
        showDismiss={false}
        onStart={startEnglishTutorial}
        onStartPortuguese={startPortugueseTutorial}
        onSkip={handleSkipForNow}
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
    </>
  );
}
