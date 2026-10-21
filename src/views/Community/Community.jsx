import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { usePresence } from '../../context/PresenceContext';
import { Button, Input, Tag, Empty } from '../../components/common';

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
  }

  return null;
}

export default function Community() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isUserOnline } = usePresence();

  const [activeTab, setActiveTab] = useState('public_sets'); // 'public_sets' | 'leaderboard' | 'members'
  const [loading, setLoading] = useState(true);

  // Tab 1: Public Sets State
  const [publicSets, setPublicSets] = useState([]);
  const [searchSetQuery, setSearchSetQuery] = useState('');
  const [savingSetId, setSavingSetId] = useState(null);

  // Tab 2 & 3: Leaderboard & Members State
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    async function fetchCommunityData() {
      setLoading(true);

      try {
        // 1. Fetch real profiles directly from public.profiles table
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
            full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Người học LeafLearn',
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

        // 3. Attempt Server-Side RPC Aggregation for Leaderboard
        const { data: rpcLeaderboard, error: rpcErr } = await supabase.rpc('get_community_leaderboard');

        if (!rpcErr && Array.isArray(rpcLeaderboard) && rpcLeaderboard.length > 0) {
          const formatted = rpcLeaderboard.map((item) => {
            const isMe = user && item.id === user.id;
            const authMeta = isMe ? user.user_metadata : null;
            const profileObj = profilesMap[item.id] || { full_name: item.full_name };
            const name = getCreatorDisplayName(profileObj, authMeta) || item.full_name || 'Người học LeafLearn';
            const avatar = item.avatar_url || profileObj?.avatar_url || authMeta?.avatar_url || null;

            return {
              id: item.id,
              name: name,
              avatar: avatar,
              publicSetsCount: Number(item.public_sets_count || 0),
              masteredCards: Number(item.mastered_cards || 0),
              quizCount: Number(item.quiz_count || 0),
              learningScore: Number(item.learning_score || 0),
              avgScorePct: Number(item.avg_score_pct || 0),
            };
          });

          setLeaderboard(formatted);
        } else {
          // Client-Side Fallback Aggregation
          const { data: allSetsData } = await supabase
            .from('flashcard_sets')
            .select('id, user_id, flashcards(*)');

          const { data: allResultsData } = await supabase
            .from('quiz_results')
            .select('*');

          const compiled = userProfiles.map((p) => {
            const uId = p.id;
            const authMeta = user && p.id === user.id ? user.user_metadata : null;
            const displayName = getCreatorDisplayName(p, authMeta) || 'Người học LeafLearn';
            const avatar = p.avatar_url || authMeta?.avatar_url || null;

            const publicSetsCount = (setsData || []).filter((s) => s.user_id === uId).length;

            let masteredCards = 0;
            (allSetsData || [])
              .filter((s) => s.user_id === uId)
              .forEach((s) => {
                const cards = s.flashcards || [];
                cards.forEach((c) => {
                  if (c.learning_status === 'learned' || c.learning_status === 'mastered') {
                    masteredCards += 1;
                  }
                });
              });

            const userResults = (allResultsData || []).filter((r) => r.user_id === uId);
            const quizCount = userResults.length;

            let totalScorePct = 0;
            userResults.forEach((r) => {
              const pct = r.total_questions > 0 ? (r.score / r.total_questions) * 100 : 0;
              totalScorePct += pct;
            });

            const avgScorePct = quizCount > 0 ? totalScorePct / quizCount : 0;
            const learningScore = Math.round(masteredCards * 1 + quizCount * 5 + avgScorePct * 0.5);

            return {
              id: uId,
              name: displayName,
              avatar: avatar,
              publicSetsCount,
              masteredCards,
              quizCount,
              learningScore,
              avgScorePct: Math.round(avgScorePct),
            };
          });

          compiled.sort((a, b) => {
            if (b.learningScore !== a.learningScore) {
              return b.learningScore - a.learningScore;
            }
            return b.masteredCards - a.masteredCards;
          });

          setLeaderboard(compiled);
        }
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
      navigate(`/flashcard/${newSet.id}`);
    } catch (err) {
      console.error('Save to library error:', err);
      alert('Đã xảy ra lỗi khi lưu bộ thẻ.');
    } finally {
      setSavingSetId(null);
    }
  };

  const filteredPublicSets = publicSets.filter(
    (set) =>
      set.title.toLowerCase().includes(searchSetQuery.toLowerCase()) ||
      set.description.toLowerCase().includes(searchSetQuery.toLowerCase()) ||
      set.creatorName.toLowerCase().includes(searchSetQuery.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6 w-full">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-7 space-y-4 shadow-xs">
        <div className="space-y-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
            CỘNG ĐỒNG LEAFLEARN
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Giao lưu, Chia sẻ & Cùng Học Tập
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-2xl">
            Khám phá các bộ Flashcard chia sẻ công khai, thi đua bảng xếp hạng năng động và giữ vững thói quen học tập mỗi ngày.
          </p>
        </div>

        {/* 3 Tabs Navigation Header */}
        <div className="flex border-b border-slate-200 gap-6 sm:gap-8 text-xs sm:text-sm font-semibold pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('public_sets')}
            className={`pb-3.5 relative cursor-pointer focus:outline-none transition-colors ${
              activeTab === 'public_sets' ? 'text-emerald-700 font-bold' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Bộ thẻ cộng đồng ({publicSets.length})
            {activeTab === 'public_sets' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-full" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('leaderboard')}
            className={`pb-3.5 relative cursor-pointer focus:outline-none transition-colors ${
              activeTab === 'leaderboard' ? 'text-emerald-700 font-bold' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Bảng xếp hạng
            {activeTab === 'leaderboard' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-full" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`pb-3.5 relative cursor-pointer focus:outline-none transition-colors ${
              activeTab === 'members' ? 'text-emerald-700 font-bold' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Người học ({leaderboard.length})
            {activeTab === 'members' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-full" />
            )}
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
      ) : (
        <div>
          {/* TAB 1: BỘ THẺ CỘNG ĐỒNG */}
          {activeTab === 'public_sets' && (
            <div className="space-y-5">
              {/* Search Bar */}
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
                              to={`/users/${set.userId}`}
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
                                  <span className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                                    {set.creatorName.charAt(0).toUpperCase()}
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
                          <Link to={`/flashcard/${set.id}`} className="flex-1">
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

          {/* TAB 2: BẢNG XẾP HẠNG */}
          {activeTab === 'leaderboard' && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
              <div className="border-b border-slate-200 pb-3">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                  Bảng Xếp Hạng Động Lực
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Điểm = (Từ đã thuộc × 1) + (Quiz hoàn thành × 5) + (Điểm trung bình Quiz)
                </p>
              </div>

              {leaderboard.length === 0 ? (
                <div className="py-8 text-center text-xs sm:text-sm text-slate-500">
                  Chưa đủ dữ liệu để xếp hạng.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[540px]">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="pb-3 px-3 w-14 text-center">Hạng</th>
                        <th className="pb-3 px-3">Người học</th>
                        <th className="pb-3 px-3 text-center">Từ thuộc</th>
                        <th className="pb-3 px-3 text-center">Quiz làm</th>
                        <th className="pb-3 px-3 text-right">Điểm học tập</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                      {leaderboard.map((member, idx) => {
                        const rank = idx + 1;
                        const isMe = user && member.id === user.id;
                        const online = isUserOnline(member.id);

                        let rankBadge = (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            {rank}
                          </span>
                        );
                        if (rank === 1) {
                          rankBadge = (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold bg-amber-500 text-white shadow-xs">
                              1
                            </span>
                          );
                        } else if (rank === 2) {
                          rankBadge = (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold bg-slate-400 text-white shadow-xs">
                              2
                            </span>
                          );
                        } else if (rank === 3) {
                          rankBadge = (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold bg-amber-700 text-white shadow-xs">
                              3
                            </span>
                          );
                        }

                        return (
                          <tr
                            key={member.id}
                            className={`transition-colors hover:bg-slate-50/70 ${
                              isMe ? 'bg-emerald-50/50 font-semibold' : ''
                            }`}
                          >
                            <td className="py-3.5 px-3 text-center">{rankBadge}</td>
                            <td className="py-3.5 px-3">
                              <Link
                                to={`/users/${member.id}`}
                                className="inline-flex items-center gap-2.5 group focus:outline-none"
                              >
                                <div className="relative shrink-0">
                                  {member.avatar ? (
                                    <img
                                      src={member.avatar}
                                      alt={member.name}
                                      className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                                    />
                                  ) : (
                                    <span className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                                      {member.name.charAt(0).toUpperCase()}
                                    </span>
                                  )}
                                  {online && (
                                    <span
                                      className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white"
                                      title="Đang hoạt động"
                                    />
                                  )}
                                </div>
                                <span className="text-slate-800 group-hover:text-emerald-700 font-semibold text-sm truncate max-w-[140px] sm:max-w-[200px]">
                                  {member.name} {isMe && <span className="text-xs text-emerald-600 font-normal">(Bạn)</span>}
                                </span>
                              </Link>
                            </td>
                            <td className="py-3.5 px-3 text-center text-slate-700 font-mono font-medium">
                              {member.masteredCards} từ
                            </td>
                            <td className="py-3.5 px-3 text-center text-slate-700 font-mono font-medium">
                              {member.quizCount} bài
                            </td>
                            <td className="py-3.5 px-3 text-right">
                              <span className="font-bold text-emerald-600 text-sm sm:text-base font-mono">
                                {member.learningScore}
                              </span>
                              <span className="text-[11px] text-slate-400 block font-normal">điểm</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: NGƯỜI HỌC */}
          {activeTab === 'members' && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
              <div className="border-b border-slate-200 pb-3">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                  Danh Sách Thành Viên ({leaderboard.length})
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                {leaderboard.map((member) => {
                  const isMe = user && member.id === user.id;
                  const online = isUserOnline(member.id);

                  return (
                    <div
                      key={member.id}
                      className="border border-slate-200/80 rounded-2xl p-4 bg-slate-50/50 hover:bg-white hover:border-emerald-500/50 hover:shadow-xs transition-all space-y-3 flex flex-col justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          {member.avatar ? (
                            <img
                              src={member.avatar}
                              alt={member.name}
                              className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <span className="w-10 h-10 rounded-full bg-emerald-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                              {member.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                          {online && (
                            <span
                              className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white"
                              title="Đang hoạt động"
                            />
                          )}
                        </div>

                        <div className="truncate min-w-0">
                          <Link
                            to={`/users/${member.id}`}
                            className="font-semibold text-sm text-slate-900 hover:text-emerald-700 truncate flex items-center gap-1"
                          >
                            <span className="truncate">{member.name}</span>
                            {isMe && <span className="text-xs text-emerald-600 font-normal shrink-0">(Bạn)</span>}
                          </Link>
                          {online ? (
                            <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1 mt-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Đang hoạt động
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-500 block mt-0.5">
                              {member.publicSetsCount} bộ thẻ công khai
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-center pt-2 border-t border-slate-200/80 text-xs">
                        <div className="bg-white rounded-xl p-2 border border-slate-200/80 shadow-2xs">
                          <span className="text-[10px] text-slate-400 block font-medium">Đã thuộc</span>
                          <span className="font-bold text-slate-800 font-mono text-sm">{member.masteredCards} từ</span>
                        </div>
                        <div className="bg-white rounded-xl p-2 border border-slate-200/80 shadow-2xs">
                          <span className="text-[10px] text-slate-400 block font-medium">Điểm học</span>
                          <span className="font-bold text-emerald-600 font-mono text-sm">{member.learningScore}</span>
                        </div>
                      </div>

                      <div className="pt-1">
                        <Link to={`/users/${member.id}`} className="block w-full">
                          <Button size="small" type="default" block>
                            Xem hồ sơ
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
