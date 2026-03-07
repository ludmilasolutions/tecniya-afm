import { CONFIG } from './config.js';

let sbInstance = null;

export async function initSupabase() {
  if (sbInstance) return sbInstance;
  
  const { createClient } = window.supabase;
  sbInstance = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
  return sbInstance;
}

export function getSupabase() {
  return sbInstance;
}

export async function getSession() {
  if (!sbInstance) await initSupabase();
  return await sbInstance.auth.getSession();
}

export async function onAuthStateChange(callback) {
  if (!sbInstance) await initSupabase();
  return sbInstance.auth.onAuthStateChange(callback);
}

export const sb = {
  get auth() {
    return sbInstance?.auth;
  },
  from(table) {
    return sbInstance?.from(table);
  },
  channel(name) {
    return sbInstance?.channel(name);
  }
};
