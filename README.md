# HuddleUp

HuddleUp is a real-time collaboration application that allows users to communicate one-on-one or in groups via messaging and video chat.

## Preview

![App Screenshot](./public/thumbnail.png)

## Live Demo

[View Live Site](https://huddle-up-xi.vercel.app/)

## Tech Stack

- **Frontend**: React 18 with Vite
- **Backend**: Convex (real-time database and serverless functions)
- **Authentication**: Convex Auth with email/password
- **Video Calls**: LiveKit
- **Testing**: Vitest with React Testing Library
- **Linting**: ESLint with React and accessibility plugins
- **Formatting**: Prettier

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd huddleUp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up Convex:
   ```bash
   npx convex dev
   ```
   This will prompt you to log in to Convex and create a new project. Follow the prompts.

4. Copy the environment example and add your Convex URL:
   ```bash
   cp .env.example .env.local
   ```
   Then update `VITE_CONVEX_URL` with your Convex deployment URL.

5. Start the development server:
   ```bash
   npm run dev
   ```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint issues |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check code formatting |
| `npm run test` | Run tests in watch mode |
| `npm run test:ui` | Run tests with UI |
| `npm run test:coverage` | Run tests with coverage |

## Project Structure

```
huddleUp/
├── convex/              # Convex backend
│   ├── schema.ts        # Database schema
│   ├── auth.ts          # Authentication setup
│   ├── http.ts          # HTTP routes
│   └── lib/             # Shared utilities
├── src/
│   ├── components/      # React components
│   │   ├── auth/        # Authentication components
│   │   ├── chat/        # Chat UI components
│   │   ├── calls/       # Call UI components
│   │   ├── calendar/    # Calendar components
│   │   ├── common/      # Shared components
│   │   └── errors/      # Error boundary components
│   ├── hooks/           # Custom React hooks
│   ├── contexts/        # React contexts
│   ├── utils/           # Utility functions
│   ├── constants/       # App constants
│   ├── App.jsx          # Main app component
│   ├── main.jsx         # Entry point
│   └── index.css        # Global styles
├── public/
│   ├── sw.js            # Service worker
│   └── manifest.json    # PWA manifest
├── tests/
│   ├── setup.js         # Test setup
│   ├── components/      # Component tests
│   ├── hooks/           # Hook tests
│   └── convex/          # Convex function tests
└── ...config files
```

## Environment Variables

### Frontend (.env.local)
- `VITE_CONVEX_URL` - Convex deployment URL

### Convex Dashboard
- `LIVEKIT_API_KEY` - LiveKit API credentials
- `LIVEKIT_API_SECRET` - LiveKit secret
- `LIVEKIT_URL` - LiveKit server URL
- `VAPID_PUBLIC_KEY` - Web Push VAPID public key
- `VAPID_PRIVATE_KEY` - Web Push VAPID private key

## License

MIT
