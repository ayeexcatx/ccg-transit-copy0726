import React from 'react';

export default function DriverProtocolContent({ contentHtml }) {
  if (!contentHtml) {
    return <p className="text-sm text-slate-500">No driver protocol has been published yet.</p>;
  }

  return (
    <div
      className="driver-protocol-content space-y-4 text-base leading-7 tracking-[0.005em] text-slate-700 font-['Inter',_'Segoe_UI',_Roboto,_'Helvetica_Neue',_Arial,_sans-serif] [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mb-1 [&_.ql-indent-1]:ml-6 [&_.ql-indent-2]:ml-12 [&_.ql-indent-3]:ml-[4.5rem] [&_.ql-indent-4]:ml-24 [&_.ql-indent-5]:ml-[7.5rem] [&_.ql-indent-6]:ml-36 [&_.ql-indent-7]:ml-[10.5rem] [&_.ql-indent-8]:ml-48 [&_.ql-indent-9]:ml-[13.5rem]"
      dangerouslySetInnerHTML={{ __html: contentHtml }}
    />
  );
}
