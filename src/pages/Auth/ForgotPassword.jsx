import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [authError, setAuthError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // 60-second timer countdown effect
  useEffect(() => {
    if (countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown]);

  const validateEmail = (val) => {
    const sanitized = val.trim().toLowerCase();
    if (!sanitized) {
      setEmailError('Vui lòng nhập địa chỉ email.');
      return false;
    }

    // Strict email format validation regex
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(sanitized)) {
      setEmailError('Vui lòng nhập địa chỉ email hợp lệ.');
      return false;
    }

    setEmailError('');
    return true;
  };

  const sendResetEmail = async (targetEmail) => {
    setAuthError('');
    setSubmitting(true);

    try {
      const resetRedirectUrl = `${window.location.origin}/reset-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: resetRedirectUrl,
      });

      if (error) {
        console.error('Reset password error:', error);

        // Security Error Mapping (No internal stack trace, no account enumeration)
        const errMsg = error.message ? error.message.toLowerCase() : '';
        const errStatus = error.status;

        if (errStatus === 429 || errMsg.includes('rate limit') || errMsg.includes('too many requests')) {
          setAuthError('Bạn đã yêu cầu liên kết quá nhanh. Vui lòng đợi một chút rồi thử lại.');
        } else if (errMsg.includes('failed to fetch') || errMsg.includes('network error')) {
          setAuthError('Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.');
        } else {
          setAuthError('Không thể gửi yêu cầu lúc này. Vui lòng thử lại sau.');
        }
      } else {
        setIsSubmitted(true);
        setSubmittedEmail(targetEmail);
        setCountdown(60); // Start 60-second countdown lock
      }
    } catch (err) {
      console.error('Reset password exception:', err);
      setAuthError('Không thể gửi yêu cầu lúc này. Vui lòng thử lại sau.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (submitting || countdown > 0) return;

    const sanitized = email.trim().toLowerCase();
    if (!validateEmail(sanitized)) return;

    sendResetEmail(sanitized);
  };

  const handleResend = () => {
    if (submitting || countdown > 0 || !submittedEmail) return;
    sendResetEmail(submittedEmail);
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
            Khôi phục truy cập tài khoản.
          </h1>
          <p className="text-sm lg:text-base text-[#6B7665] leading-relaxed">
            Chúng tôi sẽ gửi liên kết bảo mật giúp bạn thiết lập lại mật khẩu an toàn.
          </p>

          <div className="space-y-2.5 pt-6 border-t border-[#E7EEDC]">
            <div className="text-xs lg:text-sm font-semibold text-[#2E3A28] flex items-center gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#A8D672] shrink-0" />
              <span>Bảo mật chống dò quét Email</span>
            </div>
            <div className="text-xs lg:text-sm font-semibold text-[#2E3A28] flex items-center gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#A8D672] shrink-0" />
              <span>Liên kết xác nhận có thời hạn</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-[11px] text-[#6B7665]/70 font-medium">
          © 2026 LeafLearn. Nền tảng học từ vựng tiếng Anh tối giản.
        </div>
      </div>

      {/* 2. Right Form Column (~52% width) */}
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

        {isSubmitted ? (
          /* Neutral Anti-Account-Enumeration Success State */
          <div className="space-y-6 text-center py-2">
            <div className="w-14 h-14 rounded-full bg-[#5B9E60]/15 border border-[#5B9E60]/30 flex items-center justify-center mx-auto text-[#5B9E60] font-bold text-2xl">
              ✓
            </div>

            <div className="space-y-2.5">
              <h2 className="text-2xl font-bold text-[#2E3A28] tracking-tight">
                Kiểm tra email của bạn
              </h2>
              <p className="text-xs sm:text-sm text-[#6B7665] leading-relaxed max-w-sm mx-auto">
                Nếu tài khoản gắn với <strong className="text-[#2E3A28]">{submittedEmail}</strong> tồn tại, bạn sẽ nhận được liên kết đặt lại mật khẩu.
              </p>
              <p className="text-xs text-[#6B7665]/80 italic">
                (Vui lòng kiểm tra cả thư mục Spam hoặc Thư rác)
              </p>
            </div>

            {authError && (
              <div className="bg-[#E57373]/15 border border-[#E57373]/30 p-3 rounded-xl text-xs text-[#E57373] font-medium text-center">
                {authError}
              </div>
            )}

            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={handleResend}
                disabled={submitting || countdown > 0}
                className="w-full h-[48px] rounded-xl bg-white border border-[#E7EEDC] hover:bg-[#F8FCF4] text-[#2E3A28] font-semibold text-sm transition-all shadow-2xs cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting
                  ? 'Đang gửi...'
                  : countdown > 0
                  ? `Gửi lại sau ${countdown}s`
                  : 'Gửi lại liên kết'}
              </button>

              <Link
                to="/login"
                className="inline-flex items-center justify-center w-full h-[48px] rounded-xl bg-[#A8D672] hover:bg-[#97C95E] text-[#2E3A28] font-semibold text-sm transition-all shadow-2xs cursor-pointer"
              >
                Quay lại đăng nhập
              </Link>
            </div>
          </div>
        ) : (
          /* Normal Input Form State */
          <div>
            <div className="space-y-1.5 mb-6 sm:mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-[#2E3A28] tracking-tight">
                Quên mật khẩu?
              </h2>
              <p className="text-xs sm:text-sm text-[#6B7665] leading-relaxed">
                Nhập email đã đăng ký. LeafLearn sẽ gửi cho bạn liên kết để đặt lại mật khẩu.
              </p>
            </div>

            {authError && (
              <div className="mb-5 bg-[#E57373]/15 border border-[#E57373]/30 p-3.5 rounded-xl text-xs text-[#E57373] font-medium text-center leading-relaxed">
                {authError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
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
                    if (emailError) setEmailError('');
                  }}
                  placeholder="Nhập email của bạn"
                  className={`w-full h-[50px] px-4 rounded-xl border text-sm text-[#2E3A28] placeholder-[#6B7665]/60 transition-all focus:outline-none disabled:bg-[#F8FCF4] ${
                    emailError
                      ? 'border-[#E57373] bg-[#E57373]/5'
                      : 'border-[#E1E8D8] bg-white focus:border-[#A8D672]'
                  }`}
                />
                {emailError && (
                  <span className="block text-xs text-[#E57373] font-medium">
                    {emailError}
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting || countdown > 0 || !email.trim()}
                className="w-full h-[50px] rounded-xl bg-[#A8D672] hover:bg-[#97C95E] text-[#2E3A28] font-semibold text-sm transition-all cursor-pointer shadow-2xs active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {submitting
                  ? 'Đang gửi...'
                  : countdown > 0
                  ? `Gửi lại sau ${countdown}s`
                  : 'Gửi liên kết đặt lại mật khẩu'}
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
