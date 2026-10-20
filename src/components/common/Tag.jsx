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
    leaf: 'bg-[#F0F7EE] border-[#C8DEC2] text-[#24693D]',
    green: 'bg-[#F6FFED] border-[#B7EB8F] text-[#389E0D]',
    blue: 'bg-[#E6F4FF] border-[#91CAFF] text-[#0958D9]',
    gold: 'bg-[#FFFBE6] border-[#FFE58F] text-[#D48806]',
    red: 'bg-[#FFF1F0] border-[#FFA39E] text-[#CF1322]',
    default: 'bg-[#F5F7F4] border-[#DCE5D8] text-[#5A6553]',
  };

  const borderClass = bordered ? 'border' : 'border-0';
  const selectedColor = colorMap[color] || colorMap.default;

  return (
    <span
      className={`inline-flex items-center text-xs px-2 py-0.5 rounded-md font-medium leading-normal gap-1 select-none shrink-0 ${borderClass} ${selectedColor} ${className}`}
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
