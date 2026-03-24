import { createClient } from '@supabase/supabase-js';
import { DRY_COOLERS } from '@/lib/dryCoolerData';
import { AIR_FANS } from '@/lib/airFanData';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database helper functions
export async function getMiners() {
  const { data, error } = await supabase
    .from('miners')
    .select('*')
    .order('hash_rate_ths', { ascending: false });
  
  if (error) throw error;
  return data;
}

export async function saveFarm(farmId: string, config: string) {
  const { data, error } = await supabase
    .from('farms')
    .insert({
      id: farmId,
      config,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function loadFarm(farmId: string) {
  const { data, error } = await supabase
    .from('farms')
    .select('*')
    .eq('id', farmId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getDryCoolers() {
  try {
    const { data, error } = await supabase
      .from('dry_coolers')
      .select('*')
      .order('kw_capacity_35c', { ascending: true });
    if (error) throw error;
    return data;
  } catch {
    return DRY_COOLERS;
  }
}

export async function getAirFans() {
  try {
    const { data, error } = await supabase
      .from('air_fans')
      .select('*')
      .order('airflow_m3h', { ascending: true });
    if (error) throw error;
    return data;
  } catch {
    return AIR_FANS;
  }
}
