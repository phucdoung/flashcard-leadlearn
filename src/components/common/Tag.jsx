import React from 'react';

/**
 * Ant Design-inspired Tag Component for LeafLearn
 */
export default function Tag({
  children,
  color = 'default', // 'leaf' | 'green' | 'blue' | 'gold' | 'red' | 'default'
  bordered = true,
  closable = false,
  onClose,
  icon = null,
  className = '',
  ...props
}) {
  const colorMap = {
    leaf: 'bg-[#1b4332]/8 border-[#1b4332]/15 text-[#1b4332]',
    green: 'bg-[#1b4332]/8 border-[#1b4332]/15 text-[#1b4332]',
    blue: 'bg-sky-50 border-sky-200 text-sky-700',
    gold: 'bg-amber-50 border-amber-200 text-amber-700',
    red: 'bg-rose-50 border-rose-200 text-rose-700',
    default: 'bg-slate-100 border-slate-200 text-slate-600',
  };

  const borderClass = bordered ? 'border' : 'border-0';
  const selectedColor = colorMap[color] || colorMap.default;

  return (
    <span
      className={`inline-flex items-center text-xs px-2.5 py-0.5 rounded-md font-medium leading-normal gap-1 select-none shrink-0 ${borderClass} ${selectedColor} ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0 flex items-center justify-center">{icon}</span>}
      <span>{children}</span>
      {closable && (
        <button
          type="button"
          onClick={onClose}
          className="ml-0.5 hover:opacity-75 cursor-pointer focus:outline-none p-0.5"
          aria-label="Xóa nhãn"
        >
          <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      )}
    </span>
  );
}
