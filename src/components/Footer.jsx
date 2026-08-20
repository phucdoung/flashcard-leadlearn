import React from 'react';

export default function Footer() {
  return (
    <footer className="border-t border-[#E7EEDC] bg-[#F8FCF4] py-5 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto w-full flex flex-col sm:flex-row items-center justify-between gap-3 text-sm font-medium text-[#6B7665]">
        <p>© 2026 LeafLearn</p>
        <div className="flex items-center gap-7 sm:gap-[30px]">
          <a href="#" className="hover:text-[#2E3A28] transition-colors focus:outline-none">
            Giới thiệu
          </a>
          <span className="text-[#DDE6D7] text-xs">•</span>
          <a href="#" className="hover:text-[#2E3A28] transition-colors focus:outline-none">
            Điều khoản
          </a>
          <span className="text-[#DDE6D7] text-xs">•</span>
          <a href="#" className="hover:text-[#2E3A28] transition-colors focus:outline-none">
            Quyền riêng tư
          </a>
        </div>
      </div>
    </footer>
  );
}
