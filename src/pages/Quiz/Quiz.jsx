import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { generateQuizWithGemini } from '../../lib/geminiQuizService';

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
  const navigate = useNavigate();
  const { user } = useAuth();

  const [quizData, setQuizData] = useState(null);
  const [quizTitle, setQuizTitle] = useState('Bài kiểm tra tổng hợp');
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

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

  const handleFinishAndSave = async (options = {}) => {
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
        navigate(`/result/${targetResultId}`);
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
        navigate(`/result/${id}`);
      }
    } catch (err) {
      console.error('Error finishing quiz:', err);
      navigate(`/result/${id}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#7BC47F] border-r-transparent"></div>
        <p className="mt-4 text-sm font-medium text-[#6B7665]">Đang chuẩn bị đề thi bài kiểm tra từ Gemini AI...</p>
      </div>
    );
  }

  if (!questions || questions.length === 0) {
    return (
      <div className="py-16 text-center">
        <h2 className="text-xl font-bold text-[#2E3A28]">Chưa có câu hỏi bài kiểm tra nào.</h2>
        <p className="mt-2 text-sm text-[#6B7665]">Vui lòng kiểm tra lại bộ thẻ từ vựng của bạn.</p>
        <Link
          to="/"
          className="mt-6 inline-block rounded-xl bg-[#97C95E] px-6 py-2.5 text-sm font-semibold text-[#2E3A28] shadow-xs transition hover:bg-[#86B84E]"
        >
          Quay lại Trang chủ
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-2 sm:py-3 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl bg-white p-4 sm:p-5 border border-[#E7EEDC] shadow-2xs">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold text-[#2E3A28]">{quizTitle}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm font-medium text-[#6B7665]">
            <p>
              Đã trả lời: <span className="font-bold text-[#2E3A28]">{answeredCount}</span> / {totalQuestions} câu hỏi
            </p>
            {remainingSeconds !== null && (
              <p
                className={`font-semibold ${
                  remainingSeconds <= 30
                    ? 'text-[#E57373] font-bold'
                    : remainingSeconds <= 120
                    ? 'text-amber-700 font-semibold'
                    : 'text-[#2E3A28] font-semibold'
                }`}
              >
                Thời gian còn lại: <span className="font-mono font-bold">{formatTimeMMSS(remainingSeconds)}</span>
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowConfirmModal(true)}
          className="h-[40px] px-5 rounded-xl text-xs sm:text-sm font-bold bg-[#A8D672] hover:bg-[#97C95E] text-[#2E3A28] transition-all shadow-2xs cursor-pointer shrink-0"
        >
          Nộp bài kiểm tra
        </button>
      </div>

      {/* Questions list */}
      <div className="space-y-4 sm:space-y-5">
        {questions.map((q, qIdx) => {
          const isAnswered = selectedAnswers[qIdx] !== undefined;

          return (
            <div
              key={q.id || qIdx}
              className="rounded-2xl border border-[#E7EEDC] bg-white p-4 sm:p-5 shadow-2xs transition-all hover:border-[#A8D672]/60"
            >
              {/* Question Index Badge */}
              <div className="mb-3 flex items-center justify-between">
                <span className="rounded-lg bg-[#F8FCF4] px-2.5 py-1 text-xs font-semibold text-[#6B7665] border border-[#E7EEDC]">
                  Câu hỏi {qIdx + 1} / {totalQuestions}
                </span>

                {isAnswered && (
                  <span className="text-xs font-semibold text-[#5B9E60] bg-[#5B9E60]/10 px-2.5 py-0.5 rounded-md">
                    Đã chọn đáp án
                  </span>
                )}
              </div>

              {/* Dialogue / Sentence Content */}
              {q.dialogue && Array.isArray(q.dialogue) ? (
                <div className="mb-4 space-y-2 rounded-xl bg-[#F8FCF4] p-3.5 sm:p-4 border border-[#E7EEDC]">
                  {q.dialogue.map((line, lIdx) => (
                    <div key={lIdx} className="text-sm sm:text-base text-[#2E3A28] leading-relaxed">
                      <span className="font-bold text-[#2E3A28]">{line.speaker}:</span>{' '}
                      {line.text}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mb-4 text-base font-medium text-[#2E3A28] leading-relaxed">
                  {q.sentence}
                </p>
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
                        className={`w-full flex items-center gap-3 rounded-xl border p-2.5 sm:p-3 text-left font-medium transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#A8D672] bg-[#A8D672]/15 text-[#2E3A28] font-bold shadow-2xs ring-1 ring-[#A8D672]'
                            : 'border-[#E7EEDC] bg-white text-[#2E3A28] hover:border-[#A8D672]/60 hover:bg-[#F8FCF4]'
                        }`}
                      >
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                            isSelected
                              ? 'bg-[#A8D672] text-[#2E3A28]'
                              : 'bg-[#F8FCF4] text-[#6B7665] border border-[#E7EEDC]'
                          }`}
                        >
                          {optionLabel}
                        </span>
                        <span className="text-sm font-semibold text-[#2E3A28] truncate">
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

      {/* Submit Action Bar */}
      <div className="pt-2 flex justify-end">
        <button
          type="button"
          onClick={() => setShowConfirmModal(true)}
          className="h-[44px] px-7 rounded-xl bg-[#A8D672] hover:bg-[#97C95E] text-[#2E3A28] text-sm font-bold shadow-2xs transition-all cursor-pointer"
        >
          Nộp bài kiểm tra
        </button>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-[#E7EEDC]">
            <h3 className="text-xl font-bold text-[#2E3A28]">Xác nhận nộp bài</h3>
            <p className="mt-2 text-sm text-[#6B7665]">
              Bạn đã hoàn thành <span className="font-bold text-[#2E3A28]">{answeredCount}</span> / {totalQuestions} câu hỏi.
              {unansweredCount > 0 && (
                <span className="block mt-1 text-xs font-medium text-[#E57373]">
                  Còn {unansweredCount} câu hỏi chưa chọn đáp án!
                </span>
              )}
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={submitting}
                className="rounded-xl border border-[#E7EEDC] bg-white px-4 py-2 text-sm font-medium text-[#6B7665] hover:bg-[#FAFDF8] cursor-pointer"
              >
                Tiếp tục làm bài
              </button>
              <button
                type="button"
                onClick={() => handleFinishAndSave()}
                disabled={submitting}
                className="rounded-xl bg-[#97C95E] px-5 py-2 text-sm font-semibold text-[#2E3A28] shadow-xs transition hover:bg-[#86B84E] cursor-pointer"
              >
                {submitting ? 'Đang nộp...' : 'Đồng ý Nộp bài'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
