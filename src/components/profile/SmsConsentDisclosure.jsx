import React from 'react';

export default function SmsConsentDisclosure() {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600">
      By enabling SMS notifications, you agree to receive work-related text messages from CCG Transit, including dispatch assignments, updates, amendments, cancellations, and operational alerts. Message frequency varies. Msg &amp; data rates may apply. Reply STOP to opt out. Reply HELP for help. View our{' '}
      <a
        href="https://ccgnj.com/privacy-policy"
        target="_blank"
        rel="noreferrer"
        className="font-medium text-slate-800 underline underline-offset-2 hover:text-slate-900"
      >
        Privacy Policy
      </a>
      . Need support? Email{' '}
      <a
        href="mailto:alex@ccgnj.com"
        className="font-medium text-slate-800 underline underline-offset-2 hover:text-slate-900"
      >
        alex@ccgnj.com
      </a>
      .
    </div>
  );
}
