import React from 'react';

/**
 * Ant Design-inspired Input Component for LeafLearn
 */
export default function Input({
  label,
  error,
  status, // 'error' | 'warning'
  prefix = null,
  suffix = null,
  allowClear = false,
  size = 'middle', // 'small' | 'middle' | 'large'
  className = '',
  wrapperClassName = '',
  value,
  onChange,
  disabled = false,
  ...props
}) {
  const isError = status === 'error' || Boolean(error);

  const sizeClasses = {
    small: 'h-8 text-xs px-2.5 rounded-lg',
    middle: 'h-10 text-sm px-3.5 rounded-xl',
    large: 'h-11 sm:h-12 text-sm sm:text-base px-4 rounded-xl',
  };

  const borderClass = isError
    ? 'border-rose-400 focus-within:border-rose-500 focus-within:ring-2 focus-within:ring-rose-500/20'
    : 'border-slate-200 hover:border-emerald-500 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20';

  const disabledClass = disabled
    ? 'bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200'
    : 'bg-white text-slate-800';

  const handleClear = (e) => {
    e.stopPropagation();
    if (onChange) {
      const syntheticEvent = {
        target: { value: '' },
      };
      onChange(syntheticEvent);
    }
  };

  return (
    <div className={`flex flex-col gap-1.5 w-full ${wrapperClassName}`}>
      {label && (
        <label className="text-xs font-semibold text-slate-800">
          {label}
        </label>
      )}

      <div
        className={`relative flex items-center w-full border transition-all duration-150 ${sizeClasses[size] || sizeClasses.middle} ${borderClass} ${disabledClass} ${className}`}
      >
        {prefix && (
          <span className="mr-2 text-slate-400 shrink-0 flex items-center justify-center">
            {prefix}
          </span>
        )}

        <input
          disabled={disabled}
          value={value}
          onChange={onChange}
          className="w-full h-full bg-transparent border-none outline-none text-current placeholder:text-slate-400 text-inherit"
          {...props}
        />

        {allowClear && value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="ml-1 text-slate-400 hover:text-slate-600 cursor-pointer focus:outline-none p-0.5 rounded-full"
            aria-label="Xóa nội dung"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}

        {suffix && (
          <span className="ml-2 text-slate-400 shrink-0 flex items-center justify-center">
            {suffix}
          </span>
        )}
      </div>

      {error && (
        <span className="text-xs text-rose-600 flex items-center gap-1 mt-0.5">
          <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          {error}
        </span>
      )}
    </div>
  );
}
