'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/src/lib/supabaseClient';
import { useAuth } from '@/src/context/AuthContext';
import { generateQuizWithGemini } from '@/src/lib/geminiQuizService';
import { speakDialogue, stopSpeech } from '@/src/lib/speechService';
import { normalizeDialogue } from '@/src/lib/speakerUtils';
import { Button, Modal, Tag, Empty } from '@/src/components/common';

/**
 * Format seconds into MM:SS string
 */
function formatTimeMMSS(seconds) {
  if (seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return `${mm}:${ss}`;
}

export default function Quiz() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const [quizData, setQuizData] = useState(null);
  const [quizTitle, setQuizTitle] = useState('Bài kiểm tra tổng hợp');
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Audio Playing State
  const [activeAudioIndex, setActiveAudioIndex] = useState(null);
  const [speechNotice, setSpeechNotice] = useState(null);

  // Timer States & Refs
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const [totalQuizSeconds, setTotalQuizSeconds] = useState(0);
  const endTimeRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const hasAutoSubmittedRef = useRef(false);
  const selectedAnswersRef = useRef(selectedAnswers);
  selectedAnswersRef.current = selectedAnswers;

  useEffect(() => {
    async function loadQuizData() {
      if (!id) return;
      setLoading(true);

      try {
        // 1. Fetch saved quiz by ID from Supabase
        const { data: fetchedQuiz } = await supabase
          .from('quizzes')
          .select('*')
          .eq('id', id)
          .single();

        let loadedQuestions = [];
        let loadedTitle = 'Bài kiểm tra tổng hợp';

        if (fetchedQuiz) {
          setQuizData(fetchedQuiz);
          loadedTitle = fetchedQuiz.title || 'Bài kiểm tra tổng hợp';
          loadedQuestions = fetchedQuiz.questions || [];
        } else {
          // If not found in quizzes, check if id is set_id and fetch cards to generate on the fly
          const { data: cardsData } = await supabase
            .from('flashcards')
            .select('*')
            .eq('set_id', id);

          if (cardsData && cardsData.length > 0) {
            loadedQuestions = await generateQuizWithGemini(cardsData, 15);
          }
        }

        setQuizTitle(loadedTitle);
        setQuestions(loadedQuestions);

        // 2. Initialize Timer if questions exist
        if (loadedQuestions.length > 0) {
          const totalSecs = loadedQuestions.length * 60; // 60 seconds per question
          setTotalQuizSeconds(totalSecs);

          const storageKey = `leaflearn_quiz_timer_${id}`;
          const cachedTimerStr = sessionStorage.getItem(storageKey);

          let targetEndTime;

          if (cachedTimerStr) {
            try {
              const parsed = JSON.parse(cachedTimerStr);
              if (parsed && parsed.endTime && typeof parsed.endTime === 'number') {
                targetEndTime = parsed.endTime;
              }
            } catch (e) {
              console.warn('[QuizTimer] Parse cached timer error:', e);
            }
          }

          if (!targetEndTime) {
            targetEndTime = Date.now() + totalSecs * 1000;
            sessionStorage.setItem(
              storageKey,
              JSON.stringify({ quizId: id, endTime: targetEndTime, totalSeconds: totalSecs })
            );
          }

          endTimeRef.current = targetEndTime;
          const initialRemaining = Math.max(0, Math.floor((targetEndTime - Date.now()) / 1000));
          setRemainingSeconds(initialRemaining);
        }
      } catch (err) {
        console.error('Quiz loading error:', err);
      } finally {
        setLoading(false);
      }
    }

    loadQuizData();
  }, [id]);

  // Main Timer Countdown Interval & Auto-Submit Check
  useEffect(() => {
    if (!endTimeRef.current || loading || questions.length === 0) return;

    function checkTimerTick() {
      if (!endTimeRef.current) return;
      const rem = Math.max(0, Math.floor((endTimeRef.current - Date.now()) / 1000));
      setRemainingSeconds(rem);

      if (rem <= 0 && !hasAutoSubmittedRef.current) {
        hasAutoSubmittedRef.current = true;
        console.log('[QuizTimer] Time limit reached! Triggering auto-submit...');
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        handleFinishAndSave({ isAutoSubmit: true });
      }
    }

    checkTimerTick();
    timerIntervalRef.current = setInterval(checkTimerTick, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [loading, questions]);

  const totalQuestions = questions.length;
  const answeredCount = Object.keys(selectedAnswers).length;
  const unansweredCount = totalQuestions - answeredCount;

  const handleSelectOption = (questionIndex, optionIndex) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionIndex]: optionIndex,
    }));
  };

  // Dialogue Audio Player Handler
  const handleToggleAudio = (qIdx, dialogueContent) => {
    if (activeAudioIndex === qIdx) {
      stopSpeech();
      setActiveAudioIndex(null);
      return;
    }

    stopSpeech();
    setActiveAudioIndex(qIdx);

    speakDialogue(dialogueContent, {
      qIndex: qIdx,
      onStart: () => setActiveAudioIndex(qIdx),
      onEnd: () => setActiveAudioIndex((current) => (current === qIdx ? null : current)),
      onError: (err) => {
        setActiveAudioIndex(null);
        if (err === 'NO_ENGLISH_VOICE') {
          setSpeechNotice('Thiết bị chưa cài đặt giọng đọc tiếng Anh.');
          setTimeout(() => setSpeechNotice(null), 3000);
        }
      },
    });
  };

  // Stop speech when component unmounts
  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, []);

  const handleFinishAndSave = async (options = {}) => {
    stopSpeech();
    if (submitting) return;
    setSubmitting(true);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    // Calculate actual elapsed duration
    const currentRem = remainingSeconds !== null ? remainingSeconds : 0;
    const durationSecs = options.isAutoSubmit
      ? totalQuizSeconds
      : Math.min(totalQuizSeconds, Math.max(1, totalQuizSeconds - currentRem));

    const formattedDuration = formatTimeMMSS(durationSecs);

    // Clean up timer from sessionStorage
    try {
      sessionStorage.removeItem(`leaflearn_quiz_timer_${id}`);
    } catch (e) {
      console.warn('[QuizTimer] Cleanup storage error:', e);
    }

    const answersToEvaluate = selectedAnswersRef.current;
    let correctCount = 0;
    questions.forEach((q, idx) => {
      if (answersToEvaluate[idx] === q.correctAnswerIndex) {
        correctCount += 1;
      }
    });

    try {
      if (user && quizData) {
        // Save result to Supabase
        const { data: newResult, error: resultErr } = await supabase
          .from('quiz_results')
          .insert({
            quiz_id: quizData.id,
            user_id: user.id,
            score: correctCount,
            total_questions: totalQuestions,
            user_answers: answersToEvaluate,
            time_spent: formattedDuration,
          })
          .select()
          .single();

        if (resultErr) {
          console.error('Error saving quiz result to Supabase:', resultErr);
        }

        const targetResultId = newResult ? newResult.id : id;
        router.push(`/result/${targetResultId}`);
      } else {
        // Cache result in sessionStorage as fallback
        const resultPayload = {
          id,
          title: quizTitle,
          questions,
          selectedAnswers: answersToEvaluate,
          score: correctCount,
          totalQuestions,
          timeSpent: formattedDuration,
        };
        sessionStorage.setItem(`quiz_result_${id}`, JSON.stringify(resultPayload));
        router.push(`/result/${id}`);
      }
    } catch (err) {
      console.error('Error finishing quiz:', err);
      router.push(`/result/${id}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center max-w-md mx-auto px-4">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-solid border-emerald-600 border-r-transparent"></div>
        <p className="mt-4 text-sm font-medium text-slate-500">
          Đang chuẩn bị đề thi bài kiểm tra từ AI...
        </p>
      </div>
    );
  }

  if (!questions || questions.length === 0) {
    return (
      <div className="py-16 max-w-md mx-auto px-4">
        <Empty
          title="Chưa có câu hỏi bài kiểm tra"
          description="Vui lòng kiểm tra lại bộ thẻ từ vựng của bạn để tạo bài kiểm tra mới."
          actionText="Quay lại Trang chủ"
          onAction={() => router.push('/')}
        />
      </div>
    );
  }

  const answeredPercent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6 w-full">
      {/* Quiz Progress & Timer Header */}
      <div className="rounded-2xl bg-white p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {quizTitle}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs sm:text-sm text-slate-500">
              <span>
                Đã trả lời: <strong className="text-slate-900">{answeredCount}</strong> / {totalQuestions} câu hỏi
              </span>
              {remainingSeconds !== null && (
                <div className="flex items-center gap-1.5">
                  <span>Thời gian còn:</span>
                  <Tag
                    color={
                      remainingSeconds <= 30
                        ? 'red'
                        : remainingSeconds <= 120
                        ? 'gold'
                        : 'green'
                    }
                  >
                    <span className="font-mono font-bold">{formatTimeMMSS(remainingSeconds)}</span>
                  </Tag>
                </div>
              )}
            </div>
          </div>

          <Button
            type="primary"
            size="large"
            onClick={() => setShowConfirmModal(true)}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            }
          >
            Nộp bài kiểm tra
          </Button>
        </div>

        {/* Linear Progress Bar */}
        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
          <div
            className="bg-emerald-600 h-full transition-all duration-300 rounded-full"
            style={{ width: `${answeredPercent}%` }}
          />
        </div>
      </div>

      {/* Questions List */}
      <div className="space-y-5">
        {questions.map((q, qIdx) => {
          const isAnswered = selectedAnswers[qIdx] !== undefined;

          return (
            <div
              key={q.id || qIdx}
              className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs transition-colors hover:border-slate-300"
            >
              {/* Question Header */}
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs sm:text-[13px] font-semibold text-slate-500">
                  Câu hỏi {qIdx + 1} / {totalQuestions}
                </span>

                {isAnswered ? (
                  <Tag color="green">Đã chọn đáp án</Tag>
                ) : (
                  <Tag color="default">Chưa trả lời</Tag>
                )}
              </div>

              {/* Dialogue / Sentence Content */}
              {q.dialogue && (Array.isArray(q.dialogue) || typeof q.dialogue === 'string') ? (() => {
                const normalizedDiag = normalizeDialogue(q.dialogue, qIdx);
                return (
                  <div className="mb-4 rounded-xl bg-slate-50/80 p-4 border border-slate-200/60 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Đoạn hội thoại
                      </span>
                      <Button
                        size="small"
                        type={activeAudioIndex === qIdx ? 'primary' : 'default'}
                        onClick={() => handleToggleAudio(qIdx, normalizedDiag)}
                        icon={
                          activeAudioIndex === qIdx ? (
                            <svg className="w-3.5 h-3.5 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                              <rect x="6" y="4" width="4" height="16" rx="1" />
                              <rect x="14" y="4" width="4" height="16" rx="1" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                            </svg>
                          )
                        }
                      >
                        {activeAudioIndex === qIdx ? 'Dừng phát' : 'Nghe hội thoại'}
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {normalizedDiag.map((line, lIdx) => (
                        <div key={lIdx} className="text-sm sm:text-base text-slate-800 leading-relaxed">
                          {line.speaker && <strong className="text-slate-900">{line.speaker}: </strong>}
                          {line.text}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })() : (
                <div className="mb-4 rounded-xl bg-slate-50/80 p-4 border border-slate-200/60 space-y-2.5">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Câu hỏi
                    </span>
                    <Button
                      size="small"
                      type={activeAudioIndex === qIdx ? 'primary' : 'default'}
                      onClick={() => handleToggleAudio(qIdx, q.sentence)}
                      icon={
                        activeAudioIndex === qIdx ? (
                          <svg className="w-3.5 h-3.5 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                            <rect x="6" y="4" width="4" height="16" rx="1" />
                            <rect x="14" y="4" width="4" height="16" rx="1" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                          </svg>
                        )
                      }
                    >
                      {activeAudioIndex === qIdx ? 'Dừng phát' : 'Nghe câu hỏi'}
                    </Button>
                  </div>
                  <p className="text-base font-medium text-slate-900 leading-relaxed pt-0.5">
                    {q.sentence}
                  </p>
                </div>
              )}

              {/* Options list (Desktop: 2 columns A/B & C/D, Mobile: 1 column) */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {q.options &&
                  q.options.map((optText, optIdx) => {
                    const isSelected = selectedAnswers[qIdx] === optIdx;
                    const optionLabel = String.fromCharCode(65 + optIdx); // A, B, C, D

                    return (
                      <button
                        key={optIdx}
                        type="button"
                        onClick={() => handleSelectOption(qIdx, optIdx)}
                        className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50/80 text-emerald-950 shadow-xs ring-1 ring-emerald-500/30'
                            : 'border-slate-200/80 bg-white text-slate-800 hover:border-emerald-400 hover:bg-slate-50'
                        }`}
                      >
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                            isSelected
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-600 border border-slate-200/80'
                          }`}
                        >
                          {optionLabel}
                        </span>
                        <span
                          className={`text-sm truncate ${
                            isSelected ? 'font-semibold text-emerald-950' : 'font-normal text-slate-800'
                          }`}
                        >
                          {optText}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Submit Action Bar */}
      <div className="pt-2 flex justify-end">
        <Button
          type="primary"
          size="large"
          onClick={() => setShowConfirmModal(true)}
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          }
        >
          Nộp bài kiểm tra
        </Button>
      </div>

      {/* Confirmation Modal */}
      <Modal
        open={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Xác nhận nộp bài kiểm tra"
        width="max-w-md"
        footer={
          <div className="flex justify-end gap-2.5">
            <Button
              type="default"
              onClick={() => setShowConfirmModal(false)}
              disabled={submitting}
            >
              Tiếp tục làm bài
            </Button>
            <Button
              type="primary"
              onClick={() => handleFinishAndSave()}
              loading={submitting}
            >
              Đồng ý Nộp bài
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">
          Bạn đã hoàn thành <strong className="text-slate-900">{answeredCount}</strong> / {totalQuestions} câu hỏi.
        </p>
        {unansweredCount > 0 && (
          <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-600">
            Còn <strong>{unansweredCount} câu hỏi</strong> chưa chọn đáp án. Bạn có chắc chắn muốn nộp bài?
          </div>
        )}
      </Modal>

      {/* Speech Notice Toast */}
      {speechNotice && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/95 text-white text-xs font-medium px-4 py-2.5 rounded-xl shadow-lg z-50 transition-all pointer-events-none border border-slate-700/50 backdrop-blur-xs flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>{speechNotice}</span>
        </div>
      )}
    </div>
  );
}
