import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { Button, Input, Tag, Empty } from '../../components/common';

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
    <div className="py-4 px-4 max-w-4xl mx-auto space-y-6 w-full">
      {/* Header Section */}
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold text-[#14261C] tracking-tight">
          Khám phá bộ thẻ
        </h1>
        <p className="text-xs sm:text-sm text-[#556551]">
          Khám phá và học từ những bộ Flashcard được chia sẻ bởi cộng đồng LeafLearn.
        </p>
      </div>

      {/* Search Input */}
      <Input
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Tìm kiếm bộ Flashcard..."
        allowClear
        onClear={() => setSearchQuery('')}
        prefix={
          <svg className="w-4 h-4 text-[#8C9B86]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        }
      />

      {/* Grid of Public Sets */}
      {loading ? (
        <div className="py-24 text-center max-w-md mx-auto px-4">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-solid border-[#24693D] border-r-transparent"></div>
          <p className="mt-4 text-sm font-medium text-[#556551]">
            Đang tải danh sách bộ thẻ công khai...
          </p>
        </div>
      ) : filteredSets.length === 0 ? (
        <div className="bg-white border border-[#DCE5D8] rounded-xl p-8 text-center shadow-xs">
          <Empty
            title={searchQuery ? 'Không tìm thấy bộ thẻ phù hợp' : 'Chưa có bộ thẻ công khai nào'}
            description={
              searchQuery
                ? 'Thử tìm kiếm với từ khóa khác.'
                : 'Hãy là người đầu tiên chia sẻ bộ thẻ từ vựng của bạn với cộng đồng!'
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredSets.map((set) => {
            const isOwnSet = user && set.userId === user.id;

            return (
              <div
                key={set.id}
                className="bg-white border border-[#DCE5D8] rounded-xl p-5 hover:border-[#24693D]/50 transition-colors flex flex-col justify-between space-y-4 shadow-xs"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-base text-[#14261C] truncate flex-1">
                      {set.title}
                    </h3>
                    <Tag color="green">Công khai</Tag>
                  </div>

                  <p className="text-xs text-[#556551]">
                    Tác giả: <strong className="text-[#14261C]">{isOwnSet ? 'Bạn' : 'Cộng đồng LeafLearn'}</strong>
                  </p>

                  {set.description && (
                    <p className="text-xs text-[#556551] line-clamp-2 leading-relaxed">
                      {set.description}
                    </p>
                  )}
                </div>

                {/* Stats */}
                <div className="text-xs font-medium text-[#556551]">
                  <span>{set.totalCards} thẻ từ vựng</span>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center gap-2 pt-2 border-t border-[#E8EFE5]">
                  <Link to={`/flashcard/${set.id}`} className="flex-1">
                    <Button type="default" size="middle" block>
                      Xem bộ
                    </Button>
                  </Link>

                  {!isOwnSet && (
                    <div className="flex-1">
                      <Button
                        type="primary"
                        size="middle"
                        block
                        onClick={() => handleSaveToLibrary(set)}
                        loading={savingSetId === set.id}
                      >
                        Lưu vào thư viện
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
  );
}
