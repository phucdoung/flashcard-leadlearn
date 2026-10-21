'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/src/lib/supabaseClient';
import { useAuth } from '@/src/context/AuthContext';
import { Tag } from '@/src/components/common';

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
    <div className="max-w-4xl mx-auto space-y-6 w-full">
      {/* Heading Section */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Thống kê học tập
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Theo dõi tiến độ học từ vựng và kết quả bài kiểm tra của bạn.
        </p>
      </div>

      {loading ? (
        <div className="py-24 text-center max-w-md mx-auto px-4">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-solid border-emerald-600 border-r-transparent"></div>
          <p className="mt-4 text-sm font-medium text-slate-500">
            Đang tải dữ liệu thống kê...
          </p>
        </div>
      ) : (
        <>
          {/* 5 Minimalist Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {/* Card 1: Tổng số bộ thẻ */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 text-center shadow-xs space-y-1 hover:shadow-sm transition-shadow">
              <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Tổng bộ thẻ</span>
              <span className="text-2xl sm:text-3xl font-bold text-slate-900 block font-mono">
                {stats.totalSets}
              </span>
            </div>

            {/* Card 2: Tổng số từ */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 text-center shadow-xs space-y-1 hover:shadow-sm transition-shadow">
              <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Tổng số từ</span>
              <span className="text-2xl sm:text-3xl font-bold text-slate-900 block font-mono">
                {stats.totalCards}
              </span>
            </div>

            {/* Card 3: Đã thuộc */}
            <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4 text-center shadow-xs space-y-1 hover:shadow-sm transition-shadow">
              <span className="block text-xs font-semibold text-emerald-800 uppercase tracking-wider">Đã thuộc</span>
              <span className="text-2xl sm:text-3xl font-bold text-emerald-700 block font-mono">
                {stats.masteredCards}
              </span>
            </div>

            {/* Card 4: Chưa thuộc */}
            <div className="bg-rose-50/60 border border-rose-200/80 rounded-2xl p-4 text-center shadow-xs space-y-1 hover:shadow-sm transition-shadow">
              <span className="block text-xs font-semibold text-rose-800 uppercase tracking-wider">Chưa thuộc</span>
              <span className="text-2xl sm:text-3xl font-bold text-rose-700 block font-mono">
                {stats.unmasteredCards}
              </span>
            </div>

            {/* Card 5: Bài kiểm tra */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 text-center shadow-xs space-y-1 hover:shadow-sm transition-shadow">
              <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Bài kiểm tra</span>
              <span className="text-2xl sm:text-3xl font-bold text-slate-900 block font-mono">
                {stats.totalQuizzes}
              </span>
            </div>
          </div>

          {/* Overall Progress Section */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-7 shadow-xs space-y-4">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">Tiến độ tổng thể</h2>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="font-semibold text-slate-600">
                  Đã thuộc {stats.masteredCards} / {stats.totalCards} từ
                </span>
                <span className="font-bold text-emerald-600 font-mono text-base">{progress}%</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-600 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Recent Quizzes Section (If results exist) */}
          {recentResults.length > 0 && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-7 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Kết quả bài kiểm tra gần nhất
                </h2>
                {stats.avgScore !== null && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Điểm TB: {stats.avgScore}%
                  </span>
                )}
              </div>

              <div className="space-y-2.5">
                {recentResults.map((res) => (
                  <Link
                    key={res.id}
                    href={`/result/${res.id}?details=true`}
                    className="flex items-center justify-between p-3.5 sm:p-4 rounded-xl bg-slate-50/70 hover:bg-emerald-50/40 border border-slate-200/80 hover:border-emerald-300 text-xs sm:text-sm transition-all group cursor-pointer shadow-2xs"
                  >
                    <span className="font-semibold text-slate-800 group-hover:text-emerald-700 truncate flex-1 pr-3 transition-colors">
                      {res.title}
                    </span>
                    <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {res.score} / {res.totalQuestions}
                      </span>
                      <span className="text-slate-400 text-xs font-mono hidden sm:inline-block">
                        {res.date}
                      </span>
                      <span className="text-xs font-semibold text-emerald-600 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
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
