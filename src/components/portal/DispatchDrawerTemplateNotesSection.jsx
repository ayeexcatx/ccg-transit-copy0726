import React from 'react';
import { NOTE_TEXT_SIZE, NOTE_TYPES, renderSimpleMarkupToHtml } from '@/lib/templateNotes';

function getGeneralNoteLayout(note) {
  const bullets = note.bullet_lines?.length > 0
    ? note.bullet_lines
    : note.note_text
      ? [note.note_text]
      : [];

  const titleLength = (note.title || '').trim().length;
  const bulletLengths = bullets.map((line) => String(line || '').trim().length);
  const totalTextLength = titleLength + bulletLengths.reduce((sum, len) => sum + len, 0);
  const longestBulletLength = Math.max(0, ...bulletLengths);
  const bulletCount = bullets.length;

  const shouldSpanWide = (
    totalTextLength > 220
    || bulletCount >= 5
    || longestBulletLength > 90
    || (Boolean(note.title) && bulletCount >= 3 && totalTextLength > 150)
  );

  return {
    bullets,
    shouldSpanWide,
  };
}

function getNoteColumnClass(displayWidth, autoShouldSpanWide = false, NOTE_DISPLAY_WIDTH) {
  if (displayWidth === NOTE_DISPLAY_WIDTH.FULL) return 'col-span-4';
  if (displayWidth === NOTE_DISPLAY_WIDTH.HALF) return 'col-span-2';
  if (displayWidth === NOTE_DISPLAY_WIDTH.QUARTER) return 'col-span-1';
  return autoShouldSpanWide ? 'col-span-2' : 'col-span-1';
}

function getTextSizeClass(textSize) {
  if (textSize === NOTE_TEXT_SIZE.SMALL) return 'text-[8px]';
  if (textSize === NOTE_TEXT_SIZE.LARGE) return 'text-[11px]';
  return 'text-[9px]';
}

export default function DispatchDrawerTemplateNotesSection({ boxNotes, generalNotes, NOTE_DISPLAY_WIDTH }) {
  const unifiedNotes = [...boxNotes, ...generalNotes];

  if (unifiedNotes.length === 0) return null;

  return (
    <div data-tour="dispatch-notes" className="space-y-1">
      <div className="rounded-md border border-slate-700/50 bg-gradient-to-r from-slate-700/85 via-slate-700/65 to-slate-700/15 px-2 py-0.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-100">General Notes</p>
      </div>

      <div className="grid grid-cols-4 gap-.5 md:gap-.5">
        {unifiedNotes.map((n) => {
          const isBoxNote = n.note_type === NOTE_TYPES.BOX;
          const textSizeClass = getTextSizeClass(n.textSize);

          if (isBoxNote) {
            return (
              <div
                key={n.id}
                className={`rounded-md border p-1 md:p-1 ${getNoteColumnClass(n.displayWidth, false, NOTE_DISPLAY_WIDTH)}`}
                style={{ borderColor: n.border_color, color: n.text_color }}
              >
                {n.title && <p className={`${textSizeClass} font-semibold leading-snug mb-0.5`}>{n.title}</p>}
                <p
                  className={`${textSizeClass} leading-snug`}
                  dangerouslySetInnerHTML={{ __html: renderSimpleMarkupToHtml(n.box_content || n.note_text) }}
                />
              </div>
            );
          }

          const { bullets, shouldSpanWide } = getGeneralNoteLayout(n);

          if (bullets.length === 0 && !n.title) return null;

          return (
            <div
              key={n.id}
              className={`rounded-md border border-slate-200 bg-white/90 p-1 md:p-1 ${getNoteColumnClass(n.displayWidth, shouldSpanWide, NOTE_DISPLAY_WIDTH)}`}
            >
              {n.title && <p className={`${textSizeClass} text-slate-700 font-semibold leading-snug mb-0.5`}>{n.title}</p>}
              <ul className="mt-0.5 space-y-0 list-disc ml-3.5">
                {bullets.map((line, idx) => (
                  <li key={`${n.id}-${idx}`} className={`${textSizeClass} text-slate-600 leading-snug`}>{line}</li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { NOTE_TYPES };
