import React from 'react';

/**
 * Ant Design-inspired Button Component for LeafLearn
 * 
 * @param {'primary' | 'default' | 'outlined' | 'text' | 'link'} type - Visual style
 * @param {boolean} danger - Danger state (red)
 * @param {'small' | 'middle' | 'large'} size - Button height and padding
 * @param {boolean} loading - Loading spinner state
 * @param {boolean} disabled - Disabled state
 * @param {boolean} block - Full width button
 * @param {React.ReactNode} icon - Leading icon
 * @param {string} htmlType - 'button' | 'submit' | 'reset'
 */
export default function Button({
  children,
  type = 'default',
  danger = false,
  size = 'middle',
  loading = false,
  disabled = false,
  block = false,
  icon = null,
  htmlType = 'button',
  className = '',
  onClick,
  ...props
}) {
  const isDisabled = disabled || loading;

  // Base sizing and typography
  const sizeClasses = {
    small: 'h-7 px-2.5 text-xs rounded-md gap-1.5',
    middle: 'h-9 px-3.5 text-sm rounded-lg gap-2',
    large: 'h-10 sm:h-11 px-4 sm:px-5 text-sm sm:text-base rounded-lg gap-2.5',
  };

  // Variant styling matching Ant Design principles
  let variantClass = '';

  if (danger) {
    if (type === 'primary') {
      variantClass = 'bg-[#CF1322] hover:bg-[#A8071A] active:bg-[#820014] text-white shadow-xs focus-visible:ring-2 focus-visible:ring-[#FFA39E]';
    } else if (type === 'outlined' || type === 'default') {
      variantClass = 'bg-white border border-[#FFA39E] text-[#CF1322] hover:bg-[#FFF1F0] hover:border-[#CF1322] focus-visible:ring-2 focus-visible:ring-[#FFA39E]';
    } else {
      variantClass = 'bg-transparent text-[#CF1322] hover:bg-[#FFF1F0]';
    }
  } else {
    switch (type) {
      case 'primary':
        variantClass = 'bg-[#24693D] hover:bg-[#1D5732] active:bg-[#154225] text-white font-medium shadow-xs focus-visible:ring-2 focus-visible:ring-[#24693D]/30';
        break;
      case 'outlined':
        variantClass = 'bg-transparent border border-[#24693D] text-[#24693D] font-medium hover:bg-[#F0F7EE] active:bg-[#E2F0DE] focus-visible:ring-2 focus-visible:ring-[#24693D]/20';
        break;
      case 'text':
        variantClass = 'bg-transparent border-transparent text-[#5A6553] hover:text-[#1F291E] hover:bg-[#F0F4EE] active:bg-[#E5ECE2]';
        break;
      case 'link':
        variantClass = 'bg-transparent border-transparent text-[#24693D] hover:text-[#1D5732] hover:underline p-0 h-auto shadow-none';
        break;
      case 'default':
      default:
        variantClass = 'bg-white border border-[#DCE5D8] text-[#2E3A28] font-medium hover:border-[#24693D] hover:text-[#24693D] hover:bg-[#F9FCF8] active:bg-[#F0F7EE] shadow-2xs focus-visible:ring-2 focus-visible:ring-[#24693D]/20';
        break;
    }
  }

  const disabledClass = isDisabled
    ? 'opacity-55 cursor-not-allowed pointer-events-none shadow-none'
    : 'cursor-pointer active:scale-[0.99] transition-all duration-150';

  const widthClass = block ? 'w-full' : '';

  return (
    <button
      type={htmlType}
      disabled={isDisabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center font-medium select-none focus:outline-none shrink-0 ${sizeClasses[size] || sizeClasses.middle} ${variantClass} ${disabledClass} ${widthClass} ${className}`}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin h-3.5 w-3.5 shrink-0 text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {!loading && icon && <span className="inline-flex shrink-0 items-center justify-center">{icon}</span>}
      {children && <span className="truncate">{children}</span>}
    </button>
  );
}
