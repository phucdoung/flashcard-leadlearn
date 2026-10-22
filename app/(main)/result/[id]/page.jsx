'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { supabase } from '@/src/lib/supabaseClient';
import { speakDialogue, stopSpeech } from '@/src/lib/speechService';
import { translateDialogueWithGemini } from '@/src/lib/geminiQuizService';
import {
  normalizeDialogue,
  normalizeVietnameseTranslation,
} from '@/src/lib/speakerUtils';
import { Button, Tag, Empty } from '@/src/components/common';

function QuizResultContent() {
  const { id } = useParams();
  const searchParams = useSearchParams();

  // If query parameter ?details=true or ?review=true is present, start with details expanded
  const initialShowDetails =
    searchParams.get('details') === 'true' ||
    searchParams.get('review') === 'true';

  const [showDetails, setShowDetails] = useState(initialShowDetails);
  const [resultData, setResultData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Audio and Translation states
  const [activeAudioIndex, setActiveAudioIndex] = useState(null);
  const [speechNotice, setSpeechNotice] = useState(null);
  const [translations, setTranslations] = useState({});
  const [loadingTranslations, setLoadingTranslations] = useState({});

  useEffect(() => {
    async function fetchResult() {
      if (!id) {
        setLoading(false);
        return;
      }
      setLoading(true);

      try {
        let matchedResult = null;
        let matchedQuiz = null;

        // 1. First priority: Check if ID matches a quiz_results ID directly (single query, no fragile joins)
        try {
          const { data: resRow, error: resErr } = await supabase
            .from('quiz_results')
            .select('*')
            .eq('id', id)
            .maybeSingle();

          if (resRow) {
            matchedResult = resRow;
            // Now fetch the parent quiz using resRow.quiz_id
            if (resRow.quiz_id) {
              const { data: qRow } = await supabase
                .from('quizzes')
                .select('*')
                .eq('id', resRow.quiz_id)
                .maybeSingle();
              if (qRow) {
                matchedQuiz = qRow;
              }
            }
          }
        } catch (e) {
          console.warn('[QuizResult] Primary quiz_results query notice:', e);
        }

        // 2. Second priority: Check if ID matches a quizzes ID directly
        if (!matchedQuiz) {
          try {
            const { data: qRow } = await supabase
              .from('quizzes')
              .select('*')
              .eq('id', id)
              .maybeSingle();

            if (qRow) {
              matchedQuiz = qRow;
              // Fetch the latest quiz_result for this quiz
              const { data: resList } = await supabase
                .from('quiz_results')
                .select('*')
                .eq('quiz_id', qRow.id)
                .order('created_at', { ascending: false })
                .limit(1);

              if (resList && resList.length > 0) {
                matchedResult = resList[0];
              }
            }
          } catch (e) {
            console.warn('[QuizResult] Quizzes lookup notice:', e);
          }
        }

        // 3. Third priority: Try joined relation if direct single lookup did not succeed
        if (!matchedQuiz && !matchedResult) {
          try {
            const { data: legacyRes } = await supabase
              .from('quiz_results')
              .select('*, quizzes(*)')
              .eq('id', id)
              .maybeSingle();

            if (legacyRes) {
              matchedResult = legacyRes;
              matchedQuiz = legacyRes.quizzes || null;
            }
          } catch (e) {
            console.warn('[QuizResult] Legacy join query notice:', e);
          }
        }

        // 4. Construct complete result data if either quiz or result was retrieved
        if (matchedQuiz || matchedResult) {
          const rawQuestions = Array.isArray(matchedQuiz?.questions)
            ? matchedQuiz.questions
            : [];
          const userAnswers = matchedResult?.user_answers || {};

          // Calculate score defensively
          let finalScore = matchedResult?.score;
          if (finalScore === undefined || finalScore === null) {
            let correctCount = 0;
            rawQuestions.forEach((q, idx) => {
              const uChoice = userAnswers[idx];
              if (
                uChoice !== undefined &&
                uChoice !== null &&
                Number(uChoice) === Number(q.correctAnswerIndex)
              ) {
                correctCount += 1;
              }
            });
            finalScore = correctCount;
          }

          const totalQ =
            matchedResult?.total_questions ||
            (rawQuestions.length > 0 ? rawQuestions.length : 10);

          setResultData({
            id: matchedResult?.id || matchedQuiz?.id || id,
            quizId: matchedQuiz?.id || matchedResult?.quiz_id || id,
            setId: matchedQuiz?.set_id || null,
            title: matchedQuiz?.title || 'Bài kiểm tra từ vựng',
            questions: rawQuestions,
            selectedAnswers: userAnswers,
            score: finalScore,
            totalQuestions: totalQ,
            timeSpent: matchedResult?.time_spent || '03:45',
            createdAt: matchedResult?.created_at || matchedQuiz?.created_at,
          });
          setLoading(false);
          return;
        }

        // 5. Fallback to sessionStorage for guest/temporary attempts
        const cachedStr =
          sessionStorage.getItem(`quiz_result_${id}`) ||
          sessionStorage.getItem('leaflearn_latest_result');
        if (cachedStr) {
          try {
            const parsed = JSON.parse(cachedStr);
            setResultData(parsed);
            setLoading(false);
            return;
          } catch (e) {
            console.warn('[QuizResult] Storage parse notice:', e);
          }
        }
      } catch (err) {
        console.error('Fetch quiz result error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchResult();
  }, [id]);

  // Auto-scroll to details if came via ?details=true
  useEffect(() => {
    if (initialShowDetails && !loading && resultData) {
      const timer = setTimeout(() => {
        document.getElementById('details-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [initialShowDetails, loading, resultData]);

  // Stop speech when component unmounts
  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, []);

  if (loading) {
    return (
      <div className="py-24 text-center max-w-md mx-auto px-4">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-solid border-[#1b4332] border-r-transparent"></div>
        <p className="mt-4 text-sm font-medium text-slate-500">
          Đang tải kết quả bài kiểm tra...
        </p>
      </div>
    );
  }

  // If no result data found after all fallbacks
  if (!resultData) {
    return (
      <div className="py-16 px-4 max-w-md mx-auto text-center">
        <Empty
          title="Không tìm thấy thông tin bài kiểm tra"
          description="Dữ liệu bài kiểm tra hoặc kết quả này không tồn tại hoặc đã bị xóa."
          actionText="Về trang chủ"
          onAction={() => (window.location.href = '/')}
        />
      </div>
    );
  }

  // Questions and calculations
  const rawQuestions = Array.isArray(resultData.questions) ? resultData.questions : [];
  const userAnswers = resultData.selectedAnswers || {};
  const totalQuestions = resultData.totalQuestions || rawQuestions.length || 1;
  const score = resultData.score !== undefined && resultData.score !== null ? resultData.score : 0;

  // Process answers with defensive correctness comparison
  const processedQuestions = rawQuestions.map((q, idx) => {
    const rawChoice = userAnswers[idx];
    const userChoiceIdx =
      rawChoice !== undefined && rawChoice !== null && rawChoice !== ''
        ? Number(rawChoice)
        : null;
    const isCorrect =
      userChoiceIdx !== null &&
      Number(userChoiceIdx) === Number(q.correctAnswerIndex);

    return {
      ...q,
      userAnswerIndex: userChoiceIdx,
      isCorrect,
    };
  });

  const correctCount = score;
  const wrongCount = Math.max(0, totalQuestions - correctCount);
  const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const timeSpent = resultData.timeSpent || '03:45';

  const getEncouragingMessage = () => {
    if (percentage >= 85) {
      return 'Xuất sắc! Bạn đã làm rất tốt bài kiểm tra này.';
    } else if (percentage >= 60) {
      return 'Làm tốt lắm! Hãy tiếp tục ôn tập lại các từ chưa đúng nhé.';
    } else {
      return 'Cố gắng lên! Ôn tập thêm một chút và thử lại nhé.';
    }
  };

  const handleToggleDetails = () => {
    setShowDetails((prev) => {
      const next = !prev;
      if (next) {
        setTimeout(() => {
          document.getElementById('details-section')?.scrollIntoView({ behavior: 'smooth' });
        }, 120);
      }
      return next;
    });
  };

  // Dialogue Audio Playback Handler with normalized character names
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
      onEnd: () => setActiveAudioIndex((curr) => (curr === qIdx ? null : curr)),
      onError: (err) => {
        setActiveAudioIndex(null);
        if (err === 'NO_ENGLISH_VOICE') {
          setSpeechNotice('Thiết bị chưa cài đặt giọng đọc tiếng Anh.');
          setTimeout(() => setSpeechNotice(null), 3000);
        }
      },
    });
  };

  // Fetch Vietnamese translation for older quizzes that lack vietnameseTranslation
  const handleLoadTranslation = async (qIdx, question) => {
    if (loadingTranslations[qIdx] || translations[qIdx]) return;
    setLoadingTranslations((prev) => ({ ...prev, [qIdx]: true }));

    try {
      const correctWord =
        question.answer ||
        question.word ||
        (Array.isArray(question.options)
          ? question.options[question.correctAnswerIndex]
          : '') ||
        '';
      const content = question.dialogue || question.sentence;
      const res = await translateDialogueWithGemini(content, correctWord, qIdx);
      if (res) {
        setTranslations((prev) => ({ ...prev, [qIdx]: res }));
      }
    } catch (e) {
      console.warn('Load translation error:', e);
    } finally {
      setLoadingTranslations((prev) => ({ ...prev, [qIdx]: false }));
    }
  };

  // Helper to render the completed dialogue with the correct answer highlighted & normalized character names
  const renderCompletedDialogue = (dialogue, correctWord, qIdx = 0) => {
    const normalizedDiag = normalizeDialogue(dialogue, qIdx);

    if (Array.isArray(normalizedDiag) && normalizedDiag.length > 0) {
      return normalizedDiag.map((line, lIdx) => {
        const parts = (line.text || '').split(/_{2,}/g);
        return (
          <p key={lIdx} className="text-sm sm:text-[15px] text-slate-800 leading-[1.6]">
            {line.speaker && (
              <span className="font-semibold text-slate-900">{line.speaker}: </span>
            )}
            {parts.map((part, pIdx) => (
              <React.Fragment key={pIdx}>
                {part}
                {pIdx < parts.length - 1 && (
                  <strong className="font-bold text-[#1b4332] bg-[#1b4332]/10 px-2 py-0.5 rounded-md border border-[#1b4332]/20 mx-0.5 shadow-2xs">
                    {correctWord}
                  </strong>
                )}
              </React.Fragment>
            ))}
          </p>
        );
      });
    }

    const parts = String(dialogue || '').split(/_{2,}/g);
    return (
      <p className="text-sm sm:text-[15px] text-slate-800 leading-[1.6]">
        {parts.map((part, pIdx) => (
          <React.Fragment key={pIdx}>
            {part}
            {pIdx < parts.length - 1 && (
              <strong className="font-bold text-[#1b4332] bg-[#1b4332]/10 px-2 py-0.5 rounded-md border border-[#1b4332]/20 mx-0.5 shadow-2xs">
                {correctWord}
              </strong>
            )}
          </React.Fragment>
        ))}
      </p>
    );
  };

  const parentSetId = resultData?.setId;
  const quizIdToRetake = resultData?.quizId;

  // Gauge circumference for r=54: 2 * Math.PI * 54 = 339.292
  const circumference = 339.292;
  const strokeDashoffset = circumference * (1 - (totalQuestions > 0 ? correctCount / totalQuestions : 0));

  return (
    <div className="max-w-4xl mx-auto space-y-6 w-full">
      {/* Quiz Summary Main Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 text-center space-y-6 shadow-xs">
        {/* Top Header Tag */}
        <div className="inline-flex items-center justify-center">
          <Tag color="green">KẾT QUẢ BÀI KIỂM TRA</Tag>
        </div>

        {/* Hero Section: Modern Circular Progress Gauge & Score */}
        <div className="space-y-4">
          <div className="relative flex items-center justify-center w-40 h-40 sm:w-44 sm:h-44 mx-auto my-1">
            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 128 128">
              {/* Background Track */}
              <circle
                cx="64"
                cy="64"
                r="54"
                fill="transparent"
                stroke="#f1f5f9"
                strokeWidth="10"
              />
              {/* Animated Forest Green Progress Arc */}
              <circle
                cx="64"
                cy="64"
                r="54"
                fill="transparent"
                stroke="#1b4332"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)' }}
              />
            </svg>
            {/* Centered Score Inside Circular Gauge */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
              <div className="flex items-baseline justify-center">
                <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                  {correctCount}
                </span>
                <span className="text-base sm:text-lg font-medium text-slate-400 ml-1">
                  /{totalQuestions}
                </span>
              </div>
              <span className="mt-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#1b4332]/10 text-[#1b4332] border border-[#1b4332]/20 shadow-2xs">
                {percentage}%
              </span>
            </div>
          </div>

          {/* Encouraging Message Pill */}
          <div className="pt-0.5 max-w-md mx-auto">
            <div className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#1b4332]/8 border border-[#1b4332]/15 text-[#1b4332] text-xs sm:text-[13px] font-medium leading-relaxed shadow-2xs">
              <svg className="w-4 h-4 text-[#1b4332] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{getEncouragingMessage()}</span>
            </div>
          </div>
        </div>

        {/* Four Statistic Cards (Clean, balanced & modern grid with micro-icons) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-1">
          {/* Card 1: Tổng số câu */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 sm:p-4 text-center flex flex-col items-center justify-center shadow-2xs transition-all hover:border-slate-300">
            <div className="w-8 h-8 rounded-lg bg-slate-200/70 text-slate-600 flex items-center justify-center mb-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <span className="text-xs font-medium text-slate-500">
              Tổng số câu
            </span>
            <span className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5 block">
              {totalQuestions}
            </span>
          </div>

          {/* Card 2: Trả lời đúng */}
          <div className="bg-[#1b4332]/8 border border-[#1b4332]/15 rounded-xl p-3.5 sm:p-4 text-center flex flex-col items-center justify-center shadow-2xs transition-all hover:border-[#1b4332]/30">
            <div className="w-8 h-8 rounded-lg bg-[#1b4332]/15 text-[#1b4332] flex items-center justify-center mb-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-[#1b4332]">
              Trả lời đúng
            </span>
            <span className="text-xl sm:text-2xl font-bold text-[#1b4332] mt-0.5 block">
              {correctCount}
            </span>
          </div>

          {/* Card 3: Trả lời sai */}
          <div className="bg-rose-50/60 border border-rose-200/80 rounded-xl p-3.5 sm:p-4 text-center flex flex-col items-center justify-center shadow-2xs transition-all hover:border-rose-300">
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center mb-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-rose-700">
              Trả lời sai
            </span>
            <span className="text-xl sm:text-2xl font-bold text-rose-700 mt-0.5 block">
              {wrongCount}
            </span>
          </div>

          {/* Card 4: Thời gian làm bài */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 sm:p-4 text-center flex flex-col items-center justify-center shadow-2xs transition-all hover:border-slate-300">
            <div className="w-8 h-8 rounded-lg bg-slate-200/70 text-slate-600 flex items-center justify-center mb-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-xs font-medium text-slate-500">
              Thời gian
            </span>
            <span className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5 block font-mono">
              {timeSpent}
            </span>
          </div>
        </div>

        {/* Tiered Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
          <Button
            size="large"
            block
            type="default"
            onClick={handleToggleDetails}
            className={`sm:flex-1 rounded-xl transition-all ${showDetails ? 'border-[#1b4332] text-[#1b4332] bg-[#1b4332]/5' : 'border-slate-200 text-slate-700'}`}
            icon={
              <svg
                className={`w-4 h-4 transition-transform duration-200 ${
                  showDetails ? 'rotate-180 text-[#1b4332]' : 'text-slate-500'
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            }
          >
            {showDetails ? 'Ẩn chi tiết bài làm' : 'Xem chi tiết bài làm'}
          </Button>

          <Link
            href={quizIdToRetake ? `/quiz/${quizIdToRetake}` : '/'}
            className="w-full sm:flex-1"
          >
            <Button
              type="primary"
              size="large"
              block
              className="rounded-xl shadow-xs"
              icon={
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2.2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              }
            >
              Làm lại bài kiểm tra
            </Button>
          </Link>
        </div>

        {/* Tertiary Action Button Below */}
        <div className="pt-1">
          <Link
            href={parentSetId ? `/flashcard/${parentSetId}` : '/'}
            className="inline-flex items-center justify-center text-xs sm:text-sm font-medium text-slate-500 hover:text-[#1b4332] transition-colors gap-1.5 py-1.5 px-3.5 rounded-xl hover:bg-slate-100"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Quay về Bộ Flashcard</span>
          </Link>
        </div>
      </div>

      {/* Detailed Answer Review Section */}
      {showDetails && (
        <div
          id="details-section"
          className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-7 space-y-6 shadow-xs transition-all"
        >
          {/* Section Header */}
          <div className="border-b border-slate-100 pb-3.5 flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">
              Chi tiết bài làm
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              (Hiển thị đầy đủ 4 lựa chọn)
            </span>
          </div>

          {/* Empty questions fallback within review */}
          {processedQuestions.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-500">
              Bài kiểm tra này không có danh sách câu hỏi chi tiết.
            </div>
          ) : (
            <div className="space-y-5">
              {processedQuestions.map((question, qIdx) => {
                const normalizedDiag = normalizeDialogue(
                  question.dialogue || question.sentence,
                  qIdx
                );
                const hasDialogue = normalizedDiag && normalizedDiag.length > 0;

                const correctWord =
                  question.answer ||
                  question.word ||
                  (Array.isArray(question.options)
                    ? question.options[question.correctAnswerIndex]
                    : '') ||
                  '';

                return (
                  <div
                    key={question.id || qIdx}
                    className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs space-y-4 hover:border-slate-300 transition-colors"
                  >
                    {/* Question Header: Label "Câu X / Y", Audio Button & Badge "Đúng" / "Sai" */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs sm:text-[13px] font-semibold text-slate-500">
                        Câu {qIdx + 1} / {totalQuestions}
                      </span>

                      <div className="flex items-center gap-2">
                        <Button
                          size="small"
                          type={activeAudioIndex === qIdx ? 'primary' : 'default'}
                          onClick={() =>
                            handleToggleAudio(
                              qIdx,
                              hasDialogue ? normalizedDiag : question.sentence
                            )
                          }
                          icon={
                            activeAudioIndex === qIdx ? (
                              <svg
                                className="w-3.5 h-3.5 animate-pulse"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <rect x="6" y="4" width="4" height="16" rx="1" />
                                <rect x="14" y="4" width="4" height="16" rx="1" />
                              </svg>
                            ) : (
                              <svg
                                className="w-3.5 h-3.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                strokeWidth="2"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                                />
                              </svg>
                            )
                          }
                        >
                          {activeAudioIndex === qIdx ? 'Dừng phát' : 'Nghe hội thoại'}
                        </Button>

                        <Tag color={question.isCorrect ? 'green' : 'red'}>
                          {question.isCorrect ? 'Đúng' : 'Sai'}
                        </Tag>
                      </div>
                    </div>

                    {/* 1. Original Question Sentence / Dialogue with Natural Speaker Names */}
                    <div className="rounded-xl bg-slate-50/80 p-3.5 border border-slate-200/60 space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        Câu hỏi gốc
                      </span>
                      {hasDialogue ? (
                        <div className="space-y-1.5 pt-0.5">
                          {normalizedDiag.map((line, lIdx) => (
                            <p
                              key={lIdx}
                              className="text-sm sm:text-[15px] text-slate-800 leading-[1.6]"
                            >
                              {line.speaker && (
                                <strong className="text-slate-900">
                                  {line.speaker}:{' '}
                                </strong>
                              )}
                              <span>{line.text}</span>
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm sm:text-[15px] text-slate-800 leading-[1.6] pt-0.5">
                          {question.sentence || 'Fill in the blank: ________.'}
                        </p>
                      )}
                    </div>

                    {/* 2. Completed Sentence / Dialogue with Answer Filled In */}
                    <div className="rounded-xl bg-[#1b4332]/5 p-3.5 border border-[#1b4332]/15 shadow-2xs space-y-1.5">
                      <span className="text-[11px] font-bold text-[#1b4332] uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#1b4332]" />
                        Câu hoàn chỉnh (đáp án đúng)
                      </span>
                      <div className="space-y-1 pt-0.5">
                        {renderCompletedDialogue(
                          question.dialogue || question.sentence,
                          correctWord,
                          qIdx
                        )}
                      </div>
                    </div>

                    {/* 3. Vietnamese Translation Box with Natural Speaker Names */}
                    {(() => {
                      const savedTranslation = question.vietnameseTranslation;
                      const dynamicTranslation = translations[qIdx];
                      const rawTranslation = savedTranslation || dynamicTranslation;
                      const currentTranslation = rawTranslation
                        ? normalizeVietnameseTranslation(rawTranslation, {}, qIdx)
                        : null;
                      const isLoadingTr = loadingTranslations[qIdx];

                      return (
                        <div className="rounded-xl bg-slate-50/80 p-3.5 border border-slate-200/60 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                              <svg
                                className="w-3.5 h-3.5 text-[#1b4332]"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                strokeWidth="2"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                                />
                              </svg>
                              Bản dịch tiếng Việt
                            </span>

                            {!currentTranslation && (
                              <Button
                                size="small"
                                type="default"
                                disabled={isLoadingTr}
                                onClick={() => handleLoadTranslation(qIdx, question)}
                              >
                                {isLoadingTr ? 'Đang dịch...' : 'Xem bản dịch'}
                              </Button>
                            )}
                          </div>

                          {currentTranslation ? (
                            <div className="space-y-1.5 pt-0.5">
                              {Array.isArray(currentTranslation) ? (
                                currentTranslation.map((tLine, tIdx) => (
                                  <p
                                    key={tIdx}
                                    className="text-xs sm:text-sm text-slate-600 leading-relaxed"
                                  >
                                    {tLine.speaker && (
                                      <strong className="text-slate-900">
                                        {tLine.speaker}:{' '}
                                      </strong>
                                    )}
                                    <span>{tLine.text}</span>
                                  </p>
                                ))
                              ) : (
                                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                                  {String(currentTranslation)}
                                </p>
                              )}
                            </div>
                          ) : isLoadingTr ? (
                            <div className="py-2 text-center text-xs text-slate-500 animate-pulse">
                              Đang tải bản dịch ngữ cảnh từ AI...
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 italic">
                              Nhấn "Xem bản dịch" để xem nội dung đoạn hội thoại bằng tiếng Việt.
                            </p>
                          )}
                        </div>
                      );
                    })()}

                    {/* All 4 Answer Options (Desktop: 2 columns A/B and C/D) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      {Array.isArray(question.options) &&
                        question.options.map((option, optIdx) => {
                          const optionText =
                            typeof option === 'string'
                              ? option
                              : option?.text ||
                                option?.label ||
                                option?.word ||
                                String(option || '');

                          const isUserChoice = optIdx === question.userAnswerIndex;
                          const isCorrectChoice =
                            optIdx === Number(question.correctAnswerIndex);
                          const optionLabel = String.fromCharCode(65 + optIdx); // A, B, C, D

                          let optionStyle = 'border-slate-200 bg-white text-slate-800 hover:border-slate-300';
                          let badgeStyle =
                            'bg-slate-100 text-slate-600 border border-slate-200/80';
                          let labelText = null;
                          let labelColor = 'default';

                          if (question.isCorrect && isUserChoice) {
                            // Correct Answer selected by user
                            optionStyle =
                              'border-[#1b4332] bg-[#1b4332]/8 text-slate-900 font-semibold shadow-2xs';
                            badgeStyle = 'bg-[#1b4332] text-white font-bold';
                            labelText = 'Bạn đã chọn';
                            labelColor = 'green';
                          } else if (!question.isCorrect) {
                            if (isUserChoice) {
                              // Wrong Answer selected by user
                              optionStyle =
                                'border-rose-400 bg-rose-50/70 text-rose-900 font-semibold shadow-2xs';
                              badgeStyle = 'bg-rose-600 text-white font-bold';
                              labelText = 'Bạn đã chọn';
                              labelColor = 'red';
                            } else if (isCorrectChoice) {
                              // Correct Answer that user missed
                              optionStyle =
                                'border-[#1b4332] bg-[#1b4332]/5 text-slate-900 font-semibold border-dashed shadow-2xs';
                              badgeStyle = 'bg-[#1b4332] text-white font-bold';
                              labelText = 'Đáp án đúng';
                              labelColor = 'green';
                            }
                          }

                          return (
                            <div
                              key={optIdx}
                              className={`w-full min-h-[46px] sm:min-h-[48px] px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-medium transition-all flex items-center justify-between select-none ${optionStyle}`}
                            >
                              <div className="flex items-center gap-2.5 truncate flex-1 min-w-0 pr-2">
                                <span
                                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${badgeStyle}`}
                                >
                                  {optionLabel}
                                </span>
                                <span className="truncate font-mono">{optionText}</span>
                              </div>

                              {labelText && (
                                <Tag color={labelColor} size="small">
                                  {labelText}
                                </Tag>
                              )}
                            </div>
                          );
                        })}
                    </div>

                    {/* Explanation Box for Incorrect Answers */}
                    {!question.isCorrect && question.explanation && (
                      <div className="bg-amber-50/40 border border-amber-200/70 rounded-xl p-3.5 sm:p-4 space-y-2 text-xs sm:text-sm text-slate-800 leading-relaxed mt-3">
                        <h4 className="font-semibold text-slate-900 text-xs uppercase tracking-wider border-b border-amber-200/60 pb-1.5 flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Giải thích chi tiết
                        </h4>
                        {typeof question.explanation === 'string' ? (
                          <p>{question.explanation}</p>
                        ) : (
                          <>
                            <p>
                              "
                              <strong className="font-semibold text-[#1b4332]">
                                {question.explanation.correctWord || question.answer}
                              </strong>
                              "
                              {question.explanation.correctMeaning
                                ? ` nghĩa là "${question.explanation.correctMeaning}". `
                                : ' '}
                              {question.explanation.contextReason}
                            </p>

                            {question.userAnswerIndex !== undefined &&
                            question.userAnswerIndex !== null &&
                            question.options?.[question.userAnswerIndex] ? (
                              <p>
                                Bạn đã chọn "
                                <span className="font-semibold text-rose-600">
                                  {typeof question.options[question.userAnswerIndex] ===
                                  'string'
                                    ? question.options[question.userAnswerIndex]
                                    : question.options[question.userAnswerIndex]?.text ||
                                      ''}
                                </span>
                                ".{' '}
                                {question.explanation.wrongReason ||
                                  'Từ này không phù hợp với ngữ cảnh câu.'}
                              </p>
                            ) : (
                              <p className="text-slate-500">
                                Bạn chưa chọn đáp án cho câu hỏi này.
                              </p>
                            )}

                            {question.explanation.memoryTip && (
                              <p className="text-slate-600 pt-1">
                                💡 Mẹo ghi nhớ:{' '}
                                <strong className="text-slate-900 font-semibold font-mono bg-amber-100/70 px-2 py-0.5 rounded border border-amber-200/60">
                                  {question.explanation.memoryTip}
                                </strong>
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

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

export default function QuizResultPage() {
  return (
    <Suspense
      fallback={
        <div className="py-24 text-center max-w-md mx-auto px-4 text-slate-500">
          Đang tải kết quả bài kiểm tra...
        </div>
      }
    >
      <QuizResultContent />
    </Suspense>
  );
}
