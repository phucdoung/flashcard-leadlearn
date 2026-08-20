import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

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
    <div className="bg-white border border-[#E7EEDC] rounded-[22px] shadow-sm overflow-hidden flex flex-col md:flex-row w-full my-auto">
      {/* 1. Left Branding Column (~48% width) */}
      <div className="hidden md:flex md:w-[48%] bg-[#F8FCF4] border-r border-[#E7EEDC] p-8 lg:p-11 flex-col justify-between relative overflow-hidden">
        <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-[#A8D672]/20 blur-2xl pointer-events-none" />

        {/* Logo Unit */}
        <div className="relative z-10">
          <Link to="/" className="inline-flex items-center gap-3.5 group">
            <img
              src="/logo.png"
              alt="LeafLearn Logo"
              className="w-12 h-12 lg:w-14 lg:h-14 object-contain rounded-full mix-blend-multiply transition-transform group-hover:scale-105"
            />
            <span className="tracking-tight font-bold text-2xl lg:text-[30px] text-[#2E3A28]">
              LeafLearn
            </span>
          </Link>
        </div>

        {/* Value Prop */}
        <div className="space-y-4 my-8 relative z-10">
          <h1 className="text-2xl lg:text-3xl font-bold text-[#2E3A28] leading-[1.25] tracking-tight">
            Đặt lại mật khẩu an toàn.
          </h1>
          <p className="text-sm lg:text-base text-[#6B7665] leading-relaxed">
            Tạo mật khẩu mới và sẵn sàng tiếp tục lộ trình học từ vựng của bạn.
          </p>

          <div className="space-y-2.5 pt-6 border-t border-[#E7EEDC]">
            <div className="text-xs lg:text-sm font-semibold text-[#2E3A28] flex items-center gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#A8D672] shrink-0" />
              <span>Cập nhật mật khẩu trực tiếp</span>
            </div>
            <div className="text-xs lg:text-sm font-semibold text-[#2E3A28] flex items-center gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#A8D672] shrink-0" />
              <span>Đăng nhập ngay sau khi hoàn tất</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-[11px] text-[#6B7665]/70 font-medium">
          © 2026 LeafLearn. Nền tảng học từ vựng tiếng Anh tối giản.
        </div>
      </div>

      {/* 2. Right Reset Form Column (~52% width) */}
      <div className="w-full md:w-[52%] bg-white p-6 sm:p-10 lg:p-[48px] flex flex-col justify-center">
        {/* Mobile Header Logo */}
        <div className="md:hidden text-center mb-6">
          <Link to="/" className="inline-flex items-center gap-3">
            <img
              src="/logo.png"
              alt="LeafLearn Logo"
              className="w-11 h-11 object-contain rounded-full mix-blend-multiply"
            />
            <span className="tracking-tight font-bold text-2xl text-[#2E3A28]">
              LeafLearn
            </span>
          </Link>
        </div>

        {checkingSession ? (
          /* Loading session check state */
          <div className="py-12 text-center text-sm font-medium text-[#6B7665] animate-pulse">
            Đang xác thực liên kết khôi phục mật khẩu...
          </div>
        ) : !isValidSession ? (
          /* Invalid / Expired Reset Link Error Panel */
          <div className="space-y-6 text-center py-4">
            <div className="w-14 h-14 rounded-full bg-[#E57373]/15 border border-[#E57373]/30 flex items-center justify-center mx-auto text-[#E57373] font-bold text-2xl">
              !
            </div>

            <div className="space-y-2">
              <h2 className="text-xl sm:text-2xl font-bold text-[#2E3A28] tracking-tight">
                Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn
              </h2>
              <p className="text-xs sm:text-sm text-[#6B7665] leading-relaxed max-w-sm mx-auto">
                Liên kết này có thể đã được sử dụng hoặc quá thời hạn cho phép. Vui lòng gửi lại yêu cầu để nhận liên kết mới.
              </p>
            </div>

            <div className="pt-2">
              <Link
                to="/forgot-password"
                className="inline-flex items-center justify-center w-full h-[50px] rounded-xl bg-[#A8D672] hover:bg-[#97C95E] text-[#2E3A28] font-semibold text-sm transition-all shadow-2xs cursor-pointer"
              >
                Yêu cầu liên kết mới
              </Link>
            </div>
          </div>
        ) : isSuccess ? (
          /* Success State Panel */
          <div className="space-y-6 text-center py-4">
            <div className="w-14 h-14 rounded-full bg-[#5B9E60]/15 border border-[#5B9E60]/30 flex items-center justify-center mx-auto text-[#5B9E60] font-bold text-2xl">
              ✓
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-[#2E3A28] tracking-tight">
                Đặt lại mật khẩu thành công
              </h2>
              <p className="text-xs sm:text-sm text-[#6B7665] leading-relaxed max-w-sm mx-auto">
                Bạn có thể sử dụng mật khẩu mới để đăng nhập LeafLearn.
              </p>
            </div>

            <div className="pt-2">
              <Link
                to="/login"
                className="inline-flex items-center justify-center w-full h-[50px] rounded-xl bg-[#A8D672] hover:bg-[#97C95E] text-[#2E3A28] font-semibold text-sm transition-all shadow-2xs cursor-pointer"
              >
                Đăng nhập
              </Link>
            </div>
          </div>
        ) : (
          /* Normal Password Input Form State */
          <div>
            <div className="space-y-1.5 mb-6 sm:mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-[#2E3A28] tracking-tight">
                Đặt mật khẩu mới
              </h2>
              <p className="text-xs sm:text-sm text-[#6B7665]">
                Tạo mật khẩu mới cho tài khoản LeafLearn của bạn.
              </p>
            </div>

            {authError && (
              <div className="mb-5 bg-[#E57373]/15 border border-[#E57373]/30 p-3.5 rounded-xl text-xs text-[#E57373] font-medium text-center leading-relaxed">
                {authError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* New Password Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-[#2E3A28]">
                    Mật khẩu mới
                  </label>
                  <span className="text-[11px] text-[#6B7665]">Tối thiểu 8 ký tự</span>
                </div>
                <input
                  type="password"
                  value={password}
                  disabled={submitting}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
                  }}
                  placeholder="Nhập mật khẩu mới"
                  className={`w-full h-[50px] px-4 rounded-xl border text-sm text-[#2E3A28] placeholder-[#6B7665]/60 transition-all focus:outline-none disabled:bg-[#F8FCF4] ${
                    errors.password
                      ? 'border-[#E57373] bg-[#E57373]/5'
                      : 'border-[#E1E8D8] bg-white focus:border-[#A8D672]'
                  }`}
                />
                {errors.password && (
                  <span className="block text-xs text-[#E57373] font-medium">
                    {errors.password}
                  </span>
                )}
              </div>

              {/* Confirm New Password Field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#2E3A28]">
                  Xác nhận mật khẩu mới
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  disabled={submitting}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: '' }));
                  }}
                  placeholder="Nhập lại mật khẩu mới"
                  className={`w-full h-[50px] px-4 rounded-xl border text-sm text-[#2E3A28] placeholder-[#6B7665]/60 transition-all focus:outline-none disabled:bg-[#F8FCF4] ${
                    errors.confirmPassword
                      ? 'border-[#E57373] bg-[#E57373]/5'
                      : 'border-[#E1E8D8] bg-white focus:border-[#A8D672]'
                  }`}
                />
                {errors.confirmPassword && (
                  <span className="block text-xs text-[#E57373] font-medium">
                    {errors.confirmPassword}
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting || !password || !confirmPassword}
                className="w-full h-[50px] rounded-xl bg-[#A8D672] hover:bg-[#97C95E] text-[#2E3A28] font-semibold text-sm transition-all cursor-pointer shadow-2xs active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {submitting ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
              </button>
            </form>

            <div className="mt-8 text-center text-xs sm:text-sm text-[#6B7665]">
              <Link to="/login" className="text-[#5B9E60] hover:underline font-semibold">
                Quay lại đăng nhập
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
