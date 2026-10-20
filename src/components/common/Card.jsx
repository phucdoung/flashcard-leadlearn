import React from 'react';

/**
 * Ant Design-inspired Card Component for LeafLearn
 */
export default function Card({
  title,
  extra,
  children,
  bordered = true,
  hoverable = false,
  size = 'default', // 'default' | 'small'
  actions = null,
  className = '',
  bodyClassName = '',
  onClick,
  ...props
}) {
  const paddingClass = size === 'small' ? 'p-3.5 sm:p-4' : 'p-5 sm:p-6';

  const borderClass = bordered
    ? 'border border-slate-200/80'
    : 'border-0';

  const hoverClass = hoverable
    ? 'hover:shadow-md hover:border-emerald-200 transition-all duration-200 cursor-pointer'
    : 'shadow-xs';

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl ${borderClass} ${hoverClass} flex flex-col relative overflow-hidden ${className}`}
      {...props}
    >
      {/* Card Header (if title or extra present) */}
      {(title || extra) && (
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 min-h-[48px]">
          {title && (
            <div className="font-semibold text-slate-800 text-sm sm:text-base tracking-tight truncate">
              {title}
            </div>
          )}
          {extra && (
            <div className="text-xs sm:text-sm text-slate-500 ml-auto shrink-0 flex items-center gap-2">
              {extra}
            </div>
          )}
        </div>
      )}

      {/* Card Body */}
      <div className={`flex-1 ${paddingClass} ${bodyClassName}`}>
        {children}
      </div>

      {/* Card Bottom Actions (if any) */}
      {actions && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-2.5 flex items-center justify-end gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
