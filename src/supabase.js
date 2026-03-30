import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)
```

**4. .env aanmaken**

In de hoofdmap `uurregistratie/` (niet in `src/`, maar één niveau hoger) maak je een bestand aan met de naam `.env`. Let op: alleen een punt ervoor, geen verdere extensie. Inhoud:
```
VITE_SUPABASE_URL=https://uuxoteluojuswmsulakh.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xTmuMGTDyqiPYmAjH43LYg_mLP4Zgl_