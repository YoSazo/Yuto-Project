import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Waitlist functions
export async function addToWaitlist(phone: string, email?: string) {
  const { data, error } = await supabase
    .from('waitlist')
    .insert([{ phone, email }])
    .select();
  
  if (error) throw error;
  return data;
}

export async function getWaitlistCount() {
  const { count, error } = await supabase
    .from('waitlist')
    .select('*', { count: 'exact', head: true });
  
  if (error) throw error;
  return count || 0;
}

export async function getWaitlistPosition(phone: string) {
  const { data, error } = await supabase
    .from('waitlist')
    .select('id')
    .eq('phone', phone)
    .single();
  
  if (error) throw error;
  return data?.id || 0;
}
