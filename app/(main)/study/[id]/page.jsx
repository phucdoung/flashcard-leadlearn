'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/src/lib/supabaseClient';
import { speakText, stopSpeech } from '@/src/lib/speechService';
import { Button, Tag, Empty } from '@/src/components';

export default function StudyFlashcard() {
  const { id } = useParams();

  const [setDetail, setSetDetail] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // Fetch set details and cards from Supabase
  const fetchStudyData = async () => {
    if (!id) return;
    setLoading(true);

    try {
      // 1. Fetch set info
      const { data: setData } = await supabase
        .from('flashcard_sets')
        .select('*')
        .eq('id', id)
        .single();

      if (setData) {
        setSetDetail({
          id: setData.id,
          title: setData.name || setData.title || 'Bộ thẻ',
          language: setData.language || setData.lang || 'en-US',
        });
      }

      // 2. Fetch cards
      const { data: cardsData } = await supabase
        .from('flashcards')
        .select('*')
        .eq('set_id', id)
        .order('created_at', { ascending: true });

      if (cardsData) {
        const formattedCards = cardsData.map((c) => ({
          id: c.id,
          term: c.word || c.term || '',
          phonetic: c.pronunciation || c.phonetic || '',
          definition: c.meaning || c.definition || '',
          isMastered: c.learning_status === 'learned' || c.learning_status === 'mastered',
        }));
        setCards(formattedCards);
      }
    } catch (err) {
      console.error('Fetch study data error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudyData();
  }, [id]);

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechNotice, setSpeechNotice] = useState(null);

  const showSpeechNotice = (msg) => {
    setSpeechNotice(msg);
    setTimeout(() => {
      setSpeechNotice(null);
    }, 3000);
  };

  // Web Speech API Pronunciation Handler (Shared speechService)
  const handleSpeak = (e, textToSpeak) => {
    if (e) {
      e.stopPropagation();
    }

    if (!textToSpeak) return;

    speakText(textToSpeak, {
      forceVietnamese: setDetail?.language === 'vi' || setDetail?.language === 'vi-VN',
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
      onError: (err) => {
        setIsSpeaking(false);
        if (err === 'NO_ENGLISH_VOICE') {
          showSpeechNotice('Thiết bị chưa cài đặt giọng đọc tiếng Anh.');
        }
      },
    });
  };

  // Stop current speech when card changes, card is completed, or component unmounts
  useEffect(() => {
    stopSpeech();
    setIsSpeaking(false);
  }, [currentIndex, isCompleted]);

  const totalCards = cards.length;
  const currentCard = cards[currentIndex] || cards[0];

  const masteredCount = cards.filter((c) => c.isMastered).length;
  const unmasteredCount = totalCards - masteredCount;

  // Navigation Handlers
  const handlePrevious = () => {
    if (isCompleted) {
      setIsCompleted(false);
      return;
    }
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setIsFlipped(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < totalCards - 1) {
      setCurrentIndex((prev) => prev + 1);
      setIsFlipped(false);
    } else {
      setIsCompleted(true);
    }
  };

  // Status Handlers (Sync with Supabase)
  const handleMarkStatus = async (isMastered) => {
    if (!currentCard) return;

    const cardId = currentCard.id;
    const newStatus = isMastered ? 'learned' : 'unlearned';

    // Optimistic UI update
    setCards((prev) =>
      prev.map((card, idx) =>
        idx === currentIndex ? { ...card, isMastered } : card
      )
    );

    // Sync with Supabase
    try {
      await supabase
        .from('flashcards')
        .update({ learning_status: newStatus })
        .eq('id', cardId);
    } catch (err) {
      console.error('Error syncing status with Supabase:', err);
    }

    if (currentIndex < totalCards - 1) {
      setCurrentIndex((prev) => prev + 1);
      setIsFlipped(false);
    } else {
      setIsCompleted(true);
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setIsCompleted(false);
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (!isCompleted) {
          setIsFlipped((prev) => !prev);
        }
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handlePrevious();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, totalCards, isCompleted]);

  return (
    <div className="max-w-4xl mx-auto space-y-5 w-full">
      {/* Header Container */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 space-y-3.5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <Link
              href={`/flashcard/${id}`}
              className="inline-flex items-center text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl transition-all mb-2 shadow-2xs gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Quay lại bộ Flashcard
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {setDetail?.title || 'Bộ thẻ'}
            </h1>
          </div>

          {!isCompleted && totalCards > 0 && (
            <div className="shrink-0">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Thẻ {currentIndex + 1} / {totalCards}
              </span>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
          <div
            className="bg-emerald-600 h-full transition-all duration-300 rounded-full"
            style={{
              width:
                totalCards === 0
                  ? '0%'
                  : isCompleted
                  ? '100%'
                  : `${((currentIndex + 1) / totalCards) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="py-20 text-center text-sm text-slate-500 font-medium flex items-center justify-center gap-2.5">
          <svg className="animate-spin h-5 w-5 text-emerald-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Đang tải dữ liệu thẻ...
        </div>
      ) : totalCards === 0 ? (
        <Empty
          title="Bộ thẻ này chưa có Flashcard nào"
          description="Vui lòng quay lại danh sách và thêm từ vựng mới để bắt đầu học."
          action={
            <Link href={`/flashcard/${id}`}>
              <Button type="primary">
                Tạo từ mới ngay
              </Button>
            </Link>
          }
        />
      ) : isCompleted ? (
        /* Completion Panel */
        <div className="bg-white border border-slate-200/80 rounded-2xl p-8 sm:p-10 text-center space-y-6 max-w-lg mx-auto shadow-sm">
          <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto text-2xl font-bold shadow-xs">
            ✓
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
              HOÀN THÀNH
            </span>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Bạn đã hoàn thành bộ Flashcard!
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Tuyệt vời! Bạn đã hoàn thành lượt học cho {totalCards} thẻ ghi nhớ.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3.5 py-1">
            <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-4">
              <span className="block text-xs font-semibold text-emerald-800">Đã thuộc</span>
              <span className="text-2xl sm:text-3xl font-bold text-emerald-700 mt-1 block">
                {masteredCount}
              </span>
            </div>
            <div className="bg-rose-50/70 border border-rose-200/80 rounded-xl p-4">
              <span className="block text-xs font-semibold text-rose-800">Chưa thuộc</span>
              <span className="text-2xl sm:text-3xl font-bold text-rose-700 mt-1 block">
                {unmasteredCount}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <Button
              type="primary"
              size="large"
              block
              onClick={handleRestart}
              className="flex-1"
            >
              Học lại
            </Button>
            <Link href={`/flashcard/${id}`} className="w-full sm:flex-1">
              <Button type="default" size="large" block>
                Quay lại bộ Flashcard
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        /* Active Study Flashcard Layout */
        <div className="space-y-4">
          {/* Flashcard Card: Height 330px–370px */}
          <div className="w-full max-w-2xl mx-auto" style={{ perspective: '1000px' }}>
            <div
              onClick={() => setIsFlipped(!isFlipped)}
              className="relative w-full h-[330px] sm:h-[370px] cursor-pointer rounded-2xl transition-all duration-300 hover:-translate-y-0.5"
              style={{
                transformStyle: 'preserve-3d',
                transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              }}
            >
              {/* FRONT SIDE */}
              <div
                className="absolute inset-0 w-full h-full bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 flex flex-col justify-between items-center text-center shadow-xs hover:shadow-md transition-shadow select-none"
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                }}
              >
                <div className="w-full flex items-center justify-between text-xs">
                  <span className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider rounded-lg bg-slate-100 text-slate-600 border border-slate-200">
                    MẶT TRƯỚC
                  </span>
                  <span
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border ${
                      currentCard?.isMastered
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    {currentCard?.isMastered ? 'Đã thuộc' : 'Chưa thuộc'}
                  </span>
                </div>

                {/* Vocabulary word + pronunciation directly underneath */}
                <div className="my-auto flex flex-col items-center justify-center px-4 space-y-2">
                  <div className="flex items-center justify-center gap-2.5 max-w-full">
                    <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight break-words">
                      {currentCard?.term}
                    </h2>
                    {currentCard?.term && (
                      <button
                        type="button"
                        onClick={(e) => handleSpeak(e, currentCard.term)}
                        aria-label="Phát âm từ vựng"
                        title="Nghe phát âm"
                        className={`shrink-0 p-2 rounded-xl transition-all active:scale-95 cursor-pointer border ${
                          isSpeaking
                            ? 'text-emerald-700 bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20'
                            : 'text-slate-500 hover:text-emerald-700 hover:bg-emerald-50/70 border-slate-200 hover:border-emerald-200'
                        }`}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {currentCard?.phonetic && (
                    <p className="text-sm font-mono text-slate-500 bg-slate-50 px-3 py-1 rounded-lg border border-slate-200/80">
                      {currentCard.phonetic}
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-center gap-1.5">
                  <div className="w-8 h-1 bg-slate-200 rounded-full" />
                  <div className="text-xs text-slate-400 font-medium flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Nhấn để lật xem nghĩa
                  </div>
                </div>
              </div>

              {/* BACK SIDE */}
              <div
                className="absolute inset-0 w-full h-full bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 flex flex-col justify-between items-center text-center shadow-xs hover:shadow-md transition-shadow select-none"
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                }}
              >
                <div className="w-full flex items-center justify-between text-xs">
                  <span className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                    MẶT SAU
                  </span>
                  <span
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border ${
                      currentCard?.isMastered
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    {currentCard?.isMastered ? 'Đã thuộc' : 'Chưa thuộc'}
                  </span>
                </div>

                {/* Vietnamese Meaning main text + word & IPA in smaller muted text underneath */}
                <div className="my-auto flex flex-col items-center justify-center space-y-2.5 px-4">
                  <p className="text-2xl sm:text-3xl font-bold text-slate-900 leading-snug">
                    {currentCard?.definition}
                  </p>
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <p className="text-xs sm:text-sm text-slate-600 font-medium">
                      {currentCard?.term}{' '}
                      {currentCard?.phonetic ? `· ${currentCard.phonetic}` : ''}
                    </p>
                    {currentCard?.term && (
                      <button
                        type="button"
                        onClick={(e) => handleSpeak(e, currentCard.term)}
                        aria-label="Phát âm từ vựng"
                        title="Nghe phát âm"
                        className={`shrink-0 p-1.5 rounded-lg transition-all active:scale-95 cursor-pointer border ${
                          isSpeaking
                            ? 'text-emerald-700 bg-emerald-50 border-emerald-300'
                            : 'text-slate-500 hover:text-emerald-700 hover:bg-emerald-50/70 border-slate-200'
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-center gap-1.5">
                  <div className="w-8 h-1 bg-slate-200 rounded-full" />
                  <div className="text-xs text-slate-400 font-medium flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Nhấn để quay lại mặt trước
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Action Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full max-w-2xl mx-auto pt-2">
            <Button
              type="default"
              size="large"
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className="w-full"
            >
              ← Trước
            </Button>

            <button
              type="button"
              onClick={() => handleMarkStatus(false)}
              className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold transition-all cursor-pointer bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/80 active:scale-[0.98] shadow-2xs"
            >
              Chưa thuộc
            </button>

            <button
              type="button"
              onClick={() => handleMarkStatus(true)}
              className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold transition-all cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-600 active:scale-[0.98] shadow-xs"
            >
              Đã thuộc
            </button>

            <Button
              type="default"
              size="large"
              onClick={handleNext}
              className="w-full"
            >
              Tiếp theo →
            </Button>
          </div>

          {/* Keyboard Shortcuts Helper */}
          <div className="text-center text-xs text-slate-400 pt-2 font-medium">
            <kbd className="bg-slate-100 border border-slate-300 text-slate-700 px-2 py-0.5 rounded-md text-[11px] font-mono mr-1 shadow-2xs">
              Space
            </kbd>{' '}
            Lật thẻ •{' '}
            <kbd className="bg-slate-100 border border-slate-300 text-slate-700 px-2 py-0.5 rounded-md text-[11px] font-mono mx-1 shadow-2xs">
              ←
            </kbd>{' '}
            Thẻ trước •{' '}
            <kbd className="bg-slate-100 border border-slate-300 text-slate-700 px-2 py-0.5 rounded-md text-[11px] font-mono mx-1 shadow-2xs">
              →
            </kbd>{' '}
            Thẻ tiếp theo
          </div>
        </div>
      )}

      {/* Speech Notification Toast */}
      {speechNotice && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/95 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg z-50 transition-all pointer-events-none border border-slate-700/50">
          {speechNotice}
        </div>
      )}
    </div>
  );
}
