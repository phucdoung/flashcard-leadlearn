import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

export default function Register() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [errors, setErrors] = useState({});
  const [authError, setAuthError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

  const validate = () => {
    const newErrors = {};

    // 1. Full Name Validation (min 2 chars)
    const trimmedName = fullName.trim();
    if (!trimmedName) {
      newErrors.fullName = 'Vui lòng nhập Họ và tên';
    } else if (trimmedName.length < 2) {
      newErrors.fullName = 'Họ và tên phải có tối thiểu 2 ký tự';
    }

    // 2. Strict Email Regex Validation
    const sanitizedEmail = email.trim().toLowerCase();
    if (!sanitizedEmail) {
      newErrors.email = 'Vui lòng nhập địa chỉ Email';
    } else {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(sanitizedEmail)) {
        newErrors.email = 'Vui lòng nhập địa chỉ email hợp lệ.';
      }
    }

    // 3. Password Validation (min 8 chars)
    if (!password) {
      newErrors.password = 'Vui lòng nhập mật khẩu';
    } else if (password.length < 8) {
      newErrors.password = 'Mật khẩu phải có tối thiểu 8 ký tự';
    }

    // 4. Confirm Password Matching
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Vui lòng xác nhận mật khẩu';
    } else if (confirmPassword !== password) {
      newErrors.confirmPassword = 'Mật khẩu xác nhận không khớp';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');

    if (submitting || !validate()) return;

    setSubmitting(true);
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const loginRedirectUrl = `${window.location.origin}/login`;

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
          emailRedirectTo: loginRedirectUrl,
        },
      });

      // Development mode logging (NO password or token logged)
      if (import.meta.env.DEV) {
        console.log('[Register] Supabase signUp response:', {
          errorCode: error?.code,
          errorMessage: error?.message,
          hasUser: Boolean(data?.user),
          identitiesLength: data?.user?.identities?.length,
          hasSession: Boolean(data?.session),
        });
      }

      if (error) {
        console.error('Sign up error:', error);
        const errMsg = error.message ? error.message.toLowerCase() : '';

        if (
          errMsg.includes('already registered') ||
          errMsg.includes('already in use') ||
          errMsg.includes('user_already_exists') ||
          error.code === 'user_already_exists'
        ) {
          setAuthError('Email này đã được sử dụng. Vui lòng đăng nhập hoặc sử dụng email khác.');
        } else if (errMsg.includes('failed to fetch') || errMsg.includes('network error')) {
          setAuthError('Không thể kết nối. Vui lòng kiểm tra kết nối mạng và thử lại.');
        } else {
          setAuthError('Không thể đăng ký tài khoản lúc này. Vui lòng thử lại sau.');
        }
      } else if (
        data?.user &&
        Array.isArray(data.user.identities) &&
        data.user.identities.length === 0
      ) {
        // Supabase obfuscated response for already registered email
        console.warn('[Register] Detected already registered email via empty identities array');
        setAuthError('Email này đã được sử dụng. Vui lòng đăng nhập hoặc sử dụng email khác.');
      } else if (data?.user) {
        // Valid new user registration
        setRegisteredEmail(normalizedEmail);
      } else {
        setAuthError('Không thể đăng ký tài khoản lúc này. Vui lòng thử lại sau.');
      }
    } catch (err) {
      console.error('Sign up exception:', err);
      setAuthError('Không thể kết nối đến máy chủ Supabase. Vui lòng thử lại sau.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-[#E7EEDC] rounded-[22px] shadow-sm overflow-hidden flex flex-col md:flex-row w-full my-auto">
      {/* 1. Left Branding Column (Desktop & Tablet: ~48% width) */}
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

        {/* Brand Value Proposition */}
        <div className="space-y-4 my-8 relative z-10">
          <h1 className="text-2xl lg:text-3xl font-bold text-[#2E3A28] leading-[1.25] tracking-tight">
            Tạo tài khoản LeafLearn ngay hôm nay.
          </h1>
          <p className="text-sm lg:text-base text-[#6B7665] leading-relaxed">
            Bắt đầu hành trình ghi nhớ từ vựng hiệu quả mỗi ngày cùng trí tuệ nhân tạo.
          </p>

          <div className="space-y-2.5 pt-6 border-t border-[#E7EEDC]">
            <div className="text-xs lg:text-sm font-semibold text-[#2E3A28] flex items-center gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#A8D672] shrink-0" />
              <span>Bắt buộc xác nhận Email trước khi đăng nhập</span>
            </div>
            <div className="text-xs lg:text-sm font-semibold text-[#2E3A28] flex items-center gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#A8D672] shrink-0" />
              <span>Gợi ý nghĩa từ vựng tự động bằng AI</span>
            </div>
            <div className="text-xs lg:text-sm font-semibold text-[#2E3A28] flex items-center gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#A8D672] shrink-0" />
              <span>Chia sẻ bộ thẻ với cộng đồng</span>
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

        {registeredEmail ? (
          /* Mandatory Email Confirmation Panel */
          <div className="space-y-6 text-center py-2">
            <div className="w-14 h-14 rounded-full bg-[#5B9E60]/15 border border-[#5B9E60]/30 flex items-center justify-center mx-auto text-[#5B9E60] font-bold text-2xl">
              ✓
            </div>

            <div className="space-y-2.5">
              <h2 className="text-2xl font-bold text-[#2E3A28] tracking-tight">
                Đăng ký thành công!
              </h2>
              <p className="text-xs sm:text-sm text-[#6B7665] leading-relaxed">
                Chúng tôi đã gửi một liên kết xác nhận đến email:
                <span className="block font-semibold text-[#2E3A28] font-mono mt-1">
                  {registeredEmail}
                </span>
              </p>
              <div className="p-4 bg-[#F8FCF4] border border-[#E7EEDC] rounded-xl text-xs text-[#6B7665] text-left leading-relaxed mt-3">
                <span className="font-semibold text-[#2E3A28] block mb-1">
                  📌 Bước tiếp theo:
                </span>
                Mở hộp thư điện tử của bạn và nhấn vào nút <strong>"Xác nhận tài khoản"</strong> để có thể đăng nhập vào LeafLearn.
              </div>
            </div>

            <div className="pt-4 border-t border-[#E7EEDC]">
              <Link
                to="/login"
                className="w-full h-[48px] rounded-xl bg-[#A8D672] hover:bg-[#97C95E] text-[#2E3A28] font-semibold text-sm transition-all cursor-pointer shadow-2xs flex items-center justify-center"
              >
                Đến trang Đăng nhập
              </Link>
            </div>
          </div>
        ) : (
          /* Normal Registration Input Form State */
          <div>
            <div className="space-y-1.5 mb-6 sm:mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-[#2E3A28] tracking-tight">
                Tạo tài khoản
              </h2>
              <p className="text-xs sm:text-sm text-[#6B7665]">
                Đăng ký để trải nghiệm công cụ học tập thông minh cùng LeafLearn.
              </p>
            </div>

            {authError && (
              <div className="mb-5 bg-[#E57373]/15 border border-[#E57373]/30 p-3.5 rounded-xl text-xs text-[#E57373] font-medium text-center leading-relaxed space-y-2">
                <p>{authError}</p>
                {authError.includes('đã được sử dụng') && (
                  <div className="pt-1 border-t border-[#E57373]/20">
                    <Link
                      to="/login"
                      className="text-xs font-semibold text-[#2E3A28] underline hover:text-[#5B9E60] transition-colors"
                    >
                      Đến trang Đăng nhập ➔
                    </Link>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full Name Field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#2E3A28]">
                  Họ và tên
                </label>
                <input
                  type="text"
                  value={fullName}
                  disabled={submitting}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: '' }));
                  }}
                  placeholder="Nguyễn Văn A"
                  className={`w-full h-[48px] px-4 rounded-xl border text-sm text-[#2E3A28] placeholder-[#6B7665]/60 transition-all focus:outline-none disabled:bg-[#F8FCF4] ${
                    errors.fullName
                      ? 'border-[#E57373] bg-[#E57373]/5'
                      : 'border-[#E1E8D8] bg-white focus:border-[#A8D672]'
                  }`}
                />
                {errors.fullName && (
                  <span className="block text-xs text-[#E57373] font-medium">
                    {errors.fullName}
                  </span>
                )}
              </div>

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
                  placeholder="name@example.com"
                  className={`w-full h-[48px] px-4 rounded-xl border text-sm text-[#2E3A28] placeholder-[#6B7665]/60 transition-all focus:outline-none disabled:bg-[#F8FCF4] ${
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

              {/* Password Field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#2E3A28]">
                  Mật khẩu
                </label>
                <input
                  type="password"
                  value={password}
                  disabled={submitting}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
                  }}
                  placeholder="Tối thiểu 8 ký tự"
                  className={`w-full h-[48px] px-4 rounded-xl border text-sm text-[#2E3A28] placeholder-[#6B7665]/60 transition-all focus:outline-none disabled:bg-[#F8FCF4] ${
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

              {/* Confirm Password Field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#2E3A28]">
                  Xác nhận mật khẩu
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  disabled={submitting}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: '' }));
                  }}
                  placeholder="Nhập lại mật khẩu"
                  className={`w-full h-[48px] px-4 rounded-xl border text-sm text-[#2E3A28] placeholder-[#6B7665]/60 transition-all focus:outline-none disabled:bg-[#F8FCF4] ${
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

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full h-[48px] rounded-xl bg-[#A8D672] hover:bg-[#97C95E] text-[#2E3A28] font-semibold text-sm transition-all cursor-pointer shadow-2xs active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {submitting ? 'Đang tạo tài khoản...' : 'Đăng ký'}
              </button>
            </form>

            {/* Footer Link */}
            <div className="mt-6 text-center text-xs sm:text-sm text-[#6B7665]">
              Đã có tài khoản?{' '}
              <Link to="/login" className="text-[#5B9E60] hover:underline font-semibold">
                Đăng nhập
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
