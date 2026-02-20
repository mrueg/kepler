# Kepler

![Kepler Logo](public/logo.svg)

A single-page application (SPA) for browsing and discovering [Kubernetes Enhancement Proposals (KEPs)](https://github.com/kubernetes/enhancements/tree/master/keps).

## Features

- 📋 **Browse all KEPs** fetched live from the kubernetes/enhancements GitHub repository
- 🔍 **Search** by title, KEP number, or author
- 🎛️ **Filter** by SIG, status (provisional, implementable, implemented, etc.), and stage (alpha, beta, stable)
- 📄 **Detail view** showing full metadata: authors, reviewers, approvers, milestones, and links to GitHub
- ⚡ **Client-side caching** in localStorage (6 hour TTL) to avoid re-fetching on subsequent visits
- 📱 **Responsive** layout that works on mobile and desktop

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run start
```

## Tech Stack

- [Next.js](https://nextjs.org/) 15 with App Router
- [React](https://react.dev) + [TypeScript](https://www.typescriptlang.org/)
- [js-yaml](https://github.com/nodeca/js-yaml) for parsing KEP YAML metadata
- [GitHub REST API](https://docs.github.com/en/rest) + [raw.githubusercontent.com](https://raw.githubusercontent.com) for data fetching
