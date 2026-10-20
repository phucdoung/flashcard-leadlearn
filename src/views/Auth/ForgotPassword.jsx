import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { Button, Input } from '../../components/common';

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
        setCountdown(60);
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
            Khôi phục truy cập tài khoản.
          </h1>
          <p className="text-sm lg:text-base text-slate-600 leading-relaxed">
            Chúng tôi sẽ gửi liên kết bảo mật giúp bạn thiết lập lại mật khẩu an toàn.
          </p>

          <div className="space-y-3 pt-6 border-t border-slate-200">
            <div className="text-xs lg:text-sm font-semibold text-slate-800 flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span>Bảo mật chống dò quét Email</span>
            </div>
            <div className="text-xs lg:text-sm font-semibold text-slate-800 flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span>Liên kết xác nhận có thời hạn</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-[11px] text-slate-400 font-medium">
          © 2026 LeafLearn. Nền tảng học từ vựng tiếng Anh tối giản.
        </div>
      </div>

      {/* 2. Right Form Column (~52% width) */}
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

        {isSubmitted ? (
          /* Neutral Anti-Account-Enumeration Success State */
          <div className="space-y-6 text-center py-2">
            <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-600 font-bold text-2xl shadow-xs">
              ✓
            </div>

            <div className="space-y-2.5">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                Kiểm tra email của bạn
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-sm mx-auto">
                Nếu tài khoản gắn với <strong className="text-slate-900">{submittedEmail}</strong> tồn tại, bạn sẽ nhận được liên kết đặt lại mật khẩu.
              </p>
              <p className="text-xs text-slate-400 italic">
                (Vui lòng kiểm tra cả thư mục Spam hoặc Thư rác)
              </p>
            </div>

            {authError && (
              <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl text-xs text-rose-800 font-medium text-center">
                {authError}
              </div>
            )}

            <div className="space-y-3 pt-2">
              <Button
                type="default"
                size="large"
                block
                onClick={handleResend}
                disabled={submitting || countdown > 0}
              >
                {submitting
                  ? 'Đang gửi...'
                  : countdown > 0
                  ? `Gửi lại sau ${countdown}s`
                  : 'Gửi lại liên kết'}
              </Button>

              <Link to="/login" className="block w-full">
                <Button type="primary" size="large" block>
                  Quay lại đăng nhập
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          /* Normal Input Form State */
          <div>
            <div className="space-y-1 mb-6 sm:mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Quên mật khẩu?
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                Nhập email đã đăng ký. LeafLearn sẽ gửi cho bạn liên kết để đặt lại mật khẩu.
              </p>
            </div>

            {authError && (
              <div className="mb-5 bg-rose-50 border border-rose-200 p-3.5 rounded-xl text-xs text-rose-800 font-medium text-center leading-relaxed">
                {authError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Email"
                type="email"
                value={email}
                disabled={submitting}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError('');
                }}
                placeholder="Nhập email của bạn"
                status={emailError ? 'error' : ''}
                error={emailError}
              />

              <div className="pt-2">
                <Button
                  htmlType="submit"
                  type="primary"
                  size="large"
                  block
                  loading={submitting}
                  disabled={submitting || countdown > 0 || !email.trim()}
                >
                  {submitting
                    ? 'Đang gửi...'
                    : countdown > 0
                    ? `Gửi lại sau ${countdown}s`
                    : 'Gửi liên kết đặt lại mật khẩu'}
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
