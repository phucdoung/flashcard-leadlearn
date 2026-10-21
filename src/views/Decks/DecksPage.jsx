import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { Button, Modal, MoveDeckModal } from '../../components';
import {
  Folder,
  Layers,
  ChevronRight,
  Plus,
  MoreHorizontal,
  Edit2,
  Trash2,
  FolderInput,
  ArrowLeft,
} from 'lucide-react';

export default function DecksPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  // Navigation & Hierarchy State
  const initialFolderId = searchParams.get('folder') || null;
  const [currentFolderId, setCurrentFolderId] = useState(initialFolderId);

  // Data State
  const [allFolders, setAllFolders] = useState([]);
  const [allSets, setAllSets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal States: Folder Create / Edit / Delete
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [submittingFolder, setSubmittingFolder] = useState(false);

  const [isEditFolderOpen, setIsEditFolderOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState(null);

  const [isDeleteFolderOpen, setIsDeleteFolderOpen] = useState(false);

  // Modal States: Flashcard Set Create / Move
  const [isCreateSetOpen, setIsCreateSetOpen] = useState(false);
  const [setName, setSetName] = useState('');
  const [setDescription, setSetDescription] = useState('');
  const [visibility, setVisibility] = useState('private');
  const [targetFolderId, setTargetFolderId] = useState(currentFolderId);
  const [submittingSet, setSubmittingSet] = useState(false);

  const [isMoveSetOpen, setIsMoveSetOpen] = useState(false);
  const [selectedSet, setSelectedSet] = useState(null);

  // Dropdown Action Menus
  const [openFolderMenuId, setOpenFolderMenuId] = useState(null);
  const [openDeckMenuId, setOpenDeckMenuId] = useState(null);

  // Close open dropdown menus on outside click or Escape key
  useEffect(() => {
    const handleDocumentClick = (e) => {
      if (!e.target.closest('[data-dropdown-container]')) {
        setOpenFolderMenuId(null);
        setOpenDeckMenuId(null);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setOpenFolderMenuId(null);
        setOpenDeckMenuId(null);
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Sync currentFolderId with URL query
  useEffect(() => {
    const fId = searchParams.get('folder') || null;
    setCurrentFolderId(fId);
  }, [searchParams]);

  // Navigate to folder and update URL
  const handleNavigateToFolder = (folderId) => {
    setCurrentFolderId(folderId);
    if (folderId) {
      setSearchParams({ folder: folderId });
    } else {
      setSearchParams({});
    }
  };

  // Fetch all user folders and sets
  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // 1. Fetch Folders from flashcard_folders
      let foldersList = [];
      try {
        const { data: fData, error: fError } = await supabase
          .from('flashcard_folders')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (fError) {
          console.warn('flashcard_folders table query note:', fError.message);
        } else if (fData) {
          foldersList = fData;
        }
      } catch (err) {
        console.warn('flashcard_folders table not accessible:', err);
      }

      // 2. Fetch Flashcard Sets with cards
      let setsList = [];
      try {
        const { data: sData, error: sError } = await supabase
          .from('flashcard_sets')
          .select('*, flashcards(*)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (sError) {
          console.error('Error fetching flashcard sets:', sError);
        } else if (sData) {
          setsList = sData.map((s) => {
            const cards = s.flashcards || [];
            const totalCards = cards.length;
            const masteredCards = cards.filter(
              (c) => c.learning_status === 'learned' || c.learning_status === 'mastered'
            ).length;
            const progress = totalCards > 0 ? Math.min(100, Math.round((masteredCards / totalCards) * 100)) : 0;

            return {
              id: s.id,
              title: s.name || s.title || 'Bộ thẻ mới',
              description: s.description || '',
              visibility: s.visibility || 'private',
              folder_id: s.folder_id || null,
              totalCards,
              masteredCards,
              progress,
              raw: s,
            };
          });
        }
      } catch (err) {
        console.error('Sets fetch error:', err);
      }

      setAllFolders(foldersList);
      setAllSets(setsList);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // Derived: Current folder object (if any)
  const currentFolder = useMemo(() => {
    if (!currentFolderId) return null;
    return allFolders.find((f) => f.id === currentFolderId) || null;
  }, [currentFolderId, allFolders]);

  // Derived: Breadcrumb Trail
  const breadcrumbTrail = useMemo(() => {
    if (!currentFolderId) return [];
    const trail = [];
    let curr = allFolders.find((f) => f.id === currentFolderId);
    while (curr) {
      trail.unshift(curr);
      curr = curr.parent_id ? allFolders.find((f) => f.id === curr.parent_id) : null;
    }
    return trail;
  }, [currentFolderId, allFolders]);

  // Filtered Items for Current Level
  const currentFolders = useMemo(() => {
    if (!currentFolderId) {
      return allFolders.filter((f) => !f.parent_id);
    }
    return allFolders.filter((f) => f.parent_id === currentFolderId);
  }, [currentFolderId, allFolders]);

  const currentDecks = useMemo(() => {
    if (!currentFolderId) {
      return allSets.filter((s) => !s.folder_id);
    }
    return allSets.filter((s) => s.folder_id === currentFolderId);
  }, [currentFolderId, allSets]);

  // Folder detail text generator: "3 thư mục · 12 bộ"
  const getFolderDetailText = (folderId) => {
    const subFolderCount = allFolders.filter((f) => f.parent_id === folderId).length;
    const deckCount = allSets.filter((s) => s.folder_id === folderId).length;

    const parts = [];
    if (subFolderCount > 0) parts.push(`${subFolderCount} thư mục`);
    if (deckCount > 0) parts.push(`${deckCount} bộ`);

    if (parts.length === 0) return '0 mục';
    return parts.join(' · ');
  };

  // ================= FOLDER ACTIONS =================
  const handleOpenCreateFolder = () => {
    setFolderName('');
    setIsCreateFolderOpen(true);
  };

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!folderName.trim() || !user) return;
    setSubmittingFolder(true);

    try {
      const payload = {
        name: folderName.trim(),
        user_id: user.id,
        parent_id: currentFolderId || null,
      };

      const { error } = await supabase.from('flashcard_folders').insert(payload);
      if (error) {
        alert(`Không thể tạo thư mục: ${error.message}`);
      } else {
        setIsCreateFolderOpen(false);
        setFolderName('');
        fetchData();
      }
    } catch (err) {
      console.error('Create folder error:', err);
    } finally {
      setSubmittingFolder(false);
    }
  };

  const handleOpenEditFolder = (folder, e) => {
    e.stopPropagation();
    setSelectedFolder(folder);
    setFolderName(folder.name);
    setOpenFolderMenuId(null);
    setIsEditFolderOpen(true);
  };

  const handleUpdateFolder = async (e) => {
    e.preventDefault();
    if (!folderName.trim() || !selectedFolder) return;
    setSubmittingFolder(true);

    try {
      const { error } = await supabase
        .from('flashcard_folders')
        .update({ name: folderName.trim() })
        .eq('id', selectedFolder.id);

      if (error) {
        alert(`Không thể đổi tên: ${error.message}`);
      } else {
        setIsEditFolderOpen(false);
        fetchData();
      }
    } catch (err) {
      console.error('Update folder error:', err);
    } finally {
      setSubmittingFolder(false);
    }
  };

  const handleOpenDeleteFolder = (folder, e) => {
    e.stopPropagation();
    setSelectedFolder(folder);
    setOpenFolderMenuId(null);
    setIsDeleteFolderOpen(true);
  };

  const handleDeleteFolder = async () => {
    if (!selectedFolder) return;
    setSubmittingFolder(true);

    try {
      const { error } = await supabase.from('flashcard_folders').delete().eq('id', selectedFolder.id);
      if (error) {
        alert(`Không thể xóa thư mục: ${error.message}`);
      } else {
        setIsDeleteFolderOpen(false);
        if (currentFolderId === selectedFolder.id) {
          handleNavigateToFolder(selectedFolder.parent_id || null);
        } else {
          fetchData();
        }
      }
    } catch (err) {
      console.error('Delete folder error:', err);
    } finally {
      setSubmittingFolder(false);
    }
  };

  // ================= DECK ACTIONS =================
  const handleOpenCreateSet = () => {
    setSetName('');
    setSetDescription('');
    setVisibility('private');
    setTargetFolderId(currentFolderId);
    setIsCreateSetOpen(true);
  };

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const handleCreateSet = async (e) => {
    e.preventDefault();
    if (!setName.trim() || !user) return;
    setSubmittingSet(true);

    try {
      const sanitizedFolderId =
        targetFolderId && typeof targetFolderId === 'string' && UUID_REGEX.test(targetFolderId.trim())
          ? targetFolderId.trim()
          : null;

      const payload = {
        name: setName.trim(),
        description: setDescription.trim(),
        user_id: user.id,
        visibility: visibility || 'private',
        folder_id: sanitizedFolderId,
      };

      const { error } = await supabase.from('flashcard_sets').insert(payload);
      if (error) {
        if (error.message?.includes('folder_id')) {
          delete payload.folder_id;
          const { error: retryErr } = await supabase.from('flashcard_sets').insert(payload);
          if (retryErr) {
            alert(`Lỗi tạo bộ thẻ: ${retryErr.message}`);
          } else {
            setIsCreateSetOpen(false);
            fetchData();
          }
        } else {
          alert(`Không thể tạo bộ thẻ: ${error.message}`);
        }
      } else {
        setIsCreateSetOpen(false);
        fetchData();
      }
    } catch (err) {
      console.error('Create set error:', err);
    } finally {
      setSubmittingSet(false);
    }
  };

  const handleOpenMoveSet = (deck, e) => {
    e.stopPropagation();
    setSelectedSet(deck);
    setOpenDeckMenuId(null);
    setIsMoveSetOpen(true);
  };

  const handleSaveMoveDeck = async (deckId, finalFolderId) => {
    setSubmittingSet(true);
    try {
      const { error } = await supabase
        .from('flashcard_sets')
        .update({ folder_id: finalFolderId })
        .eq('id', deckId);

      if (error) {
        console.error('Error moving deck:', error);
        alert(`Không thể chuyển thư mục: ${error.message}`);
      } else {
        setIsMoveSetOpen(false);
        setSelectedSet(null);
        fetchData();
      }
    } catch (err) {
      console.error('Move set error:', err);
    } finally {
      setSubmittingSet(false);
    }
  };

  // Total statistics for the header
  const totalDecksCount = allSets.length;
  const totalFoldersCount = allFolders.length;

  return (
    <div className="min-h-screen bg-[#fbfbfa] py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto w-full space-y-6">
        {/* 1. HEADER & ACTION BUTTONS */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-slate-200/60">
          <div>
            {/* Breadcrumb if inside folder */}
            {breadcrumbTrail.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mb-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleNavigateToFolder(null)}
                  className="hover:text-[#1b4332] transition-colors cursor-pointer"
                >
                  Bộ Flashcard
                </button>
                {breadcrumbTrail.map((item, idx) => {
                  const isLast = idx === breadcrumbTrail.length - 1;
                  return (
                    <React.Fragment key={item.id}>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {isLast ? (
                        <span className="text-slate-900 font-semibold truncate max-w-[150px]">
                          {item.name}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleNavigateToFolder(item.id)}
                          className="hover:text-[#1b4332] transition-colors cursor-pointer truncate max-w-[150px]"
                        >
                          {item.name}
                        </button>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            )}

            {/* Main Title with Lora Serif */}
            <div className="flex items-center gap-2">
              {currentFolder && (
                <button
                  type="button"
                  onClick={() => {
                    const parentId = currentFolder.parent_id || null;
                    handleNavigateToFolder(parentId);
                  }}
                  className="p-1 rounded-lg hover:bg-slate-200/60 text-slate-500 hover:text-slate-800 transition-colors mr-1 cursor-pointer"
                  title="Quay lại"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-serif">
                {currentFolder ? currentFolder.name : 'Bộ Flashcard'}
              </h1>
            </div>

            {/* Subtitle count */}
            <p className="text-xs text-slate-500 font-medium mt-1">
              {currentFolder
                ? `${currentDecks.length} bộ thẻ · ${currentFolders.length} thư mục con`
                : `${totalDecksCount} bộ · ${totalFoldersCount} thư mục`}
            </p>
          </div>

          {/* Action Button Cluster */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Secondary: Thư mục Button */}
            <button
              type="button"
              onClick={handleOpenCreateFolder}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold shadow-2xs transition-all cursor-pointer"
            >
              <Folder className="w-4 h-4 text-[#1b4332]" strokeWidth={1.75} />
              <span>Thư mục</span>
            </button>

            {/* Primary: + Bộ Flashcard Button */}
            <button
              type="button"
              onClick={handleOpenCreateSet}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1b4332] hover:bg-[#143326] active:bg-[#0e241b] text-white text-xs sm:text-sm font-semibold shadow-2xs hover:shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Bộ Flashcard</span>
            </button>
          </div>
        </div>

        {/* LOADING STATE */}
        {loading ? (
          <div className="py-20 text-center text-sm text-slate-500 font-medium animate-pulse flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5 text-[#1b4332]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Đang tải dữ liệu thư mục và bộ thẻ...
          </div>
        ) : (
          <div className="space-y-6">
            {/* 2. MỤC "THƯ MỤC" */}
            {currentFolders.length > 0 && (
              <div>
                <h2 className="text-[11px] font-bold text-slate-400 tracking-wider mb-2 uppercase">
                  THƯ MỤC
                </h2>

                <div className="bg-white rounded-2xl border border-slate-200/70 shadow-2xs divide-y divide-slate-100">
                  {currentFolders.map((folder, index) => {
                    const isLast = index >= currentFolders.length - 1;
                    return (
                      <div
                        key={folder.id}
                        onClick={() => handleNavigateToFolder(folder.id)}
                        className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50/80 cursor-pointer transition-colors group relative first:rounded-t-2xl last:rounded-b-2xl"
                      >
                        {/* Left: Icon Thư mục nét mảnh + Tên thư mục */}
                        <div className="flex items-center gap-3 min-w-0 pr-3">
                          <Folder className="w-5 h-5 text-[#1b4332] shrink-0" strokeWidth={1.8} />
                          <span className="text-sm font-semibold text-slate-800 group-hover:text-[#1b4332] transition-colors truncate">
                            {folder.name}
                          </span>
                        </div>

                        {/* Right: Số lượng chi tiết + Chevron icon + Context menu */}
                        <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <span className="text-xs text-slate-400 font-medium">
                            {getFolderDetailText(folder.id)}
                          </span>

                          {/* 3-dots Menu for Folder */}
                          <div className="relative" data-dropdown-container>
                            <button
                              type="button"
                              onClick={() => setOpenFolderMenuId(openFolderMenuId === folder.id ? null : folder.id)}
                              className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                              title="Tùy chọn thư mục"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>

                            {openFolderMenuId === folder.id && (
                              <>
                                <div
                                  className="fixed inset-0 z-40"
                                  onClick={() => setOpenFolderMenuId(null)}
                                />
                                <div
                                  className={`absolute right-0 ${
                                    isLast ? 'bottom-full mb-2' : 'top-full mt-1'
                                  } w-44 bg-white rounded-xl shadow-xl border border-slate-200/80 z-50 py-1.5 animate-fadeIn`}
                                >
                                  <button
                                    type="button"
                                    onClick={(e) => handleOpenEditFolder(folder, e)}
                                    className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-colors"
                                  >
                                    <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Đổi tên</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => handleOpenDeleteFolder(folder, e)}
                                    className="w-full text-left px-3.5 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                    <span>Xóa thư mục</span>
                                  </button>
                                </div>
                              </>
                            )}
                          </div>

                          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. MỤC "BỘ FLASHCARD" */}
            <div>
              <h2 className="text-[11px] font-bold text-slate-400 tracking-wider mb-2 mt-6 uppercase">
                BỘ FLASHCARD
              </h2>

              {currentDecks.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200/70 p-8 text-center space-y-3 shadow-2xs">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <Layers className="w-6 h-6 text-slate-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700">
                      Chưa có bộ Flashcard nào {currentFolder ? 'trong thư mục này' : 'ở ngoài thư mục'}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Tạo bộ thẻ mới để bắt đầu học tập và ghi nhớ hiệu quả.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenCreateSet}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#1b4332] text-white text-xs font-semibold hover:bg-[#143326] transition-all cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tạo bộ thẻ mới</span>
                  </button>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200/70 shadow-2xs divide-y divide-slate-100">
                  {currentDecks.map((deck, index) => {
                    const isLast = index >= currentDecks.length - 1;
                    return (
                      <div
                        key={deck.id}
                        onClick={() => navigate(`/flashcard/${deck.id}`)}
                        className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50/80 cursor-pointer transition-colors group relative first:rounded-t-2xl last:rounded-b-2xl"
                      >
                        {/* Left: Icon màn hình/thẻ + Tên bộ thẻ */}
                        <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                          <Layers className="w-5 h-5 text-[#1b4332] shrink-0" strokeWidth={1.8} />
                          <span className="text-sm font-semibold text-slate-800 group-hover:text-[#1b4332] transition-colors truncate">
                            {deck.title}
                          </span>
                        </div>

                        {/* Center: Số lượng từ */}
                        <div className="w-20 sm:w-28 text-left shrink-0">
                          <span className="text-xs text-slate-400 font-medium">
                            {deck.totalCards} từ
                          </span>
                        </div>

                        {/* Right: Progress bar + Percentage + Context Menu */}
                        <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <div className="w-16 sm:w-28 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#1b4332] rounded-full transition-all duration-300"
                              style={{ width: `${deck.progress}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-slate-600 w-8 sm:w-10 text-right">
                            {deck.progress}%
                          </span>

                          {/* 3-dots Menu for Deck */}
                          <div className="relative" data-dropdown-container>
                            <button
                              type="button"
                              onClick={() => setOpenDeckMenuId(openDeckMenuId === deck.id ? null : deck.id)}
                              className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                              title="Tùy chọn bộ thẻ"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>

                            {openDeckMenuId === deck.id && (
                              <>
                                <div
                                  className="fixed inset-0 z-40"
                                  onClick={() => setOpenDeckMenuId(null)}
                                />
                                <div
                                  className={`absolute right-0 ${
                                    isLast ? 'bottom-full mb-2' : 'top-full mt-1'
                                  } w-44 bg-white rounded-xl shadow-xl border border-slate-200/80 z-50 py-1.5 animate-fadeIn`}
                                >
                                  <button
                                    type="button"
                                    onClick={(e) => handleOpenMoveSet(deck, e)}
                                    className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-colors"
                                  >
                                    <FolderInput className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Di chuyển thư mục</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => navigate(`/flashcard/${deck.id}`)}
                                    className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-colors"
                                  >
                                    <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Xem & Chỉnh sửa</span>
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODAL: CREATE FOLDER */}
        <Modal
          open={isCreateFolderOpen}
          title="Tạo thư mục mới"
          onCancel={() => setIsCreateFolderOpen(false)}
          onOk={handleCreateFolder}
          okText={submittingFolder ? 'Đang tạo...' : 'Tạo thư mục'}
          confirmLoading={submittingFolder}
        >
          <form onSubmit={handleCreateFolder} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-800">
                Tên thư mục <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="Ví dụ: Tiếng Anh Giao Tiếp, IELTS Band 7.0"
                className="w-full h-10 px-3.5 rounded-xl border border-slate-200/80 focus:border-[#1b4332] focus:ring-2 focus:ring-[#1b4332]/10 outline-none text-sm text-slate-800 transition-all"
                autoFocus
              />
            </div>
            {currentFolder && (
              <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 border border-slate-200/60">
                Thư mục cha: <strong className="text-slate-800">{currentFolder.name}</strong>
              </div>
            )}
          </form>
        </Modal>

        {/* MODAL: EDIT FOLDER */}
        <Modal
          open={isEditFolderOpen}
          title="Đổi tên thư mục"
          onCancel={() => setIsEditFolderOpen(false)}
          onOk={handleUpdateFolder}
          okText={submittingFolder ? 'Đang lưu...' : 'Lưu thay đổi'}
          confirmLoading={submittingFolder}
        >
          <form onSubmit={handleUpdateFolder} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-800">
                Tên thư mục mới <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                className="w-full h-10 px-3.5 rounded-xl border border-slate-200/80 focus:border-[#1b4332] focus:ring-2 focus:ring-[#1b4332]/10 outline-none text-sm text-slate-800 transition-all"
                autoFocus
              />
            </div>
          </form>
        </Modal>

        {/* MODAL: DELETE FOLDER */}
        <Modal
          open={isDeleteFolderOpen}
          title="Xác nhận xóa thư mục"
          danger
          onCancel={() => setIsDeleteFolderOpen(false)}
          onOk={handleDeleteFolder}
          okText={submittingFolder ? 'Đang xóa...' : 'Đồng ý xóa'}
          confirmLoading={submittingFolder}
        >
          <p className="text-sm text-slate-600 leading-relaxed">
            Bạn có chắc chắn muốn xóa thư mục <strong className="text-slate-900">"{selectedFolder?.name}"</strong>?
            Các bộ thẻ trong thư mục này sẽ tự động chuyển ra ngoài thư mục gốc và không bị mất dữ liệu.
          </p>
        </Modal>

        {/* MODAL: CREATE FLASHCARD SET */}
        <Modal
          open={isCreateSetOpen}
          title="Tạo bộ Flashcard mới"
          onCancel={() => setIsCreateSetOpen(false)}
          onOk={handleCreateSet}
          okText={submittingSet ? 'Đang tạo...' : 'Tạo mới'}
          confirmLoading={submittingSet}
        >
          <form onSubmit={handleCreateSet} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-800">
                Tên bộ Flashcard <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={setName}
                onChange={(e) => setSetName(e.target.value)}
                placeholder="Ví dụ: Từ vựng Oxford 3000 từ"
                className="w-full h-10 px-3.5 rounded-xl border border-slate-200/80 focus:border-[#1b4332] focus:ring-2 focus:ring-[#1b4332]/10 outline-none text-sm text-slate-800 transition-all"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-800">Mô tả (không bắt buộc)</label>
              <textarea
                rows={3}
                value={setDescription}
                onChange={(e) => setSetDescription(e.target.value)}
                placeholder="Nhập mô tả ngắn cho bộ thẻ..."
                className="w-full p-3 rounded-xl border border-slate-200/80 focus:border-[#1b4332] focus:ring-2 focus:ring-[#1b4332]/10 outline-none text-sm text-slate-800 transition-all"
              />
            </div>

            {/* Folder selection dropdown */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-800">Thư mục lưu trữ</label>
              <select
                value={targetFolderId || ''}
                onChange={(e) => setTargetFolderId(e.target.value || null)}
                className="w-full h-10 px-3.5 rounded-xl border border-slate-200/80 focus:border-[#1b4332] outline-none text-sm text-slate-800 bg-white"
              >
                <option value="">(Không cho vào thư mục - Thư mục gốc)</option>
                {allFolders.map((f) => (
                  <option key={f.id} value={f.id}>
                    📁 {f.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Visibility Option */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-800">Quyền riêng tư</label>
              <div className="flex flex-col sm:flex-row gap-4 pt-1">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="create-visibility"
                    value="private"
                    checked={visibility === 'private'}
                    onChange={() => setVisibility('private')}
                    className="accent-[#1b4332]"
                  />
                  Riêng tư (Chỉ mình bạn)
                </label>
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="create-visibility"
                    value="public"
                    checked={visibility === 'public'}
                    onChange={() => setVisibility('public')}
                    className="accent-[#1b4332]"
                  />
                  Công khai (Cộng đồng)
                </label>
              </div>
            </div>
          </form>
        </Modal>

        {/* MODAL: MOVE FLASHCARD SET TO FOLDER */}
        <MoveDeckModal
          open={isMoveSetOpen}
          deck={selectedSet}
          folders={allFolders}
          onClose={() => {
            setIsMoveSetOpen(false);
            setSelectedSet(null);
          }}
          onSave={handleSaveMoveDeck}
          loading={submittingSet}
        />
      </div>
    </div>
  );
}
