'use client';

import React from 'react';
import FloatingLeaves from '../components/FloatingLeaves';

export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-4 py-8 sm:py-12 relative overflow-hidden">
      {/* Faint Floating Leaves for Auth Pages */}
      <FloatingLeaves variant="auth" />

      {/* Modern Soft Ambient Glows */}
      <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-slate-400/10 blur-3xl pointer-events-none" />

      <div className="w-full max-w-[1020px] z-10 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}
