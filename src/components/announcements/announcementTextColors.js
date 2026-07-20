export const ANNOUNCEMENT_TEXT_COLOR_OPTIONS = [
  { value: 'default', label: 'Default / Black', className: 'text-slate-900', cssColor: '#0f172a' },
  { value: 'red', label: 'Red', className: 'text-red-700', cssColor: '#b91c1c' },
  { value: 'blue', label: 'Blue', className: 'text-blue-700', cssColor: '#1d4ed8' },
  { value: 'green', label: 'Green', className: 'text-green-700', cssColor: '#15803d' },
  { value: 'orange', label: 'Orange', className: 'text-orange-700', cssColor: '#c2410c' },
  { value: 'purple', label: 'Purple', className: 'text-purple-700', cssColor: '#7e22ce' },
];

export const getAnnouncementTextColorOption = (value) => (
  ANNOUNCEMENT_TEXT_COLOR_OPTIONS.find((option) => option.value === value) || ANNOUNCEMENT_TEXT_COLOR_OPTIONS[0]
);
