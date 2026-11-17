import { supabase } from './supabase';
import { frError } from './errors';

// Appelle une fonction serveur ; renvoie un message d'erreur en français, ou null si tout va bien.
export async function callFn(name: string, body: Record<string, unknown>): Promise<string | null> {
  const { error } = await supabase.functions.invoke(name, { body });
  if (!error) return null;
  try {
    const ctx = (error as { context?: Response }).context;
    if (ctx) { const j = (await ctx.json()) as { error?: string }; if (j?.error) return frError(j.error); }
  } catch { /* réponse illisible */ }
  return frError(error);
}
