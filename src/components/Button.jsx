import React from 'react';

export default function Button({ children, variant = 'primary', className = '', ...props }) {
  const baseStyle = "px-4 py-2 rounded-lg font-medium transition-colors text-sm focus:outline-none";
  
  const variants = {
    primary: "bg-[#A8D672] text-[#2E3A28] hover:bg-[#97C95E]",
    secondary: "bg-white text-[#2E3A28] border border-[#E7EEDC] hover:bg-[#F8FCF4]",
    danger: "bg-[#E57373] text-white hover:opacity-90",
    ghost: "text-[#6B7665] hover:text-[#2E3A28] hover:bg-white/50",
  };

  return (
    <button className={`${baseStyle} ${variants[variant] || variants.primary} ${className}`} {...props}>
      {children}
    </button>
  );
}
