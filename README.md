# Veritas Prototype

A modern information feed application built with Next.js and Supabase.

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Icons**: Lucide React

## Prerequisites

- Node.js 18+
- Docker Desktop (for local Supabase)
- npm or yarn

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment variables:**
   - Copy `.env.local.example` to `.env.local` (if exists)
   - Or configure the following in `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. **Run development server:**
   ```bash
   npm run dev
   ```

4. **For local Supabase development:**
   ```bash
   supabase start
   ```

## Project Structure

```
src/
├── app/              # Next.js app router pages
├── components/       # React components
│   ├── feed/        # Feed-related components
│   └── layout/      # Layout components
├── hooks/           # Custom React hooks
├── lib/             # External library configs
├── providers/       # React context providers
├── styles/          # Global styles
└── types/           # TypeScript type definitions
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint