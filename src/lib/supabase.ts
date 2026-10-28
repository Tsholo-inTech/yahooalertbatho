import { createClient, type User } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';
import SupabaseStorage from './SupabaseStorage'; // Import the new class

const supabaseUrl = 'https://ovburbwefjbjwczrfcua.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92YnVyYndlZmpiandjenJmY3VhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0NDk5MzQsImV4cCI6MjEwODAyNTkzNH0.SWW3dqnPwyHd2wuwAE4QkKDcTWj9X80GolfrAl0l6QU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: new SupabaseStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export async function ensureProfile(user: User) {
  const { data: profile, error: lookupError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (lookupError) throw lookupError;
  if (profile) return;

  const metadata = user.user_metadata ?? {};
  
  const firstName =
    typeof user.user_metadata.first_name === 'string'
      ? user.user_metadata.first_name.trim()
      : '';
  const lastName =
    typeof user.user_metadata.last_name === 'string'
      ? user.user_metadata.last_name.trim()
      : '';
  const phoneNumber =
    typeof user.user_metadata.phone_number === 'string'
      ? user.user_metadata.phone_number.trim()
      : user.phone ?? '';

  const metadataEmail =
    typeof metadata.email_address === 'string'
      ? metadata.email_address.trim()
      : '';

  const emailAddress = (
    user.email ?? metadataEmail
  ).trim().toLowerCase();

  if (!emailAddress) {
    throw new Error(
      'Your profile requires an email address, but none was found. ' +
      'Please check your registration details.'
    );
  }
    

  const { error: insertError } = await supabase
    .from('profiles')
    .insert([
      {
        id: user.id,
        first_name: firstName,
        last_name: lastName,
        phone_number: phoneNumber,
        email_address:emailAddress,
      },
    ]);

  if (insertError) throw insertError;
}