import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';

export default function Statistics() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalSets: 0,
    totalCards: 0,
    masteredCards: 0,
    unmasteredCards: 0,
    totalQuizzes: 0,
    avgScore: null,
  });
  const [recentResults, setRecentResults] = useState([]);

  useEffect(() => {
    async function fetchStatistics() {
      if (!user) return;
      setLoading(true);

      try {
        // 1. Fetch user's flashcard sets, flashcards, and quizzes
        const { data: setsData } = await supabase
          .from('flashcard_sets')
          .select('*, flashcards(*), quizzes(*)');

        let totalSets = 0;
        let totalCards = 0;
        let masteredCards = 0;
        let totalQuizzes = 0;

        if (setsData) {
          totalSets = setsData.length;
          setsData.forEach((set) => {
            const cards = set.flashcards || [];
            totalCards += cards.length;
            cards.forEach((c) => {
              if (c.learning_status === 'learned' || c.learning_status === 'mastered') {
                masteredCards += 1;
              }
            });
            const quizzes = set.quizzes || [];
            totalQuizzes += quizzes.length;
          });
        }

        const unmasteredCards = Math.max(0, totalCards - masteredCards);

        // 2. Fetch user's quiz_results for recent test scores & average score
        const { data: resultsData } = await supabase
          .from('quiz_results')
          .select('*, quizzes(title)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);

        let avgScore = null;
        let formattedResults = [];

        if (resultsData && resultsData.length > 0) {
          let sumPct = 0;
          resultsData.forEach((r) => {
            const total = r.total_questions || 10;
            const pct = (r.score / total) * 100;
            sumPct += pct;
          });
          avgScore = Math.round(sumPct / resultsData.length);

          formattedResults = resultsData.map((r) => {
            const dateObj = new Date(r.created_at);
            const formattedDate = dateObj.toLocaleDateString('vi-VN', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            });

            return {
              id: r.id,
              title: r.quizzes?.title || 'Bài kiểm tra từ vựng',
              score: r.score,
              totalQuestions: r.total_questions,
              date: formattedDate,
            };
          });
        }

        setStats({
          totalSets,
          totalCards,
          masteredCards,
          unmasteredCards,
          totalQuizzes,
          avgScore,
        });
        setRecentResults(formattedResults);
      } catch (err) {
        console.error('Error fetching statistics:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchStatistics();
  }, [user]);

  const progress =
    stats.totalCards > 0
      ? Math.min(100, Math.round((stats.masteredCards / stats.totalCards) * 100))
      : 0;

  return (
    <div className="py-2 px-4 max-w-4xl mx-auto space-y-6 w-full">
      {/* Heading Section */}
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold text-[#2E3A28]">
          Thống kê học tập
        </h1>
        <p className="text-xs sm:text-sm text-[#6B7665]">
          Theo dõi tiến độ học từ vựng của bạn.
        </p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-[#6B7665] font-medium animate-pulse">
          Đang tải dữ liệu thống kê...
        </div>
      ) : (
        <>
          {/* 5 Minimalist Stat Cards - NO ICONS */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {/* Card 1: Tổng số bộ thẻ */}
            <div className="bg-white border border-[#E7EEDC] rounded-2xl p-4 text-center shadow-2xs space-y-1">
              <span className="block text-xs font-medium text-[#6B7665]">Tổng số bộ thẻ</span>
              <span className="text-2xl font-bold text-[#2E3A28] block">
                {stats.totalSets}
              </span>
            </div>

            {/* Card 2: Tổng số từ */}
            <div className="bg-white border border-[#E7EEDC] rounded-2xl p-4 text-center shadow-2xs space-y-1">
              <span className="block text-xs font-medium text-[#6B7665]">Tổng số từ</span>
              <span className="text-2xl font-bold text-[#2E3A28] block">
                {stats.totalCards}
              </span>
            </div>

            {/* Card 3: Đã thuộc */}
            <div className="bg-white border border-[#5B9E60]/30 rounded-2xl p-4 text-center shadow-2xs space-y-1 bg-[#5B9E60]/5">
              <span className="block text-xs font-medium text-[#6B7665]">Đã thuộc</span>
              <span className="text-2xl font-bold text-[#5B9E60] block">
                {stats.masteredCards}
              </span>
            </div>

            {/* Card 4: Chưa thuộc */}
            <div className="bg-white border border-[#E57373]/30 rounded-2xl p-4 text-center shadow-2xs space-y-1 bg-[#E57373]/5">
              <span className="block text-xs font-medium text-[#6B7665]">Chưa thuộc</span>
              <span className="text-2xl font-bold text-[#E57373] block">
                {stats.unmasteredCards}
              </span>
            </div>

            {/* Card 5: Bài kiểm tra */}
            <div className="bg-white border border-[#E7EEDC] rounded-2xl p-4 text-center shadow-2xs space-y-1">
              <span className="block text-xs font-medium text-[#6B7665]">Bài kiểm tra</span>
              <span className="text-2xl font-bold text-[#2E3A28] block">
                {stats.totalQuizzes}
              </span>
            </div>
          </div>

          {/* Overall Progress Section */}
          <div className="bg-white border border-[#E7EEDC] rounded-2xl p-5 sm:p-6 shadow-2xs space-y-3">
            <h2 className="text-base font-bold text-[#2E3A28]">Tiến độ tổng thể</h2>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="font-medium text-[#6B7665]">
                  Đã thuộc {stats.masteredCards} / {stats.totalCards} từ
                </span>
                <span className="font-bold text-[#2E3A28]">{progress}%</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-[#E7EEDC]/60 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#A8D672] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Recent Quizzes Section (If results exist) */}
          {recentResults.length > 0 && (
            <div className="bg-white border border-[#E7EEDC] rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#E7EEDC] pb-3">
                <h2 className="text-base font-bold text-[#2E3A28]">
                  Kết quả bài kiểm tra gần nhất
                </h2>
                {stats.avgScore !== null && (
                  <span className="text-xs font-semibold text-[#5B9E60] bg-[#5B9E60]/10 px-2.5 py-1 rounded-full">
                    Điểm TB: {stats.avgScore}%
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {recentResults.map((res) => (
                  <div
                    key={res.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-[#F8FCF4] border border-[#E7EEDC]/70 text-xs sm:text-sm"
                  >
                    <span className="font-semibold text-[#2E3A28] truncate flex-1 pr-2">
                      {res.title}
                    </span>
                    <div className="flex items-center gap-4 shrink-0">
                      <span className="font-bold text-[#5B9E60]">
                        {res.score} / {res.totalQuestions}
                      </span>
                      <span className="text-[#6B7665] text-xs font-mono">{res.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
