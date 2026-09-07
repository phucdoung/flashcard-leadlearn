import React from 'react';

export default function Input({ label, error, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label className="text-xs font-medium text-[#2E3A28]">{label}</label>
      )}
      <input
        className={`w-full px-3.5 py-2 rounded-lg border border-[#E7EEDC] bg-white text-sm text-[#2E3A28] placeholder-[#6B7665]/60 focus:outline-none focus:border-[#A8D672] transition-colors ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-[#E57373]">{error}</span>}
    </div>
  );
}
