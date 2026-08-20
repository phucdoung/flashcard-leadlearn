import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

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
    <div className="py-1 px-4 max-w-4xl mx-auto space-y-4">
      {/* Header Container */}
      <div className="bg-white border border-[#E7EEDC] rounded-2xl p-5 sm:p-6 space-y-3 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <Link
              to={`/flashcard/${id}`}
              className="inline-flex items-center text-xs font-medium text-[#6B7665] hover:text-[#2E3A28] bg-white border border-[#E7EEDC] px-3 py-1 rounded-xl transition-all hover:border-[#A8D672] mb-1.5 shadow-2xs"
            >
              Quay lại bộ Flashcard
            </Link>
            <h1 className="text-2xl font-bold text-[#2E3A28]">
              {setDetail?.title || 'Bộ thẻ'}
            </h1>
          </div>

          {!isCompleted && totalCards > 0 && (
            <div className="shrink-0">
              <span className="text-xs font-bold text-[#2E3A28] bg-[#F8FCF4] border border-[#E7EEDC] px-4 py-2 rounded-full">
                Thẻ {currentIndex + 1} / {totalCards}
              </span>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[#E7EEDC]/80 h-2 rounded-full overflow-hidden">
          <div
            className="bg-[#A8D672] h-full transition-all duration-300 rounded-full"
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
        <div className="py-16 text-center text-sm text-[#6B7665] font-medium animate-pulse">
          Đang tải dữ liệu thẻ từ Supabase...
        </div>
      ) : totalCards === 0 ? (
        <div className="bg-white border border-[#E7EEDC] rounded-2xl p-10 text-center space-y-4 max-w-xl mx-auto shadow-2xs">
          <h2 className="text-xl font-bold text-[#2E3A28]">
            Bộ thẻ này chưa có Flashcard nào
          </h2>
          <p className="text-xs text-[#6B7665]">
            Vui lòng quay lại danh sách và thêm từ vựng mới để bắt đầu học.
          </p>
          <Link
            to={`/flashcard/${id}`}
            className="inline-flex items-center py-2.5 px-5 rounded-xl bg-[#A8D672] hover:bg-[#97C95E] text-xs font-semibold text-[#2E3A28] transition-all"
          >
            Tạo từ mới ngay
          </Link>
        </div>
      ) : isCompleted ? (
        /* Completion Panel */
        <div className="bg-white border border-[#E7EEDC] rounded-2xl p-8 sm:p-10 text-center space-y-6 max-w-lg mx-auto shadow-2xs">
          <div className="space-y-2">
            <span className="inline-block text-xs font-bold text-[#5B9E60] bg-[#5B9E60]/10 border border-[#5B9E60]/30 px-3 py-1 rounded-full uppercase tracking-wider">
              Hoàn thành
            </span>
            <h2 className="text-2xl font-bold text-[#2E3A28]">
              Bạn đã hoàn thành bộ Flashcard
            </h2>
            <p className="text-xs text-[#6B7665]">
              Tuyệt vời! Bạn đã xem qua toàn bộ {totalCards} thẻ ghi nhớ.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="bg-[#F8FCF4] border border-[#E7EEDC] rounded-xl p-4">
              <span className="block text-xs text-[#6B7665]">Đã thuộc</span>
              <span className="text-2xl font-bold text-[#5B9E60] mt-1 block">
                {masteredCount}
              </span>
            </div>
            <div className="bg-[#F8FCF4] border border-[#E7EEDC] rounded-xl p-4">
              <span className="block text-xs text-[#6B7665]">Chưa thuộc</span>
              <span className="text-2xl font-bold text-[#E57373] mt-1 block">
                {unmasteredCount}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleRestart}
              className="w-full sm:flex-1 h-[42px] rounded-xl bg-[#A8D672] hover:bg-[#97C95E] text-sm font-semibold text-[#2E3A28] transition-all shadow-2xs active:scale-[0.98] cursor-pointer"
            >
              Học lại
            </button>
            <Link
              to={`/flashcard/${id}`}
              className="w-full sm:flex-1 h-[42px] rounded-xl bg-white border border-[#E7EEDC] hover:bg-[#F8FCF4] text-sm font-medium text-[#2E3A28] transition-all flex items-center justify-center active:scale-[0.98]"
            >
              Quay lại bộ Flashcard
            </Link>
          </div>
        </div>
      ) : (
        /* Active Study Flashcard Layout */
        <div className="space-y-4">
          {/* Flashcard Card: Compact 320px–360px height */}
          <div className="w-full max-w-2xl mx-auto" style={{ perspective: '1000px' }}>
            <div
              onClick={() => setIsFlipped(!isFlipped)}
              className="relative w-full h-[320px] sm:h-[350px] cursor-pointer rounded-2xl transition-all duration-300 hover:-translate-y-0.5"
              style={{
                transformStyle: 'preserve-3d',
                transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              }}
            >
              {/* FRONT SIDE */}
              <div
                className="absolute inset-0 w-full h-full bg-white border border-[#E7EEDC] rounded-2xl p-6 sm:p-8 flex flex-col justify-between items-center text-center shadow-2xs hover:shadow-xs transition-shadow select-none"
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                }}
              >
                <div className="w-full flex items-center justify-between text-xs text-[#6B7665]">
                  <span className="font-semibold uppercase tracking-wider text-[11px] bg-[#F8FCF4] border border-[#E7EEDC] px-3 py-1 rounded-full text-[#6B7665]">
                    MẶT TRƯỚC
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                      currentCard?.isMastered
                        ? 'bg-[#5B9E60]/10 text-[#5B9E60] border-[#5B9E60]/30'
                        : 'bg-[#E57373]/10 text-[#E57373] border-[#E57373]/30'
                    }`}
                  >
                    {currentCard?.isMastered ? 'Đã thuộc' : 'Chưa thuộc'}
                  </span>
                </div>

                {/* Vocabulary word + pronunciation directly underneath */}
                <div className="my-auto flex flex-col items-center justify-center px-4 space-y-1">
                  <h2 className="text-3xl sm:text-4xl font-bold text-[#2E3A28] tracking-tight">
                    {currentCard?.term}
                  </h2>
                  {currentCard?.phonetic && (
                    <p className="text-sm font-mono text-[#6B7665] mt-1">
                      {currentCard.phonetic}
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-0.5 bg-[#E7EEDC] rounded-full" />
                  <div className="text-[11px] text-[#6B7665] font-medium">
                    Nhấn để lật xem nghĩa
                  </div>
                </div>
              </div>

              {/* BACK SIDE */}
              <div
                className="absolute inset-0 w-full h-full bg-white border border-[#E7EEDC] rounded-2xl p-6 sm:p-8 flex flex-col justify-between items-center text-center shadow-2xs hover:shadow-xs transition-shadow select-none"
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                }}
              >
                <div className="w-full flex items-center justify-between text-xs text-[#6B7665]">
                  <span className="font-semibold uppercase tracking-wider text-[11px] bg-[#F8FCF4] border border-[#E7EEDC] px-3 py-1 rounded-full text-[#6B7665]">
                    MẶT SAU
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                      currentCard?.isMastered
                        ? 'bg-[#5B9E60]/10 text-[#5B9E60] border-[#5B9E60]/30'
                        : 'bg-[#E57373]/10 text-[#E57373] border-[#E57373]/30'
                    }`}
                  >
                    {currentCard?.isMastered ? 'Đã thuộc' : 'Chưa thuộc'}
                  </span>
                </div>

                {/* Vietnamese Meaning main text + word & IPA in smaller muted text underneath */}
                <div className="my-auto flex flex-col items-center justify-center space-y-2 px-4">
                  <p className="text-2xl sm:text-3xl font-bold text-[#2E3A28] leading-snug">
                    {currentCard?.definition}
                  </p>
                  <p className="text-xs sm:text-sm text-[#6B7665] font-medium pt-1">
                    {currentCard?.term}{' '}
                    {currentCard?.phonetic ? `· ${currentCard.phonetic}` : ''}
                  </p>
                </div>

                <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-0.5 bg-[#E7EEDC] rounded-full" />
                  <div className="text-[11px] text-[#6B7665] font-medium">
                    Nhấn để quay lại mặt trước
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Action Buttons */}
          <div className="flex flex-wrap sm:flex-nowrap items-center justify-center gap-3 w-full max-w-2xl mx-auto pt-1">
            <button
              type="button"
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className="flex-1 h-[42px] rounded-xl border border-[#E7EEDC] bg-white text-sm font-semibold text-[#2E3A28] hover:bg-[#F8FCF4] disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98] cursor-pointer inline-flex items-center justify-center px-4"
            >
              Trước
            </button>

            <button
              type="button"
              onClick={() => handleMarkStatus(false)}
              className={`flex-1 h-[42px] rounded-xl border border-[#E57373]/40 bg-white text-[#E57373] hover:bg-[#E57373]/10 text-sm font-semibold transition-all active:scale-[0.98] cursor-pointer inline-flex items-center justify-center px-4 ${
                !currentCard?.isMastered ? 'ring-2 ring-[#E57373]/30 bg-[#E57373]/10' : ''
              }`}
            >
              Chưa thuộc
            </button>

            <button
              type="button"
              onClick={() => handleMarkStatus(true)}
              className="flex-1 h-[42px] rounded-xl bg-[#A8D672] hover:bg-[#97C95E] text-[#2E3A28] text-sm font-bold shadow-2xs transition-all active:scale-[0.98] cursor-pointer inline-flex items-center justify-center px-4"
            >
              Đã thuộc
            </button>

            <button
              type="button"
              onClick={handleNext}
              className="flex-1 h-[42px] rounded-xl border border-[#E7EEDC] bg-white text-sm font-semibold text-[#2E3A28] hover:bg-[#F8FCF4] transition-all active:scale-[0.98] cursor-pointer inline-flex items-center justify-center px-4"
            >
              Tiếp theo
            </button>
          </div>

          {/* Keyboard Shortcuts Helper */}
          <div className="text-center text-[11px] text-[#6B7665]">
            <span className="bg-white border border-[#E7EEDC] px-2 py-0.5 rounded-md font-mono mr-1">
              Phím cách
            </span>{' '}
            Lật thẻ •{' '}
            <span className="bg-white border border-[#E7EEDC] px-2 py-0.5 rounded-md font-mono mx-1">
              ←
            </span>{' '}
            Thẻ trước •{' '}
            <span className="bg-white border border-[#E7EEDC] px-2 py-0.5 rounded-md font-mono mx-1">
              →
            </span>{' '}
            Thẻ tiếp theo
          </div>
        </div>
      )}
    </div>
  );
}
