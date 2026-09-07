import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

export default function QuizResult() {
  const { id } = useParams();
  const [showDetails, setShowDetails] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchResult() {
      if (!id) return;
      setLoading(true);

      try {
        // 1. Check if ID matches a quiz_result ID
        const { data: resData } = await supabase
          .from('quiz_results')
          .select('*, quizzes(*)')
          .eq('id', id)
          .single();

        if (resData && resData.quizzes) {
          setResultData({
            id: resData.id,
            quizId: resData.quiz_id,
            setId: resData.quizzes.set_id,
            title: resData.quizzes.title,
            questions: resData.quizzes.questions || [],
            selectedAnswers: resData.user_answers || {},
            score: resData.score,
            totalQuestions: resData.total_questions,
            timeSpent: resData.time_spent || '03:45',
          });
          setLoading(false);
          return;
        }

        // 2. Check if ID matches a quiz ID
        const { data: quizData } = await supabase
          .from('quizzes')
          .select('*, quiz_results(*)')
          .eq('id', id)
          .single();

        if (quizData) {
          const latestRes =
            quizData.quiz_results && quizData.quiz_results.length > 0
              ? quizData.quiz_results[quizData.quiz_results.length - 1]
              : null;

          setResultData({
            id: quizData.id,
            quizId: quizData.id,
            setId: quizData.set_id,
            title: quizData.title,
            questions: quizData.questions || [],
            selectedAnswers: latestRes ? latestRes.user_answers : {},
            score: latestRes ? latestRes.score : 0,
            totalQuestions: quizData.questions ? quizData.questions.length : 0,
            timeSpent: latestRes ? latestRes.time_spent : '03:45',
          });
          setLoading(false);
          return;
        }

        // 3. Fallback to sessionStorage
        const cachedStr = sessionStorage.getItem(`quiz_result_${id}`);
        if (cachedStr) {
          setResultData(JSON.parse(cachedStr));
        }
      } catch (err) {
        console.error('Fetch quiz result error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchResult();
  }, [id]);

  if (loading) {
    return (
      <div className="py-16 text-center text-sm font-medium text-[#6B7665] animate-pulse">
        Đang tải kết quả bài kiểm tra từ Supabase...
      </div>
    );
  }

  // Questions and calculations
  const questions = resultData?.questions || [];
  const userAnswers = resultData?.selectedAnswers || {};
  const totalQuestions = resultData?.totalQuestions || questions.length;
  const score = resultData?.score !== undefined ? resultData.score : 0;

  // Process answers with correctness
  const processedQuestions = questions.map((q, idx) => {
    const userChoiceIdx = userAnswers[idx];
    const isCorrect = userChoiceIdx === q.correctAnswerIndex;
    return {
      ...q,
      userAnswerIndex: userChoiceIdx,
      isCorrect,
    };
  });

  const correctCount = score;
  const wrongCount = totalQuestions - correctCount;
  const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const timeSpent = resultData?.timeSpent || '03:45';

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
    setShowDetails((prev) => !prev);
    if (!showDetails) {
      setTimeout(() => {
        document.getElementById('details-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  const parentSetId = resultData?.setId || id;
  const quizIdToRetake = resultData?.quizId || id;

  return (
    <div className="py-2 sm:py-3 px-4 max-w-4xl mx-auto space-y-6 w-full">
      {/* Quiz Summary Main Card (Compact 10-15% reduced proportions) */}
      <div className="bg-white border border-[#E7EEDC] rounded-2xl sm:rounded-3xl p-5 sm:p-7 text-center space-y-5 shadow-2xs">
        {/* Top Score & Percentage Display */}
        <div className="space-y-2">
          <div className="inline-flex items-center justify-center">
            <span className="text-[11px] sm:text-xs font-semibold text-[#5B9E60] bg-[#5B9E60]/15 border border-[#5B9E60]/30 px-3.5 py-1 rounded-full uppercase tracking-wider">
              Kết quả bài kiểm tra
            </span>
          </div>

          <div className="flex flex-col items-center justify-center gap-1.5 pt-1">
            <h1 className="text-3xl sm:text-4xl font-bold text-[#2E3A28] tracking-tight">
              {correctCount} / {totalQuestions}
            </h1>
            <span className="text-base sm:text-lg font-bold text-[#5B9E60] bg-[#5B9E60]/15 border border-[#5B9E60]/30 px-3.5 py-0.5 rounded-full">
              {percentage}%
            </span>
          </div>

          <p className="text-xs sm:text-sm font-medium text-[#6B7665] max-w-md mx-auto leading-relaxed pt-0.5">
            {getEncouragingMessage()}
          </p>
        </div>

        {/* Four Statistic Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5 py-1">
          {/* Card 1: Tổng số câu */}
          <div className="bg-[#F8FCF4] border border-[#E7EEDC] rounded-xl p-3 text-center">
            <span className="block text-[11px] sm:text-xs font-medium text-[#6B7665]">Tổng số câu</span>
            <span className="text-lg sm:text-xl font-bold text-[#2E3A28] mt-0.5 block">
              {totalQuestions}
            </span>
          </div>

          {/* Card 2: Trả lời đúng */}
          <div className="bg-[#5B9E60]/15 border border-[#5B9E60]/30 rounded-xl p-3 text-center">
            <span className="block text-[11px] sm:text-xs font-medium text-[#6B7665]">Trả lời đúng</span>
            <span className="text-lg sm:text-xl font-bold text-[#5B9E60] mt-0.5 block">
              {correctCount}
            </span>
          </div>

          {/* Card 3: Trả lời sai */}
          <div className="bg-[#E57373]/15 border border-[#E57373]/30 rounded-xl p-3 text-center">
            <span className="block text-[11px] sm:text-xs font-medium text-[#6B7665]">Trả lời sai</span>
            <span className="text-lg sm:text-xl font-bold text-[#E57373] mt-0.5 block">
              {wrongCount}
            </span>
          </div>

          {/* Card 4: Thời gian làm bài */}
          <div className="bg-[#F8FCF4] border border-[#E7EEDC] rounded-xl p-3 text-center">
            <span className="block text-[11px] sm:text-xs font-medium text-[#6B7665]">Thời gian</span>
            <span className="text-lg sm:text-xl font-bold text-[#2E3A28] mt-0.5 block font-mono">
              {timeSpent}
            </span>
          </div>
        </div>

        {/* Two Compact Action Buttons (44-46px height, 10-12px radius, 14px font) */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 sm:gap-3 pt-1">
          <button
            type="button"
            onClick={handleToggleDetails}
            className="w-full sm:flex-1 h-[44px] sm:h-[46px] px-5 rounded-xl bg-white border border-[#E7EEDC] hover:bg-[#F8FCF4] text-sm font-semibold text-[#2E3A28] transition-all shadow-2xs active:scale-[0.98] cursor-pointer text-center flex items-center justify-center"
          >
            {showDetails ? 'Ẩn chi tiết bài làm' : 'Xem chi tiết bài làm'}
          </button>

          <Link
            to={quizIdToRetake ? `/quiz/${quizIdToRetake}` : '/'}
            className="w-full sm:flex-1 h-[44px] sm:h-[46px] px-5 rounded-xl bg-[#A8D672] hover:bg-[#97C95E] text-sm font-bold text-[#2E3A28] transition-all shadow-2xs active:scale-[0.98] text-center flex items-center justify-center"
          >
            Làm lại bài kiểm tra
          </Link>
        </div>

        {/* Outlined Button Below */}
        <div className="pt-0.5">
          <Link
            to={parentSetId ? `/flashcard/${parentSetId}` : '/'}
            className="inline-flex items-center justify-center w-full sm:w-auto h-[44px] sm:h-[46px] px-6 rounded-xl border border-[#E7EEDC] bg-white hover:bg-[#F8FCF4] text-xs sm:text-sm font-semibold text-[#2E3A28] transition-all active:scale-[0.98]"
          >
            Quay về Bộ Flashcard
          </Link>
        </div>
      </div>

      {/* Detailed Answer Review Section (2 Columns for Options on Desktop) */}
      {showDetails && (
        <div id="details-section" className="bg-white border border-[#E7EEDC] rounded-2xl sm:rounded-3xl p-5 sm:p-7 space-y-6 shadow-2xs transition-all">
          {/* Section Header */}
          <div className="border-b border-[#E7EEDC] pb-3 flex items-center justify-between">
            <h2 className="text-xl sm:text-[25px] font-bold text-[#2E3A28]">
              Chi tiết bài làm
            </h2>
            <span className="text-xs sm:text-[13px] text-[#6B7665]">
              (Hiển thị đầy đủ 4 lựa chọn)
            </span>
          </div>

          {/* Questions Detailed Cards */}
          <div className="space-y-4 sm:space-y-5">
            {processedQuestions.map((question, qIdx) => {
              return (
                <div
                  key={question.id || qIdx}
                  className="rounded-2xl border border-[#E7EEDC] bg-white p-4 sm:p-5 shadow-2xs space-y-3.5"
                >
                  {/* Question Header: Label "Câu X / Y" & Badge "Đúng" / "Sai" */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-[13px] font-semibold text-[#6B7665]">
                      Câu {qIdx + 1} / {totalQuestions}
                    </span>
                    <span
                      className={`h-[26px] sm:h-[28px] inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                        question.isCorrect
                          ? 'bg-[#5B9E60]/15 text-[#5B9E60] border-[#5B9E60]/30'
                          : 'bg-[#E57373]/15 text-[#E57373] border-[#E57373]/30'
                      }`}
                    >
                      {question.isCorrect ? 'Đúng' : 'Sai'}
                    </span>
                  </div>

                  {/* Original Question Sentence / Dialogue (Font 16-17px, line-height 1.6, 8-10px line gap) */}
                  {question.type === 'dialogue' && Array.isArray(question.dialogue) ? (
                    <div className="rounded-xl bg-[#F8FCF4] p-3.5 border border-[#E7EEDC] space-y-2">
                      {question.dialogue.map((line, lIdx) => (
                        <p key={lIdx} className="text-sm sm:text-[16px] text-[#2E3A28] leading-[1.6]">
                          <span className="font-semibold text-[#2E3A28]">{line.speaker}: </span>
                          <span className="font-normal">{line.text}</span>
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm sm:text-[16px] font-normal text-[#2E3A28] leading-[1.6] px-1">
                      {question.sentence || 'Fill in the blank: ________.'}
                    </p>
                  )}

                  {/* All 4 Answer Options (Desktop: 2 columns A/B and C/D, Height 48-50px) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {question.options &&
                      question.options.map((option, optIdx) => {
                        const isUserChoice = optIdx === question.userAnswerIndex;
                        const isCorrectChoice = optIdx === question.correctAnswerIndex;
                        const optionLabel = String.fromCharCode(65 + optIdx); // A, B, C, D

                        let optionStyle = 'border-[#E7EEDC] bg-white text-[#2E3A28]';
                        let badgeStyle = 'bg-[#F8FCF4] text-[#6B7665] border border-[#E7EEDC]';
                        let labelText = null;
                        let labelStyle = '';

                        if (question.isCorrect && isUserChoice) {
                          // Correct Answer selected by user
                          optionStyle = 'border-[#5B9E60]/50 bg-[#5B9E60]/10 text-[#2E3A28] font-semibold';
                          badgeStyle = 'bg-[#5B9E60] text-white font-bold';
                          labelText = 'Bạn đã chọn';
                          labelStyle = 'bg-[#5B9E60] text-white';
                        } else if (!question.isCorrect) {
                          if (isUserChoice) {
                            // Wrong Answer selected by user
                            optionStyle = 'border-[#E57373]/50 bg-[#E57373]/10 text-[#D32F2F] font-semibold';
                            badgeStyle = 'bg-[#E57373] text-white font-bold';
                            labelText = 'Bạn đã chọn';
                            labelStyle = 'bg-[#E57373] text-white';
                          } else if (isCorrectChoice) {
                            // Correct Answer that user missed
                            optionStyle = 'border-[#5B9E60]/50 bg-[#5B9E60]/10 text-[#2E3A28] font-semibold';
                            badgeStyle = 'bg-[#5B9E60] text-white font-bold';
                            labelText = 'Đáp án đúng';
                            labelStyle = 'bg-[#5B9E60] text-white';
                          }
                        }

                        return (
                          <div
                            key={optIdx}
                            className={`w-full h-[48px] sm:h-[50px] px-3.5 rounded-xl border text-xs sm:text-sm font-medium transition-all flex items-center justify-between select-none ${optionStyle}`}
                          >
                            <div className="flex items-center gap-2.5 truncate flex-1 min-w-0 pr-2">
                              <span
                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${badgeStyle}`}
                              >
                                {optionLabel}
                              </span>
                              <span className="truncate font-mono">{option}</span>
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

                  {/* Soft Light-Green Explanation Box ONLY for Incorrect Answers */}
                  {!question.isCorrect && question.explanation && (
                    <div className="bg-[#F8FCF4] border border-[#A8D672]/60 rounded-xl p-3.5 sm:p-4 space-y-2 text-xs sm:text-sm text-[#2E3A28] leading-relaxed mt-3">
                      <h4 className="font-semibold text-[#2E3A28] text-xs uppercase tracking-wider border-b border-[#E7EEDC] pb-1.5">
                        Giải thích
                      </h4>
                      {typeof question.explanation === 'string' ? (
                        <p>{question.explanation}</p>
                      ) : (
                        <>
                          <p>
                            "<strong className="font-semibold text-[#5B9E60]">{question.explanation.correctWord || question.answer}</strong>"
                            {question.explanation.correctMeaning ? ` nghĩa là "${question.explanation.correctMeaning}". ` : ' '}
                            {question.explanation.contextReason}
                          </p>

                          {question.userAnswerIndex !== undefined && question.userAnswerIndex !== null && question.options?.[question.userAnswerIndex] ? (
                            <p>
                              Bạn đã chọn "<span className="font-semibold text-[#E57373]">{question.options[question.userAnswerIndex]}</span>".{' '}
                              {question.explanation.wrongReason || `Từ này không phù hợp với ngữ cảnh câu.`}
                            </p>
                          ) : (
                            <p className="text-[#6B7665]">Bạn chưa chọn đáp án cho câu hỏi này.</p>
                          )}

                          {question.explanation.memoryTip && (
                            <p className="text-[#6B7665] pt-0.5">
                              Mẹo ghi nhớ:<br />
                              <strong className="text-[#2E3A28] font-semibold font-mono">{question.explanation.memoryTip}</strong>
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
        </div>
      )}
    </div>
  );
}
