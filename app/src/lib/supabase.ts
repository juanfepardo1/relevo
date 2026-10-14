import { createClient } from '@supabase/supabase-js';

// Clave publicable: segura en el navegador. El acceso real lo decide RLS (tabla equipo).
export const supabase = createClient(
  'https://zxjqixxpyxdyrqaweorn.supabase.co',
  'sb_publishable_zEwtzlpxk2cogjK0KCIMdg_xbPhTNPE',
  { auth: { persistSession: true, autoRefreshToken: true } },
);

export type Row = Record<string, any>;

export async function must<T>(p: PromiseLike<{ data: T; error: any }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data;
}
