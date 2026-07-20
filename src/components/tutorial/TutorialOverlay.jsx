import React from 'react';
import TutorialTooltip from './TutorialTooltip';

const OVERLAY_PADDING = 8;

const getCutoutPanels = (targetRect) => {
  if (!targetRect) return null;

  const top = Math.max(targetRect.top - OVERLAY_PADDING, 0);
  const left = Math.max(targetRect.left - OVERLAY_PADDING, 0);
  const right = Math.min(targetRect.right + OVERLAY_PADDING, window.innerWidth);
  const bottom = Math.min(targetRect.bottom + OVERLAY_PADDING, window.innerHeight);

  return {
    top,
    left,
    right,
    bottom,
    width: Math.max(right - left, 0),
    height: Math.max(bottom - top, 0),
  };
};

export default function TutorialOverlay({
  active,
  targetRect,
  tooltipStyle,
  step,
  stepIndex,
  totalSteps,
  isCompletion,
  onBack,
  onNext,
  onSkip,
  onFinish,
  onReplay,
}) {
  if (!active) return null;

  const cutout = targetRect && !isCompletion ? getCutoutPanels(targetRect) : null;

  return (
    <>
      {!cutout && <div className="fixed inset-0 z-[210] bg-slate-950/60 transition-opacity duration-200" />}
      {cutout && (
        <>
          <div
            className="pointer-events-none fixed z-[210] bg-slate-950/60 transition-all duration-200"
            style={{ top: 0, left: 0, right: 0, height: `${cutout.top}px` }}
          />
          <div
            className="pointer-events-none fixed z-[210] bg-slate-950/60 transition-all duration-200"
            style={{ top: `${cutout.top}px`, left: 0, width: `${cutout.left}px`, height: `${cutout.height}px` }}
          />
          <div
            className="pointer-events-none fixed z-[210] bg-slate-950/60 transition-all duration-200"
            style={{ top: `${cutout.top}px`, left: `${cutout.right}px`, right: 0, height: `${cutout.height}px` }}
          />
          <div
            className="pointer-events-none fixed z-[210] bg-slate-950/60 transition-all duration-200"
            style={{ top: `${cutout.bottom}px`, left: 0, right: 0, bottom: 0 }}
          />
        </>
      )}
      {cutout && (
        <div
          className="pointer-events-none fixed z-[220] rounded-xl border-2 border-white/95 shadow-[0_0_0_2px_rgba(255,255,255,0.95),0_0_48px_rgba(255,255,255,0.55)] transition-all duration-200"
          style={{
            top: `${cutout.top}px`,
            left: `${cutout.left}px`,
            width: `${cutout.width}px`,
            height: `${cutout.height}px`,
            backgroundColor: 'transparent',
          }}
        />
      )}
      <TutorialTooltip
        step={step}
        stepIndex={stepIndex}
        totalSteps={totalSteps}
        style={tooltipStyle}
        isFirst={stepIndex === 0}
        isLast={stepIndex === totalSteps - 1}
        isCompletion={isCompletion}
        onBack={onBack}
        onNext={onNext}
        onSkip={onSkip}
        onFinish={onFinish}
        onReplay={onReplay}
      />
    </>
  );
}
