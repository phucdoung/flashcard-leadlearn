'use client';

import React from 'react';
import { AuthProvider } from '../src/context/AuthContext';
import { PresenceProvider } from '../src/context/PresenceContext';

export default function Providers({ children }) {
  return (
    <AuthProvider>
      <PresenceProvider>
        {children}
      </PresenceProvider>
    </AuthProvider>
  );
}
