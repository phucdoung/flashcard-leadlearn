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
    small: 'h-7 text-xs px-2.5 rounded-md',
    middle: 'h-9 text-sm px-3 rounded-lg',
    large: 'h-10 sm:h-11 text-sm sm:text-base px-3.5 rounded-lg',
  };

  const borderClass = isError
    ? 'border-[#CF1322] focus-within:border-[#CF1322] focus-within:ring-2 focus-within:ring-[#CF1322]/20'
    : 'border-[#DCE5D8] hover:border-[#24693D] focus-within:border-[#24693D] focus-within:ring-2 focus-within:ring-[#24693D]/20';

  const disabledClass = disabled
    ? 'bg-[#F5F7F4] text-[#8C9785] cursor-not-allowed border-[#E2E8DF]'
    : 'bg-white text-[#2E3A28]';

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
        <label className="text-xs font-semibold text-[#1F291E]">
          {label}
        </label>
      )}

      <div
        className={`relative flex items-center w-full border transition-all duration-150 ${sizeClasses[size] || sizeClasses.middle} ${borderClass} ${disabledClass} ${className}`}
      >
        {prefix && (
          <span className="mr-2 text-[#66705F] shrink-0 flex items-center justify-center">
            {prefix}
          </span>
        )}

        <input
          disabled={disabled}
          value={value}
          onChange={onChange}
          className="w-full h-full bg-transparent border-none outline-none text-current placeholder-[#8C9785] text-inherit"
          {...props}
        />

        {allowClear && value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="ml-1 text-[#8C9785] hover:text-[#5A6553] cursor-pointer focus:outline-none p-0.5 rounded-full"
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
          <span className="ml-2 text-[#66705F] shrink-0 flex items-center justify-center">
            {suffix}
          </span>
        )}
      </div>

      {error && (
        <span className="text-xs text-[#CF1322] flex items-center gap-1 mt-0.5">
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
