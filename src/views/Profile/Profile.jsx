import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { Button, Input, Modal } from '../../components/common';

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
          console.error('Fetch profile data error:', err);
        }
      }

      fetchProfileData();
    }
  }, [user]);

  // Derived user display info
  const displayName =
    fullName.trim() ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'Người học';

  const avatarLetter = displayName.charAt(0).toUpperCase();
  const savedAvatarUrl = user?.user_metadata?.avatar_url || null;

  // Avatar Selection & Preview (Max 2MB, JPEG/PNG/WebP)
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarMessage({ type: '', text: '' });

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setAvatarMessage({
        type: 'error',
        text: 'Định dạng ảnh không hợp lệ. Vui lòng chọn ảnh JPEG, PNG hoặc WebP.',
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setAvatarMessage({
        type: 'error',
        text: 'Kích thước ảnh vượt quá giới hạn 2MB. Vui lòng chọn ảnh nhỏ hơn.',
      });
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setAvatarPreview(objectUrl);
  };

  const handleCancelPreview = () => {
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
    }
    setAvatarPreview(null);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Upload Avatar to Supabase Storage Bucket 'avatars'
  const handleSaveAvatar = async () => {
    if (!selectedFile || !user) return;

    setAvatarUploading(true);
    setAvatarMessage({ type: '', text: '' });

    try {
      const fileExt = selectedFile.name.split('.').pop();
      const filePath = `${user.id}/avatar_${Date.now()}.${fileExt}`;

      // 1. Upload to Supabase Storage 'avatars' bucket
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        console.error('Upload avatar storage error:', uploadError);
        setAvatarMessage({
          type: 'error',
          text: `Tải ảnh lên thất bại: ${uploadError.message}`,
        });
        setAvatarUploading(false);
        return;
      }

      // 2. Get Public URL
      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData?.publicUrl;
      if (!publicUrl) {
        setAvatarMessage({
          type: 'error',
          text: 'Không thể lấy đường dẫn ảnh đại diện.',
        });
        setAvatarUploading(false);
        return;
      }

      // 3. Update Supabase Auth user metadata
      const { error: updateAuthError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      });

      if (updateAuthError) {
        console.error('Update auth user metadata error:', updateAuthError);
        setAvatarMessage({
          type: 'error',
          text: 'Cập nhật thông tin tài khoản thất bại.',
        });
        setAvatarUploading(false);
        return;
      }

      // 4. Update public.profiles table
      try {
        await supabase.from('profiles').upsert({
          id: user.id,
          avatar_url: publicUrl,
          full_name: fullName.trim() || user.user_metadata?.full_name || 'Người học',
          phone: phone.trim() || null,
          show_phone: showPhone,
          updated_at: new Date().toISOString(),
        });
      } catch (profileErr) {
        console.error('Update profiles table error:', profileErr);
      }

      setAvatarMessage({
        type: 'success',
        text: 'Cập nhật ảnh đại diện thành công.',
      });
      handleCancelPreview();
    } catch (err) {
      console.error('Save avatar exception:', err);
      setAvatarMessage({
        type: 'error',
        text: 'Đã xảy ra lỗi khi lưu ảnh đại diện.',
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
      // 1. Clear user_metadata.avatar_url
      const { error: updateAuthError } = await supabase.auth.updateUser({
        data: { avatar_url: null },
      });

      if (updateAuthError) {
        console.error('Remove avatar error:', updateAuthError);
        setAvatarMessage({
          type: 'error',
          text: 'Xóa ảnh đại diện thất bại.',
        });
        setAvatarUploading(false);
        return;
      }

      // 2. Clear public.profiles avatar_url
      try {
        await supabase.from('profiles').upsert({
          id: user.id,
          avatar_url: null,
          full_name: fullName.trim() || user.user_metadata?.full_name || 'Người học',
          phone: phone.trim() || null,
          show_phone: showPhone,
          updated_at: new Date().toISOString(),
        });
      } catch (profileErr) {
        console.error('Clear profile avatar error:', profileErr);
      }

      setAvatarMessage({
        type: 'success',
        text: 'Đã xóa ảnh đại diện.',
      });
      setShowConfirmRemove(false);
    } catch (err) {
      console.error('Remove avatar exception:', err);
      setAvatarMessage({
        type: 'error',
        text: 'Đã xảy ra lỗi khi xóa ảnh đại diện.',
      });
    } finally {
      setAvatarUploading(false);
    }
  };

  // Save Account Information (Full Name + Phone + Show Phone)
  const handleSaveInfo = async (e) => {
    e.preventDefault();
    setInfoError('');
    setInfoSuccess('');

    const trimmedName = fullName.trim();
    if (!trimmedName) {
      setInfoError('Họ và tên không được để trống.');
      return;
    }
    if (trimmedName.length < 2) {
      setInfoError('Họ và tên phải có tối thiểu 2 ký tự.');
      return;
    }

    const sanitizedPhone = phone.trim();
    if (sanitizedPhone) {
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
        setPasswordError('Đổi mật khẩu thất bại. Vui lòng thử lại.');
      } else {
        setPasswordSuccess('Mật khẩu đã được cập nhật thành công.');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setPasswordSuccess(''), 4000);
      }
    } catch (err) {
      console.error('Update password exception:', err);
      setPasswordError('Đổi mật khẩu thất bại. Vui lòng thử lại.');
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
    <div className="py-4 px-4 max-w-2xl mx-auto space-y-6 w-full">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Thông tin cá nhân
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Quản lý thông tin tài khoản và bảo mật của bạn trên LeafLearn.
        </p>
      </div>

      {/* Main Form Container Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 space-y-8 shadow-xs">
        {/* Section 0: Avatar Management */}
        <div className="space-y-4 pb-6 border-b border-slate-200">
          <h3 className="text-base font-bold text-slate-900">Ảnh đại diện</h3>

          {avatarMessage.text && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold ${
                avatarMessage.type === 'error'
                  ? 'bg-rose-50 border border-rose-200 text-rose-800'
                  : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
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
                  className="w-20 h-20 rounded-full object-cover border-2 border-emerald-500 shadow-sm"
                />
              ) : savedAvatarUrl ? (
                <img
                  src={savedAvatarUrl}
                  alt="Current Avatar"
                  className="w-20 h-20 rounded-full object-cover border border-slate-200 shadow-sm"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-emerald-600 text-white font-bold text-2xl flex items-center justify-center border border-emerald-700 shadow-sm">
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
                    <Button
                      type="primary"
                      size="small"
                      onClick={handleSaveAvatar}
                      loading={avatarUploading}
                    >
                      Lưu ảnh mới
                    </Button>
                    <Button
                      type="default"
                      size="small"
                      onClick={handleCancelPreview}
                      disabled={avatarUploading}
                    >
                      Hủy
                    </Button>
                  </>
                ) : (
                  <>
                    <label
                      htmlFor="avatar-upload-input"
                      className="inline-flex items-center justify-center px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 hover:border-emerald-500 hover:bg-slate-50 transition-all cursor-pointer shadow-2xs"
                    >
                      Tải ảnh lên
                    </label>

                    {savedAvatarUrl && (
                      <>
                        {showConfirmRemove ? (
                          <div className="inline-flex items-center gap-1.5">
                            <Button
                              danger
                              size="small"
                              onClick={handleRemoveAvatar}
                              loading={avatarUploading}
                            >
                              Xác nhận xóa
                            </Button>
                            <Button
                              type="default"
                              size="small"
                              onClick={() => setShowConfirmRemove(false)}
                            >
                              Hủy
                            </Button>
                          </div>
                        ) : (
                          <Button
                            type="text"
                            size="small"
                            onClick={() => setShowConfirmRemove(true)}
                            className="text-rose-600 hover:bg-rose-50"
                          >
                            Xóa ảnh
                          </Button>
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
          <h3 className="text-base font-bold text-slate-900">Thông tin tài khoản</h3>

          {infoSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800">
              ✓ {infoSuccess}
            </div>
          )}

          {infoError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800">
              ✕ {infoError}
            </div>
          )}

          <form onSubmit={handleSaveInfo} className="space-y-4">
            <Input
              label="Họ và tên"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nhập họ và tên..."
            />

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-800">
                Email
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                readOnly
                className="w-full h-10 px-3.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-600 cursor-not-allowed font-mono select-none"
              />
              <p className="text-[11px] text-slate-400">
                Email được dùng làm định danh đăng nhập và không thể thay đổi.
              </p>
            </div>

            {/* Phone Number Field */}
            <Input
              label="Số điện thoại (tùy chọn)"
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Nhập số điện thoại của bạn..."
            />

            {/* Public Phone Visibility Checkbox */}
            <div className="pt-1">
              <label className="inline-flex items-center gap-2.5 text-xs font-medium text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showPhone}
                  onChange={(e) => setShowPhone(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                />
                <span>Hiển thị số điện thoại trên hồ sơ cộng đồng</span>
              </label>
            </div>

            {isInfoChanged && (
              <div className="pt-2">
                <Button
                  htmlType="submit"
                  type="primary"
                  loading={infoSubmitting}
                >
                  {infoSubmitting ? 'Đang lưu...' : 'Lưu thông tin'}
                </Button>
              </div>
            )}
          </form>
        </div>

        {/* Section 2: Password Change Form */}
        <div className="space-y-4 pt-6 border-t border-slate-200">
          <h3 className="text-base font-bold text-slate-900">Đổi mật khẩu</h3>

          {passwordSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800">
              ✓ {passwordSuccess}
            </div>
          )}

          {passwordError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800">
              ✕ {passwordError}
            </div>
          )}

          <form onSubmit={handleSavePassword} className="space-y-4">
            <Input
              label="Mật khẩu mới"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Tối thiểu 8 ký tự..."
            />

            <Input
              label="Xác nhận mật khẩu mới"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu mới..."
            />

            {(newPassword || confirmPassword) && (
              <div className="pt-2">
                <Button
                  htmlType="submit"
                  type="primary"
                  loading={passwordSubmitting}
                >
                  {passwordSubmitting ? 'Đang đổi mật khẩu...' : 'Cập nhật mật khẩu'}
                </Button>
              </div>
            )}
          </form>
        </div>

        {/* Section 3: Danger Zone - Delete Account */}
        <div className="space-y-3 pt-6 border-t border-rose-200/60">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-rose-600">Khu vực nguy hiểm</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Xóa tài khoản sẽ xóa vĩnh viễn tài khoản và dữ liệu học tập của bạn. Hành động này không thể hoàn tác.
            </p>
          </div>

          <div>
            <Button
              danger
              onClick={() => {
                setShowDeleteModal(true);
                setDeleteInput('');
                setDeleteError('');
              }}
            >
              Xóa tài khoản
            </Button>
          </div>
        </div>

        {/* Section 4: Logout Action */}
        <div className="pt-4 border-t border-slate-200 flex justify-end">
          <Button type="default" onClick={handleLogout}>
            Đăng xuất khỏi tài khoản
          </Button>
        </div>
      </div>

      {/* Delete Account Confirmation Modal using Ant Design Modal component */}
      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Xác nhận xóa tài khoản"
        width="max-w-md"
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <Button
              type="default"
              onClick={() => setShowDeleteModal(false)}
              disabled={deleteSubmitting}
            >
              Hủy
            </Button>
            <Button
              danger
              onClick={handleDeleteAccount}
              loading={deleteSubmitting}
              disabled={deleteInput !== 'XÓA' || deleteSubmitting}
            >
              {deleteSubmitting ? 'Đang xóa...' : 'Xóa tài khoản vĩnh viễn'}
            </Button>
          </div>
        }
      >
        <p className="text-xs text-slate-600 leading-relaxed mb-4">
          Hành động này sẽ xóa vĩnh viễn toàn bộ dữ liệu học tập và không thể hoàn tác. Để tiếp tục, vui lòng nhập chuỗi <strong className="text-slate-900 font-mono">XÓA</strong> vào ô dưới đây.
        </p>

        {deleteError && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800">
            ✕ {deleteError}
          </div>
        )}

        <Input
          label='Nhập "XÓA" để xác nhận'
          type="text"
          value={deleteInput}
          onChange={(e) => setDeleteInput(e.target.value)}
          placeholder="XÓA"
        />
      </Modal>
    </div>
  );
}
