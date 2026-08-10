# Faddernavn

A voting board for SIFI faddere. Add people, suggest names, and vote once per name.

## Deploy on Vercel

Import the GitHub repository and leave the framework preset set to **Next.js**. In the project’s Storage page, create a Neon Postgres database and connect it to this project, then redeploy. Vercel supplies the required `DATABASE_URL` automatically.

Don’t set an output directory.

## Run locally

Requires Node.js 22.13 or newer and a Postgres `DATABASE_URL` in `.env.local`.

```bash
npm install
npm run dev
```

Open http://localhost:3000.
