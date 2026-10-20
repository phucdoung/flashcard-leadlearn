import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { Button, Input } from '../../components/common';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [errors, setErrors] = useState({});
  const [authError, setAuthError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [checkingSession, setCheckingSession] = useState(true);
  const [isValidSession, setIsValidSession] = useState(false);

  // Validate recovery session when opening reset password page
  useEffect(() => {
    let mounted = true;

    // Check current session or auth state change
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY' || (session && session.user)) {
        setIsValidSession(true);
      }
      setCheckingSession(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (session && session.user) {
        setIsValidSession(true);
      }
      setCheckingSession(false);
    });

    return () => {
      mounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const validate = () => {
    const newErrors = {};

    if (!password) {
      newErrors.password = 'Vui lòng nhập mật khẩu mới';
    } else if (password.length < 8) {
      newErrors.password = 'Mật khẩu phải có tối thiểu 8 ký tự';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Vui lòng xác nhận mật khẩu mới';
    } else if (confirmPassword !== password) {
      newErrors.confirmPassword = 'Mật khẩu xác nhận không khớp';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');

    if (!validate()) return;

    setSubmitting(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        console.error('Update password error:', error);
        const errMsg = error.message ? error.message.toLowerCase() : '';
        if (errMsg.includes('failed to fetch') || errMsg.includes('network error')) {
          setAuthError('Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.');
        } else {
          setAuthError('Không thể cập nhật mật khẩu. Vui lòng thử lại sau.');
        }
      } else {
        setIsSuccess(true);
      }
    } catch (err) {
      console.error('Update password exception:', err);
      setAuthError('Không thể cập nhật mật khẩu. Vui lòng thử lại sau.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden flex flex-col md:flex-row w-full my-auto">
      {/* 1. Left Branding Column (~48% width) */}
      <div className="hidden md:flex md:w-[48%] bg-slate-50/80 border-r border-slate-200/80 p-8 lg:p-11 flex-col justify-between relative overflow-hidden">
        <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />

        {/* Logo Unit */}
        <div className="relative z-10">
          <Link to="/" className="inline-flex items-center group focus:outline-none" aria-label="LeafLearn">
            <img
              src="/logo.png"
              alt="LeafLearn Logo"
              className="h-16 lg:h-20 w-auto object-contain transition-transform group-hover:scale-105"
            />
            <span className="sr-only">LeafLearn</span>
          </Link>
        </div>

        {/* Value Prop */}
        <div className="space-y-4 my-8 relative z-10">
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 leading-[1.25] tracking-tight">
            Đặt lại mật khẩu an toàn.
          </h1>
          <p className="text-sm lg:text-base text-slate-600 leading-relaxed">
            Tạo mật khẩu mới và sẵn sàng tiếp tục lộ trình học từ vựng của bạn.
          </p>

          <div className="space-y-3 pt-6 border-t border-slate-200">
            <div className="text-xs lg:text-sm font-semibold text-slate-800 flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span>Cập nhật mật khẩu trực tiếp</span>
            </div>
            <div className="text-xs lg:text-sm font-semibold text-slate-800 flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span>Đăng nhập ngay sau khi hoàn tất</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-[11px] text-slate-400 font-medium">
          © 2026 LeafLearn. Nền tảng học từ vựng tiếng Anh tối giản.
        </div>
      </div>

      {/* 2. Right Reset Form Column (~52% width) */}
      <div className="w-full md:w-[52%] bg-white p-6 sm:p-10 lg:p-12 flex flex-col justify-center">
        {/* Mobile Header Logo */}
        <div className="md:hidden text-center mb-6">
          <Link to="/" className="inline-flex items-center justify-center focus:outline-none" aria-label="LeafLearn">
            <img
              src="/logo.png"
              alt="LeafLearn Logo"
              className="h-14 w-auto object-contain"
            />
            <span className="sr-only">LeafLearn</span>
          </Link>
        </div>

        {checkingSession ? (
          /* Loading session check state */
          <div className="py-12 text-center text-sm font-medium text-slate-500 animate-pulse">
            Đang xác thực liên kết khôi phục mật khẩu...
          </div>
        ) : !isValidSession ? (
          /* Invalid / Expired Reset Link Error Panel */
          <div className="space-y-6 text-center py-4">
            <div className="w-14 h-14 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto text-rose-600 font-bold text-2xl shadow-xs">
              !
            </div>

            <div className="space-y-2">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-sm mx-auto">
                Liên kết này có thể đã được sử dụng hoặc quá thời hạn cho phép. Vui lòng gửi lại yêu cầu để nhận liên kết mới.
              </p>
            </div>

            <div className="pt-2">
              <Link to="/forgot-password" className="block w-full">
                <Button type="primary" size="large" block>
                  Yêu cầu liên kết mới
                </Button>
              </Link>
            </div>
          </div>
        ) : isSuccess ? (
          /* Success State Panel */
          <div className="space-y-6 text-center py-4">
            <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-600 font-bold text-2xl shadow-xs">
              ✓
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                Đặt lại mật khẩu thành công
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-sm mx-auto">
                Bạn có thể sử dụng mật khẩu mới để đăng nhập LeafLearn.
              </p>
            </div>

            <div className="pt-2">
              <Link to="/login" className="block w-full">
                <Button type="primary" size="large" block>
                  Đăng nhập
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          /* Normal Password Input Form State */
          <div>
            <div className="space-y-1 mb-6 sm:mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Đặt mật khẩu mới
              </h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Tạo mật khẩu mới cho tài khoản LeafLearn của bạn.
              </p>
            </div>

            {authError && (
              <div className="mb-5 bg-rose-50 border border-rose-200 p-3.5 rounded-xl text-xs text-rose-800 font-medium text-center leading-relaxed">
                {authError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* New Password Field */}
              <Input
                label="Mật khẩu mới (Tối thiểu 8 ký tự)"
                type="password"
                value={password}
                disabled={submitting}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
                }}
                placeholder="Nhập mật khẩu mới"
                status={errors.password ? 'error' : ''}
                error={errors.password}
              />

              {/* Confirm New Password Field */}
              <Input
                label="Xác nhận mật khẩu mới"
                type="password"
                value={confirmPassword}
                disabled={submitting}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: '' }));
                }}
                placeholder="Nhập lại mật khẩu mới"
                status={errors.confirmPassword ? 'error' : ''}
                error={errors.confirmPassword}
              />

              <div className="pt-2">
                <Button
                  htmlType="submit"
                  type="primary"
                  size="large"
                  block
                  loading={submitting}
                  disabled={submitting || !password || !confirmPassword}
                >
                  {submitting ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
                </Button>
              </div>
            </form>

            <div className="mt-8 text-center text-xs sm:text-sm text-slate-500">
              <Link to="/login" className="text-emerald-600 hover:underline font-semibold">
                Quay lại đăng nhập
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
