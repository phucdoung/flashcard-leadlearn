import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from './common';

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
    <header className="bg-white border-b border-[#DCE5D8] sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 h-[64px] sm:h-[68px] flex items-center w-full">
        {/* 1. Left Brand Logo Unit */}
        <Link to="/" className="flex items-center group shrink-0 focus:outline-none" aria-label="LeafLearn">
          <img
            src="/logo.png"
            alt="LeafLearn Logo"
            className="h-[46px] sm:h-[50px] w-auto object-contain transition-transform group-hover:scale-105"
          />
          <span className="sr-only">LeafLearn</span>
        </Link>

        {/* 2. Right Complete Nav & Account Group */}
        <nav className="ml-auto flex items-center gap-3.5 sm:gap-5">
          {/* Trang chủ */}
          <Link
            to="/"
            className={`text-sm py-1 relative focus:outline-none transition-colors ${
              isHomeActive
                ? 'text-[#24693D] font-bold'
                : 'text-[#556551] hover:text-[#14261C] font-medium'
            }`}
          >
            Trang chủ
            {isHomeActive && (
              <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-[#24693D] rounded-full" />
            )}
          </Link>

          {/* Cộng đồng */}
          <Link
            to="/community"
            className={`text-sm py-1 relative focus:outline-none transition-colors ${
              isCommunityActive
                ? 'text-[#24693D] font-bold'
                : 'text-[#556551] hover:text-[#14261C] font-medium'
            }`}
          >
            Cộng đồng
            {isCommunityActive && (
              <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-[#24693D] rounded-full" />
            )}
          </Link>

          {/* Thống kê */}
          <Link
            to="/statistics"
            className={`text-sm py-1 relative focus:outline-none transition-colors ${
              isStatsActive
                ? 'text-[#24693D] font-bold'
                : 'text-[#556551] hover:text-[#14261C] font-medium'
            }`}
          >
            Thống kê
            {isStatsActive && (
              <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-[#24693D] rounded-full" />
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
                    ? 'bg-[#F0F7EE] border-[#24693D] text-[#24693D] font-semibold'
                    : 'bg-[#F8FCF4] border-[#DCE5D8] text-[#14261C] hover:bg-[#F0F7EE] hover:border-[#24693D]/50'
                }`}
                title="Thông tin cá nhân"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="User Avatar"
                    className="w-[26px] h-[26px] rounded-full object-cover border border-[#DCE5D8] shrink-0"
                  />
                ) : (
                  <span className="w-[26px] h-[26px] rounded-full bg-[#24693D] text-white font-bold text-xs flex items-center justify-center shrink-0">
                    {avatarLetter}
                  </span>
                )}
                <span className="truncate">{displayName}</span>
              </Link>

              {/* Logout Action */}
              <button
                type="button"
                onClick={handleLogout}
                className="text-sm font-medium text-[#556551] hover:text-[#CF1322] transition-colors cursor-pointer focus:outline-none"
              >
                Đăng xuất
              </button>
            </>
          ) : (
            <Link to="/login">
              <Button type="primary" size="small">
                Đăng nhập
              </Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
