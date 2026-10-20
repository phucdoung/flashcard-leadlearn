import React from 'react';

/**
 * Ant Design-inspired Empty State Component for LeafLearn
 */
export default function Empty({
  title = 'Không có dữ liệu',
  description = null,
  action = null,
  icon = null,
  className = '',
}) {
  return (
    <div
      className={`bg-white border border-slate-200/80 rounded-2xl p-8 sm:p-12 text-center flex flex-col items-center justify-center space-y-3 shadow-xs ${className}`}
    >
      <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-200/80 mb-1">
        {icon || (
          <svg
            className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-600/40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
        )}
      </div>

      <div className="space-y-1 max-w-sm">
        <h3 className="text-base font-bold text-slate-900 tracking-tight">
          {title}
        </h3>
        {description && (
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
