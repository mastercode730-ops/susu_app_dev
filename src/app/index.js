import { Redirect } from 'expo-router';
import { useAuth } from '../auth/AuthContext';

export default function Index() {
  const { user, isSuperManager } = useAuth();
  return <Redirect href={!user ? '/login' : isSuperManager ? '/sm' : '/home'} />;
}
