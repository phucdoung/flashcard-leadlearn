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
    <div className="py-4 px-4 max-w-2xl mx-auto space-y-6 w-full">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold text-[#14261C] tracking-tight">
          Thông tin cá nhân
        </h1>
        <p className="text-xs sm:text-sm text-[#556551]">
          Quản lý thông tin tài khoản và bảo mật của bạn trên LeafLearn.
        </p>
      </div>

      {/* Main Form Container Card */}
      <div className="bg-white border border-[#DCE5D8] rounded-xl p-6 sm:p-8 space-y-8 shadow-xs">
        {/* Section 0: Avatar Management */}
        <div className="space-y-4 pb-6 border-b border-[#DCE5D8]">
          <h3 className="text-base font-bold text-[#14261C]">Ảnh đại diện</h3>

          {avatarMessage.text && (
            <div
              className={`p-3 rounded-lg text-xs font-semibold ${
                avatarMessage.type === 'error'
                  ? 'bg-[#FFF2F0] border border-[#FFA39E] text-[#CF1322]'
                  : 'bg-[#F6FFED] border border-[#B7EB8F] text-[#24693D]'
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
                  className="w-20 h-20 rounded-full object-cover border-2 border-[#24693D] shadow-xs"
                />
              ) : savedAvatarUrl ? (
                <img
                  src={savedAvatarUrl}
                  alt="Current Avatar"
                  className="w-20 h-20 rounded-full object-cover border border-[#DCE5D8] shadow-xs"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-[#24693D] text-white font-bold text-2xl flex items-center justify-center border border-[#1D5732] shadow-xs">
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
                      className="inline-flex items-center justify-center px-3.5 py-1.5 rounded-lg border border-[#DCE5D8] bg-white text-xs font-semibold text-[#14261C] hover:border-[#24693D] hover:bg-[#F8FCF4] transition-all cursor-pointer shadow-2xs"
                    >
                      Tải ảnh lên
                    </label>

                    {savedAvatarUrl && (
                      <>
                        {showConfirmRemove ? (
                          <div className="inline-flex items-center gap-1.5">
                            <Button
                              type="danger"
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
                            className="text-[#CF1322] hover:bg-[#FFF2F0]"
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
          <h3 className="text-base font-bold text-[#14261C]">Thông tin tài khoản</h3>

          {infoSuccess && (
            <div className="p-3 bg-[#F6FFED] border border-[#B7EB8F] rounded-lg text-xs font-semibold text-[#24693D]">
              ✓ {infoSuccess}
            </div>
          )}

          {infoError && (
            <div className="p-3 bg-[#FFF2F0] border border-[#FFA39E] rounded-lg text-xs font-semibold text-[#CF1322]">
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
              <label className="block text-xs font-semibold text-[#14261C]">
                Email
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                readOnly
                className="w-full h-10 px-3.5 rounded-lg border border-[#DCE5D8] bg-[#F8FCF4] text-sm text-[#556551] cursor-not-allowed font-mono select-none"
              />
              <p className="text-[11px] text-[#8C9B86]">
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
              <label className="inline-flex items-center gap-2.5 text-xs font-medium text-[#14261C] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showPhone}
                  onChange={(e) => setShowPhone(e.target.checked)}
                  className="w-4 h-4 rounded border-[#DCE5D8] text-[#24693D] focus:ring-[#24693D] accent-[#24693D] cursor-pointer"
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
        <div className="space-y-4 pt-6 border-t border-[#DCE5D8]">
          <h3 className="text-base font-bold text-[#14261C]">Đổi mật khẩu</h3>

          {passwordSuccess && (
            <div className="p-3 bg-[#F6FFED] border border-[#B7EB8F] rounded-lg text-xs font-semibold text-[#24693D]">
              ✓ {passwordSuccess}
            </div>
          )}

          {passwordError && (
            <div className="p-3 bg-[#FFF2F0] border border-[#FFA39E] rounded-lg text-xs font-semibold text-[#CF1322]">
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
        <div className="space-y-3 pt-6 border-t border-[#FFA39E]/40">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[#CF1322]">Khu vực nguy hiểm</h3>
            <p className="text-xs text-[#556551] leading-relaxed">
              Xóa tài khoản sẽ xóa vĩnh viễn tài khoản và dữ liệu học tập của bạn. Hành động này không thể hoàn tác.
            </p>
          </div>

          <div>
            <Button
              type="danger"
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
        <div className="pt-4 border-t border-[#DCE5D8] flex justify-end">
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
              type="danger"
              onClick={handleDeleteAccount}
              loading={deleteSubmitting}
              disabled={deleteInput !== 'XÓA' || deleteSubmitting}
            >
              {deleteSubmitting ? 'Đang xóa...' : 'Xóa tài khoản vĩnh viễn'}
            </Button>
          </div>
        }
      >
        <p className="text-xs text-[#556551] leading-relaxed mb-4">
          Hành động này sẽ xóa vĩnh viễn toàn bộ dữ liệu học tập và không thể hoàn tác. Để tiếp tục, vui lòng nhập chuỗi <strong className="text-[#14261C] font-mono">XÓA</strong> vào ô dưới đây.
        </p>

        {deleteError && (
          <div className="mb-4 p-3 bg-[#FFF2F0] border border-[#FFA39E] rounded-lg text-xs font-semibold text-[#CF1322]">
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
