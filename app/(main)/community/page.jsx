'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/src/lib/supabaseClient';
import { useAuth } from '@/src/context/AuthContext';
import { usePresence } from '@/src/context/PresenceContext';
import { Button, Input, Empty } from '@/src/components/common';

/**
 * Fallback display name extraction with strict priority:
 * profile.full_name -> profile.display_name -> profile.username -> authUserMeta.full_name -> null
 */
function getCreatorDisplayName(profileObj, authUserMeta) {
  if (profileObj) {
    const fullName = typeof profileObj.full_name === 'string' ? profileObj.full_name.trim() : '';
    if (fullName) return fullName;

    const displayName = typeof profileObj.display_name === 'string' ? profileObj.display_name.trim() : '';
    if (displayName) return displayName;

    const username = typeof profileObj.username === 'string' ? profileObj.username.trim() : '';
    if (username) return username;
  }

  if (authUserMeta) {
    const metaName = typeof authUserMeta.full_name === 'string' ? authUserMeta.full_name.trim() : '';
    if (metaName) return metaName;

    const name = typeof authUserMeta.name === 'string' ? authUserMeta.name.trim() : '';
    if (name) return name;
  }

  return null;
}

/**
 * Extract 2-letter uppercase initials for avatar
 * e.g., "Phúc Dương" -> "PD", "Bảo Long" -> "BL", "Alex" -> "AL"
 */
function getInitials(name) {
  if (!name || typeof name !== 'string') return 'LL';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const BASELINE_LEARNERS = [
  {
    id: 'base-1',
    name: 'Bảo Long',
    wordsLearned: 145,
    quizzesTaken: 18,
    avgScorePct: 92,
    level: 24,
  },
  {
    id: 'base-2',
    name: 'Khánh Vy',
    wordsLearned: 110,
    quizzesTaken: 14,
    avgScorePct: 85,
    level: 20,
  },
  {
    id: 'base-3',
    name: 'Minh Anh',
    wordsLearned: 85,
    quizzesTaken: 10,
    avgScorePct: 78,
    level: 16,
  },
];

export default function Community() {
  const router = useRouter();
  const { user } = useAuth();
  const { isUserOnline } = usePresence();

  // Primary tab is 'leaderboard'
  const [activeTab, setActiveTab] = useState('leaderboard'); // 'leaderboard' | 'public_sets'
  const [loading, setLoading] = useState(true);

  // Public Sets State
  const [publicSets, setPublicSets] = useState([]);
  const [searchSetQuery, setSearchSetQuery] = useState('');
  const [savingSetId, setSavingSetId] = useState(null);

  // Leaderboard State
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    async function fetchCommunityData() {
      setLoading(true);

      try {
        // 1. Fetch real profiles directly from public.profiles table (NO phone fields selected - SEC-03)
        const { data: profilesData, error: profilesErr } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url');

        if (profilesErr) {
          console.error('[Community] Error fetching profiles:', profilesErr);
        }

        const userProfiles = profilesData || [];
        const profilesMap = {};

        userProfiles.forEach((p) => {
          if (p && p.id) {
            profilesMap[p.id] = p;
          }
        });

        // Add current user to map if missing from DB table
        if (user && user.id && !profilesMap[user.id]) {
          profilesMap[user.id] = {
            id: user.id,
            full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Bạn',
            avatar_url: user.user_metadata?.avatar_url || null,
          };
        }

        // 2. Fetch public flashcard sets
        const { data: setsData, error: setsErr } = await supabase
          .from('flashcard_sets')
          .select('*, flashcards(*)')
          .eq('visibility', 'public')
          .order('created_at', { ascending: false });

        if (setsErr) {
          console.error('[Community] Error fetching public sets:', setsErr);
        }

        if (setsData) {
          const formattedPublicSets = setsData.map((s) => {
            const cards = s.flashcards || [];
            const creatorProfile = profilesMap[s.user_id];
            const authMeta = user && s.user_id === user.id ? user.user_metadata : null;
            const resolvedName = getCreatorDisplayName(creatorProfile, authMeta);
            const creatorName = resolvedName || 'Người học LeafLearn';
            const creatorAvatar = creatorProfile?.avatar_url || authMeta?.avatar_url || null;

            return {
              id: s.id,
              title: s.name || s.title || 'Bộ thẻ',
              description: s.description || '',
              totalCards: cards.length,
              userId: s.user_id,
              creatorName,
              creatorAvatar,
              raw: s,
              flashcards: cards,
            };
          });

          setPublicSets(formattedPublicSets);
        }

        // 3. Fetch Flashcards & Quizzes to compile live accurate statistics
        const { data: allSetsData } = await supabase
          .from('flashcard_sets')
          .select('id, user_id, flashcards(*)');

        const { data: allResultsData } = await supabase
          .from('quiz_results')
          .select('user_id, score, total_questions');

        // Build list of all user entries
        const allUserEntries = Object.values(profilesMap);

        const compiled = allUserEntries.map((p) => {
          const uId = p.id;
          const authMeta = user && p.id === user.id ? user.user_metadata : null;
          const displayName = getCreatorDisplayName(p, authMeta) || 'Người học LeafLearn';

          let wordsLearned = 0;
          (allSetsData || [])
            .filter((s) => s.user_id === uId)
            .forEach((s) => {
              const cards = s.flashcards || [];
              cards.forEach((c) => {
                if (c.learning_status === 'learned' || c.learning_status === 'mastered') {
                  wordsLearned += 1;
                }
              });
            });

          const userResults = (allResultsData || []).filter((r) => r.user_id === uId);
          const quizzesTaken = userResults.length;

          let totalScorePct = 0;
          userResults.forEach((r) => {
            const pct = r.total_questions > 0 ? (r.score / r.total_questions) * 100 : 0;
            totalScorePct += pct;
          });

          const avgScorePct = quizzesTaken > 0 ? Math.round(totalScorePct / quizzesTaken) : 0;
          const level = Math.max(1, Math.floor(wordsLearned / 5) + quizzesTaken * 2);

          return {
            id: uId,
            name: displayName,
            wordsLearned,
            quizzesTaken,
            avgScorePct,
            level,
          };
        });

        // Ensure at least 3 learners exist for the Top 3 Podium
        let finalLeaderboard = [...compiled];
        if (finalLeaderboard.length < 3) {
          BASELINE_LEARNERS.forEach((baseline) => {
            if (
              finalLeaderboard.length < 3 &&
              !finalLeaderboard.some((u) => u.id === baseline.id || u.name === baseline.name)
            ) {
              finalLeaderboard.push(baseline);
            }
          });
        }

        // Rank by avgScorePct descending, then wordsLearned descending, then quizzesTaken descending
        finalLeaderboard.sort((a, b) => {
          if (b.avgScorePct !== a.avgScorePct) {
            return b.avgScorePct - a.avgScorePct;
          }
          if (b.wordsLearned !== a.wordsLearned) {
            return b.wordsLearned - a.wordsLearned;
          }
          return b.quizzesTaken - a.quizzesTaken;
        });

        setLeaderboard(finalLeaderboard);
      } catch (err) {
        console.error('Fetch community data exception:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchCommunityData();
  }, [user]);

  // Clone/Save Public Set to User's Personal Library
  const handleSaveToLibrary = async (set) => {
    if (!user) {
      alert('Vui lòng đăng nhập để lưu bộ thẻ vào thư viện.');
      return;
    }

    setSavingSetId(set.id);
    try {
      const { data: newSet, error: setErr } = await supabase
        .from('flashcard_sets')
        .insert({
          name: `${set.title} (Bản sao)`,
          description: set.description || '',
          user_id: user.id,
          visibility: 'private',
        })
        .select()
        .single();

      if (setErr || !newSet) {
        console.error('Error creating copied set:', setErr);
        alert(`Không thể lưu bộ thẻ: ${setErr?.message || 'Lỗi server'}`);
        return;
      }

      const cardsToCopy = set.flashcards || [];
      if (cardsToCopy.length > 0) {
        const payload = cardsToCopy.map((c) => ({
          set_id: newSet.id,
          word: c.word || c.term || '',
          pronunciation: c.pronunciation || c.phonetic || '',
          meaning: c.meaning || c.definition || '',
          part_of_speech: c.part_of_speech || 'noun',
          learning_status: 'unlearned',
        }));

        const { error: cardsErr } = await supabase.from('flashcards').insert(payload);
        if (cardsErr) {
          console.error('Error copying cards:', cardsErr);
        }
      }

      alert('Đã lưu bộ thẻ vào thư viện cá nhân của bạn.');
      router.push(`/flashcard/${newSet.id}`);
    } catch (err) {
      console.error('Save to library error:', err);
      alert('Đã xảy ra lỗi khi lưu bộ thẻ.');
    } finally {
      setSavingSetId(null);
    }
  };

  const filteredPublicSets = useMemo(() => {
    return publicSets.filter(
      (set) =>
        set.title.toLowerCase().includes(searchSetQuery.toLowerCase()) ||
        set.description.toLowerCase().includes(searchSetQuery.toLowerCase()) ||
        set.creatorName.toLowerCase().includes(searchSetQuery.toLowerCase())
    );
  }, [publicSets, searchSetQuery]);

  // Current dynamic month/year string: "tháng 10, 2026"
  const currentMonthTitle = useMemo(() => {
    const now = new Date();
    return `tháng ${now.getMonth() + 1}, ${now.getFullYear()}`;
  }, []);

  const top3 = useMemo(() => leaderboard.slice(0, 3), [leaderboard]);

  return (
    <div className="max-w-5xl mx-auto space-y-6 w-full font-sans">
      {/* 1. Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/60">
        <div className="space-y-0.5">
          <p className="text-xs text-slate-400 font-medium tracking-wide">
            Bảng xếp hạng người học — {currentMonthTitle}
          </p>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Cộng đồng LeafLearn
          </h1>
        </div>

        {/* Minimalist Sub-navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl text-xs font-semibold self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('leaderboard')}
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'leaderboard'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Bảng xếp hạng
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('public_sets')}
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'public_sets'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Bộ thẻ chia sẻ ({publicSets.length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-24 text-center max-w-md mx-auto px-4">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-solid border-emerald-600 border-r-transparent"></div>
          <p className="mt-4 text-sm font-medium text-slate-500">
            Đang tải dữ liệu cộng đồng...
          </p>
        </div>
      ) : activeTab === 'leaderboard' ? (
        <div className="space-y-6">
          {/* 2. Top 3 Podium Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {top3.map((item, idx) => {
              const rank = idx + 1;
              const isMe = user && item.id === user.id;

              let badgeBg = 'bg-amber-500 text-white';
              if (rank === 2) badgeBg = 'bg-slate-400 text-white';
              if (rank === 3) badgeBg = 'bg-[#b45309] text-white';

              return (
                <div
                  key={item.id}
                  className={`relative rounded-2xl p-5 sm:p-6 text-center transition-all flex flex-col justify-between ${
                    isMe
                      ? 'border-2 border-[#2d6a4f]/70 bg-white shadow-sm'
                      : 'border border-slate-200/80 bg-white shadow-xs hover:border-slate-300'
                  }`}
                >
                  {isMe && (
                    <span className="absolute top-3.5 right-3.5 bg-[#2d6a4f] text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                      Bạn
                    </span>
                  )}

                  <div>
                    {/* Initials Avatar */}
                    <div className="relative inline-block mx-auto mb-3">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#2d6a4f] text-white font-bold text-lg sm:text-xl flex items-center justify-center shadow-xs select-none">
                        {getInitials(item.name)}
                      </div>
                      <span
                        className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black border-2 border-white shadow-2xs ${badgeBg}`}
                      >
                        #{rank}
                      </span>
                    </div>

                    {/* Name & Level */}
                    <h3 className="font-bold text-slate-800 text-base sm:text-lg truncate max-w-[180px] mx-auto">
                      {item.name}
                    </h3>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">
                      Level {item.level}
                    </p>
                  </div>

                  {/* Percentage Stat */}
                  <div className="my-4">
                    <div className="text-3xl sm:text-4xl font-extrabold text-slate-800 tracking-tight font-mono">
                      {item.avgScorePct}%
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 font-normal">
                      điểm trung bình
                    </p>
                  </div>

                  {/* Summary Stats */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-500">
                    <span>
                      <strong className="text-slate-700 font-semibold">{item.wordsLearned}</strong> từ đã học
                    </span>
                    <span className="text-slate-300">•</span>
                    <span>
                      <strong className="text-slate-700 font-semibold">{item.quizzesTaken}</strong> quiz
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 3. Full Leaderboard Table */}
          <div className="bg-white rounded-2xl border border-slate-200/70 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[620px]">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-semibold text-[#8c6b4f] uppercase tracking-wider">
                    <th className="py-3.5 px-6 w-16 text-center">#</th>
                    <th className="py-3.5 px-6">NGƯỜI DÙNG</th>
                    <th className="py-3.5 px-6 text-center">LEVEL</th>
                    <th className="py-3.5 px-6 text-center">TỪ ĐÃ HỌC</th>
                    <th className="py-3.5 px-6 text-center">QUIZ</th>
                    <th className="py-3.5 px-6 text-right">ĐIỂM TB</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80 text-xs sm:text-sm">
                  {leaderboard.map((item, idx) => {
                    const rank = idx + 1;
                    const isMe = user && item.id === user.id;

                    return (
                      <tr
                        key={item.id}
                        className={`transition-colors hover:bg-slate-50/80 ${
                          isMe ? 'bg-[#f4f7f5]' : ''
                        }`}
                      >
                        {/* Rank */}
                        <td className="py-4 px-6 text-center font-mono font-semibold text-slate-500">
                          {rank <= 3 ? (
                            <span
                              className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white ${
                                rank === 1
                                  ? 'bg-amber-500'
                                  : rank === 2
                                  ? 'bg-slate-400'
                                  : 'bg-[#b45309]'
                              }`}
                            >
                              {rank}
                            </span>
                          ) : (
                            <span>{rank}</span>
                          )}
                        </td>

                        {/* User */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#2d6a4f] text-white font-bold text-xs flex items-center justify-center shrink-0 select-none">
                              {getInitials(item.name)}
                            </div>
                            <div className="flex items-center">
                              <span className="font-semibold text-slate-800 text-sm truncate max-w-[200px] sm:max-w-[260px]">
                                {item.name}
                              </span>
                              {isMe && (
                                <span className="bg-[#2d6a4f] text-white text-[10px] px-2 py-0.5 rounded-full font-bold ml-2 shrink-0">
                                  Bạn
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Level */}
                        <td className="py-4 px-6 text-center font-mono font-medium text-slate-700">
                          Level {item.level}
                        </td>

                        {/* Words Learned */}
                        <td className="py-4 px-6 text-center font-mono font-medium text-slate-700">
                          {item.wordsLearned}
                        </td>

                        {/* Quiz Count */}
                        <td className="py-4 px-6 text-center font-mono font-medium text-slate-700">
                          {item.quizzesTaken}
                        </td>

                        {/* Average Score */}
                        <td className="py-4 px-6 text-right">
                          <span className="font-bold text-emerald-700 font-mono text-sm sm:text-base">
                            {item.avgScorePct}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* TAB: PUBLIC FLASHCARD SETS */
        <div className="space-y-5">
          <Input
            value={searchSetQuery}
            onChange={(e) => setSearchSetQuery(e.target.value)}
            placeholder="Tìm kiếm bộ Flashcard hoặc tác giả..."
            allowClear
            onClear={() => setSearchSetQuery('')}
            prefix={
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
          />

          {filteredPublicSets.length === 0 ? (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-8 text-center shadow-xs">
              <Empty
                title={searchSetQuery ? 'Không tìm thấy bộ thẻ phù hợp' : 'Chưa có bộ thẻ công khai nào'}
                description={
                  searchSetQuery
                    ? 'Thử tìm kiếm với từ khóa khác.'
                    : 'Hãy là người đầu tiên chia sẻ bộ thẻ của bạn với cộng đồng!'
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredPublicSets.map((set) => {
                const isMine = user && set.userId === user.id;
                const creatorOnline = isUserOnline(set.userId);

                return (
                  <div
                    key={set.id}
                    className="bg-white border border-slate-200/80 rounded-2xl p-5 hover:border-emerald-500/50 hover:shadow-md transition-all space-y-4 flex flex-col justify-between shadow-xs"
                  >
                    <div className="space-y-3">
                      {/* Author Row */}
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          href={`/users/${set.userId}`}
                          className="inline-flex items-center gap-2.5 group text-xs font-semibold text-slate-600 hover:text-emerald-700"
                        >
                          <div className="relative shrink-0">
                            {set.creatorAvatar ? (
                              <img
                                src={set.creatorAvatar}
                                alt={set.creatorName}
                                className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                              />
                            ) : (
                              <span className="w-8 h-8 rounded-full bg-[#2d6a4f] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                                {getInitials(set.creatorName)}
                              </span>
                            )}
                            {creatorOnline && (
                              <span
                                className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white"
                                title="Đang hoạt động"
                              />
                            )}
                          </div>
                          <span className="text-sm font-semibold text-slate-800 group-hover:text-emerald-700 truncate max-w-[150px]">
                            {set.creatorName} {isMine && <span className="text-xs text-emerald-600 font-normal">(Bạn)</span>}
                          </span>
                        </Link>

                        <span className="px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                          {set.totalCards} thẻ
                        </span>
                      </div>

                      {/* Set Title */}
                      <h3 className="font-bold text-base sm:text-lg text-slate-900 truncate leading-tight pt-1">
                        {set.title}
                      </h3>

                      {/* Set Description */}
                      <p className="text-xs sm:text-sm text-slate-500 line-clamp-2 leading-relaxed">
                        {set.description || 'Chưa có mô tả cho bộ thẻ này.'}
                      </p>
                    </div>

                    {/* Footer Card Actions */}
                    <div className="flex items-center gap-2.5 pt-3 border-t border-slate-100">
                      <Link href={`/flashcard/${set.id}`} className="flex-1">
                        <Button type="default" size="middle" block>
                          Xem bộ thẻ
                        </Button>
                      </Link>

                      {!isMine && (
                        <div className="flex-1">
                          <Button
                            type="primary"
                            size="middle"
                            block
                            onClick={() => handleSaveToLibrary(set)}
                            loading={savingSetId === set.id}
                          >
                            + Lưu thư viện
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
