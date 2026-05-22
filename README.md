# GCSE Computer Science AI Tutor

An AI-powered tutoring platform for GCSE Computer Science students and teachers.

## Tech Stack

- **Framework**: Next.js 14 (App Router, TypeScript, Tailwind CSS)
- **Authentication**: Supabase Auth (email/password)
- **Database**: Supabase PostgreSQL with Row Level Security
- **AI**: OpenRouter API (free models)
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your Supabase credentials:

```bash
cp .env.local.example .env.local
```

Required environment variables:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anonymous key |
| `OPENROUTER_API_KEY` | Your OpenRouter API key |
| `NEXT_PUBLIC_SITE_URL` | Your site URL (e.g., http://localhost:3000) |

### Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
├── app/
│   ├── layout.tsx          # Root layout with Supabase provider
│   ├── page.tsx            # Landing page (role-based redirect)
│   ├── globals.css         # Global styles
│   ├── auth/
│   │   ├── login/page.tsx  # Login form
│   │   ├── signup/page.tsx # Signup form with role selection
│   │   ├── callback/route.ts # Auth callback handler
│   │   └── signout/route.ts  # Sign out handler
│   ├── teacher/
│   │   ├── layout.tsx      # Teacher layout with nav
│   │   ├── page.tsx        # Teacher dashboard
│   │   └── topics/page.tsx # Topics management (placeholder)
│   └── student/
│       ├── layout.tsx      # Student layout with nav
│       ├── page.tsx        # Student dashboard
│       └── topics/page.tsx # Topics browsing (placeholder)
├── lib/
│   ├── supabase/
│   │   ├── client.ts       # Browser Supabase client
│   │   ├── server.ts       # Server Supabase client
│   │   ├── middleware.ts    # Supabase middleware helper
│   │   └── database.types.ts # TypeScript types for DB
│   └── utils.ts            # Utility functions
├── components/
│   └── supabase-provider.tsx # Auth state provider
├── middleware.ts            # Auth & role-based routing
└── .env.local.example       # Environment variable template
```

## Database Schema

- **profiles** - User profiles with role (teacher/student)
- **topics** - Curriculum topics (Component 01 & 02)
- **subtopics** - Subtopics with JSON content
- **released_subtopics** - Teacher-released subtopics
- **question_sets** - Teacher-created question sets
- **student_answers** - Student submissions with scores

## Authentication & Authorization

- Email/password authentication via Supabase Auth
- Role-based access control (teacher vs student routes)
- Row Level Security on all database tables
- Auto-creates profile on user signup via database trigger

## Deployment

This project is deployed on Vercel. Pushes to the main branch trigger automatic deployments.
