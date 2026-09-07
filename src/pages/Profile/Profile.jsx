import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';

export default function Profile() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const fileInputRef = useRef(null);

  // Avatar state
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState({ type: '', text: '' });
  const [showConfirmRemove, setShowConfirmRemove] = useState(false);

  // Name & Phone form state
  const [fullName, setFullName] = useState('');
  const [initialFullName, setInitialFullName] = useState('');

  const [phone, setPhone] = useState('');
  const [initialPhone, setInitialPhone] = useState('');
  const [showPhone, setShowPhone] = useState(false);
  const [initialShowPhone, setInitialShowPhone] = useState(false);

  const [infoSubmitting, setInfoSubmitting] = useState(false);
  const [infoSuccess, setInfoSuccess] = useState('');
  const [infoError, setInfoError] = useState('');

  // Password form state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Delete Account modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Sync user metadata & DB profile on mount/user change
  useEffect(() => {
    if (user) {
      const currentName = user.user_metadata?.full_name || user.user_metadata?.name || '';
      setFullName(currentName);
      setInitialFullName(currentName);

      // Fetch phone & show_phone from public.profiles
      async function fetchProfileData() {
        try {
          const { data: dbProfile } = await supabase
            .from('profiles')
            .select('phone, show_phone')
            .eq('id', user.id)
            .single();

          if (dbProfile) {
            const userPhone = dbProfile.phone || user.user_metadata?.phone || '';
            const userShowPhone = Boolean(dbProfile.show_phone ?? user.user_metadata?.show_phone ?? false);

            setPhone(userPhone);
            setInitialPhone(userPhone);
            setShowPhone(userShowPhone);
            setInitialShowPhone(userShowPhone);
          }
        } catch (err) {
          console.warn('[Profile] Fetch profile phone warning:', err);
        }
      }

      fetchProfileData();
    }
  }, [user]);

  // Current active avatar URL from metadata
  const savedAvatarUrl = user?.user_metadata?.avatar_url || null;

  // Initial letter for fallback avatar
  const avatarLetter = (
    fullName.trim().length > 0
      ? fullName.trim().charAt(0)
      : user?.email?.charAt(0) || 'U'
  ).toUpperCase();

  // Handle File Selection
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarMessage({ type: '', text: '' });
    setShowConfirmRemove(false);

    // Validate type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setAvatarMessage({
        type: 'error',
        text: 'Vui lòng chọn ảnh JPG, PNG hoặc WEBP.',
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validate size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      setAvatarMessage({
        type: 'error',
        text: 'Ảnh đại diện không được vượt quá 2MB.',
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Local preview
    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setAvatarPreview(objectUrl);
  };

  // Cancel Preview
  const handleCancelPreview = () => {
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
    }
    setAvatarPreview(null);
    setSelectedFile(null);
    setAvatarMessage({ type: '', text: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Upload Avatar
  const handleSaveAvatar = async () => {
    if (!selectedFile || !user) return;
    setAvatarUploading(true);
    setAvatarMessage({ type: '', text: '' });

    try {
      const fileExt = selectedFile.name.split('.').pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, selectedFile, {
          upsert: true,
          contentType: selectedFile.type,
        });

      if (uploadError) {
        console.error('Upload avatar storage error:', uploadError);
        setAvatarMessage({
          type: 'error',
          text: 'Không thể tải ảnh lên. Vui lòng thử lại.',
        });
        setAvatarUploading(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const newAvatarUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

      // Save avatar_url to auth user_metadata
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          avatar_url: newAvatarUrl,
        },
      });

      if (updateError) {
        console.error('Save avatar metadata error:', updateError);
        setAvatarMessage({
          type: 'error',
          text: 'Không thể cập nhật ảnh đại diện. Vui lòng thử lại.',
        });
      } else {
        // Sync to public.profiles table ensuring full_name is preserved
        try {
          const preservedName = user.user_metadata?.full_name || fullName.trim() || user.email?.split('@')[0] || 'Người học LeafLearn';
          await supabase.from('profiles').upsert({
            id: user.id,
            full_name: preservedName,
            avatar_url: newAvatarUrl,
            phone: phone.trim() || null,
            show_phone: showPhone,
            updated_at: new Date().toISOString(),
          });
        } catch (syncErr) {
          console.error('Profiles sync error:', syncErr);
        }

        setAvatarMessage({
          type: 'success',
          text: 'Đã cập nhật ảnh đại diện.',
        });
        handleCancelPreview();
        setTimeout(() => setAvatarMessage({ type: '', text: '' }), 4000);
      }
    } catch (err) {
      console.error('Save avatar exception:', err);
      setAvatarMessage({
        type: 'error',
        text: 'Không thể cập nhật ảnh đại diện. Vui lòng thử lại.',
      });
    } finally {
      setAvatarUploading(false);
    }
  };

  // Remove Avatar
  const handleRemoveAvatar = async () => {
    if (!user) return;
    setAvatarUploading(true);
    setAvatarMessage({ type: '', text: '' });

    try {
      // Clear avatar_url from user metadata
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          avatar_url: null,
        },
      });

      if (updateError) {
        console.error('Remove avatar error:', updateError);
        setAvatarMessage({
          type: 'error',
          text: 'Không thể xóa ảnh đại diện. Vui lòng thử lại.',
        });
      } else {
        // Sync to public.profiles table preserving full_name
        try {
          const preservedName = user.user_metadata?.full_name || fullName.trim() || user.email?.split('@')[0] || 'Người học LeafLearn';
          await supabase.from('profiles').upsert({
            id: user.id,
            full_name: preservedName,
            avatar_url: null,
            phone: phone.trim() || null,
            show_phone: showPhone,
            updated_at: new Date().toISOString(),
          });
        } catch (syncErr) {
          console.error('Profiles sync error:', syncErr);
        }

        setAvatarMessage({
          type: 'success',
          text: 'Đã xóa ảnh đại diện.',
        });
        setShowConfirmRemove(false);
        setTimeout(() => setAvatarMessage({ type: '', text: '' }), 4000);
      }
    } catch (err) {
      console.error('Remove avatar exception:', err);
      setAvatarMessage({
        type: 'error',
        text: 'Không thể xóa ảnh đại diện. Vui lòng thử lại.',
      });
    } finally {
      setAvatarUploading(false);
    }
  };

  // Save Name & Phone Info Change
  const handleSaveInfo = async (e) => {
    e.preventDefault();
    setInfoError('');
    setInfoSuccess('');

    const trimmedName = fullName.trim();
    if (!trimmedName) {
      setInfoError('Họ và tên không được để trống.');
      return;
    }

    const sanitizedPhone = phone.trim();
    if (sanitizedPhone) {
      // Lightweight validation: 9-15 chars, numbers, spaces, plus, hyphens, parentheses
      const phoneRegex = /^[0-9+\-\s()]{9,15}$/;
      if (!phoneRegex.test(sanitizedPhone)) {
        setInfoError('Số điện thoại không hợp lệ.');
        return;
      }
    }

    setInfoSubmitting(true);

    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: trimmedName,
          phone: sanitizedPhone,
          show_phone: showPhone,
        },
      });

      if (error) {
        console.error('Update user metadata error:', error);
        setInfoError('Không thể cập nhật thông tin cá nhân. Vui lòng thử lại.');
      } else {
        // Sync to public.profiles table
        try {
          await supabase.from('profiles').upsert({
            id: user.id,
            full_name: trimmedName,
            avatar_url: user.user_metadata?.avatar_url || null,
            phone: sanitizedPhone || null,
            show_phone: showPhone,
            updated_at: new Date().toISOString(),
          });
        } catch (syncErr) {
          console.error('Profiles sync error:', syncErr);
        }

        setInfoSuccess('Đã cập nhật thông tin cá nhân.');
        setInitialFullName(trimmedName);
        setInitialPhone(sanitizedPhone);
        setInitialShowPhone(showPhone);
        setTimeout(() => setInfoSuccess(''), 4000);
      }
    } catch (err) {
      console.error('Update user metadata exception:', err);
      setInfoError('Không thể cập nhật thông tin cá nhân. Vui lòng thử lại.');
    } finally {
      setInfoSubmitting(false);
    }
  };

  // Save Password Change
  const handleSavePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!newPassword) {
      setPasswordError('Vui lòng nhập mật khẩu mới.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('Mật khẩu mới phải có tối thiểu 8 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setPasswordSubmitting(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        console.error('Update password error:', error);
        setPasswordError('Không thể cập nhật mật khẩu. Vui lòng thử lại.');
      } else {
        setPasswordSuccess('Đã cập nhật mật khẩu thành công.');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setPasswordSuccess(''), 4000);
      }
    } catch (err) {
      console.error('Update password exception:', err);
      setPasswordError('Không thể cập nhật mật khẩu. Vui lòng thử lại sau.');
    } finally {
      setPasswordSubmitting(false);
    }
  };

  // Logout Handler
  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  // Delete Account Handler using Server-side Supabase Edge Function
  const handleDeleteAccount = async () => {
    if (deleteInput !== 'XÓA' || deleteSubmitting) return;

    setDeleteSubmitting(true);
    setDeleteError('');

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session || !session.access_token) {
        console.error('[delete-account] Error: No active session or access token found', sessionError);
        setDeleteError('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
        setDeleteSubmitting(false);
        return;
      }

      console.log('[delete-account] Invoking Edge Function delete-account...');

      const { data, error } = await supabase.functions.invoke('delete-account', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('[delete-account] Edge Function invocation error:', error);
        setDeleteError('Không thể xóa tài khoản lúc này. Vui lòng thử lại.');
      } else if (data && data.success === true) {
        console.log('[delete-account] Account deleted successfully:', data);
        await signOut();
        navigate('/login', { state: { accountDeleted: true } });
      } else {
        console.error('[delete-account] Edge Function server-side error:', data);
        setDeleteError(data?.error || 'Không thể xóa tài khoản lúc này. Vui lòng thử lại.');
      }
    } catch (err) {
      console.error('[delete-account] Unexpected invocation exception:', err);
      setDeleteError('Không thể xóa tài khoản lúc này. Vui lòng thử lại.');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const isInfoChanged =
    fullName.trim() !== initialFullName ||
    phone.trim() !== initialPhone ||
    showPhone !== initialShowPhone;

  return (
    <div className="py-2 px-4 max-w-2xl mx-auto space-y-6 w-full">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold text-[#2E3A28]">
          Thông tin cá nhân
        </h1>
        <p className="text-xs sm:text-sm text-[#6B7665]">
          Quản lý thông tin tài khoản và bảo mật của bạn trên LeafLearn.
        </p>
      </div>

      {/* Main Form Container Card */}
      <div className="bg-white border border-[#E7EEDC] rounded-2xl p-6 sm:p-8 space-y-8 shadow-2xs">
        {/* Section 0: Avatar Management */}
        <div className="space-y-4 pb-6 border-b border-[#E7EEDC]">
          <h3 className="text-base font-bold text-[#2E3A28]">Ảnh đại diện</h3>

          {avatarMessage.text && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold ${
                avatarMessage.type === 'error'
                  ? 'bg-[#E57373]/10 border border-[#E57373]/30 text-[#E57373]'
                  : 'bg-[#5B9E60]/10 border border-[#5B9E60]/30 text-[#5B9E60]'
              }`}
            >
              {avatarMessage.type === 'error' ? '✕ ' : '✓ '}
              {avatarMessage.text}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center gap-5">
            {/* Avatar Preview Circle */}
            <div className="relative shrink-0">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Avatar Preview"
                  className="w-20 h-20 rounded-full object-cover border-2 border-[#A8D672] shadow-2xs"
                />
              ) : savedAvatarUrl ? (
                <img
                  src={savedAvatarUrl}
                  alt="Current Avatar"
                  className="w-20 h-20 rounded-full object-cover border border-[#E7EEDC] shadow-2xs"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-[#A8D672] text-[#2E3A28] font-bold text-2xl flex items-center justify-center border border-[#97C95E]/50 shadow-2xs">
                  {avatarLetter}
                </div>
              )}
            </div>

            {/* Avatar Controls */}
            <div className="space-y-2 text-center sm:text-left flex-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileSelect}
                className="hidden"
                id="avatar-upload-input"
              />

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                {avatarPreview ? (
                  <>
                    <button
                      type="button"
                      onClick={handleSaveAvatar}
                      disabled={avatarUploading}
                      className="px-4 py-2 rounded-xl bg-[#A8D672] hover:bg-[#97C95E] text-[#2E3A28] text-xs font-bold transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                    >
                      {avatarUploading ? 'Đang lưu...' : 'Lưu ảnh mới'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelPreview}
                      disabled={avatarUploading}
                      className="px-4 py-2 rounded-xl bg-white border border-[#E7EEDC] hover:bg-[#F8FCF4] text-xs font-semibold text-[#6B7665] transition-all cursor-pointer"
                    >
                      Hủy
                    </button>
                  </>
                ) : (
                  <>
                    <label
                      htmlFor="avatar-upload-input"
                      className="px-4 py-2 rounded-xl bg-white border border-[#E7EEDC] hover:border-[#A8D672] hover:bg-[#F8FCF4] text-[#2E3A28] text-xs font-semibold transition-all cursor-pointer shadow-2xs inline-block"
                    >
                      Tải ảnh lên
                    </label>

                    {savedAvatarUrl && (
                      <>
                        {showConfirmRemove ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={handleRemoveAvatar}
                              disabled={avatarUploading}
                              className="px-3 py-1.5 rounded-xl bg-[#E57373] text-white text-xs font-bold transition-all cursor-pointer shadow-2xs"
                            >
                              Xác nhận xóa
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowConfirmRemove(false)}
                              className="px-3 py-1.5 rounded-xl bg-white border border-[#E7EEDC] text-xs font-medium text-[#6B7665] transition-all cursor-pointer"
                            >
                              Hủy
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setShowConfirmRemove(true)}
                            className="px-3.5 py-1.5 rounded-xl bg-transparent hover:bg-[#E57373]/10 text-xs font-medium text-[#E57373] transition-all cursor-pointer"
                          >
                            Xóa ảnh
                          </button>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Section 1: Account Information Form */}
        <div className="space-y-4">
          <h3 className="text-base font-bold text-[#2E3A28]">Thông tin tài khoản</h3>

          {infoSuccess && (
            <div className="p-3 bg-[#5B9E60]/10 border border-[#5B9E60]/30 rounded-xl text-xs font-semibold text-[#5B9E60]">
              ✓ {infoSuccess}
            </div>
          )}

          {infoError && (
            <div className="p-3 bg-[#E57373]/10 border border-[#E57373]/30 rounded-xl text-xs font-semibold text-[#E57373]">
              ✕ {infoError}
            </div>
          )}

          <form onSubmit={handleSaveInfo} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[#2E3A28]">
                Họ và tên
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nhập họ và tên..."
                className="w-full px-4 py-2.5 rounded-xl border border-[#E7EEDC] bg-white text-sm text-[#2E3A28] focus:outline-none focus:border-[#A8D672] transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[#2E3A28]">
                Email
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                readOnly
                className="w-full px-4 py-2.5 rounded-xl border border-[#E7EEDC] bg-[#F8FCF4] text-sm text-[#6B7665] cursor-not-allowed font-mono select-none"
              />
              <p className="text-[11px] text-[#6B7665]">
                Email được dùng làm định danh đăng nhập và không thể thay đổi.
              </p>
            </div>

            {/* Phone Number Field */}
            <div className="space-y-1.5 pt-1">
              <label className="block text-xs font-medium text-[#2E3A28]">
                Số điện thoại (tùy chọn)
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Nhập số điện thoại của bạn..."
                className="w-full px-4 py-2.5 rounded-xl border border-[#E7EEDC] bg-white text-sm text-[#2E3A28] focus:outline-none focus:border-[#A8D672] transition-colors"
              />
            </div>

            {/* Public Phone Visibility Checkbox */}
            <div className="pt-1">
              <label className="inline-flex items-center gap-2.5 text-xs font-medium text-[#2E3A28] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showPhone}
                  onChange={(e) => setShowPhone(e.target.checked)}
                  className="w-4 h-4 rounded border-[#E7EEDC] text-[#5B9E60] focus:ring-[#A8D672] accent-[#5B9E60] cursor-pointer"
                />
                <span>Hiển thị số điện thoại trên hồ sơ cộng đồng</span>
              </label>
            </div>

            {isInfoChanged && (
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={infoSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-[#A8D672] hover:bg-[#97C95E] text-[#2E3A28] text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-[0.99] disabled:opacity-50"
                >
                  {infoSubmitting ? 'Đang lưu...' : 'Lưu thông tin'}
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Section 2: Password Change Form */}
        <div className="space-y-4 pt-6 border-t border-[#E7EEDC]">
          <h3 className="text-base font-bold text-[#2E3A28]">Đổi mật khẩu</h3>

          {passwordSuccess && (
            <div className="p-3 bg-[#5B9E60]/10 border border-[#5B9E60]/30 rounded-xl text-xs font-semibold text-[#5B9E60]">
              ✓ {passwordSuccess}
            </div>
          )}

          {passwordError && (
            <div className="p-3 bg-[#E57373]/10 border border-[#E57373]/30 rounded-xl text-xs font-semibold text-[#E57373]">
              ✕ {passwordError}
            </div>
          )}

          <form onSubmit={handleSavePassword} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[#2E3A28]">
                Mật khẩu mới
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Tối thiểu 8 ký tự..."
                className="w-full px-4 py-2.5 rounded-xl border border-[#E7EEDC] bg-white text-sm text-[#2E3A28] focus:outline-none focus:border-[#A8D672] transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[#2E3A28]">
                Xác nhận mật khẩu mới
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới..."
                className="w-full px-4 py-2.5 rounded-xl border border-[#E7EEDC] bg-white text-sm text-[#2E3A28] focus:outline-none focus:border-[#A8D672] transition-colors"
              />
            </div>

            {(newPassword || confirmPassword) && (
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={passwordSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-[#A8D672] hover:bg-[#97C95E] text-[#2E3A28] text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-[0.99] disabled:opacity-50"
                >
                  {passwordSubmitting ? 'Đang đổi mật khẩu...' : 'Cập nhật mật khẩu'}
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Section 3: Danger Zone - Delete Account */}
        <div className="space-y-4 pt-6 border-t border-[#E57373]/20">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[#E57373]">Khu vực nguy hiểm</h3>
            <p className="text-xs text-[#6B7665] leading-relaxed">
              Xóa tài khoản sẽ xóa vĩnh viễn tài khoản và dữ liệu học tập của bạn. Hành động này không thể hoàn tác.
            </p>
          </div>

          <div>
            <button
              type="button"
              onClick={() => {
                setShowDeleteModal(true);
                setDeleteInput('');
                setDeleteError('');
              }}
              className="px-4 py-2 rounded-xl bg-white border border-[#E57373]/40 text-[#E57373] hover:bg-[#E57373]/10 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
            >
              Xóa tài khoản
            </button>
          </div>
        </div>

        {/* Section 4: Logout Action */}
        <div className="pt-4 border-t border-[#E7EEDC] flex justify-end">
          <button
            type="button"
            onClick={handleLogout}
            className="px-5 py-2.5 rounded-xl border border-[#E7EEDC] bg-white hover:bg-[#F8FCF4] text-[#2E3A28] text-xs font-semibold transition-all cursor-pointer shadow-2xs"
          >
            Đăng xuất khỏi tài khoản
          </button>
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-[#2E3A28]/30 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#E57373]/40 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-lg space-y-5">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-[#E57373]">Xác nhận xóa tài khoản</h2>
              <p className="text-xs text-[#6B7665] leading-relaxed">
                Hành động này sẽ xóa vĩnh viễn toàn bộ dữ liệu học tập và không thể hoàn tác. Để tiếp tục, vui lòng nhập chuỗi <strong className="text-[#2E3A28] font-mono">XÓA</strong> vào ô dưới đây.
              </p>
            </div>

            {deleteError && (
              <div className="p-3 bg-[#E57373]/10 border border-[#E57373]/30 rounded-xl text-xs font-semibold text-[#E57373]">
                ✕ {deleteError}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#2E3A28]">
                Nhập "XÓA" để xác nhận
              </label>
              <input
                type="text"
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                placeholder="XÓA"
                className="w-full px-4 py-2.5 rounded-xl border border-[#E7EEDC] bg-[#F8FCF4] text-sm text-[#2E3A28] font-mono focus:outline-none focus:border-[#E57373]"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleteSubmitting}
                className="px-4 py-2 rounded-xl bg-white border border-[#E7EEDC] hover:bg-[#F8FCF4] text-xs font-semibold text-[#6B7665] transition-all cursor-pointer"
              >
                Hủy
              </button>

              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteInput !== 'XÓA' || deleteSubmitting}
                className="px-4 py-2 rounded-xl bg-[#E57373] hover:bg-[#d32f2f] text-white text-xs font-bold transition-all cursor-pointer shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deleteSubmitting ? 'Đang xóa...' : 'Xóa tài khoản vĩnh viễn'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
