# March Madness Bracket Predictor

A data-driven web application for building, simulating, and strategizing NCAA March Madness bracket predictions.

## What It Does

- **Composite probability model** — blends KenPom, Torvik, and Evan Miya ratings into calibrated win probabilities
- **Configurable levers** — tune how much weight experience, tempo, shooting, and other factors carry
- **Monte Carlo simulation** — run 10K–100K bracket simulations to see full path probabilities
- **Contest-aware strategy** — pool size shapes recommendations (chalk for small pools, contrarian for large)
- **AI matchup narratives** — Claude-powered plain-language game breakdowns
- **Backtesting** — validate model performance against 20+ years of tournament history

## Tech Stack

| Layer           | Technology                       |
| --------------- | -------------------------------- |
| Frontend        | Next.js, React, TypeScript       |
| Styling         | Tailwind CSS (dark mode default) |
| Auth & Database | Supabase (PostgreSQL)            |
| Simulation      | Server-side Monte Carlo          |
| AI              | Anthropic Claude API             |
| Deployment      | Railway / Render                 |

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn
- Supabase account (free tier works)
- Anthropic API key (for AI narratives)

### Setup

```bash
# Clone the repo
git clone https://github.com/aidec0ded/march-madness-predictor.git
cd march-madness-predictor

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase and Anthropic keys

# Run database migrations
npx supabase db push

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ANTHROPIC_API_KEY=your_anthropic_api_key
NEXT_PUBLIC_APP_URL=https://your-domain.com  # Used for OpenGraph metadata
```

## Project Structure

```
src/
├── app/              # Next.js App Router pages and API routes
│   └── api/          # Server-side API endpoints
├── components/       # React components
├── hooks/            # Custom React hooks
├── lib/
│   ├── engine/       # Probability model and simulation engine
│   ├── backtest/     # Historical backtesting module
│   ├── game-theory/  # Ownership model and strategy engine
│   ├── guidance/     # Contextual guidance rules engine
│   ├── narrative/    # AI narrative prompt builder
│   └── supabase/     # Supabase client and helpers
└── types/            # TypeScript type definitions
```

## Deployment

### Railway / Render

The app is configured for deployment on Railway or Render with Next.js standalone output:

1. Connect your GitHub repository to your deployment platform.
2. Set all environment variables listed above.
3. The build command is `npm run build` and the start command is `npm start`.
4. Next.js standalone output is configured in `next.config.ts` for optimized container deployments.

**Render-specific:** A `render.yaml` Blueprint is included for one-click deploys.

### Security Headers

Production deployments automatically include security headers (HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy) configured in `next.config.ts`.

### Rate Limiting

API endpoints are rate-limited per IP (or per user for authenticated routes):
- `/api/simulate` — 20 requests/minute
- `/api/narrative` — 10 requests/minute
- `/api/backtest` — 10 requests/minute
- `/api/teams` — 30 requests/minute

## Documentation

- [Product Requirements](docs/PRD.md)
- [User Guide](docs/USER_GUIDE.md)
- [Project Plan](PROJECT_PLAN.md)
- [Development Guide](CLAUDE.md)

## Development

See [CLAUDE.md](CLAUDE.md) for development workflow, conventions, and architecture decisions.

## License

[TBD]
