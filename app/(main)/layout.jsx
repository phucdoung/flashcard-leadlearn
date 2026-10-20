'use client';

import React from 'react';
import MainLayout from '@/src/layouts/MainLayout';
import ProtectedRoute from '@/src/components/ProtectedRoute';

export default function Layout({ children }) {
  return (
    <ProtectedRoute>
      <MainLayout>
        {children}
      </MainLayout>
    </ProtectedRoute>
  );
}
