import React, { useState, useRef, useEffect } from 'react';
import { X, Folder, ChevronDown, Check, FolderX, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function MoveDeckModal({
  isOpen,
  open,
  onClose,
  deck = null,
  deckTitle,
  folders = [],
  selectedFolderId: controlledFolderId,
  setSelectedFolderId: setControlledFolderId,
  onSave,
  isLoading,
  loading,
}) {
  const show = isOpen !== undefined ? isOpen : open;
  const isBusy = isLoading !== undefined ? isLoading : Boolean(loading);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [internalFolderId, setInternalFolderId] = useState(null);
  const [folderList, setFolderList] = useState(folders);
  const dropdownRef = useRef(null);

  // Sync folderList from props or fallback to fetch from flashcard_folders
  useEffect(() => {
    if (folders && folders.length > 0) {
      setFolderList(folders);
    } else if (show) {
      const fetchFolders = async () => {
        try {
          const { data, error } = await supabase
            .from('flashcard_folders')
            .select('id, name')
            .order('name', { ascending: true });
          if (!error && data) {
            setFolderList(data);
          }
        } catch (err) {
          console.error('Fetch folders error:', err);
        }
      };
      fetchFolders();
    }
  }, [folders, show]);

  // Sync initial selected folder when modal opens
  useEffect(() => {
    if (show) {
      setDropdownOpen(false);
      const initialFId =
        controlledFolderId !== undefined
          ? controlledFolderId
          : deck?.folder_id && UUID_REGEX.test(deck.folder_id)
          ? deck.folder_id
          : null;
      setInternalFolderId(initialFId);
    }
  }, [show, deck, controlledFolderId]);

  // Handle active selected folder ID
  const activeFolderId = controlledFolderId !== undefined ? controlledFolderId : internalFolderId;
  const handleSelectFolder = (id) => {
    const validId = id && UUID_REGEX.test(id) ? id : null;
    if (setControlledFolderId) {
      setControlledFolderId(validId);
    } else {
      setInternalFolderId(validId);
    }
    setDropdownOpen(false);
  };

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!show) return null;

  const currentFolder = folderList.find((f) => f.id === activeFolderId);
  const displayTitle = deckTitle || deck?.title || deck?.name || 'Bộ thẻ';

  const handleSaveClick = () => {
    const finalFolderId = activeFolderId && UUID_REGEX.test(activeFolderId) ? activeFolderId : null;
    if (onSave) {
      onSave(deck?.id, finalFolderId);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn duration-150">
      <div className="bg-white w-full max-w-md rounded-3xl border border-slate-200/90 shadow-2xl p-6 flex flex-col gap-6 relative overflow-visible">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="text-xl font-bold tracking-tight text-slate-900">
            Di chuyển bộ thẻ vào thư mục
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Chọn thư mục đích cho bộ thẻ <span className="font-semibold text-slate-800">"{displayTitle}"</span>:
          </p>

          <div className="space-y-1.5 relative" ref={dropdownRef}>
            <label className="block text-xs font-semibold text-slate-700">
              Thư mục lưu trữ
            </label>

            {/* Custom Select Trigger Box */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-full flex items-center justify-between px-3.5 py-3 bg-slate-50 border border-slate-200/90 rounded-xl text-sm font-medium text-slate-800 hover:bg-slate-100/60 focus:outline-none focus:border-[#1b4332] focus:ring-4 focus:ring-[#1b4332]/10 transition-all text-left cursor-pointer"
              >
                <div className="flex items-center gap-2.5 truncate">
                  {currentFolder ? (
                    <Folder className="w-4 h-4 text-[#1b4332] shrink-0" strokeWidth={1.8} />
                  ) : (
                    <FolderX className="w-4 h-4 text-slate-400 shrink-0" strokeWidth={1.8} />
                  )}
                  <span className={currentFolder ? 'text-slate-800 font-semibold truncate' : 'text-slate-500 truncate'}>
                    {currentFolder ? currentFolder.name : '(Không thuộc thư mục nào)'}
                  </span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${
                    dropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Custom Dropdown Menu */}
              {dropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-150 rounded-2xl shadow-xl p-1.5 z-50 max-h-56 overflow-y-auto space-y-0.5 animate-fadeIn">
                  <button
                    type="button"
                    onClick={() => handleSelectFolder(null)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      !activeFolderId
                        ? 'bg-[#1b4332]/10 text-[#1b4332]'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FolderX className="w-4 h-4 text-slate-400 shrink-0" strokeWidth={1.8} />
                      <span>(Không thuộc thư mục nào)</span>
                    </div>
                    {!activeFolderId && <Check className="w-3.5 h-3.5 text-[#1b4332] shrink-0" strokeWidth={2.5} />}
                  </button>

                  {folderList.map((folder) => {
                    const isSelected = activeFolderId === folder.id;
                    return (
                      <button
                        key={folder.id}
                        type="button"
                        onClick={() => handleSelectFolder(folder.id)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#1b4332]/10 text-[#1b4332]'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Folder className="w-4 h-4 text-[#1b4332] shrink-0" strokeWidth={1.8} />
                          <span className="truncate">{folder.name}</span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#1b4332] shrink-0" strokeWidth={2.5} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all cursor-pointer disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSaveClick}
            disabled={isBusy}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#1b4332] hover:bg-[#143326] active:bg-[#0e241b] text-white text-sm font-semibold shadow-md shadow-[#1b4332]/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
          >
            {isBusy && <Loader2 className="w-4 h-4 animate-spin" />}
            {isBusy ? 'Đang lưu...' : 'Lưu vị trí'}
          </button>
        </div>
      </div>
    </div>
  );
}
