# Supabase setup for VersusLetra

Project ref: `pswwfrqperukfmrxccqr`

## Apply the schema

Option A, through the Supabase dashboard:

1. Open the project in Supabase.
2. Go to SQL Editor.
3. Paste and run `migrations/20260722210000_initial_schema.sql`.

Option B, through the CLI:

```powershell
supabase login
supabase link --project-ref pswwfrqperukfmrxccqr
supabase db push
```

## Make your user admin

After creating your account in the game, run this in the Supabase SQL Editor:

```sql
update public.profiles
set is_admin = true
where nickname = 'SEU_NICK_AQUI';
```

The frontend never stores the secret key. Keep service/secret keys only in the Supabase dashboard, local environment variables, or server-side tools.
