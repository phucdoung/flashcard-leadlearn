import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import {
  generateBulkFlashcardDetails,
  generateSingleFlashcardDetails,
} from '../../lib/geminiQuizService';

export default function FlashcardSetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Set Details, Flashcards & Quizzes state from Supabase
  const [setDetail, setSetDetail] = useState(null);
  const [flashcards, setFlashcards] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Add Flashcard Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addStep, setAddStep] = useState('manual'); // 'manual' | 'bulk_input' | 'bulk_preview'
  const [fetchingSingleAI, setFetchingSingleAI] = useState(false);

  // Single Entry Form State
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

  // Edit Flashcard Modal State
  const [editingCard, setEditingCard] = useState(null);
  const [editFormData, setEditFormData] = useState({
    term: '',
    phonetic: '',
    definition: '',
    part_of_speech: 'noun',
    isMastered: false,
  });

  // Delete Confirmation Modal State (Card & Quiz)
  const [deletingCard, setDeletingCard] = useState(null);
  const [deletingQuiz, setDeletingQuiz] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Fetch Set Details, Cards & Quizzes from Supabase
  const fetchSetData = async () => {
    if (!id) return;
    setLoading(true);

    try {
      // 1. Fetch set details
      const { data: setData, error: setError } = await supabase
        .from('flashcard_sets')
        .select('*')
        .eq('id', id)
        .single();

      if (setError) {
        console.error('Error fetching set:', setError);
      } else if (setData) {
        setSetDetail({
          id: setData.id,
          title: setData.name || setData.title || 'Bộ thẻ mới',
          description: setData.description || '',
          userId: setData.user_id,
          visibility: setData.visibility || 'private',
          quizCount: 0,
          raw: setData,
        });
      }

      // 2. Fetch flashcards for this set
      const { data: cardsData, error: cardsError } = await supabase
        .from('flashcards')
        .select('*')
        .eq('set_id', id)
        .order('created_at', { ascending: true });

      if (cardsError) {
        console.error('Error fetching flashcards:', cardsError);
      } else if (cardsData) {
        const formattedCards = cardsData.map((c) => ({
          id: c.id,
          term: c.word || c.term || '',
          phonetic: c.pronunciation || c.phonetic || '',
          definition: c.meaning || c.definition || '',
          part_of_speech: c.part_of_speech || (c.word?.includes(' ') ? 'phrase' : 'noun'),
          isMastered: c.learning_status === 'learned' || c.learning_status === 'mastered',
          raw: c,
        }));
        setFlashcards(formattedCards);
      }

      // 3. Fetch saved quizzes for this set
      const { data: quizzesData, error: quizzesError } = await supabase
        .from('quizzes')
        .select('*, quiz_results(*)')
        .eq('set_id', id)
        .order('created_at', { ascending: false });

      if (quizzesError) {
        console.error('Error fetching quizzes:', quizzesError);
      } else if (quizzesData) {
        setQuizzes(quizzesData);
        setSetDetail((prev) => (prev ? { ...prev, quizCount: quizzesData.length } : null));
      }
    } catch (err) {
      console.error('Fetch data error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSetData();
  }, [id]);

  // Calculated Stats
  const totalCardsCount = flashcards.length;
  const masteredCardsCount = flashcards.filter((c) => c.isMastered).length;
  const unmasteredCardsCount = totalCardsCount - masteredCardsCount;

  // Toggle Learning Status Badge in Supabase
  const handleToggleStatus = async (cardId) => {
    const targetCard = flashcards.find((c) => c.id === cardId);
    if (!targetCard) return;

    const newIsMastered = !targetCard.isMastered;
    const newStatus = newIsMastered ? 'learned' : 'unlearned';

    setFlashcards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, isMastered: newIsMastered } : c))
    );

    try {
      const { error } = await supabase
        .from('flashcards')
        .update({ learning_status: newStatus })
        .eq('id', cardId);

      if (error) {
        console.error('Error updating learning status:', error);
        setFlashcards((prev) =>
          prev.map((c) => (c.id === cardId ? { ...c, isMastered: targetCard.isMastered } : c))
        );
      }
    } catch (err) {
      console.error('Toggle status error:', err);
    }
  };

  // Reset & Open/Close Add Modal
  const handleOpenAddModal = () => {
    setIsAddModalOpen(true);
    setAddStep('manual');
    setSingleCard({ term: '', phonetic: '', definition: '', part_of_speech: 'noun' });
    setBulkText('');
    setBulkPreviewList([]);
  };

  const handleCloseAddModal = () => {
    setIsAddModalOpen(false);
    setAddStep('manual');
    setSingleCard({ term: '', phonetic: '', definition: '', part_of_speech: 'noun' });
    setBulkText('');
    setBulkPreviewList([]);
  };

  const handleSingleInputChange = (e) => {
    const { name, value } = e.target;
    setSingleCard((prev) => ({ ...prev, [name]: value }));
  };

  // Single Card AI Suggestion Action
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

      // Allow manual entry preview rows so user can enter manually
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

  // Final Save Handler for Add Modal (Saves to Supabase)
  const handleSaveFlashcards = async () => {
    // 1. Verify Auth User
    const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authUser) {
      console.error('[flashcards-insert] Unauthenticated access attempt:', authErr);
      alert('Vui lòng đăng nhập để thực hiện thao tác.');
      return;
    }

    // 2. Query Set Owner from DB to verify Ownership
    const { data: setOwnerData, error: setOwnerErr } = await supabase
      .from('flashcard_sets')
      .select('id, user_id')
      .eq('id', id)
      .single();

    if (setOwnerErr || !setOwnerData) {
      console.error('[flashcards-insert] Cannot fetch set ownership:', setOwnerErr);
      alert('Không tìm thấy bộ thẻ Flashcard.');
      return;
    }

    if (setOwnerData.user_id !== authUser.id) {
      console.error('[flashcards-insert] Ownership check failed:', {
        authenticatedUserId: authUser.id,
        setOwnerId: setOwnerData.user_id,
      });
      alert('Bạn không có quyền chỉnh sửa bộ thẻ này. Vui lòng lưu bộ thẻ về thư viện cá nhân để chỉnh sửa.');
      return;
    }

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

      setSubmitting(true);
      const payload = {
        set_id: id,
        word: termStr,
        pronunciation: singleCard.phonetic.trim(),
        meaning: meaningStr,
        part_of_speech: singleCard.part_of_speech || (termStr.includes(' ') ? 'phrase' : 'noun'),
        learning_status: 'unlearned',
      };

      try {
        console.log('[flashcards-insert] Single card insert request:', {
          authenticatedUserId: authUser.id,
          flashcardSetId: id,
          payload,
        });

        const { error } = await supabase.from('flashcards').insert(payload);

        if (error) {
          console.error('[flashcards-insert] Single insert error:', {
            authenticatedUserId: authUser.id,
            flashcardSetId: id,
            payload,
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
          });
          alert(`Không thể thêm thẻ: ${error.message}`);
        } else {
          handleCloseAddModal();
          fetchSetData();
        }
      } catch (err) {
        console.error('Save flashcards error:', err);
      } finally {
        setSubmitting(false);
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

      setSubmitting(true);
      const payload = validNewCards.map((item) => ({
        set_id: id,
        word: item.term.trim(),
        pronunciation: item.phonetic ? item.phonetic.trim() : '',
        meaning: item.definition.trim(),
        part_of_speech: item.part_of_speech || (item.term.includes(' ') ? 'phrase' : 'noun'),
        learning_status: 'unlearned',
      }));

      try {
        console.log('[flashcards-insert] Bulk card insert request:', {
          authenticatedUserId: authUser.id,
          flashcardSetId: id,
          payload,
        });

        const { error } = await supabase.from('flashcards').insert(payload);

        if (error) {
          console.error('[flashcards-insert] Bulk insert error:', {
            authenticatedUserId: authUser.id,
            flashcardSetId: id,
            payload,
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
          });
          alert(`Không thể nhập nhiều từ: ${error.message}`);
        } else {
          handleCloseAddModal();
          fetchSetData();
        }
      } catch (err) {
        console.error('Save flashcards error:', err);
      } finally {
        setSubmitting(false);
      }
    }
  };

  // Handlers for Edit Modal
  const handleOpenEditModal = (card) => {
    setEditingCard(card);
    setEditFormData({
      term: card.term || '',
      phonetic: card.phonetic || '',
      definition: card.definition || '',
      part_of_speech: card.part_of_speech || 'noun',
      isMastered: !!card.isMastered,
    });
  };

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Save Edit to Supabase
  const handleEditSave = async (e) => {
    e.preventDefault();
    if (!editingCard) return;

    const termStr = editFormData.term.trim();
    const meaningStr = editFormData.definition.trim();

    if (!termStr) {
      alert('Vui lòng nhập từ hoặc cụm từ.');
      return;
    }

    if (!meaningStr) {
      alert('AI chưa thể gợi ý nghĩa cho từ này. Bạn có thể nhập nghĩa thủ công trước khi lưu.');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('flashcards')
        .update({
          word: termStr,
          pronunciation: editFormData.phonetic.trim(),
          meaning: meaningStr,
          part_of_speech: editFormData.part_of_speech || (termStr.includes(' ') ? 'phrase' : 'noun'),
          learning_status: editFormData.isMastered ? 'learned' : 'unlearned',
        })
        .eq('id', editingCard.id);

      if (error) {
        console.error('Error updating card:', error);
        alert(`Không thể sửa thẻ: ${error.message}`);
      } else {
        setEditingCard(null);
        fetchSetData();
      }
    } catch (err) {
      console.error('Edit card error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClose = () => {
    setEditingCard(null);
    setEditFormData({ term: '', phonetic: '', definition: '', part_of_speech: 'noun', isMastered: false });
  };

  // Handlers for Delete Card Modal
  const handleOpenDeleteModal = (card) => {
    setDeletingCard(card);
  };

  const handleConfirmDelete = async () => {
    if (!deletingCard) return;
    setSubmitting(true);

    try {
      const { error } = await supabase
        .from('flashcards')
        .delete()
        .eq('id', deletingCard.id);

      if (error) {
        console.error('Error deleting card:', error);
        alert(`Không thể xóa thẻ: ${error.message}`);
      } else {
        setDeletingCard(null);
        fetchSetData();
      }
    } catch (err) {
      console.error('Delete card error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDeleteQuizModal = (quiz) => {
    setDeletingQuiz(quiz);
  };

  const handleConfirmDeleteQuiz = async () => {
    if (!deletingQuiz) return;
    setSubmitting(true);

    try {
      const { error } = await supabase
        .from('quizzes')
        .delete()
        .eq('id', deletingQuiz.id);

      if (error) {
        console.error('Error deleting quiz:', error);
        alert(`Không thể xóa bài kiểm tra: ${error.message}`);
      } else {
        setDeletingQuiz(null);
        fetchSetData();
      }
    } catch (err) {
      console.error('Delete quiz error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Save Public Set to User Library
  const handleSaveToLibrary = async () => {
    if (!user) {
      alert('Vui lòng đăng nhập để lưu bộ thẻ vào thư viện.');
      return;
    }
    if (!setDetail) return;

    setSubmitting(true);
    try {
      const { data: newSet, error: setErr } = await supabase
        .from('flashcard_sets')
        .insert({
          name: `${setDetail.title} (Bản sao)`,
          description: setDetail.description || '',
          user_id: user.id,
          visibility: 'private',
        })
        .select()
        .single();

      if (setErr) {
        console.error('Error saving set to library:', setErr);
        alert(`Không thể lưu bộ thẻ: ${setErr.message}`);
        return;
      }

      if (flashcards.length > 0) {
        const payload = flashcards.map((c) => ({
          set_id: newSet.id,
          word: c.term || c.word || '',
          pronunciation: c.phonetic || c.pronunciation || '',
          meaning: c.definition || c.meaning || '',
          part_of_speech: c.part_of_speech || 'noun',
          learning_status: 'unlearned',
        }));

        const { error: cardsErr } = await supabase.from('flashcards').insert(payload);
        if (cardsErr) {
          console.error('Error copying cards to library:', cardsErr);
        }
      }

      alert('Đã lưu bộ thẻ vào thư viện cá nhân của bạn.');
      navigate(`/flashcard/${newSet.id}`);
    } catch (err) {
      console.error('Save to library error:', err);
      alert('Đã xảy ra lỗi khi lưu bộ thẻ.');
    } finally {
      setSubmitting(false);
    }
  };

  const isOwner = user && setDetail?.userId === user.id;

  return (
    <div className="py-2 max-w-4xl mx-auto space-y-6 px-4 sm:px-6 w-full">
      {/* Back Navigation Link */}
      <div>
        <Link
          to="/"
          className="inline-flex items-center text-xs font-medium text-[#6B7665] hover:text-[#2E3A28] bg-white border border-[#E7EEDC] px-3.5 py-1.5 rounded-xl transition-all hover:border-[#A8D672] shadow-2xs"
        >
          Quay lại danh sách
        </Link>
      </div>

      {/* 2. Flashcard Set Header Card */}
      <div className="bg-white border border-[#E7EEDC] rounded-2xl p-6 sm:p-7 space-y-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-[32px] font-bold text-[#2E3A28] leading-tight">
                {setDetail?.title || 'Đang tải thông tin...'}
              </h1>
              {setDetail?.visibility === 'public' && (
                <span className="text-xs font-semibold text-[#5B9E60] bg-[#5B9E60]/10 px-2.5 py-0.5 rounded-md shrink-0">
                  Công khai
                </span>
              )}
            </div>

            <p className="text-xs text-[#6B7665] font-medium">
              Tác giả: <span className="text-[#2E3A28]">{isOwner ? 'Bạn' : 'Cộng đồng LeafLearn'}</span>
            </p>

            {setDetail?.description && (
              <p className="text-sm text-[#6B7665] leading-relaxed pt-1">
                {setDetail.description}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {!isOwner && (
              <button
                type="button"
                onClick={handleSaveToLibrary}
                disabled={submitting}
                className="h-[44px] px-5 rounded-xl text-sm font-bold flex items-center justify-center transition-all bg-[#A8D672] hover:bg-[#97C95E] text-[#2E3A28] cursor-pointer disabled:opacity-50 shadow-2xs"
              >
                {submitting ? 'Đang lưu...' : 'Lưu vào thư viện'}
              </button>
            )}

            <Link
              to={`/study/${id}`}
              className="h-[44px] px-5 rounded-xl text-sm font-semibold flex items-center justify-center transition-all bg-white border border-[#E7EEDC] text-[#2E3A28] hover:border-[#A8D672] hover:bg-[#F8FCF4]"
            >
              Học Flashcard
            </Link>

            <Link
              to={`/quiz/create/${id}`}
              className="h-[44px] px-5 rounded-xl text-sm font-bold flex items-center justify-center transition-all bg-[#A8D672] hover:bg-[#97C95E] text-[#2E3A28]"
            >
              Tạo bài kiểm tra
            </Link>
          </div>
        </div>

        {/* Compact Horizontal Statistics */}
        <div className="pt-4 border-t border-[#E7EEDC] flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-[#6B7665]">
          <span>
            Tổng số: <strong className="text-[#2E3A28] font-bold">{totalCardsCount}</strong>
          </span>
          <span className="text-[#E7EEDC]">|</span>
          <span>
            Đã thuộc: <strong className="text-[#5B9E60] font-bold">{masteredCardsCount}</strong>
          </span>
          <span className="text-[#E7EEDC]">|</span>
          <span>
            Chưa thuộc: <strong className="text-[#E57373] font-bold">{unmasteredCardsCount}</strong>
          </span>
          <span className="text-[#E7EEDC]">|</span>
          <span>
            Bài kiểm tra: <strong className="text-[#2E3A28] font-bold">{quizzes.length}</strong>
          </span>
        </div>
      </div>

      {/* 3. Section: Saved Quizzes */}
      {quizzes.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-[#2E3A28]">
            Bài kiểm tra đã tạo ({quizzes.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {quizzes.map((quiz) => {
              const quizResults = quiz.quiz_results || [];
              const latestResult = quizResults[0];
              const qCount = Array.isArray(quiz.questions) ? quiz.questions.length : 0;
              const hasQuestions = qCount > 0;

              return (
                <div
                  key={quiz.id}
                  className="bg-white border border-[#E7EEDC] rounded-2xl p-5 hover:border-[#A8D672] hover:shadow-xs transition-all space-y-3 flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-[#2E3A28] text-base">{quiz.title}</h3>
                      <p className="text-xs text-[#6B7665] mt-0.5">
                        {qCount} câu hỏi
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenDeleteQuizModal(quiz)}
                      className="text-xs text-[#6B7665] hover:text-[#E57373] transition-colors cursor-pointer"
                    >
                      Xóa
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[#E7EEDC]/60 text-xs">
                    <span className="text-[#6B7665]">
                      {!hasQuestions ? (
                        <span className="text-[#E57373] font-medium">Bài kiểm tra chưa có câu hỏi</span>
                      ) : latestResult ? (
                        <>
                          Điểm: <strong className="text-[#5B9E60] font-bold">{latestResult.score}/{latestResult.total_questions}</strong>
                        </>
                      ) : (
                        'Chưa làm'
                      )}
                    </span>

                    {hasQuestions ? (
                      <Link
                        to={`/quiz/${quiz.id}`}
                        className="inline-flex items-center text-xs font-semibold text-[#2E3A28] bg-[#A8D672] hover:bg-[#97C95E] px-4 py-2 rounded-xl transition-all"
                      >
                        Làm bài
                      </Link>
                    ) : (
                      <button
                        disabled
                        className="inline-flex items-center text-xs font-semibold text-[#6B7665] bg-[#E7EEDC] px-4 py-2 rounded-xl opacity-50 cursor-not-allowed"
                      >
                        Làm bài
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Section: Flashcards List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#2E3A28]">
            Danh sách Flashcard ({flashcards.length})
          </h2>
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="h-[38px] bg-[#A8D672] hover:bg-[#97C95E] text-[#2E3A28] font-bold text-xs px-4 rounded-xl transition-all cursor-pointer shadow-2xs"
          >
            Thêm Flashcard
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-[#6B7665] font-medium animate-pulse">
            Đang tải danh sách thẻ từ Supabase...
          </div>
        ) : flashcards.length === 0 ? (
          <div className="bg-white border border-[#E7EEDC] rounded-2xl p-8 sm:p-10 text-center space-y-3 shadow-2xs">
            <p className="text-sm font-semibold text-[#2E3A28]">
              Bộ Flashcard này chưa có thẻ nào
            </p>
            <p className="text-xs text-[#6B7665] max-w-md mx-auto leading-relaxed">
              Bấm nút bên dưới để bắt đầu thêm từ vựng mới hoặc nhập nhiều từ cùng lúc.
            </p>
            <div className="pt-1">
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="inline-flex items-center bg-[#A8D672] hover:bg-[#97C95E] text-[#2E3A28] font-bold text-xs px-4 py-2.5 rounded-xl transition-colors shadow-2xs cursor-pointer"
              >
                Thêm Flashcard
              </button>
            </div>
          </div>
        ) : (
          /* 5. Flashcard Cards Grid (2 columns on desktop) */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {flashcards.map((card) => (
              <div
                key={card.id}
                className="bg-white border border-[#E7EEDC] rounded-2xl p-5 hover:border-[#A8D672] hover:shadow-2xs transition-all space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-[#2E3A28]">
                      {card.term}
                    </h3>
                    {card.phonetic && (
                      <span className="text-xs font-mono text-[#6B7665] block mt-0.5">
                        {card.phonetic}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleStatus(card.id)}
                    className={`text-xs font-semibold px-3 py-1 rounded-full border transition-all cursor-pointer ${
                      card.isMastered
                        ? 'bg-[#5B9E60]/10 text-[#5B9E60] border-[#5B9E60]/30 hover:bg-[#5B9E60]/20'
                        : 'bg-[#E57373]/10 text-[#E57373] border-[#E57373]/30 hover:bg-[#E57373]/20'
                    }`}
                  >
                    {card.isMastered ? 'Đã thuộc' : 'Chưa thuộc'}
                  </button>
                </div>

                <p className="text-sm text-[#2E3A28] leading-relaxed border-t border-[#E7EEDC]/60 pt-2.5">
                  {card.definition || 'Chưa có định nghĩa.'}
                </p>

                <div className="flex items-center justify-end gap-3 pt-2 text-xs border-t border-[#E7EEDC]/40">
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(card)}
                    className="text-[#6B7665] hover:text-[#2E3A28] font-medium transition-colors cursor-pointer"
                  >
                    Chỉnh sửa
                  </button>
                  <span className="text-[#E7EEDC]">|</span>
                  <button
                    type="button"
                    onClick={() => handleOpenDeleteModal(card)}
                    className="text-[#6B7665] hover:text-[#E57373] font-medium transition-colors cursor-pointer"
                  >
                    Xóa
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Flashcard Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-[#2E3A28]/30 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white border border-[#E7EEDC] rounded-2xl p-6 sm:p-8 max-w-xl w-full shadow-lg space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E7EEDC] pb-4">
              <h2 className="text-xl font-bold text-[#2E3A28]">
                {addStep === 'manual' && 'Thêm Flashcard mới'}
                {addStep === 'bulk_input' && 'Nhập nhiều Flashcard cùng lúc'}
                {addStep === 'bulk_preview' && 'Xem trước danh sách Flashcard'}
              </h2>
              <button
                type="button"
                onClick={handleCloseAddModal}
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
                      <label className="block text-xs font-medium text-[#2E3A28]">
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
                    <label className="block text-xs font-medium text-[#2E3A28]">
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
                    <label className="block text-xs font-medium text-[#2E3A28]">
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
                    onClick={handleCloseAddModal}
                    className="px-4 py-2 rounded-xl border border-[#E7EEDC] text-sm text-[#2E3A28] hover:bg-[#F8FCF4] cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveFlashcards}
                    disabled={submitting || !singleCard.term.trim()}
                    className="px-5 py-2 rounded-xl bg-[#A8D672] hover:bg-[#97C95E] text-sm font-semibold text-[#2E3A28] disabled:opacity-50 cursor-pointer"
                  >
                    {submitting ? 'Đang lưu...' : 'Lưu Flashcard'}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: BULK INPUT */}
            {addStep === 'bulk_input' && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-[#2E3A28]">
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
                    className="px-4 py-2 rounded-xl border border-[#E7EEDC] text-sm text-[#2E3A28] hover:bg-[#F8FCF4] cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleGeneratePreview}
                    disabled={!bulkText.trim() || generatingPreview}
                    className="px-5 py-2 rounded-xl bg-[#A8D672] hover:bg-[#97C95E] text-sm font-semibold text-[#2E3A28] disabled:opacity-50 flex items-center gap-2 cursor-pointer"
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
                      key={item.id}
                      className="bg-[#F8FCF4] border border-[#E7EEDC] p-4 rounded-xl space-y-3 relative"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#6B7665]">
                          Thẻ #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemovePreviewItem(idx)}
                          className="text-xs text-[#E57373] hover:underline cursor-pointer"
                        >
                          Xóa
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-[#2E3A28] mb-1">
                            Từ / Cụm từ:
                          </label>
                          <input
                            type="text"
                            value={item.term}
                            onChange={(e) => handlePreviewItemChange(idx, 'term', e.target.value)}
                            className="w-full px-3 py-1.5 text-xs rounded-lg border border-[#E7EEDC] bg-white focus:outline-none focus:border-[#A8D672]"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-[#2E3A28] mb-1">
                            Phiên âm:
                          </label>
                          <input
                            type="text"
                            value={item.phonetic}
                            onChange={(e) =>
                              handlePreviewItemChange(idx, 'phonetic', e.target.value)
                            }
                            className="w-full px-3 py-1.5 text-xs rounded-lg border border-[#E7EEDC] bg-white focus:outline-none focus:border-[#A8D672]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-[#2E3A28] mb-1">
                          Nghĩa:
                        </label>
                        <input
                          type="text"
                          value={item.definition}
                          onChange={(e) => handlePreviewItemChange(idx, 'definition', e.target.value)}
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-[#E7EEDC] bg-white focus:outline-none focus:border-[#A8D672]"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-[#E7EEDC]">
                  <button
                    type="button"
                    onClick={() => setAddStep('bulk_input')}
                    className="px-4 py-2 rounded-xl border border-[#E7EEDC] text-sm text-[#2E3A28] hover:bg-[#F8FCF4] cursor-pointer"
                  >
                    Quay lại
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveFlashcards}
                    disabled={submitting || bulkPreviewList.length === 0}
                    className="px-5 py-2 rounded-xl bg-[#A8D672] hover:bg-[#97C95E] text-sm font-semibold text-[#2E3A28] disabled:opacity-50 cursor-pointer"
                  >
                    {submitting ? 'Đang lưu...' : `Lưu tất cả (${bulkPreviewList.length} thẻ)`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Flashcard Modal */}
      {editingCard && (
        <div className="fixed inset-0 bg-[#2E3A28]/30 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#E7EEDC] rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-lg space-y-6">
            <div className="flex items-center justify-between border-b border-[#E7EEDC] pb-4">
              <h2 className="text-xl font-bold text-[#2E3A28]">Chỉnh sửa Flashcard</h2>
              <button
                type="button"
                onClick={handleEditClose}
                className="text-[#6B7665] hover:text-[#2E3A28] text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSave} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#2E3A28]">
                  Từ hoặc cụm từ <span className="text-[#E57373]">*</span>
                </label>
                <input
                  type="text"
                  name="term"
                  value={editFormData.term}
                  onChange={handleEditInputChange}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E7EEDC] text-sm text-[#2E3A28] focus:outline-none focus:border-[#A8D672]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#2E3A28]">Phiên âm</label>
                <input
                  type="text"
                  name="phonetic"
                  value={editFormData.phonetic}
                  onChange={handleEditInputChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E7EEDC] text-sm text-[#2E3A28] focus:outline-none focus:border-[#A8D672]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#2E3A28]">Nghĩa</label>
                <textarea
                  rows={3}
                  name="definition"
                  value={editFormData.definition}
                  onChange={handleEditInputChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E7EEDC] text-sm text-[#2E3A28] focus:outline-none focus:border-[#A8D672]"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="editIsMastered"
                  checked={editFormData.isMastered}
                  onChange={(e) =>
                    setEditFormData((prev) => ({ ...prev, isMastered: e.target.checked }))
                  }
                  className="rounded border-[#E7EEDC] text-[#5B9E60] focus:ring-[#5B9E60]"
                />
                <label htmlFor="editIsMastered" className="text-xs font-medium text-[#2E3A28]">
                  Đã thuộc thẻ này
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E7EEDC]">
                <button
                  type="button"
                  onClick={handleEditClose}
                  className="px-4 py-2 rounded-xl border border-[#E7EEDC] text-sm text-[#2E3A28] hover:bg-[#F8FCF4] cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting || !editFormData.term.trim()}
                  className="px-5 py-2 rounded-xl bg-[#A8D672] hover:bg-[#97C95E] text-sm font-semibold text-[#2E3A28] disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Đang lưu...' : 'Lưu chỉnh sửa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Card Confirmation Modal */}
      {deletingCard && (
        <div className="fixed inset-0 bg-[#2E3A28]/30 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#E7EEDC] rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-lg space-y-4">
            <h3 className="text-lg font-bold text-[#2E3A28]">Xác nhận xóa thẻ Flashcard</h3>
            <p className="text-xs text-[#6B7665]">
              Bạn có chắc chắn muốn xóa thẻ từ vựng{' '}
              <strong className="text-[#2E3A28]">"{deletingCard.term}"</strong> khỏi bộ thẻ? Hành động này không thể hoàn tác.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingCard(null)}
                className="px-4 py-2 rounded-xl border border-[#E7EEDC] text-xs font-medium text-[#6B7665] hover:bg-[#F8FCF4] cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-[#E57373] text-[#FAFDF8] text-xs font-semibold hover:bg-[#D32F2F] cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Đang xóa...' : 'Đồng ý xóa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Quiz Confirmation Modal */}
      {deletingQuiz && (
        <div className="fixed inset-0 bg-[#2E3A28]/30 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#E7EEDC] rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-lg space-y-4">
            <h3 className="text-lg font-bold text-[#2E3A28]">Xác nhận xóa Bài kiểm tra</h3>
            <p className="text-xs text-[#6B7665]">
              Bạn có chắc chắn muốn xóa bài kiểm tra{' '}
              <strong className="text-[#2E3A28]">"{deletingQuiz.title}"</strong>?
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingQuiz(null)}
                className="px-4 py-2 rounded-xl border border-[#E7EEDC] text-xs font-medium text-[#6B7665] hover:bg-[#F8FCF4] cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteQuiz}
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-[#E57373] text-[#FAFDF8] text-xs font-semibold hover:bg-[#D32F2F] cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Đang xóa...' : 'Đồng ý xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
