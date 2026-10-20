import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { Button, Input, Card, Modal, Tag, Empty } from '../../components';
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
      {/* Section Heading & Compact Integrated Toolbar */}
      <div id="sets-section" className="mb-6">
        <h2 className="text-xl sm:text-2xl font-bold leading-tight text-slate-900 tracking-tight mb-3.5">
          Flashcard của bạn
        </h2>

        {/* Ant Design Compact Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-[minmax(0,1fr)_150px_auto] gap-2.5 items-center">
          {/* Search Input */}
          <div className="w-full sm:col-span-2 md:col-span-1">
            <Input
              prefix={
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              }
              allowClear
              size="large"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm bộ thẻ..."
            />
          </div>

          {/* Custom Sort Dropdown */}
          <div className="relative w-full" ref={sortRef}>
            <button
              type="button"
              onClick={() => setIsSortOpen(!isSortOpen)}
              className="w-full h-10 sm:h-11 px-3.5 bg-white border border-slate-200/80 hover:border-emerald-600 rounded-xl text-sm font-medium text-slate-700 flex items-center justify-between shadow-xs transition-all cursor-pointer focus:outline-none"
            >
              <span className="truncate">
                {sortOptions.find((o) => o.value === sortBy)?.label || 'Mới nhất'}
              </span>
              <span className={`transition-transform duration-200 text-slate-400 ml-1.5 text-xs ${isSortOpen ? 'rotate-180' : ''}`}>
                ▾
              </span>
            </button>

            {isSortOpen && (
              <div className="absolute top-full left-0 mt-1 w-full sm:w-[160px] bg-white border border-slate-200/80 rounded-xl shadow-lg p-1 z-30 space-y-0.5">
                {sortOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setSortBy(opt.value);
                      setIsSortOpen(false);
                    }}
                    className={`w-full h-8 px-3 rounded-lg text-xs sm:text-sm text-left flex items-center transition-colors cursor-pointer ${
                      sortBy === opt.value
                        ? 'bg-emerald-50 text-emerald-700 font-bold'
                        : 'text-slate-700 hover:bg-slate-50 font-medium'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Create Set Primary Button */}
          <Button
            type="primary"
            size="large"
            onClick={handleOpenCreate}
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
              </svg>
            }
            className="w-full sm:col-span-2 md:col-span-1 shadow-xs"
          >
            Tạo bộ thẻ mới
          </Button>
        </div>
      </div>

      {/* 3. Grid of Flashcard Sets */}
      {loading ? (
        <div className="py-16 text-center text-sm text-slate-500 font-medium animate-pulse flex items-center justify-center gap-2">
          <svg className="animate-spin h-4 w-4 text-emerald-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Đang tải danh sách bộ thẻ...
        </div>
      ) : processedSets.length === 0 ? (
        <Empty
          title={searchQuery ? 'Không tìm thấy bộ thẻ phù hợp' : 'Bạn chưa có bộ Flashcard nào'}
          description={
            searchQuery
              ? 'Thử tìm kiếm với từ khóa khác.'
              : 'Hãy bắt đầu tạo bộ thẻ đầu tiên để lưu trữ và học từ vựng hiệu quả cùng AI.'
          }
          action={
            !searchQuery && (
              <Button type="primary" onClick={handleOpenCreate}>
                Tạo bộ thẻ mới
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
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
                className="bg-white border border-slate-200/80 hover:border-emerald-300 hover:shadow-md rounded-2xl p-5 transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-4 min-h-[210px] relative group shadow-xs"
              >
                {/* Header: Title + Visibility Badge + Menu */}
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 truncate flex-1">
                      <h3 className="font-bold text-base text-slate-900 truncate">
                        {set.title}
                      </h3>
                      <Tag color={set.visibility === 'public' ? 'leaf' : 'default'}>
                        {set.visibility === 'public' ? 'Công khai' : 'Riêng tư'}
                      </Tag>
                    </div>

                    {/* 3-dots Dropdown Menu */}
                    <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => toggleMenu(set.id)}
                        className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer text-xs"
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
                          <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200/80 rounded-xl shadow-lg py-1 z-20">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(set)}
                              className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-2"
                            >
                              <span>✏️</span> Đổi tên / Chỉnh sửa
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenDelete(set)}
                              className="w-full text-left px-3.5 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer flex items-center gap-2"
                            >
                              <span>🗑️</span> Xóa bộ Flashcard
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {set.description && (
                    <p className="text-xs text-slate-500 line-clamp-2">
                      {set.description}
                    </p>
                  )}
                </div>

                {/* Content: Clean Typography Stats & Progress OR Compact Empty State */}
                {hasCards ? (
                  <div className="space-y-3.5">
                    {/* Clean Minimal Text Stats */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                      <span className="font-semibold text-slate-900">{set.totalCards} thẻ</span>
                      <span className="text-slate-300">•</span>
                      <span className="font-medium text-emerald-600">{set.masteredCards} đã thuộc</span>
                      <span className="text-slate-300">•</span>
                      <span className="font-medium text-rose-600">{set.unmasteredCards} chưa thuộc</span>
                      <span className="text-slate-300">•</span>
                      <span className="font-medium text-slate-500">{set.quizCount} bài test</span>
                    </div>

                    {/* Tiến độ học Progress Bar */}
                    <div className="space-y-1.5 pt-0.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Tiến độ học</span>
                        <span className="font-bold text-slate-900">{progress}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-600 transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-4 px-3.5 rounded-xl bg-slate-50 border border-slate-200/60 text-center space-y-2 my-auto">
                    <p className="text-xs font-medium text-slate-500">
                      Chưa có Flashcard trong bộ này.
                    </p>
                    {isOwner && (
                      <Button
                        type="outlined"
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenAddCardModal(set);
                        }}
                      >
                        + Thêm thẻ
                      </Button>
                    )}
                  </div>
                )}

                {/* Footer Action Buttons */}
                {hasCards && (
                  <div className="flex items-center gap-2 pt-1">
                    <Link
                      to={`/study/${set.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1"
                    >
                      <Button type="primary" block>
                        Học ngay
                      </Button>
                    </Link>

                    {isOwner && (
                      <Button
                        type="default"
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenAddCardModal(set);
                        }}
                      >
                        + Thêm thẻ
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal 1: Create Flashcard Set */}
      <Modal
        open={isCreateModalOpen}
        title="Tạo bộ Flashcard"
        onCancel={() => setIsCreateModalOpen(false)}
        onOk={handleCreateSet}
        okText={submitting ? 'Đang tạo...' : 'Tạo mới'}
        confirmLoading={submitting}
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
              placeholder="Ví dụ: Từ vựng IELTS Listening"
              className="w-full h-10 px-3.5 rounded-xl border border-slate-200/80 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm text-slate-800 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-800">Mô tả (không bắt buộc)</label>
            <textarea
              rows={3}
              value={setDescription}
              onChange={(e) => setSetDescription(e.target.value)}
              placeholder="Nhập mô tả ngắn cho bộ thẻ..."
              className="w-full p-3 rounded-xl border border-slate-200/80 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm text-slate-800 transition-all"
            />
          </div>

          {/* Visibility Option */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-800">Quyền riêng tư</label>
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="create-visibility"
                  value="private"
                  checked={visibility === 'private'}
                  onChange={() => setVisibility('private')}
                  className="accent-emerald-600"
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
                  className="accent-emerald-600"
                />
                Công khai (Cộng đồng)
              </label>
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal 2: Edit Flashcard Set */}
      <Modal
        open={isEditModalOpen}
        title="Chỉnh sửa bộ Flashcard"
        onCancel={() => setIsEditModalOpen(false)}
        onOk={handleUpdateSet}
        okText={submitting ? 'Đang lưu...' : 'Lưu chỉnh sửa'}
        confirmLoading={submitting}
      >
        <form onSubmit={handleUpdateSet} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-800">
              Tên bộ Flashcard <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={setName}
              onChange={(e) => setSetName(e.target.value)}
              className="w-full h-10 px-3.5 rounded-xl border border-slate-200/80 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm text-slate-800 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-800">Mô tả</label>
            <textarea
              rows={3}
              value={setDescription}
              onChange={(e) => setSetDescription(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200/80 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm text-slate-800 transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-800">Quyền riêng tư</label>
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="edit-visibility"
                  value="private"
                  checked={visibility === 'private'}
                  onChange={() => setVisibility('private')}
                  className="accent-emerald-600"
                />
                Riêng tư (Chỉ mình bạn)
              </label>
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="edit-visibility"
                  value="public"
                  checked={visibility === 'public'}
                  onChange={() => setVisibility('public')}
                  className="accent-emerald-600"
                />
                Công khai (Cộng đồng)
              </label>
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal 3: Delete Flashcard Set */}
      <Modal
        open={isDeleteModalOpen}
        title="Xác nhận xóa bộ Flashcard"
        danger
        onCancel={() => setIsDeleteModalOpen(false)}
        onOk={handleDeleteSet}
        okText={submitting ? 'Đang xóa...' : 'Đồng ý xóa'}
        confirmLoading={submitting}
      >
        <p className="text-sm text-slate-600 leading-relaxed">
          Bạn có chắc chắn muốn xóa bộ thẻ{' '}
          <strong className="text-slate-900">"{selectedSet?.title}"</strong>? Tất cả thẻ từ vựng và bài kiểm tra thuộc bộ thẻ này cũng sẽ bị xóa vĩnh viễn. Hành động này không thể hoàn tác.
        </p>
      </Modal>

      {/* Modal 4: Add Flashcard Direct Modal */}
      <Modal
        open={isAddCardModalOpen && !!selectedSetForAdd}
        title={
          <div>
            <div className="font-bold text-slate-900 text-base sm:text-lg">
              {addStep === 'manual' && 'Thêm Flashcard mới'}
              {addStep === 'bulk_input' && 'Nhập nhiều Flashcard cùng lúc'}
              {addStep === 'bulk_preview' && 'Xem trước danh sách Flashcard'}
            </div>
            <p className="text-xs text-slate-500 font-normal mt-0.5">
              Bộ thẻ: <strong className="text-slate-800">{selectedSetForAdd?.title}</strong>
            </p>
          </div>
        }
        onCancel={handleCloseAddCardModal}
        width="max-w-xl"
        footer={null}
      >
        {/* STEP 1: MANUAL ENTRY */}
        {addStep === 'manual' && (
          <div className="space-y-4">
            <div className="space-y-3.5">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-800">
                    Từ hoặc cụm từ <span className="text-rose-500">*</span>
                  </label>
                  <Button
                    type="default"
                    size="small"
                    onClick={handleFetchSingleAISuggestion}
                    disabled={!singleCard.term.trim() || fetchingSingleAI}
                    loading={fetchingSingleAI}
                    icon={<span>✨</span>}
                  >
                    AI gợi ý
                  </Button>
                </div>
                <input
                  type="text"
                  name="term"
                  value={singleCard.term}
                  onChange={handleSingleInputChange}
                  placeholder="Ví dụ: take care of hoặc serendipity"
                  className="w-full h-10 px-3.5 rounded-xl border border-slate-200/80 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm text-slate-800 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-800">
                  Phiên âm
                </label>
                <input
                  type="text"
                  name="phonetic"
                  value={singleCard.phonetic}
                  onChange={handleSingleInputChange}
                  placeholder="Ví dụ: /ˌser.ənˈdɪp.ə.ti/"
                  className="w-full h-10 px-3.5 rounded-xl border border-slate-200/80 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm text-slate-800 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-800">
                  Nghĩa tiếng Việt <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  name="definition"
                  value={singleCard.definition}
                  onChange={handleSingleInputChange}
                  placeholder="Ví dụ: Sự tình cờ may mắn tìm thấy điều gì đó..."
                  className="w-full p-3 rounded-xl border border-slate-200/80 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm text-slate-800 transition-all"
                />
              </div>

              <div className="bg-slate-50 border border-slate-200/60 px-3.5 py-2.5 rounded-xl text-xs text-slate-600">
                Trạng thái học mặc định: <strong className="text-emerald-700">Chưa thuộc</strong>
              </div>
            </div>

            <div className="pt-1">
              <Button
                type="link"
                onClick={() => setAddStep('bulk_input')}
                className="text-xs"
              >
                Nhập nhiều từ cùng lúc
              </Button>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
              <Button type="default" onClick={handleCloseAddCardModal}>
                Hủy
              </Button>
              <Button
                type="primary"
                onClick={handleSaveFlashcards}
                loading={submittingCard}
                disabled={!singleCard.term.trim()}
              >
                Lưu Flashcard
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: BULK INPUT */}
        {addStep === 'bulk_input' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-800">
                Nhập danh sách từ (Mỗi dòng một từ hoặc cụm từ)
              </label>
              <textarea
                rows={8}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={`neighbor\nmeticulous\ntake care of\nlook forward to`}
                className="w-full p-3.5 rounded-xl border border-slate-200/80 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm font-mono text-slate-800 transition-all"
              />
              <p className="text-xs text-slate-500">
                Mỗi dòng sẽ được AI Gemini hỗ trợ gợi ý nghĩa tiếng Việt và phiên âm ở bước xem trước.
              </p>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <Button type="default" onClick={() => setAddStep('manual')}>
                Quay lại
              </Button>
              <Button
                type="primary"
                onClick={handleGeneratePreview}
                loading={generatingPreview}
                disabled={!bulkText.trim()}
              >
                {generatingPreview ? 'Đang tạo gợi ý bằng AI...' : 'Xem trước'}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: BULK PREVIEW & EDIT */}
        {addStep === 'bulk_preview' && (
          <div className="space-y-4">
            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {bulkPreviewList.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="bg-slate-50/80 border border-slate-200/80 p-3.5 rounded-xl space-y-2.5 relative shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">
                      Từ #{idx + 1}
                    </span>
                    <Button
                      type="text"
                      danger
                      size="small"
                      onClick={() => handleRemovePreviewItem(idx)}
                    >
                      Xóa
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Từ/Cụm từ <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={item.term}
                        onChange={(e) => handlePreviewItemChange(idx, 'term', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200/80 focus:border-emerald-600 outline-none bg-white text-xs text-slate-800 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Phiên âm
                      </label>
                      <input
                        type="text"
                        value={item.phonetic}
                        onChange={(e) => handlePreviewItemChange(idx, 'phonetic', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200/80 focus:border-emerald-600 outline-none bg-white text-xs text-slate-800 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Nghĩa tiếng Việt <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={item.definition}
                        onChange={(e) => handlePreviewItemChange(idx, 'definition', e.target.value)}
                        placeholder="Nhập nghĩa..."
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200/80 focus:border-emerald-600 outline-none bg-white text-xs text-slate-800 transition-all"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <Button type="default" onClick={() => setAddStep('bulk_input')}>
                Quay lại nhập
              </Button>

              <div className="flex items-center gap-2.5">
                <Button type="default" onClick={handleCloseAddCardModal}>
                  Hủy
                </Button>
                <Button
                  type="primary"
                  onClick={handleSaveFlashcards}
                  loading={submittingCard}
                  disabled={bulkPreviewList.length === 0}
                >
                  Lưu tất cả ({bulkPreviewList.length} thẻ)
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
