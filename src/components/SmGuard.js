import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '../auth/AuthContext';

// Super Manager screens: anyone else is sent back to their own start page.
export default function SmGuard({ children }) {
  const { user, isSuperManager } = useAuth();
  if (!user) return <Redirect href="/login" />;
  if (!isSuperManager) return <Redirect href="/home" />;
  return children;
}
