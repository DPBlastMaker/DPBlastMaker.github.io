# DP Blast

Profile picture overlay campaign platform.

## Setup

### 1. Supabase Project

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run `schema.sql`
3. Go to **Authentication > Settings** and disable "Confirm email" (or enable auto-confirm)
4. Go to **Authentication > Providers** and enable Email auth

### 2. Configure

Edit `js/supabase.js` with your Supabase project URL and anon key:

```js
const SUPABASE_URL = 'https://your-project.supabase.co'
const SUPABASE_ANON_KEY = 'your-anon-key'
```

You can find both in **Project Settings > API**.

### 3. Create an Admin User

Open your Supabase **SQL Editor** and run:

```sql
-- Create admin user (use a real email if email confirm is on)
SELECT supabase_auth.admin_create_user(
  'admin@dpblast.local',
  'YourAdminPassword123',
  '{"email_confirm": true}'
);

-- Then insert their profile with admin role
INSERT INTO public.profiles (id, username, role)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'admin@dpblast.local'),
  'admin',
  'admin'
);
```

Or use the Supabase **Authentication > Users** panel to create a user with email `admin@dpblast.local`, then run the INSERT above.

### 4. Run Locally

```bash
# Using Python
python3 -m http.server 8080

# Or using Node
npx serve .
```

Open `http://localhost:8080`

## Usage

1. **Admin** — Log in at `/admin.html`, create creator accounts
2. **Creator** — Log in at `/login.html`, create DP Blasts from `/create.html`
3. **Visitor** — Open a blast link like `/?blast=my-campaign`, upload a photo, download the result

## Project Structure

```
dpblast/
├── index.html       # Viewer page (public)
├── login.html       # Login page
├── dashboard.html   # Creator dashboard
├── create.html      # Create DP Blast
├── admin.html       # Admin panel
├── css/
│   ├── main.css     # Global styles
│   └── admin.css    # Admin-specific styles
├── js/
│   ├── supabase.js  # Supabase client config
│   ├── auth.js      # Auth helpers
│   ├── viewer.js    # Public viewer logic
│   ├── dashboard.js # Dashboard logic
│   ├── create.js    # Create blast logic
│   └── admin.js     # Admin logic
├── assets/          # Static assets
└── schema.sql       # Database setup
```

## Tech Stack

- HTML/CSS/JS (vanilla)
- Supabase (Auth, Database, Storage)
