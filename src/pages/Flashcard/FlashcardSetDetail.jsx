import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { Button, Input, Modal, Tag, Empty } from '../../components';
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
          className="inline-flex items-center text-xs font-medium text-[#66705F] hover:text-[#1A2416] bg-white border border-[#DCE5D8] px-3.5 py-1.5 rounded-lg transition-all hover:border-[#24693D] shadow-2xs gap-1.5"
        >
          <span>←</span> Quay lại danh sách
        </Link>
      </div>

      {/* 2. Flashcard Set Header Card */}
      <div className="bg-white border border-[#DCE5D8] rounded-xl p-6 sm:p-7 space-y-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-bold text-[#1A2416] leading-tight">
                {setDetail?.title || 'Đang tải thông tin...'}
              </h1>
              <Tag color={setDetail?.visibility === 'public' ? 'leaf' : 'default'}>
                {setDetail?.visibility === 'public' ? 'Công khai' : 'Riêng tư'}
              </Tag>
            </div>

            <p className="text-xs text-[#66705F] font-medium">
              Tác giả: <span className="text-[#2E3A28]">{isOwner ? 'Bạn' : 'Cộng đồng LeafLearn'}</span>
            </p>

            {setDetail?.description && (
              <p className="text-sm text-[#66705F] leading-relaxed pt-0.5">
                {setDetail.description}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {!isOwner && (
              <Button
                type="default"
                size="large"
                onClick={handleSaveToLibrary}
                loading={submitting}
              >
                Lưu vào thư viện
              </Button>
            )}

            <Link to={`/study/${id}`}>
              <Button type="primary" size="large">
                Học Flashcard
              </Button>
            </Link>

            <Link to={`/quiz/create/${id}`}>
              <Button type="outlined" size="large">
                Tạo bài kiểm tra
              </Button>
            </Link>
          </div>
        </div>

        {/* Compact Horizontal Statistics */}
        <div className="pt-4 border-t border-[#E8EFE5] flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#66705F]">
          <span>
            Tổng số: <strong className="text-[#1A2416] font-bold">{totalCardsCount}</strong>
          </span>
          <span className="text-[#DCE5D8]">•</span>
          <span>
            Đã thuộc: <strong className="text-[#389E0D] font-bold">{masteredCardsCount}</strong>
          </span>
          <span className="text-[#DCE5D8]">•</span>
          <span>
            Chưa thuộc: <strong className="text-[#CF1322] font-bold">{unmasteredCardsCount}</strong>
          </span>
          <span className="text-[#DCE5D8]">•</span>
          <span>
            Bài kiểm tra: <strong className="text-[#1A2416] font-bold">{quizzes.length}</strong>
          </span>
        </div>
      </div>

      {/* 3. Section: Saved Quizzes */}
      {quizzes.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-[#1A2416]">
            Bài kiểm tra đã tạo ({quizzes.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {quizzes.map((quiz) => {
              const quizResults = quiz.quiz_results || [];
              const latestResult = quizResults[0];
              const qCount = Array.isArray(quiz.questions) ? quiz.questions.length : 0;
              const hasQuestions = qCount > 0;

              return (
                <div
                  key={quiz.id}
                  className="bg-white border border-[#DCE5D8] rounded-xl p-4 sm:p-5 hover:border-[#24693D]/40 hover:shadow-sm transition-all space-y-3 flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-[#1A2416] text-sm sm:text-base">{quiz.title}</h3>
                      <p className="text-xs text-[#66705F] mt-0.5">
                        {qCount} câu hỏi
                      </p>
                    </div>

                    <Button
                      type="text"
                      danger
                      size="small"
                      onClick={() => handleOpenDeleteQuizModal(quiz)}
                    >
                      Xóa
                    </Button>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[#E8EFE5] text-xs">
                    <span className="text-[#66705F]">
                      {!hasQuestions ? (
                        <span className="text-[#CF1322] font-medium">Chưa có câu hỏi</span>
                      ) : latestResult ? (
                        <>
                          Điểm: <strong className="text-[#389E0D] font-bold">{latestResult.score}/{latestResult.total_questions}</strong>
                        </>
                      ) : (
                        'Chưa làm'
                      )}
                    </span>

                    <div className="flex items-center gap-2">
                      {hasQuestions && latestResult && (
                        <Link to={`/result/${latestResult.id}?details=true`}>
                          <Button type="default" size="small">
                            Chi tiết
                          </Button>
                        </Link>
                      )}

                      {hasQuestions ? (
                        <Link to={`/quiz/${quiz.id}`}>
                          <Button type="primary" size="small">
                            {latestResult ? 'Làm lại' : 'Làm bài'}
                          </Button>
                        </Link>
                      ) : (
                        <Button disabled size="small">
                          Làm bài
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Section: Flashcards List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-[#1A2416]">
            Danh sách Flashcard ({flashcards.length})
          </h2>
          <Button
            type="primary"
            onClick={handleOpenAddModal}
            icon={
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
              </svg>
            }
          >
            Thêm Flashcard
          </Button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-[#66705F] font-medium animate-pulse flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4 text-[#24693D]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Đang tải danh sách thẻ...
          </div>
        ) : flashcards.length === 0 ? (
          <Empty
            title="Bộ Flashcard này chưa có thẻ nào"
            description="Bấm nút bên dưới để bắt đầu thêm từ vựng mới hoặc nhập nhiều từ cùng lúc."
            action={
              <Button type="primary" onClick={handleOpenAddModal}>
                Thêm Flashcard
              </Button>
            }
          />
        ) : (
          /* Flashcard Cards Grid (2 columns on desktop) */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {flashcards.map((card) => (
              <div
                key={card.id}
                className="bg-white border border-[#DCE5D8] rounded-xl p-4 sm:p-5 hover:border-[#24693D]/40 hover:shadow-xs transition-all space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-[#1A2416]">
                        {card.term}
                      </h3>
                      {card.phonetic && (
                        <span className="text-xs font-mono text-[#66705F] block mt-0.5">
                          {card.phonetic}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleStatus(card.id)}
                      className="cursor-pointer focus:outline-none"
                      title="Nhấn để đổi trạng thái"
                    >
                      <Tag color={card.isMastered ? 'green' : 'red'}>
                        {card.isMastered ? 'Đã thuộc' : 'Chưa thuộc'}
                      </Tag>
                    </button>
                  </div>

                  <p className="text-xs sm:text-sm text-[#2E3A28] leading-relaxed border-t border-[#E8EFE5] pt-2">
                    {card.definition || 'Chưa có định nghĩa.'}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E8EFE5]/60 text-xs">
                  <Button
                    type="text"
                    size="small"
                    onClick={() => handleOpenEditModal(card)}
                  >
                    Chỉnh sửa
                  </Button>
                  <span className="text-[#DCE5D8]">•</span>
                  <Button
                    type="text"
                    danger
                    size="small"
                    onClick={() => handleOpenDeleteModal(card)}
                  >
                    Xóa
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Flashcard Modal */}
      <Modal
        open={isAddModalOpen}
        title={
          <div>
            <div className="font-bold text-[#1A2416] text-base sm:text-lg">
              {addStep === 'manual' && 'Thêm Flashcard mới'}
              {addStep === 'bulk_input' && 'Nhập nhiều Flashcard cùng lúc'}
              {addStep === 'bulk_preview' && 'Xem trước danh sách Flashcard'}
            </div>
            <p className="text-xs text-[#66705F] font-normal mt-0.5">
              Bộ thẻ: <strong className="text-[#2E3A28]">{setDetail?.title}</strong>
            </p>
          </div>
        }
        onCancel={handleCloseAddModal}
        width="max-w-xl"
        footer={null}
      >
        {/* STEP 1: MANUAL ENTRY */}
        {addStep === 'manual' && (
          <div className="space-y-4">
            <div className="space-y-3.5">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-[#1A2416]">
                    Từ hoặc cụm từ <span className="text-[#CF1322]">*</span>
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
                  className="w-full h-10 px-3.5 rounded-lg border border-[#DCE5D8] focus:border-[#24693D] focus:ring-2 focus:ring-[#24693D]/20 outline-none text-sm text-[#2E3A28]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#1A2416]">
                  Phiên âm
                </label>
                <input
                  type="text"
                  name="phonetic"
                  value={singleCard.phonetic}
                  onChange={handleSingleInputChange}
                  placeholder="Ví dụ: /ˌser.ənˈdɪp.ə.ti/"
                  className="w-full h-10 px-3.5 rounded-lg border border-[#DCE5D8] focus:border-[#24693D] focus:ring-2 focus:ring-[#24693D]/20 outline-none text-sm text-[#2E3A28]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#1A2416]">
                  Nghĩa tiếng Việt <span className="text-[#CF1322]">*</span>
                </label>
                <textarea
                  rows={3}
                  name="definition"
                  value={singleCard.definition}
                  onChange={handleSingleInputChange}
                  placeholder="Ví dụ: Sự tình cờ may mắn tìm thấy điều gì đó..."
                  className="w-full p-3 rounded-lg border border-[#DCE5D8] focus:border-[#24693D] focus:ring-2 focus:ring-[#24693D]/20 outline-none text-sm text-[#2E3A28]"
                />
              </div>

              <div className="bg-[#F9FCF8] border border-[#E8EFE5] px-3.5 py-2 rounded-lg text-xs text-[#66705F]">
                Trạng thái học mặc định: <strong className="text-[#24693D]">Chưa thuộc</strong>
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

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#E8EFE5]">
              <Button type="default" onClick={handleCloseAddModal}>
                Hủy
              </Button>
              <Button
                type="primary"
                onClick={handleSaveFlashcards}
                loading={submitting}
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
              <label className="block text-xs font-semibold text-[#1A2416]">
                Nhập danh sách từ (Mỗi dòng một từ hoặc cụm từ)
              </label>
              <textarea
                rows={8}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={`neighbor\nmeticulous\ntake care of\nlook forward to`}
                className="w-full p-3.5 rounded-lg border border-[#DCE5D8] focus:border-[#24693D] focus:ring-2 focus:ring-[#24693D]/20 outline-none text-sm font-mono text-[#2E3A28]"
              />
              <p className="text-xs text-[#66705F]">
                Mỗi dòng sẽ được AI Gemini hỗ trợ gợi ý nghĩa tiếng Việt và phiên âm ở bước xem trước.
              </p>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-[#E8EFE5]">
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
                  className="bg-[#F9FCF8] border border-[#DCE5D8] p-3.5 rounded-lg space-y-2.5 relative"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1A2416]">
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
                      <label className="block text-[11px] font-semibold text-[#66705F] mb-1">
                        Từ/Cụm từ <span className="text-[#CF1322]">*</span>
                      </label>
                      <input
                        type="text"
                        value={item.term}
                        onChange={(e) => handlePreviewItemChange(idx, 'term', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-md border border-[#DCE5D8] focus:border-[#24693D] outline-none bg-white text-xs text-[#2E3A28]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#66705F] mb-1">
                        Phiên âm
                      </label>
                      <input
                        type="text"
                        value={item.phonetic}
                        onChange={(e) => handlePreviewItemChange(idx, 'phonetic', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-md border border-[#DCE5D8] focus:border-[#24693D] outline-none bg-white text-xs text-[#2E3A28]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#66705F] mb-1">
                        Nghĩa tiếng Việt <span className="text-[#CF1322]">*</span>
                      </label>
                      <input
                        type="text"
                        value={item.definition}
                        onChange={(e) => handlePreviewItemChange(idx, 'definition', e.target.value)}
                        placeholder="Nhập nghĩa..."
                        className="w-full px-2.5 py-1.5 rounded-md border border-[#DCE5D8] focus:border-[#24693D] outline-none bg-white text-xs text-[#2E3A28]"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-[#E8EFE5]">
              <Button type="default" onClick={() => setAddStep('bulk_input')}>
                Quay lại nhập
              </Button>

              <div className="flex items-center gap-2.5">
                <Button type="default" onClick={handleCloseAddModal}>
                  Hủy
                </Button>
                <Button
                  type="primary"
                  onClick={handleSaveFlashcards}
                  loading={submitting}
                  disabled={bulkPreviewList.length === 0}
                >
                  Lưu tất cả ({bulkPreviewList.length} thẻ)
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Flashcard Modal */}
      <Modal
        open={!!editingCard}
        title="Chỉnh sửa Flashcard"
        onCancel={handleEditClose}
        onOk={handleEditSave}
        okText={submitting ? 'Đang lưu...' : 'Lưu chỉnh sửa'}
        confirmLoading={submitting}
      >
        <form onSubmit={handleEditSave} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#1A2416]">
              Từ hoặc cụm từ <span className="text-[#CF1322]">*</span>
            </label>
            <input
              type="text"
              name="term"
              value={editFormData.term}
              onChange={handleEditInputChange}
              required
              className="w-full h-10 px-3.5 rounded-lg border border-[#DCE5D8] focus:border-[#24693D] focus:ring-2 focus:ring-[#24693D]/20 outline-none text-sm text-[#2E3A28]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#1A2416]">Phiên âm</label>
            <input
              type="text"
              name="phonetic"
              value={editFormData.phonetic}
              onChange={handleEditInputChange}
              className="w-full h-10 px-3.5 rounded-lg border border-[#DCE5D8] focus:border-[#24693D] focus:ring-2 focus:ring-[#24693D]/20 outline-none text-sm text-[#2E3A28]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#1A2416]">Nghĩa tiếng Việt</label>
            <textarea
              rows={3}
              name="definition"
              value={editFormData.definition}
              onChange={handleEditInputChange}
              className="w-full p-3 rounded-lg border border-[#DCE5D8] focus:border-[#24693D] focus:ring-2 focus:ring-[#24693D]/20 outline-none text-sm text-[#2E3A28]"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="editIsMastered"
              checked={editFormData.isMastered}
              onChange={(e) =>
                setEditFormData((prev) => ({ ...prev, isMastered: e.target.checked }))
              }
              className="rounded border-[#DCE5D8] text-[#24693D] focus:ring-[#24693D]"
            />
            <label htmlFor="editIsMastered" className="text-xs font-medium text-[#2E3A28] cursor-pointer">
              Đã thuộc thẻ này
            </label>
          </div>
        </form>
      </Modal>

      {/* Delete Card Confirmation Modal */}
      <Modal
        open={!!deletingCard}
        title="Xác nhận xóa thẻ Flashcard"
        danger
        onCancel={() => setDeletingCard(null)}
        onOk={handleConfirmDelete}
        okText={submitting ? 'Đang xóa...' : 'Đồng ý xóa'}
        confirmLoading={submitting}
      >
        <p className="text-sm text-[#5A6553] leading-relaxed">
          Bạn có chắc chắn muốn xóa thẻ từ vựng{' '}
          <strong className="text-[#1A2416]">"{deletingCard?.term}"</strong> khỏi bộ thẻ? Hành động này không thể hoàn tác.
        </p>
      </Modal>

      {/* Delete Quiz Confirmation Modal */}
      <Modal
        open={!!deletingQuiz}
        title="Xác nhận xóa bài kiểm tra"
        danger
        onCancel={() => setDeletingQuiz(null)}
        onOk={handleConfirmDeleteQuiz}
        okText={submitting ? 'Đang xóa...' : 'Đồng ý xóa'}
        confirmLoading={submitting}
      >
        <p className="text-sm text-[#5A6553] leading-relaxed">
          Bạn có chắc chắn muốn xóa bài kiểm tra{' '}
          <strong className="text-[#1A2416]">"{deletingQuiz?.title}"</strong>?
        </p>
      </Modal>
    </div>
  );
}
