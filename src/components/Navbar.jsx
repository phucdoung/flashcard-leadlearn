'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { Button } from './common';

export default function Navbar() {
  const pathname = usePathname() || '';
  const router = useRouter();
  const { user, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  const displayName = user?.user_metadata?.full_name || user?.email || 'User';
  const avatarUrl = user?.user_metadata?.avatar_url || null;
  const avatarLetter = (
    displayName.trim().length > 0
      ? displayName.trim().charAt(0)
      : user?.email?.charAt(0) || 'U'
  ).toUpperCase();

  const isHomeActive = pathname === '/';
  const isCommunityActive =
    pathname.startsWith('/community') ||
    pathname.startsWith('/users') ||
    pathname.startsWith('/explore');
  const isStatsActive = pathname === '/statistics';
  const isProfileActive = pathname === '/profile';

  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-white/85 border-b border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.03)] transition-all">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-[68px] flex items-center justify-between gap-4 w-full">
        {/* 1. Left Brand Logo Unit */}
        <Link
          href="/"
          className="flex items-center gap-3 group shrink-0 focus:outline-none"
          aria-label="LeafLearn Trang chủ"
        >
          <img
            src="/logo.png"
            alt="LeafLearn Logo"
            className="h-10 sm:h-11 w-auto object-contain transition-transform group-hover:scale-105"
          />
          <span className="sr-only">LeafLearn</span>
        </Link>

        {/* 2. Center Segmented Navigation Group */}
        <nav className="hidden md:flex items-center p-1 bg-slate-100/90 rounded-xl border border-slate-200/60 shadow-inner gap-1">
          <Link
            href="/"
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              isHomeActive
                ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            Trang chủ
          </Link>
          <Link
            href="/community"
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              isCommunityActive
                ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            Cộng đồng
          </Link>
          <Link
            href="/statistics"
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              isStatsActive
                ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            Thống kê
          </Link>
        </nav>

        {/* 3. Right Complete User & Mobile Navigation Group */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Mobile Quick Navigation Tabs */}
          <div className="flex md:hidden items-center gap-1 mr-0.5">
            <Link
              href="/"
              className={`px-2 py-1 text-xs font-semibold rounded-lg transition-colors ${
                isHomeActive ? 'text-emerald-700 bg-emerald-50' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Trang chủ
            </Link>
            <Link
              href="/community"
              className={`px-2 py-1 text-xs font-semibold rounded-lg transition-colors ${
                isCommunityActive ? 'text-emerald-700 bg-emerald-50' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cộng đồng
            </Link>
            <Link
              href="/statistics"
              className={`px-2 py-1 text-xs font-semibold rounded-lg transition-colors ${
                isStatsActive ? 'text-emerald-700 bg-emerald-50' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Thống kê
            </Link>
          </div>

          {/* User Account Controls */}
          {user ? (
            <>
              {/* Modern User Profile Badge */}
              <Link
                href="/profile"
                className={`inline-flex items-center gap-2 h-9 px-2.5 sm:px-3 rounded-xl border text-xs sm:text-sm font-semibold max-w-[120px] sm:max-w-[170px] transition-all cursor-pointer focus:outline-none shadow-xs ${
                  isProfileActive
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/40'
                }`}
                title="Hồ sơ cá nhân"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="User Avatar"
                    className="w-6 h-6 rounded-lg object-cover ring-1 ring-slate-200 shrink-0"
                  />
                ) : (
                  <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                    {avatarLetter}
                  </span>
                )}
                <span className="truncate">{displayName}</span>
              </Link>

              {/* Refined Logout Action */}
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer focus:outline-none"
                title="Đăng xuất"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="hidden sm:inline">Đăng xuất</span>
              </button>
            </>
          ) : (
            <Link href="/login">
              <Button type="primary" size="small">
                Đăng nhập
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
