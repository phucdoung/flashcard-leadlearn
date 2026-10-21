'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/src/lib/supabaseClient';
import { useAuth } from '@/src/context/AuthContext';
import {
  generateQuizWithGemini,
  QuizGenerationError,
} from '@/src/lib/geminiQuizService';
import { Button, Input, Modal, Tag } from '@/src/components/common';

export default function CreateQuiz() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const [setDetail, setSetDetail] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [isValidatingCards, setIsValidatingCards] = useState(false);

  const [quizTitle, setQuizTitle] = useState('Bài kiểm tra tổng hợp từ vựng');

  // Flashcard Scope Selection state: 'all' | 'unlearned' | 'custom'
  const [scope, setScope] = useState('all');
  const [selectedCardIds, setSelectedCardIds] = useState(new Set());

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
          setSelectedCardIds(new Set(rawCards.map((c) => c.id)));
        }
      } catch (err) {
        console.error('Error fetching set for quiz creation:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchSetInfo();
  }, [id]);

  // Card scope handlers
  const handleToggleCard = (cardId) => {
    setSelectedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedCardIds(new Set(cards.map((c) => c.id)));
  };

  const handleDeselectAll = () => {
    setSelectedCardIds(new Set());
  };

  const unlearnedCardsCount = cards.filter(
    (c) => c.learning_status !== 'learned' && c.learning_status !== 'mastered'
  ).length;

  const getScopedCards = () => {
    if (scope === 'unlearned') {
      return cards.filter(
        (c) => c.learning_status !== 'learned' && c.learning_status !== 'mastered'
      );
    }
    if (scope === 'custom') {
      return cards.filter((c) => selectedCardIds.has(c.id));
    }
    return cards;
  };

  const scopedCards = getScopedCards();
  const validScopedCards = scopedCards.filter(
    (f) =>
      (f.word || f.term || '').trim().length > 0 &&
      (f.meaning || f.definition || '').trim().length > 0
  );

  const availableCardsCount = cards.length;
  const scopedValidCount = validScopedCards.length;
  const hasMinimumCards = scopedValidCount >= 10;

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
        router.push(`/quiz/${newQuiz.id}`);
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
    await executeQuizGeneration(validScopedCards);
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
    <div className="max-w-4xl mx-auto space-y-6 w-full">
      {/* Header Section */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <Link
              href={`/flashcard/${id}`}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-emerald-700 transition-colors mb-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Quay lại bộ Flashcard
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Tạo bài kiểm tra
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Tag color={availableCardsCount < 10 ? 'red' : 'green'}>
              {loading ? 'Đang tải...' : `${availableCardsCount} Flashcard`}
            </Tag>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-slate-100 text-xs text-slate-500">
          <span>
            Bộ thẻ: <strong className="text-slate-900 font-semibold">{setDetail?.title || 'Đang tải...'}</strong>
          </span>
          <span>
            Trạng thái:{' '}
            <strong className={availableCardsCount < 10 ? 'text-rose-600' : 'text-emerald-700'}>
              {availableCardsCount < 10 ? 'Cần tối thiểu 10 từ' : 'Đủ điều kiện tạo bài'}
            </strong>
          </span>
        </div>
      </div>

      {/* Quiz Settings Form */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-xs">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Quiz Title Input */}
          <Input
            label="Tên bài kiểm tra"
            required
            value={quizTitle}
            onChange={(e) => setQuizTitle(e.target.value)}
            placeholder="Nhập tên bài kiểm tra..."
          />

          {/* Flashcard Scope Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-800">
                Phạm vi câu hỏi
              </label>
              <span className="text-xs text-slate-500">
                Từ hợp lệ:{' '}
                <strong className={scopedValidCount >= 10 ? 'text-emerald-700' : 'text-rose-600'}>
                  {scopedValidCount} từ
                </strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Option A: Tất cả flashcard */}
              <button
                type="button"
                onClick={() => setScope('all')}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                  scope === 'all'
                    ? 'border-emerald-600 bg-emerald-50/80 ring-1 ring-emerald-500/30'
                    : 'border-slate-200/80 bg-white hover:border-emerald-400'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-bold text-slate-900">Tất cả</span>
                  <span
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      scope === 'all' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'
                    }`}
                  >
                    {scope === 'all' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500">
                  Toàn bộ {availableCardsCount} từ trong bộ thẻ
                </span>
              </button>

              {/* Option B: Từ chưa thuộc */}
              <button
                type="button"
                onClick={() => setScope('unlearned')}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                  scope === 'unlearned'
                    ? 'border-emerald-600 bg-emerald-50/80 ring-1 ring-emerald-500/30'
                    : 'border-slate-200/80 bg-white hover:border-emerald-400'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-bold text-slate-900">Từ chưa thuộc</span>
                  <span
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      scope === 'unlearned' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'
                    }`}
                  >
                    {scope === 'unlearned' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500">
                  {unlearnedCardsCount} từ được đánh dấu chưa thuộc
                </span>
              </button>

              {/* Option C: Tự chọn flashcard */}
              <button
                type="button"
                onClick={() => setScope('custom')}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                  scope === 'custom'
                    ? 'border-emerald-600 bg-emerald-50/80 ring-1 ring-emerald-500/30'
                    : 'border-slate-200/80 bg-white hover:border-emerald-400'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-bold text-slate-900">Chọn chi tiết</span>
                  <span
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      scope === 'custom' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'
                    }`}
                  >
                    {scope === 'custom' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500">
                  Đã chọn {selectedCardIds.size} / {availableCardsCount} từ
                </span>
              </button>
            </div>

            {/* Custom Flashcard Checklist */}
            {scope === 'custom' && (
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 space-y-3">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200/60">
                  <span className="font-semibold text-slate-900">
                    Danh sách từ trong bộ ({selectedCardIds.size}/{availableCardsCount} đã chọn)
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-xs font-medium text-emerald-700 hover:underline cursor-pointer"
                    >
                      Chọn tất cả
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={handleDeselectAll}
                      className="text-xs font-medium text-slate-500 hover:underline cursor-pointer"
                    >
                      Bỏ chọn tất cả
                    </button>
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                  {cards.map((card) => {
                    const isChecked = selectedCardIds.has(card.id);
                    const isMastered =
                      card.learning_status === 'learned' || card.learning_status === 'mastered';
                    const word = card.word || card.term || '';
                    const meaning = card.meaning || card.definition || '';

                    return (
                      <label
                        key={card.id}
                        className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-white border-emerald-500/50 shadow-2xs'
                            : 'bg-white/60 border-slate-200 text-slate-500'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate flex-1 pr-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleCard(card.id)}
                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <span className="font-semibold text-slate-900 truncate">{word}</span>
                          <span className="text-slate-500 truncate">- {meaning}</span>
                        </div>

                        <Tag color={isMastered ? 'green' : 'default'} size="small">
                          {isMastered ? 'Đã thuộc' : 'Chưa thuộc'}
                        </Tag>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Dynamic AI Question Count Guidance Box */}
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 sm:p-5 space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-600 text-[10px] font-bold text-white shadow-2xs">
                AI
              </span>
              <h4 className="text-xs font-bold text-slate-900">
                Quy trình sinh đề thông minh
              </h4>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Bài kiểm tra sẽ được AI tạo tự động từ các từ vựng thuộc phạm vi đã chọn (yêu cầu tối thiểu 10 từ/cụm từ hợp lệ).
            </p>

            <p className="text-[11px] text-slate-400 italic">
              * Số lượng câu hỏi thực tế phụ thuộc vào số từ vựng hợp lệ trong phạm vi.
            </p>

            {/* Condition Warning If < 10 Cards */}
            {!loading && !hasMinimumCards && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-600 font-medium space-y-1 mt-2">
                {scope === 'unlearned' && (
                  <p>
                    Phạm vi <strong>"Từ chưa thuộc"</strong> chỉ có {scopedValidCount} từ hợp lệ (yêu cầu tối thiểu 10 từ để tạo đề thi). Vui lòng chọn phạm vi <strong>"Tất cả"</strong> hoặc thêm từ chưa thuộc.
                  </p>
                )}
                {scope === 'custom' && (
                  <p>
                    Bạn đã chọn {scopedValidCount} từ hợp lệ (cần tối thiểu 10 từ để AI sinh câu hỏi chất lượng cao). Vui lòng chọn thêm ít nhất {10 - scopedValidCount} từ nữa.
                  </p>
                )}
                {scope === 'all' && (
                  <p>
                    Bộ thẻ cần có tối thiểu 10 Flashcard hợp lệ mới có thể tạo bài kiểm tra (Hiện có {scopedValidCount} thẻ).
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Main Action Button */}
          <Button
            htmlType="submit"
            type="primary"
            size="large"
            block
            loading={generating}
            disabled={loading || !hasMinimumCards || generating}
            className="rounded-xl shadow-xs"
            icon={
              !generating ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              ) : null
            }
          >
            {generating ? 'Đang sinh câu hỏi bằng AI Gemini...' : 'Tạo bài kiểm tra'}
          </Button>
        </form>
      </div>

      {/* Quality Review Modal using Ant Design Modal component */}
      <Modal
        open={showQualityModal}
        onClose={() => setShowQualityModal(false)}
        title="Kiểm tra từ vựng trước khi tạo bài"
        width="max-w-2xl"
        footer={
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
            <div className="text-xs text-slate-500">
              Flashcard hợp lệ sẵn sàng:{' '}
              <strong className={validCardsPool.length < 10 ? 'text-rose-600' : 'text-emerald-700'}>
                {validCardsPool.length} / 10 thẻ tối thiểu
              </strong>
            </div>

            <div className="flex items-center gap-2">
              <Button type="default" onClick={() => setShowQualityModal(false)}>
                Hủy bỏ
              </Button>
              <Button
                type="primary"
                onClick={handleFinishReviewAndGenerate}
                disabled={!canProceedWithQuiz}
              >
                Tiếp tục tạo bài kiểm tra
              </Button>
            </div>
          </div>
        }
      >
        <p className="text-xs text-slate-500 mb-4">
          Phát hiện <strong className="text-slate-900">{auditIssues.length} thẻ</strong> có thể gặp vấn đề về mặt từ vựng hoặc ý nghĩa. Vui lòng xem xét trước khi tiến hành sinh bài kiểm tra.
        </p>

        {/* Audit Issues List */}
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
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
                  isError ? 'border-rose-200 bg-rose-50/70' : 'border-amber-200 bg-amber-50/70'
                }`}
              >
                {/* Header Badge */}
                <div className="flex items-center justify-between mb-2">
                  <Tag color={isError ? 'red' : 'gold'}>
                    {isError ? 'Lỗi nghiêm trọng' : 'Cảnh báo'}
                  </Tag>

                  {isApplied && <span className="text-xs font-semibold text-emerald-700">✓ Đã áp dụng gợi ý</span>}
                  {isIgnored && <span className="text-xs font-semibold text-amber-700">✓ Giữ nguyên (Cảnh báo)</span>}
                  {isExcluded && <span className="text-xs font-semibold text-rose-600">✕ Đã loại bỏ khỏi bài</span>}
                </div>

                {/* Issue Description */}
                <p className="text-xs font-semibold text-slate-900 mb-2">
                  Nguyên nhân: <span className="font-normal text-slate-600">{item.issue}</span>
                </p>

                {/* Current vs Suggested Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white/90 p-3 rounded-xl border border-slate-200/80 mb-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-0.5">
                      Từ vựng hiện tại:
                    </span>
                    <p className="font-semibold text-slate-900">{item.word}</p>
                    <p className="text-slate-600">{item.currentMeaning}</p>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-sky-600 block mb-0.5">
                      Gợi ý từ AI:
                    </span>
                    <p className="font-semibold text-sky-700">
                      {item.suggestedWord}{' '}
                      {item.suggestedPronunciation && (
                        <span className="font-normal text-[11px] text-slate-500">
                          ({item.suggestedPronunciation})
                        </span>
                      )}
                    </p>
                    <p className="text-sky-800">{item.suggestedMeaning}</p>
                  </div>
                </div>

                {/* Editing Form */}
                {isEditing ? (
                  <div className="space-y-3 bg-white p-3.5 rounded-xl border border-slate-200/80 mb-2">
                    <Input
                      label="Từ/Cụm từ tiếng Anh"
                      value={editFormData.word}
                      onChange={(e) => setEditFormData((prev) => ({ ...prev, word: e.target.value }))}
                    />
                    <Input
                      label="Nghĩa tiếng Việt"
                      value={editFormData.meaning}
                      onChange={(e) => setEditFormData((prev) => ({ ...prev, meaning: e.target.value }))}
                    />
                    <div className="flex gap-2 justify-end pt-1">
                      <Button size="small" type="default" onClick={() => setEditingCardId(null)}>
                        Hủy
                      </Button>
                      <Button size="small" type="primary" onClick={() => handleSaveManualEdit(item.flashcardId)}>
                        Lưu chỉnh sửa
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Action Buttons */
                  isPending && (
                    <div className="flex flex-wrap gap-2 justify-end">
                      <Button size="small" type="primary" onClick={() => handleApplySuggestion(item)}>
                        Dùng gợi ý
                      </Button>
                      <Button
                        size="small"
                        type="default"
                        onClick={() => {
                          setEditingCardId(item.flashcardId);
                          setEditFormData({ word: item.word, meaning: item.currentMeaning });
                        }}
                      >
                        Tự chỉnh sửa
                      </Button>
                      {!isError && (
                        <Button size="small" type="default" onClick={() => handleIgnoreWarning(item.flashcardId)}>
                          Vẫn tiếp tục
                        </Button>
                      )}
                      {isError && (
                        <Button size="small" type="danger" onClick={() => handleExcludeCard(item.flashcardId)}>
                          Loại bỏ thẻ này
                        </Button>
                      )}
                    </div>
                  )
                )}
              </div>
            );
          })}
        </div>

        {!canProceedWithQuiz && (
          <p className="mt-3 text-center text-[11px] font-semibold text-rose-600">
            {unhandledErrorIds.size > 0
              ? 'Vui lòng xử lý tất cả các thẻ có lỗi nghiêm trọng (dùng gợi ý, chỉnh sửa hoặc loại bỏ) trước khi tạo bài.'
              : 'Bộ Flashcard chưa có đủ 10 từ/cụm từ hợp lệ để tạo bài kiểm tra.'}
          </p>
        )}
      </Modal>
    </div>
  );
}
