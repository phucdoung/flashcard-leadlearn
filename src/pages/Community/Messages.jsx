import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/common';

export default function Messages() {
  const { userId: targetUserId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const messagesEndRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load user conversations and initialize target conversation if userId is provided
  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    async function loadConversations() {
      setLoading(true);
      try {
        // 1. Fetch conversation_members for current user
        const { data: userMemberships } = await supabase
          .from('conversation_members')
          .select('conversation_id')
          .eq('user_id', user.id);

        if (!userMemberships || userMemberships.length === 0) {
          if (targetUserId) {
            // Initiate new conversation with targetUserId
            await startConversationWith(targetUserId);
          } else {
            setConversations([]);
            setLoading(false);
          }
          return;
        }

        const convIds = userMemberships.map((m) => m.conversation_id);

        // 2. Fetch all members of these conversations to find peer users
        const { data: allMembers } = await supabase
          .from('conversation_members')
          .select('conversation_id, user_id')
          .in('conversation_id', convIds);

        // 3. Fetch latest messages for each conversation
        const { data: latestMsgs } = await supabase
          .from('messages')
          .select('*')
          .in('conversation_id', convIds)
          .order('created_at', { ascending: false });

        // Map conversations
        const convMap = {};
        convIds.forEach((cId) => {
          convMap[cId] = {
            id: cId,
            peerId: null,
            peerName: 'Người dùng',
            peerAvatar: null,
            lastMessage: null,
            lastMessageAt: null,
          };
        });

        if (allMembers) {
          allMembers.forEach((m) => {
            if (m.user_id !== user.id && convMap[m.conversation_id]) {
              convMap[m.conversation_id].peerId = m.user_id;
            }
          });
        }

        if (latestMsgs) {
          latestMsgs.forEach((msg) => {
            if (convMap[msg.conversation_id] && !convMap[msg.conversation_id].lastMessage) {
              convMap[msg.conversation_id].lastMessage = msg.content;
              convMap[msg.conversation_id].lastMessageAt = msg.created_at;
            }
          });
        }

        const convList = Object.values(convMap);

        if (!isMounted) return;
        setConversations(convList);

        // Target user logic: find or create conversation with targetUserId
        if (targetUserId) {
          const existing = convList.find((c) => c.peerId === targetUserId);
          if (existing) {
            setActiveConversation(existing);
          } else {
            await startConversationWith(targetUserId);
          }
        } else if (convList.length > 0) {
          setActiveConversation(convList[0]);
        }
      } catch (err) {
        console.error('Load conversations error:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadConversations();

    return () => {
      isMounted = false;
    };
  }, [user, targetUserId]);

  // Helper to start or get conversation with targetUserId
  const startConversationWith = async (targetId) => {
    if (!user || targetId === user.id) return;

    try {
      // Create new conversation row
      const { data: newConv, error: convErr } = await supabase
        .from('conversations')
        .insert({})
        .select()
        .single();

      if (convErr || !newConv) {
        console.error('Error creating conversation:', convErr);
        return;
      }

      // Add both members
      await supabase.from('conversation_members').insert([
        { conversation_id: newConv.id, user_id: user.id },
        { conversation_id: newConv.id, user_id: targetId },
      ]);

      const createdObj = {
        id: newConv.id,
        peerId: targetId,
        peerName: 'Người dùng',
        peerAvatar: null,
        lastMessage: null,
        lastMessageAt: new Date().toISOString(),
      };

      setConversations((prev) => [createdObj, ...prev]);
      setActiveConversation(createdObj);
    } catch (err) {
      console.error('startConversationWith exception:', err);
    }
  };

  // Fetch messages and subscribe to Realtime updates for active conversation
  useEffect(() => {
    if (!activeConversation || !user) return;

    let isMounted = true;

    async function fetchMessages() {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', activeConversation.id)
          .order('created_at', { ascending: true });

        if (!error && data && isMounted) {
          setMessages(data);
        }
      } catch (err) {
        console.error('Fetch messages error:', err);
      }
    }

    fetchMessages();

    // Supabase Realtime Channel Subscription for live chat updates
    const channel = supabase
      .channel(`public:messages:conversation_id=eq.${activeConversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${activeConversation.id}`,
        },
        (payload) => {
          if (payload.new && isMounted) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === payload.new.id)) return prev;
              return [...prev, payload.new];
            });

            // Update conversation preview
            setConversations((prev) =>
              prev.map((c) =>
                c.id === activeConversation.id
                  ? {
                      ...c,
                      lastMessage: payload.new.content,
                      lastMessageAt: payload.new.created_at,
                    }
                  : c
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [activeConversation, user]);

  // Send Message
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const content = newMessage.trim();
    if (!content || !activeConversation || !user || sending) return;

    setSending(true);

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: activeConversation.id,
          sender_id: user.id,
          content: content,
        })
        .select()
        .single();

      if (error) {
        console.error('Send message error:', error);
      } else if (data) {
        setMessages((prev) => [...prev, data]);
        setNewMessage('');

        // Update conversation list item preview
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConversation.id
              ? {
                  ...c,
                  lastMessage: content,
                  lastMessageAt: data.created_at,
                }
              : c
          )
        );
      }
    } catch (err) {
      console.error('Send message exception:', err);
    } finally {
      setSending(false);
    }
  };

  // Keyboard shortcut: Enter to send, Shift+Enter for newline
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-sm font-medium text-[#6B7665] animate-pulse">
        Đang kết nối tin nhắn cộng đồng...
      </div>
    );
  }

  return (
    <div className="py-4 px-4 max-w-4xl mx-auto w-full">
      <div className="bg-white border border-[#DCE5D8] rounded-xl shadow-xs overflow-hidden flex flex-col md:flex-row min-h-[560px]">
        {/* 1. Left Column: Conversations List (~35% width) */}
        <div className="w-full md:w-[35%] border-b md:border-b-0 md:border-r border-[#DCE5D8] bg-[#F8FCF4] flex flex-col justify-between">
          <div className="p-4 border-b border-[#DCE5D8]">
            <h2 className="text-base font-bold text-[#14261C]">Tin nhắn</h2>
            <p className="text-xs text-[#556551]">Trò chuyện 1-1 với người học khác</p>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#E8EFE5] p-2 space-y-1">
            {conversations.length === 0 ? (
              <div className="p-6 text-center space-y-3">
                <p className="text-xs text-[#556551]">Bạn chưa có cuộc trò chuyện nào.</p>
                <Link to="/community" className="inline-block">
                  <Button type="primary" size="small">
                    Khám phá cộng đồng
                  </Button>
                </Link>
              </div>
            ) : (
              conversations.map((conv) => {
                const isActive = activeConversation && activeConversation.id === conv.id;

                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => {
                      setActiveConversation(conv);
                      navigate(`/messages/${conv.peerId || ''}`);
                    }}
                    className={`w-full p-3 rounded-lg text-left flex items-center gap-3 transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-white border border-[#24693D] shadow-xs font-semibold'
                        : 'hover:bg-white/80 border border-transparent'
                    }`}
                  >
                    <span className="w-9 h-9 rounded-full bg-[#24693D] text-white font-bold text-xs flex items-center justify-center shrink-0">
                      U
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs sm:text-sm font-bold text-[#14261C] block truncate">
                        Người học #{conv.peerId ? conv.peerId.substring(0, 6) : 'Partner'}
                      </span>
                      <p className="text-[11px] text-[#556551] truncate mt-0.5">
                        {conv.lastMessage || 'Bắt đầu cuộc trò chuyện...'}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* 2. Right Column: Active Chat Window (~65% width) */}
        <div className="w-full md:w-[65%] flex flex-col justify-between bg-white">
          {activeConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-[#DCE5D8] flex items-center justify-between bg-white">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-[#24693D] text-white font-bold text-xs flex items-center justify-center">
                    U
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-[#14261C]">
                      Người học #{activeConversation.peerId ? activeConversation.peerId.substring(0, 6) : 'Partner'}
                    </h3>
                    {activeConversation.peerId && (
                      <Link
                        to={`/users/${activeConversation.peerId}`}
                        className="text-[11px] text-[#24693D] hover:underline"
                      >
                        Xem hồ sơ public ➔
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              {/* Chat History */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 max-h-[420px] bg-[#F8FCF4]/40">
                {messages.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#556551]">
                    Hãy gửi tin nhắn đầu tiên để chào hỏi! 👋
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMine = msg.sender_id === user.id;

                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[78%] px-3.5 py-2 rounded-xl text-xs sm:text-sm leading-relaxed border ${
                            isMine
                              ? 'bg-[#F0F7EE] border-[#24693D]/30 text-[#14261C] rounded-br-none'
                              : 'bg-white border-[#DCE5D8] text-[#14261C] rounded-bl-none shadow-2xs'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          <span className="block text-[10px] text-[#8C9B86] text-right mt-1 font-mono">
                            {new Date(msg.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input Bar */}
              <form
                onSubmit={handleSendMessage}
                className="p-3.5 border-t border-[#DCE5D8] bg-white flex items-center gap-2"
              >
                <textarea
                  rows={1}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Nhập tin nhắn... (Enter để gửi, Shift+Enter xuống dòng)"
                  className="flex-1 px-3.5 py-2.5 rounded-lg border border-[#DCE5D8] bg-[#F8FCF4] text-xs sm:text-sm text-[#14261C] focus:outline-none focus:border-[#24693D] focus:bg-white transition-all resize-none"
                />
                <Button
                  htmlType="submit"
                  type="primary"
                  disabled={!newMessage.trim() || sending}
                  loading={sending}
                >
                  Gửi
                </Button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <p className="text-xs sm:text-sm font-semibold text-[#556551]">
                Chọn một cuộc trò chuyện từ danh sách hoặc nhắn tin từ trang Cộng đồng.
              </p>
              <Link to="/community">
                <Button type="primary" size="small">
                  Đến trang Cộng đồng
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
