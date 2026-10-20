'use client';

import React from 'react';
import AuthLayout from '@/src/layouts/AuthLayout';

export default function Layout({ children }) {
  return <AuthLayout>{children}</AuthLayout>;
}
