import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { speakDialogue, stopSpeech } from '../../lib/speechService';
import { translateDialogueWithGemini } from '../../lib/geminiQuizService';
import {
  normalizeDialogue,
  normalizeVietnameseTranslation,
} from '../../lib/speakerUtils';

export default function QuizResult() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();

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
      <div className="py-16 text-center text-sm font-medium text-[#6B7665] animate-pulse">
        Đang tải kết quả bài kiểm tra từ Supabase...
      </div>
    );
  }

  // If no result data found after all fallbacks
  if (!resultData) {
    return (
      <div className="py-12 px-4 max-w-lg mx-auto text-center space-y-4">
        <div className="bg-white border border-[#E7EEDC] rounded-2xl p-6 sm:p-8 space-y-4 shadow-2xs">
          <div className="w-12 h-12 rounded-full bg-[#E57373]/15 text-[#E57373] flex items-center justify-center mx-auto text-xl font-bold">
            !
          </div>
          <h2 className="text-lg font-bold text-[#2E3A28]">
            Không tìm thấy thông tin bài kiểm tra
          </h2>
          <p className="text-xs sm:text-sm text-[#6B7665] leading-relaxed">
            Dữ liệu bài kiểm tra hoặc kết quả này không tồn tại hoặc đã bị xóa.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
            <Link
              to="/statistics"
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white border border-[#E7EEDC] hover:bg-[#F8FCF4] text-xs sm:text-sm font-semibold text-[#2E3A28] transition-all"
            >
              Xem thống kê
            </Link>
            <Link
              to="/"
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#A8D672] hover:bg-[#97C95E] text-xs sm:text-sm font-bold text-[#2E3A28] transition-all"
            >
              Về trang chủ
            </Link>
          </div>
        </div>
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
          <p key={lIdx} className="text-sm sm:text-[15px] text-[#2E3A28] leading-[1.6]">
            {line.speaker && (
              <span className="font-semibold text-[#2E3A28]">{line.speaker}: </span>
            )}
            {parts.map((part, pIdx) => (
              <React.Fragment key={pIdx}>
                {part}
                {pIdx < parts.length - 1 && (
                  <strong className="font-bold text-[#1F5C24] bg-[#A8D672]/35 px-1.5 py-0.5 rounded border border-[#A8D672]/70 mx-0.5">
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
      <p className="text-sm sm:text-[15px] text-[#2E3A28] leading-[1.6]">
        {parts.map((part, pIdx) => (
          <React.Fragment key={pIdx}>
            {part}
            {pIdx < parts.length - 1 && (
              <strong className="font-bold text-[#1F5C24] bg-[#A8D672]/35 px-1.5 py-0.5 rounded border border-[#A8D672]/70 mx-0.5">
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

  return (
    <div className="py-2 sm:py-3 px-4 max-w-4xl mx-auto space-y-6 w-full">
      {/* Quiz Summary Main Card */}
      <div className="bg-white border border-[#E2EAD6] rounded-2xl p-5 sm:p-7 text-center space-y-5 sm:space-y-6 shadow-xs">
        {/* Top Score & Percentage Display */}
        <div className="space-y-2">
          <div className="inline-flex items-center justify-center">
            <span className="text-[11px] sm:text-xs font-semibold text-[#3D7842] bg-[#EBF5E6] border border-[#CCE7C4] px-3.5 py-1 rounded-full uppercase tracking-wider">
              Kết quả bài kiểm tra
            </span>
          </div>

          <div className="flex flex-col items-center justify-center gap-1.5 pt-1">
            <div className="flex items-baseline justify-center gap-1.5">
              <h1 className="text-4xl sm:text-5xl font-black text-[#22331C] tracking-tight">
                {correctCount}
              </h1>
              <span className="text-xl sm:text-2xl font-semibold text-[#76856E]">
                / {totalQuestions}
              </span>
            </div>
            <div className="inline-flex items-center">
              <span className="text-xs sm:text-sm font-extrabold text-[#27642E] bg-[#E8F5E5] border border-[#C6E5C3] px-3.5 py-0.5 rounded-full shadow-2xs">
                {percentage}%
              </span>
            </div>
          </div>

          <div className="pt-0.5 max-w-md mx-auto">
            <div className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#F4F9EE] border border-[#DFEED2] text-[#315626] text-xs sm:text-[13px] font-medium leading-relaxed shadow-2xs">
              <svg className="w-4 h-4 text-[#5B9E60] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{getEncouragingMessage()}</span>
            </div>
          </div>
        </div>

        {/* Four Statistic Cards (Clean, balanced & harmonized) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 py-1">
          {/* Card 1: Tổng số câu */}
          <div className="bg-[#F9FAF6] border border-[#E3ECE0] rounded-xl p-3 sm:p-3.5 text-center flex flex-col items-center justify-center transition-all hover:border-[#D0DEC9]">
            <span className="text-[11px] sm:text-xs font-medium text-[#6B7665] tracking-wide">
              Tổng số câu
            </span>
            <span className="text-xl sm:text-2xl font-bold text-[#2E3A28] mt-1 block">
              {totalQuestions}
            </span>
          </div>

          {/* Card 2: Trả lời đúng */}
          <div className="bg-[#F1F8ED] border border-[#CDE5C3] rounded-xl p-3 sm:p-3.5 text-center flex flex-col items-center justify-center transition-all hover:border-[#BFDEB4]">
            <span className="text-[11px] sm:text-xs font-semibold text-[#386D31] tracking-wide">
              Trả lời đúng
            </span>
            <span className="text-xl sm:text-2xl font-bold text-[#25631F] mt-1 block">
              {correctCount}
            </span>
          </div>

          {/* Card 3: Trả lời sai */}
          <div className="bg-[#FDF5F5] border border-[#F3D5D5] rounded-xl p-3 sm:p-3.5 text-center flex flex-col items-center justify-center transition-all hover:border-[#EBBDBD]">
            <span className="text-[11px] sm:text-xs font-semibold text-[#B34545] tracking-wide">
              Trả lời sai
            </span>
            <span className="text-xl sm:text-2xl font-bold text-[#C73737] mt-1 block">
              {wrongCount}
            </span>
          </div>

          {/* Card 4: Thời gian làm bài */}
          <div className="bg-[#F9FAF6] border border-[#E3ECE0] rounded-xl p-3 sm:p-3.5 text-center flex flex-col items-center justify-center transition-all hover:border-[#D0DEC9]">
            <span className="text-[11px] sm:text-xs font-medium text-[#6B7665] tracking-wide">
              Thời gian
            </span>
            <span className="text-xl sm:text-2xl font-bold text-[#2E3A28] mt-1 block font-mono">
              {timeSpent}
            </span>
          </div>
        </div>

        {/* Tiered Action Buttons (Retain exact position, clear hierarchy) */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 sm:gap-3 pt-1">
          <button
            type="button"
            onClick={handleToggleDetails}
            className={`w-full sm:flex-1 h-[44px] sm:h-[46px] px-5 rounded-xl border text-xs sm:text-sm font-semibold transition-all shadow-2xs active:scale-[0.98] cursor-pointer text-center flex items-center justify-center gap-2 ${
              showDetails
                ? 'bg-[#EEF5E8] border-[#95CA5D] text-[#1E4319]'
                : 'bg-white border-[#D2E0CA] text-[#2E3A28] hover:bg-[#F7FAF4] hover:border-[#95CA5D]'
            }`}
          >
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${
                showDetails ? 'text-[#386D31] rotate-180' : 'text-[#5B9E60]'
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
            <span>{showDetails ? 'Ẩn chi tiết bài làm' : 'Xem chi tiết bài làm'}</span>
          </button>

          <Link
            to={quizIdToRetake ? `/quiz/${quizIdToRetake}` : '/'}
            className="w-full sm:flex-1 h-[44px] sm:h-[46px] px-5 rounded-xl bg-[#A8D672] hover:bg-[#96C85F] text-xs sm:text-sm font-bold text-[#193316] transition-all shadow-xs active:scale-[0.98] text-center flex items-center justify-center gap-2 cursor-pointer"
          >
            <svg
              className="w-4 h-4 text-[#193316]"
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
            <span>Làm lại bài kiểm tra</span>
          </Link>
        </div>

        {/* Tertiary Action Button Below */}
        <div className="pt-0.5">
          <Link
            to={parentSetId ? `/flashcard/${parentSetId}` : '/'}
            className="inline-flex items-center justify-center w-full sm:w-auto h-[40px] sm:h-[42px] px-5 rounded-xl text-xs sm:text-sm font-medium text-[#55634E] hover:text-[#23311E] bg-transparent hover:bg-[#F2F7ED] border border-transparent hover:border-[#D6E4CC] transition-all gap-1.5 active:scale-[0.98]"
          >
            <svg
              className="w-3.5 h-3.5 text-[#6B7665]"
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
          className="bg-white border border-[#E2EAD6] rounded-2xl p-5 sm:p-7 space-y-5 sm:space-y-6 shadow-xs transition-all"
        >
          {/* Section Header */}
          <div className="border-b border-[#E2EAD6] pb-3 flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-bold text-[#2E3A28]">
              Chi tiết bài làm
            </h2>
            <span className="text-xs sm:text-[13px] text-[#6B7665]">
              (Hiển thị đầy đủ 4 lựa chọn)
            </span>
          </div>

          {/* Empty questions fallback within review */}
          {processedQuestions.length === 0 ? (
            <div className="text-center py-8 text-sm text-[#6B7665]">
              Bài kiểm tra này không có danh sách câu hỏi chi tiết.
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-5">
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
                    className="rounded-xl border border-[#E2EAD6] bg-white p-4 sm:p-5 shadow-2xs space-y-3.5"
                  >
                    {/* Question Header: Label "Câu X / Y", Audio Button & Badge "Đúng" / "Sai" */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs sm:text-[13px] font-semibold text-[#6B7665]">
                        Câu {qIdx + 1} / {totalQuestions}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleToggleAudio(
                              qIdx,
                              hasDialogue ? normalizedDiag : question.sentence
                            )
                          }
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                            activeAudioIndex === qIdx
                              ? 'bg-[#A8D672] text-[#193316] border-[#86B84E] shadow-2xs'
                              : 'bg-white text-[#2E3A28] border-[#E2EAD6] hover:border-[#A8D672] hover:bg-[#F9FAF6]'
                          }`}
                          title={
                            activeAudioIndex === qIdx
                              ? 'Dừng phát âm thanh'
                              : 'Nghe hội thoại'
                          }
                        >
                          {activeAudioIndex === qIdx ? (
                            <>
                              <svg
                                className="w-3.5 h-3.5 animate-pulse text-[#193316]"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <rect x="6" y="4" width="4" height="16" rx="1" />
                                <rect x="14" y="4" width="4" height="16" rx="1" />
                              </svg>
                              <span>Dừng phát</span>
                            </>
                          ) : (
                            <>
                              <svg
                                className="w-3.5 h-3.5 text-[#5B9E60]"
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
                              <span>Nghe hội thoại</span>
                            </>
                          )}
                        </button>

                        <span
                          className={`h-[26px] sm:h-[28px] inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                            question.isCorrect
                              ? 'bg-[#EBF5E6] text-[#2E6B34] border-[#CDE5C3]'
                              : 'bg-[#FDF4F4] text-[#C73737] border-[#F2D3D3]'
                          }`}
                        >
                          {question.isCorrect ? 'Đúng' : 'Sai'}
                        </span>
                      </div>
                    </div>

                    {/* 1. Original Question Sentence / Dialogue with Natural Speaker Names */}
                    <div className="rounded-xl bg-[#F9FAF6] p-3.5 border border-[#E5ECE0] space-y-1.5">
                      <span className="text-[11px] font-bold text-[#6B7665] uppercase tracking-wider block">
                        Câu hỏi gốc
                      </span>
                      {hasDialogue ? (
                        <div className="space-y-1.5 pt-0.5">
                          {normalizedDiag.map((line, lIdx) => (
                            <p
                              key={lIdx}
                              className="text-sm sm:text-[15px] text-[#2E3A28] leading-[1.6]"
                            >
                              {line.speaker && (
                                <span className="font-semibold text-[#2E3A28]">
                                  {line.speaker}:{' '}
                                </span>
                              )}
                              <span className="font-normal">{line.text}</span>
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm sm:text-[15px] font-normal text-[#2E3A28] leading-[1.6] pt-0.5">
                          {question.sentence || 'Fill in the blank: ________.'}
                        </p>
                      )}
                    </div>

                    {/* 2. Completed Sentence / Dialogue with Answer Filled In */}
                    <div className="rounded-xl bg-white p-3.5 border border-[#A8D672]/70 shadow-2xs space-y-1.5">
                      <span className="text-[11px] font-bold text-[#1F5C24] uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#5B9E60]" />
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
                        <div className="rounded-xl bg-[#F8FCF4]/60 p-3.5 border border-[#E7EEDC] space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-[#6B7665] uppercase tracking-wider flex items-center gap-1.5">
                              <svg
                                className="w-3.5 h-3.5 text-[#5B9E60]"
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
                              <button
                                type="button"
                                disabled={isLoadingTr}
                                onClick={() => handleLoadTranslation(qIdx, question)}
                                className="text-xs font-semibold text-[#386D31] hover:text-[#25631F] bg-white border border-[#D0DEC9] px-2.5 py-1 rounded-lg transition-colors cursor-pointer hover:border-[#A8D672] disabled:opacity-50"
                              >
                                {isLoadingTr ? 'Đang dịch...' : 'Xem bản dịch'}
                              </button>
                            )}
                          </div>

                          {currentTranslation ? (
                            <div className="space-y-1.5 pt-0.5">
                              {Array.isArray(currentTranslation) ? (
                                currentTranslation.map((tLine, tIdx) => (
                                  <p
                                    key={tIdx}
                                    className="text-xs sm:text-sm text-[#4A5545] leading-relaxed"
                                  >
                                    {tLine.speaker && (
                                      <span className="font-semibold text-[#2E3A28]">
                                        {tLine.speaker}:{' '}
                                      </span>
                                    )}
                                    <span>{tLine.text}</span>
                                  </p>
                                ))
                              ) : (
                                <p className="text-xs sm:text-sm text-[#4A5545] leading-relaxed">
                                  {String(currentTranslation)}
                                </p>
                              )}
                            </div>
                          ) : isLoadingTr ? (
                            <div className="py-2 text-center text-xs text-[#6B7665] animate-pulse">
                              Đang tải bản dịch ngữ cảnh từ AI Gemini...
                            </div>
                          ) : (
                            <p className="text-xs text-[#6B7665] italic">
                              Nhấn "Xem bản dịch" để xem nội dung đoạn hội thoại bằng tiếng Việt.
                            </p>
                          )}
                        </div>
                      );
                    })()}

                    {/* All 4 Answer Options (Desktop: 2 columns A/B and C/D, Height 46-48px) */}
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

                          let optionStyle = 'border-[#E2EAD6] bg-white text-[#2E3A28]';
                          let badgeStyle =
                            'bg-[#F9FAF6] text-[#6B7665] border border-[#E2EAD6]';
                          let labelText = null;
                          let labelStyle = '';

                          if (question.isCorrect && isUserChoice) {
                            // Correct Answer selected by user
                            optionStyle =
                              'border-[#7EC068] bg-[#F2F8ED] text-[#1E4319] font-medium shadow-2xs';
                            badgeStyle = 'bg-[#5B9E60] text-white font-bold';
                            labelText = 'Bạn đã chọn';
                            labelStyle = 'bg-[#5B9E60] text-white';
                          } else if (!question.isCorrect) {
                            if (isUserChoice) {
                              // Wrong Answer selected by user
                              optionStyle =
                                'border-[#E89E9E] bg-[#FDF4F4] text-[#B83232] font-medium shadow-2xs';
                              badgeStyle = 'bg-[#D9534F] text-white font-bold';
                              labelText = 'Bạn đã chọn';
                              labelStyle = 'bg-[#D9534F] text-white';
                            } else if (isCorrectChoice) {
                              // Correct Answer that user missed
                              optionStyle =
                                'border-[#7EC068] bg-[#F2F8ED] text-[#1E4319] font-medium shadow-2xs';
                              badgeStyle = 'bg-[#5B9E60] text-white font-bold';
                              labelText = 'Đáp án đúng';
                              labelStyle = 'bg-[#5B9E60] text-white';
                            }
                          }

                          return (
                            <div
                              key={optIdx}
                              className={`w-full h-[46px] sm:h-[48px] px-3.5 rounded-xl border text-xs sm:text-sm font-medium transition-all flex items-center justify-between select-none ${optionStyle}`}
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
                                <span
                                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-md shrink-0 whitespace-nowrap ${labelStyle}`}
                                >
                                  {labelText}
                                </span>
                              )}
                            </div>
                          );
                        })}
                    </div>

                    {/* Explanation Box for Incorrect Answers */}
                    {!question.isCorrect && question.explanation && (
                      <div className="bg-[#F9FAF6] border border-[#DCE8D5] rounded-xl p-3.5 sm:p-4 space-y-2 text-xs sm:text-sm text-[#2E3A28] leading-relaxed mt-3">
                        <h4 className="font-semibold text-[#2E3A28] text-xs uppercase tracking-wider border-b border-[#E2EAD6] pb-1.5">
                          Giải thích
                        </h4>
                        {typeof question.explanation === 'string' ? (
                          <p>{question.explanation}</p>
                        ) : (
                          <>
                            <p>
                              "
                              <strong className="font-semibold text-[#5B9E60]">
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
                                <span className="font-semibold text-[#E57373]">
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
                              <p className="text-[#6B7665]">
                                Bạn chưa chọn đáp án cho câu hỏi này.
                              </p>
                            )}

                            {question.explanation.memoryTip && (
                              <p className="text-[#6B7665] pt-0.5">
                                Mẹo ghi nhớ:
                                <br />
                                <strong className="text-[#2E3A28] font-semibold font-mono">
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#2E3A28]/95 text-white text-xs font-medium px-4 py-2.5 rounded-full shadow-lg z-50 transition-all pointer-events-none border border-[#E7EEDC]/20">
          {speechNotice}
        </div>
      )}
    </div>
  );
}
