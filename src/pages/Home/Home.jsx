import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import HomeBanner from '../../components/HomeBanner';
import {
  generateBulkFlashcardDetails,
  generateSingleFlashcardDetails,
} from '../../lib/geminiQuizService';

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortRef = useRef(null);
  const [openMenuId, setOpenMenuId] = useState(null);

  // Set Create/Edit/Delete Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedSet, setSelectedSet] = useState(null);

  // Set Form states
  const [setName, setSetName] = useState('');
  const [setDescription, setSetDescription] = useState('');
  const [visibility, setVisibility] = useState('private'); // 'private' | 'public'
  const [submitting, setSubmitting] = useState(false);

  // Add Flashcard Direct Modal States
  const [selectedSetForAdd, setSelectedSetForAdd] = useState(null);
  const [isAddCardModalOpen, setIsAddCardModalOpen] = useState(false);
  const [addStep, setAddStep] = useState('manual'); // 'manual' | 'bulk_input' | 'bulk_preview'
  const [fetchingSingleAI, setFetchingSingleAI] = useState(false);
  const [submittingCard, setSubmittingCard] = useState(false);

  // Single Card Form State
  const [singleCard, setSingleCard] = useState({
    term: '',
    phonetic: '',
    definition: '',
    part_of_speech: 'noun',
  });

  // Bulk Import Text & Preview List State
  const [bulkText, setBulkText] = useState('');
  const [bulkPreviewList, setBulkPreviewList] = useState([]);
  const [generatingPreview, setGeneratingPreview] = useState(false);

  const sortOptions = [
    { value: 'newest', label: 'Mới nhất' },
    { value: 'oldest', label: 'Cũ nhất' },
    { value: 'a-z', label: 'Tên A → Z' },
    { value: 'z-a', label: 'Tên Z → A' },
  ];

  // Close Custom Sort Dropdown on Outside Click & Escape Key
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sortRef.current && !sortRef.current.contains(e.target)) {
        setIsSortOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsSortOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Fetch flashcard sets belonging strictly to current user with flashcards and quizzes
  const fetchSets = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('flashcard_sets')
        .select('*, flashcards(*), quizzes(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching flashcard sets:', error);
      } else if (data) {
        const formattedSets = data.map((set) => {
          const cards = set.flashcards || [];
          const totalCards = cards.length;
          const masteredCards = cards.filter(
            (c) => c.learning_status === 'learned' || c.learning_status === 'mastered'
          ).length;
          const unmasteredCards = totalCards - masteredCards;

          const quizzesList = set.quizzes || [];
          const quizCount = quizzesList.length;

          return {
            id: set.id,
            title: set.name || set.title || 'Bộ thẻ mới',
            description: set.description || '',
            visibility: set.visibility || 'private',
            totalCards,
            masteredCards,
            unmasteredCards,
            quizCount,
            raw: set,
          };
        });
        setSets(formattedSets);
      }
    } catch (err) {
      console.error('Fetch sets error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSets();
  }, [user]);

  const toggleMenu = (id) => {
    setOpenMenuId(openMenuId === id ? null : id);
  };

  const handleCardClick = (id) => {
    navigate(`/flashcard/${id}`);
  };

  // Open Create Set Modal
  const handleOpenCreate = () => {
    setSetName('');
    setSetDescription('');
    setVisibility('private');
    setIsCreateModalOpen(true);
  };

  // Create Set Submit
  const handleCreateSet = async (e) => {
    e.preventDefault();
    if (!setName.trim()) return;
    setSubmitting(true);

    try {
      const { error } = await supabase.from('flashcard_sets').insert({
        name: setName.trim(),
        description: setDescription.trim(),
        user_id: user.id,
        visibility: visibility || 'private',
      });

      if (error) {
        console.error('Error creating set:', error);
        alert(`Không thể tạo bộ thẻ: ${error.message}`);
      } else {
        setIsCreateModalOpen(false);
        fetchSets();
      }
    } catch (err) {
      console.error('Create set error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Set Modal
  const handleOpenEdit = (set) => {
    setSelectedSet(set);
    setSetName(set.title);
    setSetDescription(set.description);
    setVisibility(set.raw?.visibility || 'private');
    setOpenMenuId(null);
    setIsEditModalOpen(true);
  };

  // Update Set Submit
  const handleUpdateSet = async (e) => {
    e.preventDefault();
    if (!setName.trim() || !selectedSet) return;
    setSubmitting(true);

    try {
      const { error } = await supabase
        .from('flashcard_sets')
        .update({
          name: setName.trim(),
          description: setDescription.trim(),
          visibility: visibility || 'private',
        })
        .eq('id', selectedSet.id);

      if (error) {
        console.error('Error updating set:', error);
        alert(`Không thể cập nhật: ${error.message}`);
      } else {
        setIsEditModalOpen(false);
        fetchSets();
      }
    } catch (err) {
      console.error('Update set error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Open Delete Set Modal
  const handleOpenDelete = (set) => {
    setSelectedSet(set);
    setOpenMenuId(null);
    setIsDeleteModalOpen(true);
  };

  // Delete Set Submit
  const handleDeleteSet = async () => {
    if (!selectedSet) return;
    setSubmitting(true);

    try {
      const { error } = await supabase
        .from('flashcard_sets')
        .delete()
        .eq('id', selectedSet.id);

      if (error) {
        console.error('Error deleting set:', error);
        alert(`Không thể xóa bộ thẻ: ${error.message}`);
      } else {
        setIsDeleteModalOpen(false);
        fetchSets();
      }
    } catch (err) {
      console.error('Delete set error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // ================= ADD FLASHCARD DIRECT HANDLERS =================
  const handleOpenAddCardModal = (set) => {
    setSelectedSetForAdd(set);
    setIsAddCardModalOpen(true);
    setAddStep('manual');
    setSingleCard({ term: '', phonetic: '', definition: '', part_of_speech: 'noun' });
    setBulkText('');
    setBulkPreviewList([]);
  };

  const handleCloseAddCardModal = () => {
    setIsAddCardModalOpen(false);
    setSelectedSetForAdd(null);
    setAddStep('manual');
    setSingleCard({ term: '', phonetic: '', definition: '', part_of_speech: 'noun' });
    setBulkText('');
    setBulkPreviewList([]);
  };

  const handleSingleInputChange = (e) => {
    const { name, value } = e.target;
    setSingleCard((prev) => ({ ...prev, [name]: value }));
  };

  // AI Suggestion for Single Flashcard
  const handleFetchSingleAISuggestion = async () => {
    const termInput = singleCard.term.trim();
    if (!termInput) return;

    setFetchingSingleAI(true);
    try {
      console.log('[FlashcardAI] request:', termInput);
      const details = await generateSingleFlashcardDetails(termInput);
      console.log('[FlashcardAI] result:', details);

      if (details) {
        const foundIPA = details.pronunciation || details.phonetic || '';
        const foundMeaning = details.meaning || details.definition || '';
        const foundPOS = details.part_of_speech || (termInput.includes(' ') ? 'phrase' : 'noun');

        setSingleCard((prev) => ({
          ...prev,
          phonetic: foundIPA || prev.phonetic,
          definition: foundMeaning || prev.definition,
          part_of_speech: foundPOS || prev.part_of_speech,
        }));

        if (!foundMeaning) {
          alert('AI chưa thể gợi ý nghĩa cho từ này. Bạn có thể nhập nghĩa thủ công trước khi lưu.');
        }
      }
    } catch (err) {
      console.error('[FlashcardAI] error:', err);
      const msg = err?.message || '';
      if (
        err?.code === 'MODEL_NOT_FOUND' ||
        msg.includes('MODEL_NOT_FOUND') ||
        msg.includes('không còn khả dụng') ||
        msg.includes('404')
      ) {
        alert('Model AI hiện tại không còn khả dụng. Vui lòng cập nhật model Gemini.');
      } else if (
        err?.code === 'RESOURCE_EXHAUSTED' ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('đạt giới hạn') ||
        msg.includes('429')
      ) {
        alert('AI hiện đã đạt giới hạn sử dụng. Vui lòng nhập thông tin thủ công hoặc thử lại sau.');
      } else {
        alert('AI chưa thể gợi ý nghĩa cho từ này. Bạn có thể nhập nghĩa thủ công trước khi lưu.');
      }
    } finally {
      setFetchingSingleAI(false);
    }
  };

  // Generate Bulk Preview with Gemini API
  const handleGeneratePreview = async () => {
    const lines = bulkText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) return;

    setGeneratingPreview(true);

    try {
      console.log('[FlashcardAI] request:', lines);
      const items = await generateBulkFlashcardDetails(lines);
      console.log('[FlashcardAI] result:', items);

      const formattedItems = items.map((item, index) => ({
        id: `bulk-${Date.now()}-${index}`,
        term: item.term || item.word || lines[index],
        phonetic: item.pronunciation || item.phonetic || '',
        definition: item.meaning || item.definition || '',
        part_of_speech: item.part_of_speech || (lines[index].includes(' ') ? 'phrase' : 'noun'),
      }));

      setBulkPreviewList(formattedItems);
      setAddStep('bulk_preview');
    } catch (err) {
      console.error('[FlashcardAI] error:', err);
      const msg = err?.message || '';
      if (
        err?.code === 'MODEL_NOT_FOUND' ||
        msg.includes('MODEL_NOT_FOUND') ||
        msg.includes('không còn khả dụng') ||
        msg.includes('404')
      ) {
        alert('Model AI hiện tại không còn khả dụng. Vui lòng cập nhật model Gemini.');
      } else if (
        err?.code === 'RESOURCE_EXHAUSTED' ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('đạt giới hạn') ||
        msg.includes('429')
      ) {
        alert('AI hiện đã đạt giới hạn sử dụng. Vui lòng nhập thông tin thủ công hoặc thử lại sau.');
      } else {
        alert('AI chưa thể gợi ý nghĩa cho các từ này. Bạn có thể nhập nghĩa thủ công trước khi lưu.');
      }

      const fallbackItems = lines.map((term, index) => ({
        id: `bulk-${Date.now()}-${index}`,
        term: term,
        phonetic: '',
        definition: '',
        part_of_speech: term.includes(' ') ? 'phrase' : 'noun',
      }));
      setBulkPreviewList(fallbackItems);
      setAddStep('bulk_preview');
    } finally {
      setGeneratingPreview(false);
    }
  };

  const handlePreviewItemChange = (index, field, value) => {
    setBulkPreviewList((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemovePreviewItem = (index) => {
    setBulkPreviewList((prev) => prev.filter((_, i) => i !== index));
  };

  // Final Save Handler for Add Card Modal
  const handleSaveFlashcards = async () => {
    if (!selectedSetForAdd) return;

    if (addStep === 'manual') {
      const termStr = singleCard.term.trim();
      const meaningStr = singleCard.definition.trim();

      if (!termStr) {
        alert('Vui lòng nhập từ hoặc cụm từ.');
        return;
      }

      if (!meaningStr) {
        alert('AI chưa thể gợi ý nghĩa cho từ này. Bạn có thể nhập nghĩa thủ công trước khi lưu.');
        return;
      }

      setSubmittingCard(true);
      try {
        const { error } = await supabase.from('flashcards').insert({
          set_id: selectedSetForAdd.id,
          word: termStr,
          pronunciation: singleCard.phonetic.trim(),
          meaning: meaningStr,
          part_of_speech: singleCard.part_of_speech || (termStr.includes(' ') ? 'phrase' : 'noun'),
          learning_status: 'unlearned',
        });

        if (error) {
          console.error('Error adding card:', error);
          alert(`Không thể thêm thẻ: ${error.message}`);
        } else {
          handleCloseAddCardModal();
          fetchSets();
        }
      } catch (err) {
        console.error('Save flashcards error:', err);
      } finally {
        setSubmittingCard(false);
      }
    } else if (addStep === 'bulk_preview') {
      const validNewCards = bulkPreviewList.filter((item) => item.term.trim().length > 0);

      if (validNewCards.length === 0) {
        alert('Danh sách từ vựng rỗng.');
        return;
      }

      const missingMeaningItem = validNewCards.find((item) => !item.definition || !item.definition.trim());
      if (missingMeaningItem) {
        alert(`AI chưa thể gợi ý nghĩa cho từ "${missingMeaningItem.term}". Bạn có thể nhập nghĩa thủ công trước khi lưu.`);
        return;
      }

      setSubmittingCard(true);
      try {
        const payload = validNewCards.map((item) => ({
          set_id: selectedSetForAdd.id,
          word: item.term.trim(),
          pronunciation: item.phonetic ? item.phonetic.trim() : '',
          meaning: item.definition.trim(),
          part_of_speech: item.part_of_speech || (item.term.includes(' ') ? 'phrase' : 'noun'),
          learning_status: 'unlearned',
        }));

        const { error } = await supabase.from('flashcards').insert(payload);

        if (error) {
          console.error('Error bulk adding cards:', error);
          alert(`Không thể thêm danh sách thẻ: ${error.message}`);
        } else {
          handleCloseAddCardModal();
          fetchSets();
        }
      } catch (err) {
        console.error('Save bulk flashcards error:', err);
      } finally {
        setSubmittingCard(false);
      }
    }
  };

  // Search & Sort Filtering
  const processedSets = sets
    .filter(
      (set) =>
        set.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        set.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'oldest') {
        return new Date(a.raw.created_at) - new Date(b.raw.created_at);
      }
      if (sortBy === 'a-z') {
        return a.title.localeCompare(b.title, 'vi');
      }
      if (sortBy === 'z-a') {
        return b.title.localeCompare(a.title, 'vi');
      }
      // default: newest
      return new Date(b.raw.created_at) - new Date(a.raw.created_at);
    });

  return (
    <div className="max-w-4xl mx-auto w-full px-4">
      {/* 1. Carousel Home Banner */}
      <HomeBanner />

      {/* 2. Section Heading & Compact Integrated Toolbar (Banner -> Heading: 30px) */}
      <div id="sets-section" className="mt-[30px]">
        {/* Section Heading (Desktop 28px, Tablet 25px, Mobile 22px, line-height 1.2, margin-bottom 14px) */}
        <h2 className="text-[22px] sm:text-[25px] md:text-[28px] font-bold leading-[1.2] text-[#2E3A28] tracking-tight mb-[14px]">
          Bộ thẻ Flashcard của bạn
        </h2>

        {/* Compact Toolbar (Search 44px + Custom Sort 145px + Create Set 44px, margin-bottom 24px) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-[minmax(0,1fr)_145px_auto] gap-[10px] items-center mb-[24px]">
          {/* Search Input (44px height, 10px radius, soft green focus ring) */}
          <div className="relative w-full sm:col-span-2 md:col-span-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm..."
              className="w-full h-[44px] px-4 bg-white border border-[#DDE6D7] focus:border-[#A8D672] focus:ring-2 focus:ring-[#A8D672]/20 rounded-[10px] text-sm text-[#2E3A28] placeholder-[#6B7665]/60 focus:outline-none transition-all shadow-2xs"
            />
          </div>

          {/* Custom Sort Dropdown (44px height, 145px width, 10px radius) */}
          <div className="relative w-full" ref={sortRef}>
            <button
              type="button"
              onClick={() => setIsSortOpen(!isSortOpen)}
              className="w-full h-[44px] px-3.5 bg-white border border-[#DDE6D7] hover:border-[#A8D672] rounded-[10px] text-sm font-medium text-[#2E3A28] flex items-center justify-between shadow-2xs transition-all cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
            >
              <span className="truncate">
                {sortOptions.find((o) => o.value === sortBy)?.label || 'Mới nhất'}
              </span>
              <span className={`transition-transform duration-200 text-[#6B7665] ml-1.5 text-xs ${isSortOpen ? 'rotate-180' : ''}`}>
                ▾
              </span>
            </button>

            {isSortOpen && (
              <div className="absolute top-full left-0 mt-1 w-[145px] sm:w-[155px] bg-white border border-[#E1E8DC] rounded-xl shadow-lg p-1.5 z-30 space-y-0.5">
                {sortOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setSortBy(opt.value);
                      setIsSortOpen(false);
                    }}
                    className={`w-full h-[38px] px-3 rounded-lg text-xs sm:text-sm text-left flex items-center transition-colors cursor-pointer ${
                      sortBy === opt.value
                        ? 'bg-[#A8D672]/20 text-[#2E3A28] font-bold'
                        : 'text-[#2E3A28] hover:bg-[#F8FCF4] font-medium'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Create Set Primary Button (44px height, min-145px width, 10px radius) */}
          <button
            type="button"
            onClick={handleOpenCreate}
            className="w-full sm:col-span-2 md:col-span-1 h-[44px] px-[18px] min-w-[145px] rounded-[10px] bg-[#A8D672] hover:bg-[#97C95E] text-[#2E3A28] font-semibold text-sm transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] cursor-pointer shadow-2xs whitespace-nowrap"
          >
            Tạo bộ thẻ mới
          </button>
        </div>
      </div>

      {/* 3. Grid of Flashcard Sets (20-22px gap) */}
      {loading ? (
        <div className="py-16 text-center text-sm text-[#6B7665] font-medium animate-pulse">
          Đang tải danh sách bộ thẻ từ Supabase...
        </div>
      ) : processedSets.length === 0 ? (
        <div className="bg-white border border-[#E7EEDC] rounded-2xl p-10 text-center space-y-3 shadow-2xs">
          <p className="text-base font-bold text-[#2E3A28]">
            {searchQuery ? 'Không tìm thấy bộ thẻ phù hợp' : 'Bạn chưa có bộ Flashcard nào.'}
          </p>
          <p className="text-xs text-[#6B7665]">
            {searchQuery
              ? 'Thử tìm kiếm với từ khóa khác.'
              : 'Hãy bắt đầu tạo bộ thẻ đầu tiên để lưu trữ và học từ vựng.'}
          </p>
          {!searchQuery && (
            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center bg-[#A8D672] hover:bg-[#97C95E] text-[#2E3A28] font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-2xs mt-2 cursor-pointer"
            >
              Tạo bộ thẻ mới
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[22px]">
          {processedSets.map((set) => {
            const hasCards = set.totalCards > 0;
            const progress = hasCards
              ? Math.min(100, Math.round((set.masteredCards / set.totalCards) * 100))
              : 0;
            const isOwner = user && set.raw?.user_id === user.id;

            return (
              <div
                key={set.id}
                onClick={() => handleCardClick(set.id)}
                className="bg-white border border-[#E7EEDC] rounded-2xl p-5 sm:p-6 hover:border-[#A8D672]/70 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-5 min-h-[220px] shadow-2xs relative group"
              >
                {/* Header: Title + Visibility Badge + Menu */}
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 truncate flex-1">
                      <h3 className="font-bold text-base text-[#2E3A28] truncate">
                        {set.title}
                      </h3>
                      {set.visibility === 'public' && (
                        <span className="text-[11px] font-semibold text-[#5B9E60] bg-[#5B9E60]/10 px-2 py-0.5 rounded-md shrink-0">
                          Công khai
                        </span>
                      )}
                    </div>

                    {/* 3-dots Dropdown Menu */}
                    <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => toggleMenu(set.id)}
                        className="p-1 rounded-lg hover:bg-[#F8FCF4] text-[#6B7665] hover:text-[#2E3A28] transition-colors cursor-pointer text-xs"
                        title="Tùy chọn"
                      >
                        •••
                      </button>

                      {openMenuId === set.id && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setOpenMenuId(null)}
                          />
                          <div className="absolute right-0 mt-1 w-40 bg-white border border-[#E7EEDC] rounded-xl shadow-md py-1 z-20">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(set)}
                              className="w-full text-left px-4 py-2 text-xs font-semibold text-[#2E3A28] hover:bg-[#F8FCF4] transition-colors cursor-pointer"
                            >
                              Đổi tên / Chỉnh sửa
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenDelete(set)}
                              className="w-full text-left px-4 py-2 text-xs font-semibold text-[#E57373] hover:bg-[#F8FCF4] transition-colors cursor-pointer"
                            >
                              Xóa bộ Flashcard
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {set.description && (
                    <p className="text-xs text-[#6B7665] truncate">
                      {set.description}
                    </p>
                  )}
                </div>

                {/* Content: Clean Typography Stats & Progress OR Compact Empty State */}
                {hasCards ? (
                  <div className="space-y-4">
                    {/* Clean Minimal Text Stats (13-14px) */}
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-[13px] text-[#6B7665]">
                      <span className="font-medium">{set.totalCards} thẻ</span>
                      <span className="text-[#6B7665]/40">•</span>
                      <span className="font-medium text-[#5B9E60]">{set.masteredCards} đã thuộc</span>
                      <span className="text-[#6B7665]/40">•</span>
                      <span className="font-medium text-[#E57373]">{set.unmasteredCards} chưa thuộc</span>
                      <span className="text-[#6B7665]/40">•</span>
                      <span className="font-medium text-[#2E3A28]">{set.quizCount} bài kiểm tra</span>
                    </div>

                    {/* Tiến độ học Progress Bar (8px height) */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs sm:text-[13px]">
                        <span className="font-medium text-[#6B7665]">Tiến độ học</span>
                        <span className="font-bold text-[#2E3A28]">{progress}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-[#E7EEDC]/60 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#A8D672] transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Compact Empty State cho bộ chưa có từ vựng (22px padding, min 105px) */
                  <div className="py-[22px] px-4 rounded-[14px] bg-[#F8FCF4] border border-[#E7EEDC]/60 text-center space-y-3 min-h-[105px] my-auto">
                    <p className="text-xs sm:text-sm font-medium text-[#6B7665]">
                      Chưa có Flashcard trong bộ này.
                    </p>
                    {isOwner && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenAddCardModal(set);
                        }}
                        className="inline-block text-xs sm:text-sm font-semibold text-[#5B9E60] hover:text-[#2E3A28] hover:underline transition-colors cursor-pointer"
                      >
                        + Thêm thẻ
                      </button>
                    )}
                  </div>
                )}

                {/* Footer Action Buttons (42px height, 10px radius, 10px gap, 600 font weight) */}
                {hasCards && (
                  <div className="flex items-center gap-[10px] pt-1">
                    <Link
                      to={`/study/${set.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 h-[42px] inline-flex items-center justify-center text-center bg-[#A8D672] hover:bg-[#97C95E] text-[#2E3A28] font-semibold text-xs sm:text-sm rounded-[10px] transition-all shadow-2xs"
                    >
                      Học ngay
                    </Link>

                    {isOwner && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenAddCardModal(set);
                        }}
                        className="flex-1 h-[42px] inline-flex items-center justify-center text-center bg-white border border-[#E7EEDC] hover:border-[#A8D672] hover:bg-[#F8FCF4] text-[#2E3A28] font-semibold text-xs sm:text-sm rounded-[10px] transition-all cursor-pointer shadow-2xs"
                      >
                        + Thêm thẻ
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal 1: Create Flashcard Set */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-[#2E3A28]/30 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#E7EEDC] rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-lg space-y-6">
            <h2 className="text-xl font-bold text-[#2E3A28]">Tạo bộ Flashcard</h2>
            <form onSubmit={handleCreateSet} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#2E3A28]">Tên bộ Flashcard</label>
                <input
                  type="text"
                  required
                  value={setName}
                  onChange={(e) => setSetName(e.target.value)}
                  placeholder="Ví dụ: Từ vựng IELTS Listening"
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E7EEDC] bg-[#F8FCF4]/50 text-sm text-[#2E3A28] focus:outline-none focus:border-[#A8D672]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#2E3A28]">Mô tả (không bắt buộc)</label>
                <textarea
                  rows={3}
                  value={setDescription}
                  onChange={(e) => setSetDescription(e.target.value)}
                  placeholder="Nhập mô tả ngắn cho bộ thẻ..."
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E7EEDC] bg-[#F8FCF4]/50 text-sm text-[#2E3A28] focus:outline-none focus:border-[#A8D672]"
                />
              </div>

              {/* Visibility Option */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#2E3A28]">Quyền riêng tư</label>
                <div className="flex flex-col sm:flex-row gap-3 pt-1">
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-[#2E3A28] cursor-pointer">
                    <input
                      type="radio"
                      name="create-visibility"
                      value="private"
                      checked={visibility === 'private'}
                      onChange={() => setVisibility('private')}
                      className="accent-[#5B9E60]"
                    />
                    Riêng tư (Chỉ mình bạn)
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-[#2E3A28] cursor-pointer">
                    <input
                      type="radio"
                      name="create-visibility"
                      value="public"
                      checked={visibility === 'public'}
                      onChange={() => setVisibility('public')}
                      className="accent-[#5B9E60]"
                    />
                    Công khai (Cộng đồng)
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E7EEDC]">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#E7EEDC] text-xs font-semibold text-[#6B7665] hover:bg-[#F8FCF4] cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-[#A8D672] hover:bg-[#97C95E] text-xs font-bold text-[#2E3A28] shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Đang tạo...' : 'Tạo mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Edit Flashcard Set */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-[#2E3A28]/30 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#E7EEDC] rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-lg space-y-6">
            <h2 className="text-xl font-bold text-[#2E3A28]">Chỉnh sửa bộ Flashcard</h2>
            <form onSubmit={handleUpdateSet} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#2E3A28]">Tên bộ Flashcard</label>
                <input
                  type="text"
                  required
                  value={setName}
                  onChange={(e) => setSetName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E7EEDC] bg-[#F8FCF4]/50 text-sm text-[#2E3A28] focus:outline-none focus:border-[#A8D672]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#2E3A28]">Mô tả</label>
                <textarea
                  rows={3}
                  value={setDescription}
                  onChange={(e) => setSetDescription(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E7EEDC] bg-[#F8FCF4]/50 text-sm text-[#2E3A28] focus:outline-none focus:border-[#A8D672]"
                />
              </div>

              {/* Visibility Option */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#2E3A28]">Quyền riêng tư</label>
                <div className="flex flex-col sm:flex-row gap-3 pt-1">
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-[#2E3A28] cursor-pointer">
                    <input
                      type="radio"
                      name="edit-visibility"
                      value="private"
                      checked={visibility === 'private'}
                      onChange={() => setVisibility('private')}
                      className="accent-[#5B9E60]"
                    />
                    Riêng tư (Chỉ mình bạn)
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-[#2E3A28] cursor-pointer">
                    <input
                      type="radio"
                      name="edit-visibility"
                      value="public"
                      checked={visibility === 'public'}
                      onChange={() => setVisibility('public')}
                      className="accent-[#5B9E60]"
                    />
                    Công khai (Cộng đồng)
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E7EEDC]">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#E7EEDC] text-xs font-semibold text-[#6B7665] hover:bg-[#F8FCF4] cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-[#A8D672] hover:bg-[#97C95E] text-xs font-bold text-[#2E3A28] shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Đang lưu...' : 'Lưu chỉnh sửa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Delete Flashcard Set */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-[#2E3A28]/30 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#E7EEDC] rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-lg space-y-4">
            <h3 className="text-lg font-bold text-[#2E3A28]">Xác nhận xóa bộ Flashcard</h3>
            <p className="text-xs text-[#6B7665]">
              Bạn có chắc chắn muốn xóa bộ thẻ{' '}
              <strong className="text-[#2E3A28]">"{selectedSet?.title}"</strong>? Tất cả thẻ từ vựng và bài kiểm tra thuộc bộ thẻ này cũng sẽ bị xóa. Hành động này không thể hoàn tác.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[#E7EEDC] text-xs font-medium text-[#6B7665] hover:bg-[#F8FCF4] cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleDeleteSet}
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-[#E57373] text-white text-xs font-bold hover:bg-[#D32F2F] cursor-pointer disabled:opacity-50 shadow-2xs"
              >
                {submitting ? 'Đang xóa...' : 'Đồng ý xóa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Add Flashcard Direct Modal */}
      {isAddCardModalOpen && selectedSetForAdd && (
        <div className="fixed inset-0 bg-[#2E3A28]/30 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white border border-[#E7EEDC] rounded-2xl p-6 sm:p-8 max-w-xl w-full shadow-lg space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E7EEDC] pb-4">
              <div>
                <h2 className="text-xl font-bold text-[#2E3A28]">
                  {addStep === 'manual' && 'Thêm Flashcard mới'}
                  {addStep === 'bulk_input' && 'Nhập nhiều Flashcard cùng lúc'}
                  {addStep === 'bulk_preview' && 'Xem trước danh sách Flashcard'}
                </h2>
                <p className="text-xs text-[#6B7665] mt-0.5">
                  Bộ thẻ: <strong className="text-[#2E3A28]">{selectedSetForAdd.title}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseAddCardModal}
                className="text-[#6B7665] hover:text-[#2E3A28] text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* STEP 1: MANUAL ENTRY */}
            {addStep === 'manual' && (
              <div className="space-y-5">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-[#2E3A28]">
                        Từ hoặc cụm từ <span className="text-[#E57373]">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={handleFetchSingleAISuggestion}
                        disabled={!singleCard.term.trim() || fetchingSingleAI}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] bg-[#EFF6FF] border border-[#BFDBFE] px-2.5 py-1 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {fetchingSingleAI ? 'Đang gợi ý...' : '✨ AI gợi ý'}
                      </button>
                    </div>
                    <input
                      type="text"
                      name="term"
                      value={singleCard.term}
                      onChange={handleSingleInputChange}
                      placeholder="Ví dụ: take care of hoặc serendipity"
                      className="w-full px-4 py-2.5 rounded-xl border border-[#E7EEDC] bg-[#F8FCF4]/50 text-sm text-[#2E3A28] focus:outline-none focus:border-[#A8D672]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[#2E3A28]">
                      Phiên âm
                    </label>
                    <input
                      type="text"
                      name="phonetic"
                      value={singleCard.phonetic}
                      onChange={handleSingleInputChange}
                      placeholder="Ví dụ: /ˌser.ənˈdɪp.ə.ti/"
                      className="w-full px-4 py-2.5 rounded-xl border border-[#E7EEDC] bg-[#F8FCF4]/50 text-sm text-[#2E3A28] focus:outline-none focus:border-[#A8D672]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[#2E3A28]">
                      Nghĩa
                    </label>
                    <textarea
                      rows={3}
                      name="definition"
                      value={singleCard.definition}
                      onChange={handleSingleInputChange}
                      placeholder="Ví dụ: Sự tình cờ may mắn tìm thấy điều gì đó..."
                      className="w-full px-4 py-2.5 rounded-xl border border-[#E7EEDC] bg-[#F8FCF4]/50 text-sm text-[#2E3A28] focus:outline-none focus:border-[#A8D672]"
                    />
                  </div>

                  <div className="bg-[#F8FCF4] border border-[#E7EEDC] px-4 py-2 rounded-xl text-xs text-[#6B7665]">
                    Trạng thái học mặc định: <strong className="text-[#2E3A28]">Chưa thuộc</strong>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setAddStep('bulk_input')}
                    className="text-xs font-semibold text-[#2E3A28] underline hover:text-[#5B9E60] transition-colors cursor-pointer"
                  >
                    Nhập nhiều từ
                  </button>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E7EEDC]">
                  <button
                    type="button"
                    onClick={handleCloseAddCardModal}
                    className="px-4 py-2 rounded-xl border border-[#E7EEDC] text-xs font-semibold text-[#6B7665] hover:bg-[#F8FCF4] cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveFlashcards}
                    disabled={submittingCard || !singleCard.term.trim()}
                    className="px-5 py-2 rounded-xl bg-[#A8D672] hover:bg-[#97C95E] text-xs font-bold text-[#2E3A28] disabled:opacity-50 cursor-pointer shadow-2xs"
                  >
                    {submittingCard ? 'Đang lưu...' : 'Lưu Flashcard'}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: BULK INPUT */}
            {addStep === 'bulk_input' && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-[#2E3A28]">
                    Nhập danh sách từ (Mỗi dòng một từ hoặc cụm từ)
                  </label>
                  <textarea
                    rows={8}
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    placeholder={`neighbor\nmeticulous\ntake care of\nlook forward to`}
                    className="w-full p-4 rounded-xl border border-[#E7EEDC] bg-[#F8FCF4]/50 text-sm font-mono text-[#2E3A28] focus:outline-none focus:border-[#A8D672]"
                  />
                  <p className="text-xs text-[#6B7665]">
                    Mỗi dòng sẽ được AI Gemini hỗ trợ gợi ý nghĩa tiếng Việt và phiên âm ở bước xem trước.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-[#E7EEDC]">
                  <button
                    type="button"
                    onClick={() => setAddStep('manual')}
                    className="px-4 py-2 rounded-xl border border-[#E7EEDC] text-xs font-semibold text-[#6B7665] hover:bg-[#F8FCF4] cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleGeneratePreview}
                    disabled={!bulkText.trim() || generatingPreview}
                    className="px-5 py-2 rounded-xl bg-[#A8D672] hover:bg-[#97C95E] text-xs font-bold text-[#2E3A28] disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-2xs"
                  >
                    {generatingPreview ? 'Đang tạo gợi ý bằng AI Gemini...' : 'Xem trước'}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: BULK PREVIEW & EDIT */}
            {addStep === 'bulk_preview' && (
              <div className="space-y-5">
                <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                  {bulkPreviewList.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="bg-[#F8FCF4] border border-[#E7EEDC] p-4 rounded-xl space-y-3 relative"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#2E3A28]">
                          Từ #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemovePreviewItem(idx)}
                          className="text-xs font-semibold text-[#E57373] hover:underline cursor-pointer"
                        >
                          Xóa
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-[#6B7665] mb-1">
                            Từ/Cụm từ <span className="text-[#E57373]">*</span>
                          </label>
                          <input
                            type="text"
                            value={item.term}
                            onChange={(e) => handlePreviewItemChange(idx, 'term', e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg border border-[#E7EEDC] bg-[#FAFDF8] text-xs text-[#2E3A28] focus:outline-none focus:border-[#A8D672]"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-[#6B7665] mb-1">
                            Phiên âm
                          </label>
                          <input
                            type="text"
                            value={item.phonetic}
                            onChange={(e) => handlePreviewItemChange(idx, 'phonetic', e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg border border-[#E7EEDC] bg-[#FAFDF8] text-xs text-[#2E3A28] focus:outline-none focus:border-[#A8D672]"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-[#6B7665] mb-1">
                            Nghĩa tiếng Việt <span className="text-[#E57373]">*</span>
                          </label>
                          <input
                            type="text"
                            value={item.definition}
                            onChange={(e) => handlePreviewItemChange(idx, 'definition', e.target.value)}
                            placeholder="Nhập nghĩa..."
                            className="w-full px-3 py-1.5 rounded-lg border border-[#E7EEDC] bg-[#FAFDF8] text-xs text-[#2E3A28] focus:outline-none focus:border-[#A8D672]"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-[#E7EEDC]">
                  <button
                    type="button"
                    onClick={() => setAddStep('bulk_input')}
                    className="px-4 py-2 rounded-xl border border-[#E7EEDC] text-xs font-semibold text-[#6B7665] hover:bg-[#F8FCF4] cursor-pointer"
                  >
                    Quay lại nhập
                  </button>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleCloseAddCardModal}
                      className="px-4 py-2 rounded-xl border border-[#E7EEDC] text-xs font-semibold text-[#6B7665] hover:bg-[#F8FCF4] cursor-pointer"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveFlashcards}
                      disabled={submittingCard || bulkPreviewList.length === 0}
                      className="px-5 py-2 rounded-xl bg-[#A8D672] hover:bg-[#97C95E] text-xs font-bold text-[#2E3A28] disabled:opacity-50 cursor-pointer shadow-2xs"
                    >
                      {submittingCard ? 'Đang lưu...' : `Lưu tất cả (${bulkPreviewList.length} thẻ)`}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
