import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [errors, setErrors] = useState({});
  const [authError, setAuthError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Account deleted message state
  const [accountDeletedMsg, setAccountDeletedMsg] = useState(
    location.state?.accountDeleted ? 'Tài khoản của bạn đã được xóa.' : ''
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
        console.error('Login error:', error);
        const errMsg = error.message ? error.message.toLowerCase() : '';

        // Check if error is due to unconfirmed email
        if (errMsg.includes('email not confirmed') || errMsg.includes('email_not_confirmed')) {
          setAuthError(
            'Email của bạn chưa được xác nhận. Vui lòng kiểm tra hộp thư và xác nhận tài khoản trước khi đăng nhập.'
          );
          setShowResendOption(true);
        } else if (errMsg.includes('failed to fetch') || errMsg.includes('network error')) {
          setAuthError('Không thể kết nối. Vui lòng kiểm tra kết nối mạng và thử lại.');
        } else {
          setAuthError('Email hoặc mật khẩu không chính xác.');
        }
      } else {
        navigate('/');
      }
    } catch (err) {
      console.error('Login exception:', err);
      setAuthError('Không thể kết nối đến máy chủ Supabase. Vui lòng thử lại sau.');
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
    <div className="bg-white border border-[#E7EEDC] rounded-[22px] shadow-sm overflow-hidden flex flex-col md:flex-row w-full my-auto">
      {/* 1. Left Branding Column (~48% width) */}
      <div className="hidden md:flex md:w-[48%] bg-[#F8FCF4] border-r border-[#E7EEDC] p-8 lg:p-11 flex-col justify-between relative overflow-hidden">
        <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-[#A8D672]/20 blur-2xl pointer-events-none" />

        {/* Top: Logo & Brand Name */}
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

        {/* Middle: Brand Value Proposition */}
        <div className="space-y-4 my-8 relative z-10">
          <h1 className="text-2xl lg:text-3xl font-bold text-[#2E3A28] leading-[1.25] tracking-tight">
            Học từ vựng dễ dàng hơn mỗi ngày.
          </h1>
          <p className="text-sm lg:text-base text-[#6B7665] leading-relaxed">
            Tạo Flashcard, ghi nhớ từ vựng và luyện tập thông minh cùng AI.
          </p>

          <div className="space-y-2.5 pt-6 border-t border-[#E7EEDC]">
            <div className="text-xs lg:text-sm font-semibold text-[#2E3A28] flex items-center gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#A8D672] shrink-0" />
              <span>Tạo bộ Flashcard cá nhân</span>
            </div>
            <div className="text-xs lg:text-sm font-semibold text-[#2E3A28] flex items-center gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#A8D672] shrink-0" />
              <span>Luyện tập với bài kiểm tra AI</span>
            </div>
            <div className="text-xs lg:text-sm font-semibold text-[#2E3A28] flex items-center gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#A8D672] shrink-0" />
              <span>Theo dõi tiến độ học tập</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-[11px] text-[#6B7665]/70 font-medium">
          © 2026 LeafLearn. Nền tảng học từ vựng tiếng Anh tối giản.
        </div>
      </div>

      {/* 2. Right Login Form Column (~52% width) */}
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

        {/* Form Heading & Subheading */}
        <div className="space-y-1.5 mb-6 sm:mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#2E3A28] tracking-tight">
            Chào mừng trở lại
          </h2>
          <p className="text-xs sm:text-sm text-[#6B7665]">
            Đăng nhập để tiếp tục hành trình học tập cùng LeafLearn.
          </p>
        </div>

        {/* Account Deleted Success Alert */}
        {accountDeletedMsg && (
          <div className="mb-5 bg-[#5B9E60]/15 border border-[#5B9E60]/30 p-3.5 rounded-xl text-xs font-semibold text-[#5B9E60] text-center leading-relaxed">
            ✓ {accountDeletedMsg}
          </div>
        )}

        {/* Supabase Error Alert */}
        {authError && (
          <div className="mb-5 bg-[#E57373]/15 border border-[#E57373]/30 p-3.5 rounded-xl text-xs text-[#E57373] font-medium text-center leading-relaxed space-y-2">
            <p>{authError}</p>

            {/* Resend Unconfirmed Email Action */}
            {showResendOption && (
              <div className="pt-1 border-t border-[#E57373]/20">
                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  disabled={resending || resendCountdown > 0}
                  className="text-xs font-semibold text-[#2E3A28] underline hover:text-[#5B9E60] transition-colors cursor-pointer disabled:opacity-60"
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
          <div className="mb-5 bg-[#5B9E60]/15 border border-[#5B9E60]/30 p-3.5 rounded-xl text-xs text-[#5B9E60] font-medium text-center leading-relaxed">
            {resendMsg}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#2E3A28]">
              Email
            </label>
            <input
              type="email"
              value={email}
              disabled={submitting}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
              }}
              placeholder="Nhập email của bạn"
              className={`w-full h-[50px] px-4 rounded-xl border text-sm text-[#2E3A28] placeholder-[#6B7665]/60 transition-all focus:outline-none disabled:bg-[#F8FCF4] ${
                errors.email
                  ? 'border-[#E57373] bg-[#E57373]/5'
                  : 'border-[#E1E8D8] bg-white focus:border-[#A8D672]'
              }`}
            />
            {errors.email && (
              <span className="block text-xs text-[#E57373] font-medium">
                {errors.email}
              </span>
            )}
          </div>

          {/* Password Field with Forgot Password link aligned on right */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-[#2E3A28]">
                Mật khẩu
              </label>
              <Link
                to="/forgot-password"
                className="text-xs font-semibold text-[#5B9E60] hover:text-[#2E3A28] hover:underline transition-colors"
              >
                Quên mật khẩu?
              </Link>
            </div>
            <input
              type="password"
              value={password}
              disabled={submitting}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
              }}
              placeholder="Nhập mật khẩu của bạn"
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

          {/* Primary Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full h-[50px] rounded-xl bg-[#A8D672] hover:bg-[#97C95E] text-[#2E3A28] font-semibold text-sm transition-all cursor-pointer shadow-2xs active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        {/* Footer Link to Register */}
        <div className="mt-8 text-center text-xs sm:text-sm text-[#6B7665]">
          Chưa có tài khoản?{' '}
          <Link to="/register" className="text-[#5B9E60] hover:underline font-semibold">
            Đăng ký
          </Link>
        </div>
      </div>
    </div>
  );
}
