'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Layers, Users, User as UserIcon, LogOut } from 'lucide-react';
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

  const isHomeActive = pathname === '/';
  const isDecksActive = pathname.startsWith('/decks') || pathname.startsWith('/flashcard');
  const isCommunityActive =
    pathname.startsWith('/community') ||
    pathname.startsWith('/users') ||
    pathname.startsWith('/explore');
  const isProfileActive = pathname === '/profile';

  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-white/90 border-b border-slate-200/60 shadow-[0_1px_3px_rgba(15,23,42,0.02)] transition-all">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 w-full">
        {/* 1. Logo bên trái: Icon chiếc lá xanh đậm + chữ LeafLearn đậm màu forest green */}
        <Link
          href="/"
          className="flex items-center gap-2.5 group shrink-0 focus:outline-none"
          aria-label="LeafLearn Trang chủ"
        >
          <div className="w-8 h-8 rounded-xl bg-emerald-800/10 flex items-center justify-center text-[#1f4e38] transition-transform group-hover:scale-105">
            <svg
              className="w-5 h-5 text-[#1f4e38]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
              <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
            </svg>
          </div>
          <span className="font-bold text-xl text-[#1f4e38] tracking-tight">
            LeafLearn
          </span>
        </Link>

        {/* 2. Menu bên phải gồm các mục có icon outline mảnh */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Trang chủ */}
          <Link
            href="/"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
              isHomeActive
                ? 'bg-slate-100 text-[#1f4e38] font-semibold border border-slate-200/80 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
            }`}
          >
            <Home className="w-4 h-4" strokeWidth={1.75} />
            <span className="hidden sm:inline">Trang chủ</span>
          </Link>

          {/* Bộ Flashcard */}
          <Link
            href="/decks"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
              isDecksActive
                ? 'bg-slate-100 text-[#1f4e38] font-semibold border border-slate-200/80 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
            }`}
          >
            <Layers className="w-4 h-4" strokeWidth={1.75} />
            <span className="hidden sm:inline">Bộ Flashcard</span>
          </Link>

          {/* Cộng đồng */}
          <Link
            href="/community"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
              isCommunityActive
                ? 'bg-slate-100 text-[#1f4e38] font-semibold border border-slate-200/80 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
            }`}
          >
            <Users className="w-4 h-4" strokeWidth={1.75} />
            <span className="hidden sm:inline">Cộng đồng</span>
          </Link>

          {/* Hồ sơ */}
          {user ? (
            <Link
              href="/profile"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                isProfileActive
                  ? 'bg-slate-100 text-[#1f4e38] font-semibold border border-slate-200/80 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
              }`}
            >
              <UserIcon className="w-4 h-4" strokeWidth={1.75} />
              <span className="hidden sm:inline">Hồ sơ</span>
            </Link>
          ) : (
            <Link href="/login" className="ml-1">
              <Button type="primary" size="small">
                Đăng nhập
              </Button>
            </Link>
          )}

          {/* Logout Action */}
          {user && (
            <button
              type="button"
              onClick={handleLogout}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer ml-1"
              title="Đăng xuất"
              aria-label="Đăng xuất"
            >
              <LogOut className="w-4 h-4" strokeWidth={1.75} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
