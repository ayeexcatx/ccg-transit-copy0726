import React from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const modules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'underline'],
    [{ color: [] }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ indent: '-1' }, { indent: '+1' }],
    ['clean'],
  ],
};

const formats = ['header', 'bold', 'underline', 'color', 'list', 'bullet', 'indent'];

export default function DriverProtocolEditor({ value, onChange }) {
  return (
    <ReactQuill
      theme="snow"
      value={value}
      onChange={onChange}
      modules={modules}
      formats={formats}
      className="[&_.ql-editor]:min-h-[320px] [&_.ql-editor]:text-base [&_.ql-editor]:leading-7 [&_.ql-editor]:tracking-[0.005em] [&_.ql-editor]:font-['Inter',_'Segoe_UI',_Roboto,_'Helvetica_Neue',_Arial,_sans-serif]"
    />
  );
}
