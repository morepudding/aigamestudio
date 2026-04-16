# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Eden Studio is a web-based game studio management platform built with Next.js 16 and React 19. It simulates running a game development studio with AI-powered "collaborateurs" (agents) who have distinct personalities and memories. The platform manages game projects through an automated pipeline system.

## Development Commands

```bash
npm run dev      # Start development server (localhost:3000)
npm run build    # Production build
npm run lint     # Run ESLint
```

## Architecture

### Core Concepts

- **Agents (Collaborateurs)**: AI team members with personalities (`PersonalityTrait`), departments (`Department`), and persistent memories stored in Supabase
- **Projects**: Game projects with statuses (concept → in-dev → released) and deliverables tracking
- **Pipeline Tasks**: Automated workflow tasks organized in waves with dependencies, assignable to agents
- **Chat System**: Conversations with agents that persist memories and adapt based on relationship confidence level

### Key Directories

- `app/` - Next.js App Router pages and API routes
- `app/api/ai/` - AI endpoints using OpenRouter API (DeepSeek V3 model)
- `app/api/pipeline/` - Task execution and pipeline management
- `lib/services/` - Business logic layer (agents, chat, pipeline, memory, projects)
- `lib/types/` - TypeScript type definitions
- `lib/config/llm.ts` - LLM model configuration and OpenRouter API wrapper
- `lib/prompts/` - System prompts and rules for AI agents
- `components/` - React components (sidebar, chat panel, pipeline UI)
- `supabase/migrations/` - Database schema migrations

### Data Flow

1. **Agent Chat**: User message → `chatService.ts` → `/api/ai/reply` → OpenRouter → response with personality + memories
2. **Pipeline Execution**: Task ready → `/api/pipeline/task/[taskId]/execute` → Agent generates deliverable → Review flow
3. **Memory System**: Conversations → `extractMemories()` → Supabase storage → Retrieved for context in future chats

### Database (Supabase)

Key tables:
- `agents` - Team member profiles with personality, appearance, backstory
- `conversations` / `messages` - Chat history with agents
- `agent_memories` - Extracted memories from conversations
- `pipeline_tasks` / `task_executions` - Project automation pipeline
- `project_decisions` - Recorded project decisions

### LLM Integration

All AI calls go through OpenRouter (`lib/config/llm.ts`). Environment variables:
- `OPENROUTER_API_KEY` or `OPEN_ROUTE_SERVICE_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Type System

- `lib/types/agent.ts` - Agent, Department, PersonalityTrait, Appearance
- `lib/types/task.ts` - PipelineTask, TaskExecution, Wave, TaskStatus
- `lib/types/project.ts` - Project, ProjectStatus, ConceptDeliverables
- `lib/types/chat.ts` - Conversation, Message, MessageType

### UI Patterns

- Uses Tailwind CSS v4 with custom design tokens in `globals.css`
- Dark theme with glassmorphism effects
- Shadcn/ui components in `components/ui/`
- French language interface (lang="fr")

## RTK - Token Optimization

RTK (Rust Token Killer) is installed globally. Always use `rtk` as a prefix for verbose CLI commands to reduce token consumption by 60-90%.

```bash
# Git
rtk git status        # instead of: git status
rtk git log -n 10     # instead of: git log
rtk git diff          # instead of: git diff
rtk git add .         # instead of: git add
rtk git commit -m ""  # instead of: git commit

# Build & Lint
rtk next build        # instead of: next build
rtk tsc               # instead of: tsc
rtk lint              # instead of: eslint

# Files
rtk ls .              # instead of: ls
rtk grep "pattern" .  # instead of: grep/rg

# Stats
rtk gain              # token savings report
```
