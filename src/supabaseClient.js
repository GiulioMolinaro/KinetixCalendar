import { createClient } from '@supabase/supabase-js'

// Sostituisci queste stringhe con i tuoi dati dalla dashboard di Supabase
const supabaseUrl = 'https://oqbjlzfxonypbmbihvlg.supabase.co'
const supabaseAnonKey = 'sb_publishable_bxMM86UfxoZl8LynrR1igw_7Rs63G5E'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)