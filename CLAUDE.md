# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run setup          # First-time setup: install deps, generate Prisma client, run migrations
npm run dev            # Start dev server with Turbopack
npm run dev:daemon     # Dev server with Node.js compatibility shim (needed for some environments)
npm run build          # Production build (includes node-compat shim)
npm run lint           # ESLint
npm run test           # Run Vitest unit tests
npm run db:reset       # Reset SQLite database (destructive)
npx prisma studio      # Browse database
```

To run a single test file: `npx vitest src/lib/__tests__/file-system.test.ts`

## Architecture

**UIGen** is an AI-powered React component generator. Users describe components in a chat interface; Claude generates and iterates on React code with live preview.

### Request Flow

1. User types in chat → `ChatContext` (`src/lib/contexts/`) handles state via Vercel AI SDK `useChat`
2. POST to `/api/chat/route.ts` with messages + serialized virtual file system
3. Claude streams responses with tool calls (`str_replace_editor`, `file_manager`)
4. `FileSystemContext` processes tool results, updating the virtual file system
5. `PreviewFrame` compiles JSX via Babel Standalone in an iframe and renders it live
6. If authenticated, updated file system is persisted to SQLite via Prisma

### Key Architectural Decisions

**Virtual File System** (`src/lib/file-system.ts`): All generated code lives in memory — nothing is written to disk. Serialized to JSON for database persistence and sent with each API request so Claude has full context.

**AI Provider** (`src/lib/provider.ts`): Uses `claude-haiku-4-5` by default. Falls back to `MockLanguageModel` if `ANTHROPIC_API_KEY` is not set — mock mode simulates tool use for demo/testing without an API key.

**Prompt Caching**: System prompt in `/api/chat/route.ts` uses Anthropic's `ephemeral` cache control to reduce costs on repeated requests.

**Authentication**: JWT sessions in HTTP-only cookies (7-day expiry). Anonymous users can use the app without an account — sessions are tracked via `localStorage`. Only authenticated users get database persistence.

**Layout**: Three-panel resizable layout in `src/app/main-content.tsx` — chat (left), preview/code editor (right). Preview and code views share the right panel as tabs.

### Directory Map

```
src/app/
  api/chat/route.ts       # AI streaming endpoint with tool use
  [projectId]/page.tsx    # Project page (loads persisted state)
  main-content.tsx        # Root layout with resizable panels

src/components/
  chat/                   # Chat UI, message rendering, input
  editor/                 # Monaco editor + file tree
  preview/                # iframe-based live preview
  auth/                   # Sign in/up forms

src/lib/
  contexts/               # ChatContext, FileSystemContext (core state)
  tools/                  # AI tool definitions (str_replace, file_manager)
  prompts/                # Claude system prompts
  provider.ts             # LLM provider (real or mock)
  file-system.ts          # Virtual FS implementation
  auth.ts                 # JWT session utilities

src/actions/              # Next.js server actions (auth, CRUD for projects)
prisma/schema.prisma      # SQLite: User + Project models
```

### Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | No | If absent, mock provider is used |
| `JWT_SECRET` | Yes (prod) | For signing session tokens |

## Working with Claude Code

### Prompting for Fewer Tokens

**Be direct — skip the preamble.**
- Bad: `"I was wondering if maybe we could look at possibly changing the button color"`
- Good: `"Change button color to blue in src/components/chat/ChatInput.tsx"`

**Include the file path when you know it.** I won't need to search.
- Bad: `"Fix the login form validation"`
- Good: `"Fix email validation in src/components/auth/SignInForm.tsx"`

**State the what, not the why.** I don't need backstory unless it changes the solution.
- Bad: `"The user reported that when they click submit nothing happens, it might be a state issue or maybe an event handler..."`
- Good: `"Submit button in ChatInput doesn't fire — check the onClick handler"`

**For bugs: paste the exact error + file:line.** No need to describe what you were doing.

**For new features: describe input/output, not implementation.**
- Good: `"Add a copy-to-clipboard button on each code block in the chat messages"`

**Use slash commands for repeated tasks** — `/audit` to check the dev server, `/review` for PR review, `/security-review` for security checks.

**One request per message.** Bundling 3 things in one prompt costs more tokens and increases the chance I miss one.

### What I Already Know (No Need to Repeat)
- Stack: Next.js 15, Turbopack, Tailwind, Prisma/SQLite, Vercel AI SDK, Anthropic Claude
- Dev server runs on `localhost:3000`
- All generated component code lives in the virtual file system (in-memory), not on disk
- Auth is JWT in HTTP-only cookies; anonymous users are supported
- Mock mode activates automatically when `ANTHROPIC_API_KEY` is absent
