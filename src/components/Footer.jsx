import React from 'react';

export default function Footer() {
  return (
    <footer className="border-t border-slate-200/80 bg-white/70 backdrop-blur-sm py-5 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto w-full flex flex-col sm:flex-row items-center justify-between gap-3 text-sm font-medium text-slate-500">
        <p className="text-xs sm:text-sm">© 2026 LeafLearn. Nền tảng học từ vựng tiếng Anh hiện đại.</p>
        <div className="flex items-center gap-6 sm:gap-7 text-xs sm:text-sm">
          <a href="#" className="hover:text-emerald-700 transition-colors focus:outline-none">
            Giới thiệu
          </a>
          <span className="text-slate-300 text-xs">•</span>
          <a href="#" className="hover:text-emerald-700 transition-colors focus:outline-none">
            Điều khoản
          </a>
          <span className="text-slate-300 text-xs">•</span>
          <a href="#" className="hover:text-emerald-700 transition-colors focus:outline-none">
            Quyền riêng tư
          </a>
        </div>
      </div>
    </footer>
  );
}
