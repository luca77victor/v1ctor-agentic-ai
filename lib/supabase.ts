import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  '';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

function getSupabaseClient() {
  if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
    console.warn('Supabase URL is invalid or missing in .env.local');
    return createClient('https://placeholder.supabase.co', 'placeholder-key');
  }
  try {
    return createClient(supabaseUrl, supabaseKey);
  } catch (err) {
    console.error('Error creating Supabase client:', err);
    return createClient('https://placeholder.supabase.co', 'placeholder-key');
  }
}

export const supabase = getSupabaseClient();
