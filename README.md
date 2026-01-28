# CodeDuel MVP

A real-time 1v1 coding duel platform built with Next.js and Supabase.

## Features

- Real-time 1v1 coding battles
- Quick play matchmaking
- Custom room creation
- Monaco code editor with Python/C++ support
- Live scoring based on correctness, efficiency, and speed
- Judge0 integration for code execution
- Real-time updates via Supabase Realtime

## Tech Stack

- **Frontend**: Next.js 14 (App Router), Tailwind CSS, shadcn/ui
- **Backend**: Supabase (Auth, Postgres, Realtime, Edge Functions)
- **Code Execution**: Judge0 API
- **Deployment**: Vercel (Frontend), Supabase (Backend)

## Setup Instructions

### 1. Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Get your project URL and anon key from Project Settings > API
3. Run the database schema from `supabase/migrations/001_initial_schema.sql`
4. Enable Row Level Security (already in schema)

### 2. Judge0 Setup

1. Sign up at [judge0.com](https://judge0.com)
2. Get your API key from the dashboard
3. Add to Supabase environment variables:
