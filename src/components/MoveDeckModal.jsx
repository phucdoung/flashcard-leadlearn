import React, { useState, useEffect } from 'react';
import Modal from './common/Modal';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * MoveDeckModal Component
 * Modal to move a flashcard set (deck) into a specific folder or to root (null).
 * Enforces valid UUID for folder.id and converts empty string / falsy to null.
 */
export default function MoveDeckModal({
  open = false,
  deck = null,
  folders = [],
  onClose,
  onSave,
  loading = false,
}) {
  const [selectedFolderId, setSelectedFolderId] = useState('');

  // Sync initial deck folder_id when modal opens or deck changes
  useEffect(() => {
    if (deck) {
      const currentFId =
        deck.folder_id && typeof deck.folder_id === 'string' && UUID_REGEX.test(deck.folder_id.trim())
          ? deck.folder_id.trim()
          : '';
      setSelectedFolderId(currentFId);
    } else {
      setSelectedFolderId('');
    }
  }, [deck, open]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!deck) return;

    // Strict sanitization:
    // If empty string, falsy, or not a valid UUID => pass null to avoid Postgres Foreign Key violations
    let finalFolderId = null;
    if (selectedFolderId && typeof selectedFolderId === 'string') {
      const trimmed = selectedFolderId.trim();
      if (trimmed !== '' && trimmed !== 'null' && trimmed !== 'undefined' && UUID_REGEX.test(trimmed)) {
        finalFolderId = trimmed;
      }
    }

    onSave(deck.id, finalFolderId);
  };

  return (
    <Modal
      open={open && !!deck}
      title="Di chuyển bộ thẻ vào thư mục"
      onCancel={onClose}
      onOk={handleSubmit}
      okText={loading ? 'Đang lưu...' : 'Lưu vị trí'}
      confirmLoading={loading}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-slate-600">
          Chọn thư mục đích cho bộ thẻ <strong className="text-slate-900">"{deck?.title || deck?.name}"</strong>:
        </p>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-800">
            Thư mục lưu trữ
          </label>
          <select
            value={selectedFolderId || ''}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedFolderId(val ? val.trim() : '');
            }}
            className="w-full h-10 px-3.5 rounded-xl border border-slate-200/80 focus:border-[#1b4332] outline-none text-sm text-slate-800 bg-white cursor-pointer"
          >
            <option value="">(Không thuộc thư mục nào)</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                📁 {folder.name}
              </option>
            ))}
          </select>
        </div>
      </form>
    </Modal>
  );
}
