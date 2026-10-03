/** @type {import('next').NextConfig} */
const { execSync } = require('child_process');

function getGitInfo() {
  try {
    const hash = execSync('git rev-parse --short HEAD').toString().trim();
    const date = execSync('git log -1 --format=%cd --date=short').toString().trim();
    return { hash, date };
  } catch {
    return { hash: 'dev', date: new Date().toISOString().split('T')[0] };
  }
}

const { hash, date } = getGitInfo();

const nextConfig = {
  output: 'standalone', // Required for Docker deployment
  outputFileTracingRoot: __dirname, // single-package repo; don't let a stray parent lockfile move the root
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
