import { Session } from '@supabase/supabase-js';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Colors } from '../constants/colors';
import { supabase } from '../lib/supabase';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === 'auth';

    if (!session && !inAuthGroup) {
      router.replace('/auth');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, segments, isLoading]);

  if (isLoading) return null; 

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        {/* The Main Tabs (Hidden Header) */}
        <Stack.Screen name="(tabs)" />
        
        {/* Auth Screen (Hidden Header) */}
        <Stack.Screen name="auth" />

        {/* NEW HEADERS FOR THE HIDDEN SCREENS */}
        <Stack.Screen 
          name="messages" 
          options={{ 
            headerShown: true, 
            title: 'Received Alerts',
            headerStyle: { backgroundColor: Colors.card },
            headerTintColor: Colors.text,
            headerTitleStyle: { fontWeight: 'bold' }
          }} 
        />
        <Stack.Screen 
          name="network" 
          options={{ 
            headerShown: true, 
            title: 'Safety Network',
            headerStyle: { backgroundColor: Colors.card },
            headerTintColor: Colors.text,
            headerTitleStyle: { fontWeight: 'bold' }
          }} 
        />

                <Stack.Screen 
          name="first-aid" 
          options={{ 
            headerShown: false // We built our own custom header in the file
          }} 
        />
        
      </Stack>
    </>
  );
}