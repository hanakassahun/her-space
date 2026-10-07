# Her Space

**Learn. Share. Know yourself.**

Her Space is a women's knowledge and community platform. Health is the foundation, but the core idea is simple: women learn about their bodies, share what they've learned, and help each other navigate everyday life, with clear labels showing where each piece of information comes from.

It is built for women in Ethiopia first, with English and Amharic (አማርኛ) support from the start.

> **Status:** early beta, invite-only. Her Space shares education, not medical advice or diagnosis.

[🌐 Live Demo](https://her-space-her-space.vercel.app/)
---

## Features

**Community**
- Pseudonymous accounts with invite-code signup
- Posts of three types: experience, question, knowledge
- **Provenance labels** on every post: personal experience, community knowledge (not medically verified), or evidence-backed (with sources)
- Verified professional badges, added manually by an admin
- Comments, likes, follows, and a Following feed
- Explore with search and topic filters
- Report button and an admin review screen

**Personal**
- Private **Body Journal** (mood, energy, sleep, period, symptoms, notes). Only the owner can read it, enforced by database rules
- **My Library** of saved posts, with topic filters
- Option to turn a journal entry into a post (private details are never prefilled)

**Learn and local resources**
- Learn articles with four sections: what can be normal, what may deserve attention, when to see a doctor, and questions to ask your doctor, with sources and a reviewer name
- Resources directory (clinics, pharmacies, hotlines) with last-verified dates, and a suggestion form

**Safety and trust**
- Community rules, privacy, and terms pages
- Self-service account deletion
- Rate limits on posting and commenting
- Admin tools for invite codes, articles, resources, and reports

**Platform**
- English and Amharic interface with a language switcher
- Installable PWA (no offline caching, on purpose, because pages can contain private health data)
- Mobile-first design

---

## Tech stack

- [Next.js](https://nextjs.org) 16 (App Router) with TypeScript
- [Tailwind CSS](https://tailwindcss.com) v4
- [Supabase](https://supabase.com) for authentication, Postgres, and Row Level Security
- [Vercel](https://vercel.com) for hosting

---

## Getting started

### Requirements
- Node.js (LTS)
- A Supabase project

### 1. Install

```bash
git clone https://github.com/hanakassahun/her-space.git
cd her-space/her-space
npm install
```

> The app lives in the inner `her-space` folder, which is the one containing `package.json`.

### 2. Environment variables

Create a file named `.env.local` in the inner `her-space` folder:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

- Use the **publishable** key only.
- **Never** put the secret / `service_role` key in this app or commit it anywhere.
- `.env.local` is ignored by git.

### 3. Database

The schema is set up in the Supabase SQL Editor. Tables include `profiles`, `posts`, `comments`, `bookmarks`, `likes`, `follows`, `journal_entries`, `articles`, `resources`, `resource_suggestions`, `reports`, `admins`, `verified_professionals`, and `invite_codes`.

Every table has Row Level Security enabled. Helper functions: `is_admin()`, `is_invite_code_valid()`, `redeem_invite_code()`, and `delete_my_account()`.

> **To do:** export the SQL into a `supabase/migrations` folder so the database can be rebuilt from this repo.

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Make yourself an admin

After signing up, run this in the Supabase SQL Editor (use your own display name):

```sql
insert into public.admins (user_id)
select id from public.profiles where display_name = 'your-display-name';
```

---

## Project structure

```
app/                 Pages and routes (feed, explore, journal, learn, resources, admin, ...)
components/          Shared components (ui/, AppHeader, BottomNav, LanguageProvider, ...)
lib/
  supabase.ts        Supabase browser client
  nav.ts             Single source of truth for navigation links
  i18n/en.ts         English strings
  i18n/am.ts         Amharic strings
```

---

## Translations

All interface text lives in `lib/i18n/en.ts` and `lib/i18n/am.ts`. To add or change text, add the same key to both files and use `t("your.key")` in components.

User-written content (posts, comments, bios, journal notes) is never translated automatically.

Medical and legal text must be reviewed by a qualified person before it is published.

---

## Deployment

The app is deployed on Vercel.

1. Import the repo and set **Root Directory** to the inner `her-space` folder.
2. Set **Framework Preset** to **Next.js**.
3. Add the two environment variables above, then deploy.
4. In Supabase, set **Authentication → URL Configuration**: Site URL to the live address, and add `/reset-password` to the Redirect URLs.

---

## Privacy and safety principles

- Journal entries and saved posts are visible only to their owner.
- Posts and comments are visible to signed-in members only.
- Health information is labeled by source, never presented as diagnosis.
- Health articles are published only after review by a qualified professional.
- No ads, and user data is not sold.
- No service worker caches pages or API responses.

---

## Known limitations (beta)

- Email confirmation is off during the invite-only beta. The built-in Supabase email is rate-limited, so a custom email provider is needed before opening signup to the public.
- Search matches text exactly, so it does not yet treat look-alike Amharic letters as equivalent.
- Topic chips filter on English topic tags.
- Free-tier hosting limits apply (project pausing, no automatic backups).

---

## Roadmap

- Custom email sender and email confirmation
- Block and mute
- Notifications
- Pagination everywhere
- Amharic search normalization and translated topic chips
- Amharic Learn articles (after professional review)
- Anonymous posting option
- Journal insights and a "share with my doctor" export

---

## Contributing

This project is in a private beta. If you'd like to help, especially as a native Amharic speaker or a health professional who can review content, please get in touch: **hannabirle@gmail.com**

---

## License

