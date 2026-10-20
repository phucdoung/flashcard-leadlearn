'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/src/lib/supabaseClient';
import { Button, Input } from '@/src/components/common';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [errors, setErrors] = useState({});
  const [authError, setAuthError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Account deleted message state
  const isDeleted = searchParams.get('deleted') || searchParams.get('accountDeleted');
  const [accountDeletedMsg, setAccountDeletedMsg] = useState(
    isDeleted ? 'Tài khoản của bạn đã được xóa.' : ''
  );

  // Resend confirmation email state
  const [showResendOption, setShowResendOption] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [resendMsg, setResendMsg] = useState('');
  const [resending, setResending] = useState(false);

  // 60-second resend countdown timer
  useEffect(() => {
    if (resendCountdown <= 0) return;

    const timer = setInterval(() => {
      setResendCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [resendCountdown]);

  const validate = () => {
    const newErrors = {};

    const sanitizedEmail = email.trim().toLowerCase();
    if (!sanitizedEmail) {
      newErrors.email = 'Vui lòng nhập Email';
    } else {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(sanitizedEmail)) {
        newErrors.email = 'Vui lòng nhập địa chỉ email hợp lệ.';
      }
    }

    if (!password) {
      newErrors.password = 'Vui lòng nhập mật khẩu';
    } else if (password.length < 6) {
      newErrors.password = 'Mật khẩu phải có tối thiểu 6 ký tự';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setResendMsg('');
    setShowResendOption(false);

    if (!validate()) return;

    setSubmitting(true);
    const sanitizedEmail = email.trim().toLowerCase();

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: sanitizedEmail,
        password,
      });

      if (error) {
        console.error('[Supabase Auth Error]', {
          name: error.name,
          status: error.status,
          code: error.code,
          message: error.message,
        });

        const errMsg = (error.message || '').toLowerCase();
        const errName = error.name || '';
        const errStatus = error.status;

        // 1. Unconfirmed email error
        if (
          errMsg.includes('email not confirmed') ||
          errMsg.includes('email_not_confirmed') ||
          error.code === 'email_not_confirmed'
        ) {
          setAuthError(
            'Email của bạn chưa được xác nhận. Vui lòng kiểm tra hộp thư và xác nhận tài khoản trước khi đăng nhập.'
          );
          setShowResendOption(true);
        }
        // 2. Network / connection error / failed to fetch (DO NOT treat as wrong password!)
        else if (
          errName === 'AuthRetryableFetchError' ||
          errName === 'TypeError' ||
          errStatus === 0 ||
          errMsg.includes('failed to fetch') ||
          errMsg.includes('fetch') ||
          errMsg.includes('network') ||
          errMsg.includes('connection')
        ) {
          setAuthError(
            'Không thể kết nối đến máy chủ Supabase. Vui lòng kiểm tra kết nối mạng hoặc thử lại sau.'
          );
        }
        // 3. Rate limit / too many requests
        else if (
          errStatus === 429 ||
          errMsg.includes('rate limit') ||
          errMsg.includes('too many requests')
        ) {
          setAuthError('Bạn đã thử đăng nhập quá nhiều lần. Vui lòng đợi ít phút rồi thử lại.');
        }
        // 4. Invalid credentials (email / password incorrect)
        else if (
          errStatus === 400 ||
          error.code === 'invalid_credentials' ||
          errMsg.includes('invalid login credentials') ||
          errMsg.includes('invalid credentials')
        ) {
          setAuthError('Email hoặc mật khẩu không chính xác.');
        }
        // 5. Server-side error (5xx)
        else if (errStatus && errStatus >= 500) {
          setAuthError('Máy chủ xác thực đang gặp sự cố. Vui lòng thử lại sau.');
        }
        // 6. Generic fallback without assuming wrong password
        else {
          setAuthError(error.message || 'Đăng nhập không thành công. Vui lòng thử lại.');
        }
      } else {
        router.push('/');
      }
    } catch (err) {
      console.error('[Supabase Auth Exception]', {
        name: err?.name,
        message: err?.message,
        err,
      });
      setAuthError('Không thể kết nối đến máy chủ Supabase. Vui lòng kiểm tra kết nối mạng và thử lại sau.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (resending || resendCountdown > 0 || !email.trim()) return;

    setResending(true);
    setResendMsg('');

    try {
      const sanitizedEmail = email.trim().toLowerCase();
      const loginRedirectUrl = `${window.location.origin}/login`;

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: sanitizedEmail,
        options: {
          emailRedirectTo: loginRedirectUrl,
        },
      });

      if (error) {
        console.error('Resend confirmation error:', error);
        setResendMsg('Không thể gửi lại email xác nhận lúc này. Vui lòng thử lại sau.');
      } else {
        setResendMsg('Đã gửi lại email xác nhận. Vui lòng kiểm tra hộp thư.');
        setResendCountdown(60); // Start 60-second lock
      }
    } catch (err) {
      console.error('Resend confirmation exception:', err);
      setResendMsg('Không thể gửi lại email xác nhận. Vui lòng thử lại sau.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden flex flex-col md:flex-row w-full my-auto">
      {/* 1. Left Branding Column (~48% width) */}
      <div className="hidden md:flex md:w-[48%] bg-slate-50/80 border-r border-slate-200/80 p-8 lg:p-11 flex-col justify-between relative overflow-hidden">
        <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />

        {/* Top: Logo & Brand Name */}
        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center group focus:outline-none" aria-label="LeafLearn">
            <img
              src="/logo.png"
              alt="LeafLearn Logo"
              className="h-16 lg:h-20 w-auto object-contain transition-transform group-hover:scale-105"
            />
            <span className="sr-only">LeafLearn</span>
          </Link>
        </div>

        {/* Middle: Brand Value Proposition */}
        <div className="space-y-4 my-8 relative z-10">
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 leading-[1.25] tracking-tight">
            Học từ vựng dễ dàng hơn mỗi ngày.
          </h1>
          <p className="text-sm lg:text-base text-slate-600 leading-relaxed">
            Tạo Flashcard, ghi nhớ từ vựng và luyện tập thông minh cùng AI.
          </p>

          <div className="space-y-3 pt-6 border-t border-slate-200">
            <div className="text-xs lg:text-sm font-semibold text-slate-800 flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span>Tạo bộ Flashcard cá nhân</span>
            </div>
            <div className="text-xs lg:text-sm font-semibold text-slate-800 flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span>Luyện tập với bài kiểm tra AI</span>
            </div>
            <div className="text-xs lg:text-sm font-semibold text-slate-800 flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span>Theo dõi tiến độ học tập</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-[11px] text-slate-400 font-medium">
          © 2026 LeafLearn. Nền tảng học từ vựng tiếng Anh tối giản.
        </div>
      </div>

      {/* 2. Right Login Form Column (~52% width) */}
      <div className="w-full md:w-[52%] bg-white p-6 sm:p-10 lg:p-12 flex flex-col justify-center">
        {/* Mobile Header Logo */}
        <div className="md:hidden text-center mb-6">
          <Link href="/" className="inline-flex items-center justify-center focus:outline-none" aria-label="LeafLearn">
            <img
              src="/logo.png"
              alt="LeafLearn Logo"
              className="h-14 w-auto object-contain"
            />
            <span className="sr-only">LeafLearn</span>
          </Link>
        </div>

        {/* Form Heading & Subheading */}
        <div className="space-y-1 mb-6 sm:mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Chào mừng trở lại
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Đăng nhập để tiếp tục hành trình học tập cùng LeafLearn.
          </p>
        </div>

        {/* Account Deleted Success Alert */}
        {accountDeletedMsg && (
          <div className="mb-5 bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl text-xs font-semibold text-emerald-800 text-center leading-relaxed">
            ✓ {accountDeletedMsg}
          </div>
        )}

        {/* Supabase Error Alert */}
        {authError && (
          <div className="mb-5 bg-rose-50 border border-rose-200 p-3.5 rounded-xl text-xs text-rose-800 font-medium text-center leading-relaxed space-y-2">
            <p>{authError}</p>

            {/* Resend Unconfirmed Email Action */}
            {showResendOption && (
              <div className="pt-1 border-t border-rose-200/60">
                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  disabled={resending || resendCountdown > 0}
                  className="text-xs font-semibold text-emerald-700 underline hover:text-emerald-800 transition-colors cursor-pointer disabled:opacity-60"
                >
                  {resending
                    ? 'Đang gửi...'
                    : resendCountdown > 0
                    ? `Gửi lại email xác nhận sau ${resendCountdown}s`
                    : 'Gửi lại email xác nhận'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Resend Confirmation Success/Info Message */}
        {resendMsg && (
          <div className="mb-5 bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl text-xs text-emerald-800 font-medium text-center leading-relaxed">
            {resendMsg}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Field */}
          <Input
            label="Email"
            type="email"
            value={email}
            disabled={submitting}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
            }}
            placeholder="Nhập email của bạn"
            status={errors.email ? 'error' : ''}
            error={errors.email}
          />

          {/* Password Field with Forgot Password link aligned on right */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-800">
                Mật khẩu
              </label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:underline transition-colors"
              >
                Quên mật khẩu?
              </Link>
            </div>
            <Input
              type="password"
              value={password}
              disabled={submitting}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
              }}
              placeholder="Nhập mật khẩu của bạn"
              status={errors.password ? 'error' : ''}
              error={errors.password}
            />
          </div>

          {/* Primary Submit Button */}
          <div className="pt-2">
            <Button
              htmlType="submit"
              type="primary"
              size="large"
              block
              loading={submitting}
            >
              {submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </Button>
          </div>
        </form>

        {/* Footer Link to Register */}
        <div className="mt-8 text-center text-xs sm:text-sm text-slate-500">
          Chưa có tài khoản?{' '}
          <Link href="/register" className="text-emerald-600 hover:underline font-semibold">
            Đăng ký
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Đang tải...</div>}>
      <LoginForm />
    </Suspense>
  );
}
