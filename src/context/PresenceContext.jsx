import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';

const PresenceContext = createContext({
  onlineUserIds: new Set(),
  isUserOnline: () => false,
});

export function PresenceProvider({ children }) {
  const { user } = useAuth();
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());

  useEffect(() => {
    if (!user) {
      setOnlineUserIds(new Set());
      return;
    }

    // Single shared Realtime Presence channel for online status tracking
    const channel = supabase.channel('leaflearn-online-users', {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const activeIds = new Set();

        Object.keys(state).forEach((key) => {
          if (key) activeIds.add(key);
        });

        setOnlineUserIds(activeIds);
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        if (key) {
          setOnlineUserIds((prev) => {
            const next = new Set(prev);
            next.add(key);
            return next;
          });
        }
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        if (key) {
          setOnlineUserIds((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user.id,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const isUserOnline = (userId) => {
    if (!userId) return false;
    return onlineUserIds.has(userId);
  };

  return (
    <PresenceContext.Provider value={{ onlineUserIds, isUserOnline }}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  return useContext(PresenceContext);
}
