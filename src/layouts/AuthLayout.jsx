import React from 'react';
import { Outlet } from 'react-router-dom';
import FloatingLeaves from '../components/FloatingLeaves';

export default function AuthLayout() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FCF4] px-4 py-8 sm:py-12 relative overflow-hidden">
      {/* Faint Floating Leaves for Auth Pages */}
      <FloatingLeaves variant="auth" />

      {/* Background Soft Glow Decoration */}
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-[#A8D672]/15 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-[#5B9E60]/10 blur-3xl pointer-events-none" />

      <div className="w-full max-w-[1040px] z-10 flex items-center justify-center">
        <Outlet />
      </div>
    </div>
  );
}
