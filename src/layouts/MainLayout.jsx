import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import FloatingLeaves from '../components/FloatingLeaves';

export default function MainLayout() {
  return (
    <div className="relative min-h-screen flex flex-col bg-[#F8FCF4] text-[#2E3A28] overflow-x-hidden">
      {/* Floating Leaves Background Animation */}
      <FloatingLeaves variant="main" />

      {/* Subtle Botanical Decoration - Top Left Accent */}
      <div aria-hidden="true" className="leaf-decoration-top" />

      {/* Subtle Botanical Decoration - Bottom Right Accent */}
      <div aria-hidden="true" className="leaf-decoration-bottom" />

      {/* Navbar */}
      <div className="relative z-10">
        <Navbar />
      </div>

      {/* Main Content */}
      <main className="relative z-10 flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-6 sm:pt-7 pb-8">
        <Outlet />
      </main>

      {/* Footer */}
      <div className="relative z-10">
        <Footer />
      </div>
    </div>
  );
}
