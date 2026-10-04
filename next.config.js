/** @type {import('next').NextConfig} */
const { execSync } = require('child_process');

/**
 * Commit shown in the footer. Resolved once, in the main build process, and
 * exported through process.env so Next's build workers (which re-load this file)
 * inherit the same value. Otherwise a worker whose git call fails renders "dev"
 * on the server while the client bundle has the real hash: a hydration error.
 */
function getGitInfo() {
  if (process.env.NEXT_PUBLIC_COMMIT_HASH && process.env.NEXT_PUBLIC_COMMIT_DATE) {
    return { hash: process.env.NEXT_PUBLIC_COMMIT_HASH, date: process.env.NEXT_PUBLIC_COMMIT_DATE };
  }
  const run = (cmd) => execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  try {
    return { hash: run('git rev-parse --short HEAD'), date: run('git log -1 --format=%cd --date=short') };
  } catch {
    // Vercel builds may not have git metadata, but expose the commit SHA.
    const sha = process.env.VERCEL_GIT_COMMIT_SHA;
    return { hash: sha ? sha.slice(0, 7) : 'dev', date: new Date().toISOString().split('T')[0] };
  }
}

const { hash, date } = getGitInfo();
process.env.NEXT_PUBLIC_COMMIT_HASH = hash;
process.env.NEXT_PUBLIC_COMMIT_DATE = date;

const nextConfig = {
  output: 'standalone', // Required for Docker deployment
  outputFileTracingRoot: __dirname, // single-package repo; don't let a stray parent lockfile move the root
  // The MCP methodology resource reads ARCHITECTURE.md at runtime
  outputFileTracingIncludes: { '/api/mcp': ['./ARCHITECTURE.md'] },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  env: {
    NEXT_PUBLIC_COMMIT_HASH: hash,
    NEXT_PUBLIC_COMMIT_DATE: date,
  },
};

module.exports = nextConfig;
