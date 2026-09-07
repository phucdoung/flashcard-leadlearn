import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';

export default function Explore() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [publicSets, setPublicSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [savingSetId, setSavingSetId] = useState(null);

  useEffect(() => {
    async function fetchPublicSets() {
      setLoading(true);
      try {
        // Fetch public sets
        const { data, error } = await supabase
          .from('flashcard_sets')
          .select('*, flashcards(*)')
          .eq('visibility', 'public')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching public sets:', error);
          setPublicSets([]);
        } else if (data) {
          const formatted = data.map((set) => {
            const cards = set.flashcards || [];
            return {
              id: set.id,
              title: set.name || set.title || 'Bộ thẻ',
              description: set.description || '',
              totalCards: cards.length,
              userId: set.user_id,
              raw: set,
              flashcards: cards,
            };
          });
          setPublicSets(formatted);
        }
      } catch (err) {
        console.error('Fetch public sets error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchPublicSets();
  }, []);

  // Save to Library (Copy public set to user's account)
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

      if (setErr) {
        console.error('Error creating copied set:', setErr);
        alert(`Không thể lưu bộ thẻ: ${setErr.message}`);
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

  const filteredSets = publicSets.filter(
    (set) =>
      set.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      set.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="py-2 px-4 max-w-4xl mx-auto space-y-6 w-full">
      {/* Header Section */}
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold text-[#2E3A28]">
          Khám phá bộ thẻ
        </h1>
        <p className="text-xs sm:text-sm text-[#6B7665]">
          Khám phá và học từ những bộ Flashcard được chia sẻ bởi cộng đồng LeafLearn.
        </p>
      </div>

      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Tìm kiếm bộ Flashcard..."
          className="w-full h-[44px] px-4 bg-white border border-[#E7EEDC] rounded-xl text-sm text-[#2E3A28] placeholder-[#6B7665]/60 focus:outline-none focus:border-[#A8D672] transition-all shadow-2xs"
        />
      </div>

      {/* Grid of Public Sets */}
      {loading ? (
        <div className="py-16 text-center text-sm text-[#6B7665] font-medium animate-pulse">
          Đang tải danh sách bộ thẻ công khai...
        </div>
      ) : filteredSets.length === 0 ? (
        <div className="bg-white border border-[#E7EEDC] rounded-2xl p-10 text-center space-y-2 shadow-2xs">
          <p className="text-base font-bold text-[#2E3A28]">
            {searchQuery ? 'Không tìm thấy bộ thẻ phù hợp' : 'Chưa có bộ thẻ công khai nào'}
          </p>
          <p className="text-xs text-[#6B7665]">
            {searchQuery
              ? 'Thử tìm kiếm với từ khóa khác.'
              : 'Hãy là người đầu tiên chia sẻ bộ thẻ từ vựng của bạn với cộng đồng!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredSets.map((set) => {
            const isOwnSet = user && set.userId === user.id;

            return (
              <div
                key={set.id}
                className="bg-white border border-[#E7EEDC] rounded-2xl p-5 sm:p-6 hover:border-[#A8D672]/70 hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between space-y-4 shadow-2xs"
              >
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-base text-[#2E3A28] truncate flex-1">
                      {set.title}
                    </h3>
                    <span className="text-xs font-semibold text-[#5B9E60] bg-[#5B9E60]/10 px-2 py-0.5 rounded-md shrink-0">
                      Công khai
                    </span>
                  </div>

                  <p className="text-xs text-[#6B7665] font-medium">
                    Tác giả: <span className="text-[#2E3A28]">{isOwnSet ? 'Bạn' : 'Cộng đồng LeafLearn'}</span>
                  </p>

                  {set.description && (
                    <p className="text-xs text-[#6B7665] truncate pt-1">
                      {set.description}
                    </p>
                  )}
                </div>

                {/* Stats */}
                <div className="text-xs text-[#6B7665] font-medium">
                  <span>{set.totalCards} thẻ từ vựng</span>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <Link
                    to={`/flashcard/${set.id}`}
                    className="flex-1 text-center bg-white border border-[#E7EEDC] hover:bg-[#F8FCF4] text-[#2E3A28] font-bold text-xs py-2.5 px-3 rounded-xl transition-all shadow-2xs"
                  >
                    Xem bộ
                  </Link>

                  {!isOwnSet && (
                    <button
                      type="button"
                      onClick={() => handleSaveToLibrary(set)}
                      disabled={savingSetId === set.id}
                      className="flex-1 text-center bg-[#A8D672] hover:bg-[#97C95E] text-[#2E3A28] font-bold text-xs py-2.5 px-3 rounded-xl transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                    >
                      {savingSetId === set.id ? 'Đang lưu...' : 'Lưu vào thư viện'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
