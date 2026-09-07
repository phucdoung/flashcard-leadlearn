import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import {
  generateQuizWithGemini,
  QuizGenerationError,
} from '../../lib/geminiQuizService';

export default function CreateQuiz() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [setDetail, setSetDetail] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [isValidatingCards, setIsValidatingCards] = useState(false);

  const [quizTitle, setQuizTitle] = useState('Bài kiểm tra tổng hợp từ vựng');

  // Flashcard Quality Audit Modal State
  const [showQualityModal, setShowQualityModal] = useState(false);
  const [auditIssues, setAuditIssues] = useState([]);
  const [editingCardId, setEditingCardId] = useState(null);
  const [editFormData, setEditFormData] = useState({ word: '', meaning: '' });

  useEffect(() => {
    async function fetchSetInfo() {
      if (!id) return;
      setLoading(true);
      try {
        const { data: setData } = await supabase
          .from('flashcard_sets')
          .select('*, flashcards(*)')
          .eq('id', id)
          .single();

        if (setData) {
          const rawCards = setData.flashcards || [];
          setSetDetail({
            id: setData.id,
            title: setData.name || setData.title || 'Bộ thẻ',
          });
          setCards(rawCards);
        }
      } catch (err) {
        console.error('Error fetching set for quiz creation:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchSetInfo();
  }, [id]);

  const availableCardsCount = cards.length;
  const hasMinimumCards = availableCardsCount >= 10;

  // Execute actual Quiz generation with verified card pool
  const executeQuizGeneration = async (cardList) => {
    const usableCards = (cardList || []).filter(
      (f) =>
        (f.word || f.term || '').trim().length > 0 &&
        (f.meaning || f.definition || '').trim().length > 0
    );

    if (usableCards.length < 10) {
      alert('Bộ Flashcard chưa có đủ 10 từ/cụm từ hợp lệ để tạo bài kiểm tra.');
      return;
    }

    setGenerating(true);

    try {
      // Generate fill-in-the-blank questions with Gemini AI in ONE batch request
      const generatedQuestions = await generateQuizWithGemini(usableCards);

      if (!generatedQuestions || generatedQuestions.length < 10) {
        alert('AI chưa tạo đủ 10 câu hỏi đạt yêu cầu. Vui lòng thử lại.');
        return;
      }

      // Persist generated quiz in Supabase
      const { data: newQuiz, error: insertErr } = await supabase
        .from('quizzes')
        .insert({
          set_id: id,
          user_id: user.id,
          title: quizTitle.trim() || 'Bài kiểm tra tổng hợp',
          questions: generatedQuestions,
        })
        .select()
        .single();

      if (insertErr) {
        console.error('Error saving quiz to Supabase:', insertErr);
        alert(`Không thể lưu bài kiểm tra: ${insertErr.message}`);
      } else if (newQuiz) {
        navigate(`/quiz/${newQuiz.id}`);
      }
    } catch (err) {
      console.error('Quiz creation error:', err);
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
        alert('AI hiện đã đạt giới hạn sử dụng. Vui lòng thử lại sau.');
      } else if (err?.code === 'VALIDATION_ERROR' || msg.includes('chưa tạo đủ 10 câu hỏi')) {
        alert('AI chưa tạo đủ 10 câu hỏi đạt yêu cầu. Vui lòng thử lại.');
      } else {
        alert(msg || 'Đã xảy ra lỗi khi kết nối AI. Vui lòng thử lại sau.');
      }
    } finally {
      setGenerating(false);
    }
  };

  // Form Submit: Proceed directly to batch quiz generation
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hasMinimumCards || generating || !user) return;
    await executeQuizGeneration(cards);
  };

  // Apply AI Suggestion & Update Supabase
  const handleApplySuggestion = async (issueItem) => {
    try {
      const cardId = issueItem.flashcardId;
      const newWord = issueItem.suggestedWord || issueItem.word;
      const newMeaning = issueItem.suggestedMeaning || issueItem.currentMeaning;
      const newIPA = issueItem.suggestedPronunciation || '';

      const { error } = await supabase
        .from('flashcards')
        .update({
          term: newWord,
          definition: newMeaning,
          phonetic: newIPA,
        })
        .eq('id', cardId);

      if (error) {
        console.error('Error updating flashcard in Supabase:', error);
        alert(`Không thể cập nhật từ vựng: ${error.message}`);
        return;
      }

      setCards((prevCards) =>
        prevCards.map((c) =>
          c.id === cardId
            ? { ...c, term: newWord, word: newWord, definition: newMeaning, meaning: newMeaning, phonetic: newIPA }
            : c
        )
      );

      setAuditIssues((prev) =>
        prev.map((item) =>
          item.flashcardId === cardId ? { ...item, status: 'applied' } : item
        )
      );
    } catch (err) {
      console.error('Apply suggestion error:', err);
    }
  };

  // Save manual edit & Update Supabase
  const handleSaveManualEdit = async (cardId) => {
    if (!editFormData.word.trim() || !editFormData.meaning.trim()) return;

    try {
      const newWord = editFormData.word.trim();
      const newMeaning = editFormData.meaning.trim();

      const { error } = await supabase
        .from('flashcards')
        .update({
          term: newWord,
          definition: newMeaning,
        })
        .eq('id', cardId);

      if (error) {
        console.error('Error updating flashcard in Supabase:', error);
        alert(`Không thể cập nhật từ vựng: ${error.message}`);
        return;
      }

      setCards((prevCards) =>
        prevCards.map((c) =>
          c.id === cardId
            ? { ...c, term: newWord, word: newWord, definition: newMeaning, meaning: newMeaning }
            : c
        )
      );

      setAuditIssues((prev) =>
        prev.map((item) =>
          item.flashcardId === cardId ? { ...item, status: 'applied' } : item
        )
      );

      setEditingCardId(null);
    } catch (err) {
      console.error('Manual edit error:', err);
    }
  };

  const handleIgnoreWarning = (cardId) => {
    setAuditIssues((prev) =>
      prev.map((item) =>
        item.flashcardId === cardId ? { ...item, status: 'ignored' } : item
      )
    );
  };

  const handleExcludeCard = (cardId) => {
    setAuditIssues((prev) =>
      prev.map((item) =>
        item.flashcardId === cardId ? { ...item, status: 'excluded' } : item
      )
    );
  };

  const excludedCardIds = new Set(
    auditIssues.filter((i) => i.status === 'excluded').map((i) => i.flashcardId)
  );
  const unhandledErrorIds = new Set(
    auditIssues.filter((i) => i.severity === 'error' && i.status === 'pending').map((i) => i.flashcardId)
  );

  const validCardsPool = cards.filter(
    (c) => !excludedCardIds.has(c.id) && !unhandledErrorIds.has(c.id)
  );

  const canProceedWithQuiz = validCardsPool.length >= 10 && unhandledErrorIds.size === 0;

  const handleFinishReviewAndGenerate = () => {
    if (!canProceedWithQuiz) return;
    setShowQualityModal(false);
    executeQuizGeneration(validCardsPool);
  };

  return (
    <div className="py-2 sm:py-3 max-w-4xl mx-auto space-y-6 px-4 sm:px-6 w-full">
      {/* Header Section */}
      <div className="bg-white border border-[#E7EEDC] rounded-2xl p-5 sm:p-6 space-y-3.5 shadow-2xs">
        <div>
          <Link
            to={`/flashcard/${id}`}
            className="inline-flex items-center text-xs font-medium text-[#6B7665] hover:text-[#2E3A28] bg-white border border-[#E7EEDC] px-3.5 py-1.5 rounded-xl transition-all hover:border-[#A8D672] mb-2 shadow-2xs"
          >
            Quay lại bộ Flashcard
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#2E3A28] leading-tight">
            Tạo bài kiểm tra
          </h1>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-[#E7EEDC] text-xs text-[#6B7665]">
          <span>
            Bộ thẻ: <strong className="text-[#2E3A28] font-bold">{setDetail?.title || 'Đang tải...'}</strong>
          </span>
          <span>
            Tổng số Flashcard có sẵn:{' '}
            <strong
              className={`font-bold ${
                availableCardsCount < 10 ? 'text-[#E57373]' : 'text-[#5B9E60]'
              }`}
            >
              {loading ? '...' : `${availableCardsCount} thẻ`}
            </strong>
          </span>
        </div>
      </div>

      {/* Quiz Settings Form */}
      <div className="bg-white border border-[#E7EEDC] rounded-2xl p-5 sm:p-6 space-y-5 shadow-2xs">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Quiz Title Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#2E3A28]">
              Tên bài kiểm tra
            </label>
            <input
              type="text"
              required
              value={quizTitle}
              onChange={(e) => setQuizTitle(e.target.value)}
              placeholder="Nhập tên bài kiểm tra..."
              className="w-full h-[46px] px-4 rounded-xl border border-[#E7EEDC] bg-[#F8FCF4]/50 text-sm text-[#2E3A28] placeholder-[#6B7665]/50 focus:outline-none focus:border-[#A8D672] focus:bg-white transition-colors"
            />
          </div>

          {/* Dynamic AI Question Count Guidance Box */}
          <div className="space-y-2 rounded-2xl border border-[#E7EEDC] bg-[#F8FCF4] p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#A8D672] text-[11px] font-bold text-[#2E3A28]">
                AI
              </span>
              <h4 className="text-xs font-bold text-[#2E3A28]">
                Quy trình sinh câu hỏi tự động
              </h4>
            </div>

            <p className="text-xs text-[#4A5545] leading-relaxed pt-0.5">
              Bài kiểm tra sẽ được AI tạo tự động từ các từ/cụm từ hợp lệ trong bộ Flashcard (yêu cầu tối thiểu 10 câu hỏi).
            </p>

            <p className="text-[11px] text-[#6B7665] italic">
              * Số lượng câu hỏi thực tế phụ thuộc vào số từ vựng hợp lệ và kết quả sinh câu hỏi chất lượng cao từ Gemini.
            </p>

            {!loading && !hasMinimumCards && (
              <span className="block text-xs text-[#E57373] font-semibold pt-1.5">
                Yêu cầu bộ thẻ phải có tối thiểu 10 Flashcards mới có thể tạo bài kiểm tra (Hiện có {availableCardsCount} thẻ).
              </span>
            )}
          </div>

          {/* Main Action Button */}
          <button
            type="submit"
            disabled={loading || !hasMinimumCards || generating}
            className="w-full h-[46px] rounded-xl bg-[#A8D672] hover:bg-[#97C95E] text-[#2E3A28] text-sm font-bold transition-all shadow-2xs active:scale-[0.98] cursor-pointer text-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? 'Đang sinh câu hỏi bằng AI Gemini...' : 'Tạo bài kiểm tra'}
          </button>
        </form>
      </div>

      {/* Quality Review Modal */}
      {showQualityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-white p-6 shadow-xl border border-[#E7EEDC]">
            {/* Modal Header */}
            <div className="pb-4 border-b border-[#E7EEDC]">
              <h3 className="text-xl font-bold text-[#2E3A28]">
                Kiểm tra từ vựng trước khi tạo bài
              </h3>
              <p className="mt-1 text-xs text-[#6B7665]">
                Phát hiện <strong className="text-[#2E3A28]">{auditIssues.length} thẻ</strong> có thể gặp vấn đề về mặt từ vựng hoặc ý nghĩa. Vui lòng xem xét trước khi tiến hành sinh bài kiểm tra.
              </p>
            </div>

            {/* Audit Issues List */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              {auditIssues.map((item) => {
                const isError = item.severity === 'error';
                const isPending = item.status === 'pending';
                const isApplied = item.status === 'applied';
                const isIgnored = item.status === 'ignored';
                const isExcluded = item.status === 'excluded';
                const isEditing = editingCardId === item.flashcardId;

                return (
                  <div
                    key={item.flashcardId}
                    className={`p-4 rounded-xl border transition-all ${
                      isError
                        ? 'border-[#FCA5A5] bg-[#FEF2F2]'
                        : 'border-[#FDE68A] bg-[#FFFBEB]'
                    }`}
                  >
                    {/* Header Badge */}
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
                          isError
                            ? 'bg-[#FEE2E2] text-[#DC2626]'
                            : 'bg-[#FEF3C7] text-[#D97706]'
                        }`}
                      >
                        {isError ? 'Lỗi nghiêm trọng' : 'Cảnh báo'}
                      </span>

                      {isApplied && (
                        <span className="text-xs font-semibold text-[#166534]">
                          ✓ Đã áp dụng gợi ý
                        </span>
                      )}
                      {isIgnored && (
                        <span className="text-xs font-semibold text-[#D97706]">
                          ✓ Giữ nguyên (Cảnh báo)
                        </span>
                      )}
                      {isExcluded && (
                        <span className="text-xs font-semibold text-[#DC2626]">
                          ✕ Đã loại bỏ khỏi bài kiểm tra
                        </span>
                      )}
                    </div>

                    {/* Issue Description */}
                    <p className="text-xs font-semibold text-[#2E3A28] mb-2">
                      Nguyên nhân: <span className="font-normal text-[#4B5563]">{item.issue}</span>
                    </p>

                    {/* Current vs Suggested Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white/70 p-3 rounded-lg border border-[#E7EEDC] mb-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-[#6B7665] block mb-0.5">
                          Từ vựng hiện tại:
                        </span>
                        <p className="font-semibold text-[#2E3A28]">{item.word}</p>
                        <p className="text-[#6B7665]">{item.currentMeaning}</p>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-[#2563EB] block mb-0.5">
                          Gợi ý từ AI:
                        </span>
                        <p className="font-semibold text-[#2563EB]">
                          {item.suggestedWord}{' '}
                          {item.suggestedPronunciation && (
                            <span className="font-normal text-[11px] text-[#4B5563]">
                              ({item.suggestedPronunciation})
                            </span>
                          )}
                        </p>
                        <p className="text-[#3B82F6]">{item.suggestedMeaning}</p>
                      </div>
                    </div>

                    {/* Editing Form */}
                    {isEditing ? (
                      <div className="space-y-2 bg-white p-3 rounded-lg border border-[#E7EEDC] mb-2">
                        <div>
                          <label className="block text-[10px] font-bold text-[#2E3A28] mb-1">
                            Từ/Cụm từ tiếng Anh:
                          </label>
                          <input
                            type="text"
                            value={editFormData.word}
                            onChange={(e) =>
                              setEditFormData((prev) => ({ ...prev, word: e.target.value }))
                            }
                            className="w-full px-3 py-1.5 text-xs rounded-lg border border-[#E7EEDC] focus:outline-none focus:border-[#A8D672]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-[#2E3A28] mb-1">
                            Nghĩa tiếng Việt:
                          </label>
                          <input
                            type="text"
                            value={editFormData.meaning}
                            onChange={(e) =>
                              setEditFormData((prev) => ({ ...prev, meaning: e.target.value }))
                            }
                            className="w-full px-3 py-1.5 text-xs rounded-lg border border-[#E7EEDC] focus:outline-none focus:border-[#A8D672]"
                          />
                        </div>
                        <div className="flex gap-2 justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => setEditingCardId(null)}
                            className="px-3 py-1 text-xs rounded-lg border border-[#E7EEDC] bg-white text-[#6B7665] cursor-pointer"
                          >
                            Hủy
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveManualEdit(item.flashcardId)}
                            className="px-3 py-1 text-xs rounded-lg bg-[#A8D672] text-[#2E3A28] font-semibold cursor-pointer"
                          >
                            Lưu chỉnh sửa
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Action Buttons */
                      isPending && (
                        <div className="flex flex-wrap gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => handleApplySuggestion(item)}
                            className="px-3 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold shadow-2xs transition cursor-pointer"
                          >
                            Dùng gợi ý
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCardId(item.flashcardId);
                              setEditFormData({ word: item.word, meaning: item.currentMeaning });
                            }}
                            className="px-3 py-1.5 rounded-lg bg-white border border-[#E7EEDC] hover:bg-[#F8FCF4] text-[#2E3A28] text-xs font-medium cursor-pointer"
                          >
                            Tự chỉnh sửa
                          </button>
                          {!isError && (
                            <button
                              type="button"
                              onClick={() => handleIgnoreWarning(item.flashcardId)}
                              className="px-3 py-1.5 rounded-lg bg-white border border-[#FDE68A] hover:bg-[#FEF3C7] text-[#D97706] text-xs font-medium cursor-pointer"
                            >
                              Vẫn tiếp tục
                            </button>
                          )}
                          {isError && (
                            <button
                              type="button"
                              onClick={() => handleExcludeCard(item.flashcardId)}
                              className="px-3 py-1.5 rounded-lg bg-white border border-[#FCA5A5] hover:bg-[#FEE2E2] text-[#DC2626] text-xs font-medium cursor-pointer"
                            >
                              Loại bỏ thẻ này
                            </button>
                          )}
                        </div>
                      )
                    )}
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-[#E7EEDC] flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-[#6B7665]">
                Flashcard hợp lệ sẵn sàng: {' '}
                <strong
                  className={`font-semibold ${
                    validCardsPool.length < 10 ? 'text-[#DC2626]' : 'text-[#166534]'
                  }`}
                >
                  {validCardsPool.length} / 10 thẻ tối thiểu
                </strong>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowQualityModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#E7EEDC] bg-white text-xs font-medium text-[#6B7665] hover:bg-[#F8FCF4] cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleFinishReviewAndGenerate}
                  disabled={!canProceedWithQuiz}
                  className="px-5 py-2 rounded-xl bg-[#A8D672] hover:bg-[#97C95E] text-[#2E3A28] text-xs font-semibold shadow-2xs transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  Tiếp tục tạo bài kiểm tra
                </button>
              </div>
            </div>

            {!canProceedWithQuiz && (
              <p className="mt-2 text-center text-[11px] font-semibold text-[#DC2626]">
                {unhandledErrorIds.size > 0
                  ? 'Vui lòng xử lý tất cả các thẻ có lỗi nghiêm trọng (dùng gợi ý, chỉnh sửa hoặc loại bỏ) trước khi tạo bài.'
                  : 'Bộ Flashcard chưa có đủ 10 từ/cụm từ hợp lệ để tạo bài kiểm tra.'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
