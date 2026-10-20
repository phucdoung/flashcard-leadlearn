import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { Tag } from '../../components/common';

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
    <div className="py-4 px-4 max-w-4xl mx-auto space-y-6 w-full">
      {/* Heading Section */}
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold text-[#14261C] tracking-tight">
          Thống kê học tập
        </h1>
        <p className="text-xs sm:text-sm text-[#556551]">
          Theo dõi tiến độ học từ vựng và kết quả kiểm tra của bạn.
        </p>
      </div>

      {loading ? (
        <div className="py-24 text-center max-w-md mx-auto px-4">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-solid border-[#24693D] border-r-transparent"></div>
          <p className="mt-4 text-sm font-medium text-[#556551]">
            Đang tải dữ liệu thống kê...
          </p>
        </div>
      ) : (
        <>
          {/* 5 Minimalist Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Card 1: Tổng số bộ thẻ */}
            <div className="bg-[#F8FCF4] border border-[#DCE5D8] rounded-lg p-4 text-center shadow-xs space-y-1">
              <span className="block text-xs font-medium text-[#556551]">Tổng bộ thẻ</span>
              <span className="text-2xl font-bold text-[#14261C] block">
                {stats.totalSets}
              </span>
            </div>

            {/* Card 2: Tổng số từ */}
            <div className="bg-[#F8FCF4] border border-[#DCE5D8] rounded-lg p-4 text-center shadow-xs space-y-1">
              <span className="block text-xs font-medium text-[#556551]">Tổng số từ</span>
              <span className="text-2xl font-bold text-[#14261C] block">
                {stats.totalCards}
              </span>
            </div>

            {/* Card 3: Đã thuộc */}
            <div className="bg-[#F6FFED] border border-[#B7EB8F] rounded-lg p-4 text-center shadow-xs space-y-1">
              <span className="block text-xs font-semibold text-[#24693D]">Đã thuộc</span>
              <span className="text-2xl font-bold text-[#24693D] block">
                {stats.masteredCards}
              </span>
            </div>

            {/* Card 4: Chưa thuộc */}
            <div className="bg-[#FFF2F0] border border-[#FFA39E] rounded-lg p-4 text-center shadow-xs space-y-1">
              <span className="block text-xs font-semibold text-[#CF1322]">Chưa thuộc</span>
              <span className="text-2xl font-bold text-[#CF1322] block">
                {stats.unmasteredCards}
              </span>
            </div>

            {/* Card 5: Bài kiểm tra */}
            <div className="bg-[#F8FCF4] border border-[#DCE5D8] rounded-lg p-4 text-center shadow-xs space-y-1">
              <span className="block text-xs font-medium text-[#556551]">Bài kiểm tra</span>
              <span className="text-2xl font-bold text-[#14261C] block">
                {stats.totalQuizzes}
              </span>
            </div>
          </div>

          {/* Overall Progress Section */}
          <div className="bg-white border border-[#DCE5D8] rounded-xl p-5 sm:p-6 shadow-xs space-y-3">
            <h2 className="text-base font-bold text-[#14261C]">Tiến độ tổng thể</h2>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="font-medium text-[#556551]">
                  Đã thuộc {stats.masteredCards} / {stats.totalCards} từ
                </span>
                <span className="font-bold text-[#24693D]">{progress}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-[#E8EFE5] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#24693D] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Recent Quizzes Section (If results exist) */}
          {recentResults.length > 0 && (
            <div className="bg-white border border-[#DCE5D8] rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#DCE5D8] pb-3">
                <h2 className="text-base font-bold text-[#14261C]">
                  Kết quả bài kiểm tra gần nhất
                </h2>
                {stats.avgScore !== null && (
                  <Tag color="green">
                    Điểm TB: {stats.avgScore}%
                  </Tag>
                )}
              </div>

              <div className="space-y-2">
                {recentResults.map((res) => (
                  <Link
                    key={res.id}
                    to={`/result/${res.id}?details=true`}
                    className="flex items-center justify-between p-3.5 rounded-lg bg-[#F8FCF4] hover:bg-[#F0F7EE] border border-[#DCE5D8] hover:border-[#24693D]/50 text-xs sm:text-sm transition-colors group cursor-pointer"
                  >
                    <span className="font-semibold text-[#14261C] group-hover:text-[#24693D] truncate flex-1 pr-3 transition-colors">
                      {res.title}
                    </span>
                    <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                      <Tag color="green">
                        {res.score} / {res.totalQuestions}
                      </Tag>
                      <span className="text-[#8C9B86] text-xs font-mono hidden sm:inline-block">
                        {res.date}
                      </span>
                      <span className="text-xs font-semibold text-[#24693D] group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1">
                        <span>Chi tiết</span>
                        <span>&rarr;</span>
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
