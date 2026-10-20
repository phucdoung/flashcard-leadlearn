import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { speakDialogue, stopSpeech } from '../../lib/speechService';
import { translateDialogueWithGemini } from '../../lib/geminiQuizService';
import {
  normalizeDialogue,
  normalizeVietnameseTranslation,
} from '../../lib/speakerUtils';
import { Button, Tag, Empty } from '../../components/common';

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
      <div className="py-24 text-center max-w-md mx-auto px-4">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-solid border-[#24693D] border-r-transparent"></div>
        <p className="mt-4 text-sm font-medium text-[#556551]">
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
    <div className="py-4 px-4 max-w-4xl mx-auto space-y-6 w-full">
      {/* Quiz Summary Main Card */}
      <div className="bg-white border border-[#DCE5D8] rounded-xl p-5 sm:p-7 text-center space-y-6 shadow-xs">
        {/* Top Score & Percentage Display */}
        <div className="space-y-3">
          <div className="inline-flex items-center justify-center">
            <Tag color="green">KẾT QUẢ BÀI KIỂM TRA</Tag>
          </div>

          <div className="flex flex-col items-center justify-center gap-1.5">
            <div className="flex items-baseline justify-center gap-2">
              <h1 className="text-4xl sm:text-5xl font-black text-[#14261C] tracking-tight">
                {correctCount}
              </h1>
              <span className="text-xl sm:text-2xl font-semibold text-[#8C9B86]">
                / {totalQuestions}
              </span>
            </div>
            <div className="inline-flex items-center">
              <span className="text-xs sm:text-sm font-bold text-[#24693D] bg-[#F0F7EE] border border-[#C8DEC2] px-3.5 py-0.5 rounded-full">
                {percentage}%
              </span>
            </div>
          </div>

          <div className="pt-0.5 max-w-md mx-auto">
            <div className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#F8FCF4] border border-[#DCE5D8] text-[#24693D] text-xs sm:text-[13px] font-medium leading-relaxed">
              <svg className="w-4 h-4 text-[#24693D] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{getEncouragingMessage()}</span>
            </div>
          </div>
        </div>

        {/* Four Statistic Cards (Clean, balanced & harmonized) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-1">
          {/* Card 1: Tổng số câu */}
          <div className="bg-[#F8FCF4] border border-[#DCE5D8] rounded-lg p-3 sm:p-4 text-center flex flex-col items-center justify-center transition-colors">
            <span className="text-xs font-medium text-[#556551]">
              Tổng số câu
            </span>
            <span className="text-xl sm:text-2xl font-bold text-[#14261C] mt-1 block">
              {totalQuestions}
            </span>
          </div>

          {/* Card 2: Trả lời đúng */}
          <div className="bg-[#F6FFED] border border-[#B7EB8F] rounded-lg p-3 sm:p-4 text-center flex flex-col items-center justify-center transition-colors">
            <span className="text-xs font-semibold text-[#24693D]">
              Trả lời đúng
            </span>
            <span className="text-xl sm:text-2xl font-bold text-[#24693D] mt-1 block">
              {correctCount}
            </span>
          </div>

          {/* Card 3: Trả lời sai */}
          <div className="bg-[#FFF2F0] border border-[#FFA39E] rounded-lg p-3 sm:p-4 text-center flex flex-col items-center justify-center transition-colors">
            <span className="text-xs font-semibold text-[#CF1322]">
              Trả lời sai
            </span>
            <span className="text-xl sm:text-2xl font-bold text-[#CF1322] mt-1 block">
              {wrongCount}
            </span>
          </div>

          {/* Card 4: Thời gian làm bài */}
          <div className="bg-[#F8FCF4] border border-[#DCE5D8] rounded-lg p-3 sm:p-4 text-center flex flex-col items-center justify-center transition-colors">
            <span className="text-xs font-medium text-[#556551]">
              Thời gian
            </span>
            <span className="text-xl sm:text-2xl font-bold text-[#14261C] mt-1 block font-mono">
              {timeSpent}
            </span>
          </div>
        </div>

        {/* Tiered Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
          <Button
            size="large"
            block
            type={showDetails ? 'default' : 'default'}
            onClick={handleToggleDetails}
            className={`sm:flex-1 ${showDetails ? 'border-[#24693D] text-[#24693D]' : ''}`}
            icon={
              <svg
                className={`w-4 h-4 transition-transform duration-200 ${
                  showDetails ? 'rotate-180 text-[#24693D]' : 'text-[#556551]'
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
            to={quizIdToRetake ? `/quiz/${quizIdToRetake}` : '/'}
            className="w-full sm:flex-1"
          >
            <Button
              type="primary"
              size="large"
              block
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
            to={parentSetId ? `/flashcard/${parentSetId}` : '/'}
            className="inline-flex items-center justify-center text-xs sm:text-sm font-medium text-[#556551] hover:text-[#24693D] transition-colors gap-1.5 py-1 px-3 rounded-lg hover:bg-[#F8FCF4]"
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
          className="bg-white border border-[#DCE5D8] rounded-xl p-5 sm:p-7 space-y-6 shadow-xs transition-all"
        >
          {/* Section Header */}
          <div className="border-b border-[#DCE5D8] pb-3.5 flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-bold text-[#14261C]">
              Chi tiết bài làm
            </h2>
            <span className="text-xs text-[#556551]">
              (Hiển thị đầy đủ 4 lựa chọn)
            </span>
          </div>

          {/* Empty questions fallback within review */}
          {processedQuestions.length === 0 ? (
            <div className="text-center py-8 text-sm text-[#556551]">
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
                    className="rounded-xl border border-[#DCE5D8] bg-white p-4 sm:p-5 shadow-2xs space-y-4"
                  >
                    {/* Question Header: Label "Câu X / Y", Audio Button & Badge "Đúng" / "Sai" */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs sm:text-[13px] font-semibold text-[#556551]">
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
                    <div className="rounded-lg bg-[#F8FCF4] p-3.5 border border-[#E8EFE5] space-y-1.5">
                      <span className="text-[11px] font-bold text-[#8C9B86] uppercase tracking-wider block">
                        Câu hỏi gốc
                      </span>
                      {hasDialogue ? (
                        <div className="space-y-1.5 pt-0.5">
                          {normalizedDiag.map((line, lIdx) => (
                            <p
                              key={lIdx}
                              className="text-sm sm:text-[15px] text-[#14261C] leading-[1.6]"
                            >
                              {line.speaker && (
                                <strong className="text-[#14261C]">
                                  {line.speaker}:{' '}
                                </strong>
                              )}
                              <span>{line.text}</span>
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm sm:text-[15px] text-[#14261C] leading-[1.6] pt-0.5">
                          {question.sentence || 'Fill in the blank: ________.'}
                        </p>
                      )}
                    </div>

                    {/* 2. Completed Sentence / Dialogue with Answer Filled In */}
                    <div className="rounded-lg bg-white p-3.5 border border-[#24693D]/30 shadow-2xs space-y-1.5">
                      <span className="text-[11px] font-bold text-[#24693D] uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#24693D]" />
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
                        <div className="rounded-lg bg-[#F8FCF4] p-3.5 border border-[#E8EFE5] space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-[#8C9B86] uppercase tracking-wider flex items-center gap-1.5">
                              <svg
                                className="w-3.5 h-3.5 text-[#24693D]"
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
                                    className="text-xs sm:text-sm text-[#556551] leading-relaxed"
                                  >
                                    {tLine.speaker && (
                                      <strong className="text-[#14261C]">
                                        {tLine.speaker}:{' '}
                                      </strong>
                                    )}
                                    <span>{tLine.text}</span>
                                  </p>
                                ))
                              ) : (
                                <p className="text-xs sm:text-sm text-[#556551] leading-relaxed">
                                  {String(currentTranslation)}
                                </p>
                              )}
                            </div>
                          ) : isLoadingTr ? (
                            <div className="py-2 text-center text-xs text-[#556551] animate-pulse">
                              Đang tải bản dịch ngữ cảnh từ AI...
                            </div>
                          ) : (
                            <p className="text-xs text-[#8C9B86] italic">
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

                          let optionStyle = 'border-[#DCE5D8] bg-white text-[#14261C]';
                          let badgeStyle =
                            'bg-[#F8FCF4] text-[#556551] border border-[#DCE5D8]';
                          let labelText = null;
                          let labelColor = 'default';

                          if (question.isCorrect && isUserChoice) {
                            // Correct Answer selected by user
                            optionStyle =
                              'border-[#24693D] bg-[#F6FFED] text-[#24693D] font-medium shadow-2xs';
                            badgeStyle = 'bg-[#24693D] text-white font-bold';
                            labelText = 'Bạn đã chọn';
                            labelColor = 'green';
                          } else if (!question.isCorrect) {
                            if (isUserChoice) {
                              // Wrong Answer selected by user
                              optionStyle =
                                'border-[#FFA39E] bg-[#FFF2F0] text-[#CF1322] font-medium shadow-2xs';
                              badgeStyle = 'bg-[#CF1322] text-white font-bold';
                              labelText = 'Bạn đã chọn';
                              labelColor = 'red';
                            } else if (isCorrectChoice) {
                              // Correct Answer that user missed
                              optionStyle =
                                'border-[#24693D] bg-[#F6FFED] text-[#24693D] font-medium shadow-2xs';
                              badgeStyle = 'bg-[#24693D] text-white font-bold';
                              labelText = 'Đáp án đúng';
                              labelColor = 'green';
                            }
                          }

                          return (
                            <div
                              key={optIdx}
                              className={`w-full h-[46px] sm:h-[48px] px-3.5 rounded-lg border text-xs sm:text-sm font-medium transition-all flex items-center justify-between select-none ${optionStyle}`}
                            >
                              <div className="flex items-center gap-2.5 truncate flex-1 min-w-0 pr-2">
                                <span
                                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold ${badgeStyle}`}
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
                      <div className="bg-[#F8FCF4] border border-[#DCE5D8] rounded-lg p-3.5 sm:p-4 space-y-2 text-xs sm:text-sm text-[#14261C] leading-relaxed mt-3">
                        <h4 className="font-semibold text-[#14261C] text-xs uppercase tracking-wider border-b border-[#DCE5D8] pb-1.5">
                          Giải thích
                        </h4>
                        {typeof question.explanation === 'string' ? (
                          <p>{question.explanation}</p>
                        ) : (
                          <>
                            <p>
                              "
                              <strong className="font-semibold text-[#24693D]">
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
                                <span className="font-semibold text-[#CF1322]">
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
                              <p className="text-[#556551]">
                                Bạn chưa chọn đáp án cho câu hỏi này.
                              </p>
                            )}

                            {question.explanation.memoryTip && (
                              <p className="text-[#556551] pt-0.5">
                                Mẹo ghi nhớ:{' '}
                                <strong className="text-[#14261C] font-semibold font-mono">
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#14261C]/95 text-white text-xs font-medium px-4 py-2 rounded-full shadow-lg z-50 transition-all pointer-events-none border border-[#DCE5D8]/20">
          {speechNotice}
        </div>
      )}
    </div>
  );
}
