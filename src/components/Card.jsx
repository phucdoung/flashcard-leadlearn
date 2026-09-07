import React from 'react';

export default function Card({ children, className = '', ...props }) {
  return (
    <div
      className={`bg-white border border-[#E7EEDC] rounded-xl p-6 transition-all ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
