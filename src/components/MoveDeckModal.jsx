import React, { useState, useEffect } from 'react';
import Modal from './common/Modal';
import { supabase } from '../lib/supabaseClient';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * MoveDeckModal Component
 * Modal to move a flashcard set (deck) into a specific folder or to root (null).
 * Fetches folders from 'flashcard_folders' and enforces valid UUIDs for folder.id.
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
  const [folderList, setFolderList] = useState(folders);
  const [fetchingFolders, setFetchingFolders] = useState(false);

  // Sync folder list from props if provided
  useEffect(() => {
    if (folders && folders.length > 0) {
      setFolderList(folders);
    }
  }, [folders]);

  // Fetch folders directly from 'flashcard_folders' table when modal opens
  useEffect(() => {
    if (!open) return;

    const fetchFlashcardFolders = async () => {
      setFetchingFolders(true);
      try {
        const { data, error } = await supabase
          .from('flashcard_folders')
          .select('id, name')
          .order('name', { ascending: true });

        if (error) {
          console.error('Error fetching flashcard_folders in MoveDeckModal:', error);
        } else if (data) {
          setFolderList(data);
        }
      } catch (err) {
        console.error('Fetch flashcard_folders error:', err);
      } finally {
        setFetchingFolders(false);
      }
    };

    fetchFlashcardFolders();
  }, [open]);

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
            Thư mục lưu trữ {fetchingFolders && <span className="text-slate-400 font-normal text-xs">(Đang tải...)</span>}
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
            {folderList.map((folder) => (
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
