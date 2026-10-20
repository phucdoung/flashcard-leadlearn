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

  // Base sizing and typography (modern rounded corners)
  const sizeClasses = {
    small: 'h-8 px-3 text-xs rounded-lg gap-1.5',
    middle: 'h-10 px-4 text-sm rounded-xl gap-2',
    large: 'h-11 sm:h-12 px-5 sm:px-6 text-sm sm:text-base rounded-xl gap-2.5',
  };

  // Variant styling matching Modern Emerald Design
  let variantClass = '';

  if (danger) {
    if (type === 'primary') {
      variantClass = 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-sm focus-visible:ring-2 focus-visible:ring-rose-400';
    } else if (type === 'outlined' || type === 'default') {
      variantClass = 'bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 focus-visible:ring-2 focus-visible:ring-rose-300';
    } else {
      variantClass = 'bg-transparent text-rose-600 hover:bg-rose-50';
    }
  } else {
    switch (type) {
      case 'primary':
        variantClass = 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium shadow-sm hover:shadow-md focus-visible:ring-2 focus-visible:ring-emerald-500/30';
        break;
      case 'outlined':
        variantClass = 'bg-transparent border border-emerald-600 text-emerald-600 font-medium hover:bg-emerald-50 active:bg-emerald-100 focus-visible:ring-2 focus-visible:ring-emerald-500/20';
        break;
      case 'text':
        variantClass = 'bg-transparent border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200';
        break;
      case 'link':
        variantClass = 'bg-transparent border-transparent text-emerald-600 hover:text-emerald-700 hover:underline p-0 h-auto shadow-none';
        break;
      case 'default':
      default:
        variantClass = 'bg-white border border-slate-200 text-slate-700 font-medium hover:border-slate-300 hover:text-slate-900 hover:bg-slate-50/80 active:bg-slate-100 shadow-xs focus-visible:ring-2 focus-visible:ring-slate-300/40';
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
