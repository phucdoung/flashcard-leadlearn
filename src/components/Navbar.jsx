import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const displayName = user?.user_metadata?.full_name || user?.email || 'User';
  const avatarUrl = user?.user_metadata?.avatar_url || null;
  const avatarLetter = (
    displayName.trim().length > 0
      ? displayName.trim().charAt(0)
      : user?.email?.charAt(0) || 'U'
  ).toUpperCase();

  const isHomeActive = location.pathname === '/';
  const isCommunityActive =
    location.pathname.startsWith('/community') ||
    location.pathname.startsWith('/users') ||
    location.pathname.startsWith('/explore');
  const isStatsActive = location.pathname === '/statistics';
  const isProfileActive = location.pathname === '/profile';

  return (
    <header className="bg-white border-b border-[#E7EEDC] sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 h-[64px] sm:h-[68px] flex items-center w-full">
        {/* 1. Left Brand Logo Unit */}
        <Link to="/" className="flex items-center gap-2 sm:gap-[9px] group shrink-0 focus:outline-none">
          <img
            src="/logo.png"
            alt="LeafLearn Logo"
            className="w-[40px] h-[40px] sm:w-[42px] sm:h-[42px] object-contain rounded-full mix-blend-multiply transition-transform group-hover:scale-105"
          />
          <span className="tracking-tight font-bold text-[22px] sm:text-[25px] text-[#2E3A28]">
            LeafLearn
          </span>
        </Link>

        {/* 2. Right Complete Nav & Account Group (ml-auto, gap: 20px) */}
        <nav className="ml-auto flex items-center gap-3.5 sm:gap-[20px]">
          {/* Trang chủ */}
          <Link
            to="/"
            className={`text-sm py-1 relative focus:outline-none transition-colors ${
              isHomeActive
                ? 'text-[#2E3A28] font-semibold'
                : 'text-[#6B7665] hover:text-[#2E3A28] font-medium'
            }`}
          >
            Trang chủ
            {isHomeActive && (
              <span className="absolute -bottom-1 left-0 right-0 h-[2px] bg-[#A8D672] rounded-full" />
            )}
          </Link>

          {/* Cộng đồng */}
          <Link
            to="/community"
            className={`text-sm py-1 relative focus:outline-none transition-colors ${
              isCommunityActive
                ? 'text-[#2E3A28] font-semibold'
                : 'text-[#6B7665] hover:text-[#2E3A28] font-medium'
            }`}
          >
            Cộng đồng
            {isCommunityActive && (
              <span className="absolute -bottom-1 left-0 right-0 h-[2px] bg-[#A8D672] rounded-full" />
            )}
          </Link>

          {/* Thống kê */}
          <Link
            to="/statistics"
            className={`text-sm py-1 relative focus:outline-none transition-colors ${
              isStatsActive
                ? 'text-[#2E3A28] font-semibold'
                : 'text-[#6B7665] hover:text-[#2E3A28] font-medium'
            }`}
          >
            Thống kê
            {isStatsActive && (
              <span className="absolute -bottom-1 left-0 right-0 h-[2px] bg-[#A8D672] rounded-full" />
            )}
          </Link>

          {/* User Account Controls */}
          {user ? (
            <>
              {/* Compact User Profile Pill */}
              <Link
                to="/profile"
                className={`inline-flex items-center gap-2 h-[36px] sm:h-[38px] px-2.5 sm:px-3 rounded-full border text-sm font-medium max-w-[120px] sm:max-w-[160px] transition-all cursor-pointer focus:outline-none ${
                  isProfileActive
                    ? 'bg-[#A8D672]/20 border-[#A8D672] text-[#2E3A28] font-semibold'
                    : 'bg-[#F8FCF4] border-[#E7EEDC] text-[#2E3A28] hover:bg-[#E7EEDC]/60 hover:border-[#A8D672]'
                }`}
                title="Thông tin cá nhân"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="User Avatar"
                    className="w-[28px] h-[28px] rounded-full object-cover border border-[#97C95E]/50 shrink-0"
                  />
                ) : (
                  <span className="w-[28px] h-[28px] rounded-full bg-[#A8D672] text-[#2E3A28] font-bold text-xs flex items-center justify-center border border-[#97C95E]/50 shrink-0">
                    {avatarLetter}
                  </span>
                )}
                <span className="truncate">{displayName}</span>
              </Link>

              {/* Logout Action */}
              <button
                type="button"
                onClick={handleLogout}
                className="text-sm font-medium text-[#6B7665] hover:text-[#2E3A28] transition-colors cursor-pointer focus:outline-none"
              >
                Đăng xuất
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="h-[36px] px-3.5 inline-flex items-center rounded-xl bg-[#A8D672] hover:bg-[#97C95E] text-[#2E3A28] font-semibold text-sm transition-all shadow-2xs focus:outline-none"
            >
              Đăng nhập
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
