import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';

export default function PublicProfile() {
  const { id } = useParams();
  const { user: currentUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [profileUser, setProfileUser] = useState(null);
  const [publicSets, setPublicSets] = useState([]);
  const [userStats, setUserStats] = useState({
    masteredCards: 0,
    quizCount: 0,
    learningScore: 0,
  });

  useEffect(() => {
    async function fetchPublicProfile() {
      if (!id) return;
      setLoading(true);

      try {
        // 1. Fetch user profile directly from public.profiles table by userId from URL parameter
        const { data: dbProfile, error: profileErr } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, phone, show_phone')
          .eq('id', id)
          .single();

        if (profileErr) {
          console.error('[PublicProfile] Error fetching profile for userId:', id, profileErr);
        }

        // Development diagnostic logging (NO email, token, or key logged)
        if (import.meta.env.DEV) {
          console.log('[PublicProfile] userId:', id);
          console.log('[PublicProfile] profile:', dbProfile);
        }

        // 2. Fetch public sets belonging to target user
        const { data: setsData } = await supabase
          .from('flashcard_sets')
          .select('*, flashcards(*)')
          .eq('user_id', id)
          .eq('visibility', 'public')
          .order('created_at', { ascending: false });

        // 3. Fetch all flashcard sets of user to count mastered cards across private + public sets
        const { data: allUserSets } = await supabase
          .from('flashcard_sets')
          .select('*, flashcards(*)')
          .eq('user_id', id);

        // 4. Fetch quiz_results belonging to target user
        const { data: resultsData } = await supabase
          .from('quiz_results')
          .select('*')
          .eq('user_id', id);

        let totalMastered = 0;
        if (allUserSets) {
          allUserSets.forEach((s) => {
            const cards = s.flashcards || [];
            cards.forEach((c) => {
              if (c.learning_status === 'mastered' || c.learning_status === 'learned') {
                totalMastered += 1;
              }
            });
          });
        }

        let setList = [];
        if (setsData) {
          setList = setsData.map((s) => ({
            id: s.id,
            title: s.name || s.title || 'Bộ thẻ',
            description: s.description || '',
            totalCards: (s.flashcards || []).length,
          }));
        }

        let quizCount = 0;
        let totalScorePct = 0;
        if (resultsData) {
          quizCount = resultsData.length;
          resultsData.forEach((r) => {
            const pct = r.total_questions > 0 ? (r.score / r.total_questions) * 100 : 0;
            totalScorePct += pct;
          });
        }

        const avgScorePct = quizCount > 0 ? totalScorePct / quizCount : 0;
        const learningScore = Math.round(totalMastered * 1 + quizCount * 5 + avgScorePct * 0.5);

        // Fallback display name logic based strictly on public.profiles.full_name
        const rawFullName = dbProfile && typeof dbProfile.full_name === 'string'
          ? dbProfile.full_name.trim()
          : '';

        const displayName = rawFullName || 'Người học LeafLearn';
        const avatarUrl = dbProfile?.avatar_url || null;
        const phone = dbProfile?.phone ? String(dbProfile.phone).trim() : '';
        const showPhone = Boolean(dbProfile?.show_phone);

        setProfileUser({
          id,
          name: displayName,
          avatar: avatarUrl,
          phone,
          showPhone,
        });

        setPublicSets(setList);
        setUserStats({
          masteredCards: totalMastered,
          quizCount,
          learningScore,
        });
      } catch (err) {
        console.error('Fetch public profile error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchPublicProfile();
  }, [id]);

  if (loading) {
    return (
      <div className="py-16 text-center text-sm font-medium text-[#6B7665] animate-pulse">
        Đang tải hồ sơ người dùng thật...
      </div>
    );
  }

  const isSelf = currentUser && currentUser.id === id;

  return (
    <div className="py-2 px-4 max-w-4xl mx-auto space-y-6 w-full">
      {/* Profile Header Main Card */}
      <div className="bg-white border border-[#E7EEDC] rounded-2xl sm:rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          {/* Avatar */}
          {profileUser?.avatar ? (
            <img
              src={profileUser.avatar}
              alt={profileUser.name}
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-2 border-[#97C95E]/50 shrink-0"
            />
          ) : (
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#A8D672] text-[#2E3A28] font-bold text-3xl flex items-center justify-center border-2 border-[#97C95E]/50 shrink-0">
              {profileUser?.name ? profileUser.name.charAt(0).toUpperCase() : 'U'}
            </div>
          )}

          {/* User Info */}
          <div className="flex-1 text-center sm:text-left space-y-2">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#2E3A28] tracking-tight">
                {profileUser?.name} {isSelf && <span className="text-xs text-[#5B9E60] font-normal">(Bạn)</span>}
              </h1>
              <span className="text-xs text-[#6B7665] font-medium block mt-0.5">
                Hồ sơ học tập công khai
              </span>
            </div>

            {/* Optional Public Phone Section */}
            {profileUser?.phone && (profileUser?.showPhone || isSelf) && (
              <div className="pt-1.5">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#F8FCF4] border border-[#E7EEDC] text-xs font-semibold text-[#2E3A28]">
                  <span className="text-[#5B9E60]">Liên hệ:</span>
                  <a
                    href={`tel:${profileUser.phone}`}
                    className="font-mono text-[#2E3A28] hover:text-[#5B9E60] hover:underline transition-colors"
                  >
                    {profileUser.phone}
                  </a>
                  {isSelf && !profileUser.showPhone && (
                    <span className="text-[11px] text-[#6B7665] font-normal italic">
                      (Chỉ bạn nhìn thấy)
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* 4 Key Statistics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3">
              <div className="bg-[#F8FCF4] border border-[#E7EEDC] rounded-xl p-3 text-center">
                <span className="block text-[11px] text-[#6B7665]">Bộ thẻ công khai</span>
                <span className="text-lg font-bold text-[#2E3A28] mt-0.5 block font-mono">
                  {publicSets.length}
                </span>
              </div>

              <div className="bg-[#F8FCF4] border border-[#E7EEDC] rounded-xl p-3 text-center">
                <span className="block text-[11px] text-[#6B7665]">Từ đã thuộc</span>
                <span className="text-lg font-bold text-[#2E3A28] mt-0.5 block font-mono">
                  {userStats.masteredCards}
                </span>
              </div>

              <div className="bg-[#F8FCF4] border border-[#E7EEDC] rounded-xl p-3 text-center">
                <span className="block text-[11px] text-[#6B7665]">Quiz đã làm</span>
                <span className="text-lg font-bold text-[#2E3A28] mt-0.5 block font-mono">
                  {userStats.quizCount}
                </span>
              </div>

              <div className="bg-[#5B9E60]/15 border border-[#5B9E60]/30 rounded-xl p-3 text-center">
                <span className="block text-[11px] text-[#6B7665]">Điểm học tập</span>
                <span className="text-lg font-bold text-[#5B9E60] mt-0.5 block font-mono">
                  {userStats.learningScore}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Public Flashcard Sets Section */}
      <div className="bg-white border border-[#E7EEDC] rounded-2xl sm:rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xs">
        <div className="border-b border-[#E7EEDC] pb-3 flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-bold text-[#2E3A28]">
            Bộ thẻ Flashcard công khai ({publicSets.length})
          </h2>
        </div>

        {publicSets.length === 0 ? (
          <div className="py-8 text-center text-xs sm:text-sm text-[#6B7665]">
            Người dùng chưa tạo bộ thẻ Flashcard công khai nào.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {publicSets.map((set) => (
              <div
                key={set.id}
                className="bg-[#F8FCF4] border border-[#E7EEDC] rounded-2xl p-5 hover:border-[#A8D672] transition-all space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-1.5">
                  <h3 className="font-bold text-base text-[#2E3A28] truncate">
                    {set.title}
                  </h3>
                  <p className="text-xs text-[#6B7665] line-clamp-2 leading-relaxed">
                    {set.description || 'Chưa có mô tả cho bộ thẻ này.'}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#E7EEDC] text-xs">
                  <span className="font-semibold text-[#5B9E60]">
                    {set.totalCards} thẻ Flashcard
                  </span>

                  <Link
                    to={`/flashcard/${set.id}`}
                    className="px-3 py-1.5 rounded-lg bg-white border border-[#E7EEDC] hover:border-[#A8D672] text-xs font-semibold text-[#2E3A28] transition-all"
                  >
                    Xem bộ thẻ ➔
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
