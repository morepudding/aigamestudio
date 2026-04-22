from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


ROOT_DIR = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT_DIR / ".env.local"
if ENV_PATH.exists():
  load_dotenv(ENV_PATH)


class ProjectInfo(BaseModel):
  id: str
  title: str
  description: str
  genre: str
  engine: str
  platforms: list[str] = Field(default_factory=list)
  courseInfo: dict[str, Any] | None = None


class DocumentsPayload(BaseModel):
  backlogMarkdown: str
  gdd: str | None = None
  techSpec: str | None = None
  dataArch: str | None = None


class AgentPayload(BaseModel):
  slug: str
  name: str
  department: str
  specialization: str | None = None
  status: str | None = None


class PlanningContextPayload(BaseModel):
  studioIdentity: str = ""
  productDirective: str = ""
  technicalDirective: str = ""


class ConstraintsPayload(BaseModel):
  maxTasksPerWave: int = 5
  preferSmallSlices: bool = True
  mustProduceRepoPaths: bool = True


class PlanningRequest(BaseModel):
  project: ProjectInfo
  documents: DocumentsPayload
  agents: list[AgentPayload] = Field(default_factory=list)
  context: PlanningContextPayload = Field(default_factory=PlanningContextPayload)
  constraints: ConstraintsPayload = Field(default_factory=ConstraintsPayload)


class PlanningTask(BaseModel):
  title: str
  description: str
  backlog_ref: str
  agent_department: str
  specialization: str | None = None
  deliverable_type: str = "code"
  deliverable_path: str
  context_files: list[str] = Field(default_factory=list)
  depends_on_refs: list[str] = Field(default_factory=list)
  planning_notes: str | None = None


class PlanningWave(BaseModel):
  number: int
  goal: str
  tasks: list[PlanningTask]


class PlanningResponse(BaseModel):
  planningSummary: str
  warnings: list[str] = Field(default_factory=list)
  waves: list[PlanningWave]
  token_usage: int | None = None


app = FastAPI(title="Eden Studio Crew Planner", version="0.1.0")


def extract_json(raw: str) -> str:
  fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
  if fenced:
    return fenced.group(1).strip()

  bare = re.search(r"(\{[\s\S]*\})", raw)
  if bare:
    return bare.group(1).strip()

  return raw.strip()


def normalize_path(raw_title: str, deliverable_type: str) -> str:
  slug = re.sub(r"[^a-z0-9]+", "-", raw_title.lower()).strip("-") or "task"
  if deliverable_type == "markdown":
    return f"docs/{slug}.md"
  if deliverable_type == "json":
    return f"data/{slug}.json"
  if deliverable_type == "config":
    return f"config/{slug}.json"
  return f"src/{slug}.ts"


def infer_type(title: str) -> str:
  lower = title.lower()
  if any(keyword in lower for keyword in ["doc", "spec", "gdd", "readme", "backlog"]):
    return "markdown"
  if any(keyword in lower for keyword in ["config", "setup", "pipeline"]):
    return "config"
  if any(keyword in lower for keyword in ["state", "schema", "data"]):
    return "json"
  return "code"


def infer_department(title: str, description: str, agents: list[AgentPayload]) -> tuple[str, str | None]:
  haystack = f"{title} {description}".lower()
  if any(token in haystack for token in ["ui", "screen", "hud", "menu", "interface"]):
    return "programming", "ui-tech"
  if any(token in haystack for token in ["api", "data", "save", "persist", "auth"]):
    return "programming", "backend"
  if any(token in haystack for token in ["engine", "performance", "build", "deploy", "tooling"]):
    return "programming", "engine"

  for agent in agents:
    if agent.department:
      return agent.department, agent.specialization

  return "programming", "gameplay"


def parse_backlog_items(backlog_markdown: str) -> list[tuple[str, str]]:
  items: list[tuple[str, str]] = []
  current_ref: str | None = None
  current_text: list[str] = []

  for raw_line in backlog_markdown.splitlines():
    line = raw_line.strip()
    ref_match = re.match(r"[-*\d.)\s]*([A-Z]{2,}-\d+)[:\s-]*(.*)", line)
    if ref_match:
      if current_ref and current_text:
        items.append((current_ref, " ".join(current_text).strip()))
      current_ref = ref_match.group(1)
      current_text = [ref_match.group(2).strip()] if ref_match.group(2).strip() else []
      continue

    if current_ref and line:
      current_text.append(line)

  if current_ref and current_text:
    items.append((current_ref, " ".join(current_text).strip()))

  if items:
    return items

  bullets = [line.strip("- *") for line in backlog_markdown.splitlines() if line.strip().startswith(("-", "*"))]
  return [(f"BG-{index + 1:02d}", bullet) for index, bullet in enumerate(bullets) if bullet]


def build_heuristic_plan(payload: PlanningRequest) -> PlanningResponse:
  backlog_items = parse_backlog_items(payload.documents.backlogMarkdown)
  if not backlog_items:
    raise HTTPException(status_code=400, detail="No backlog items found in backlogMarkdown")

  max_per_wave = max(1, payload.constraints.maxTasksPerWave)
  waves: list[PlanningWave] = []

  for index in range(0, len(backlog_items), max_per_wave):
    wave_number = len(waves) + 1
    chunk = backlog_items[index:index + max_per_wave]
    tasks: list[PlanningTask] = []

    for task_index, (backlog_ref, text) in enumerate(chunk):
      title = text[:90].strip().rstrip(".") or f"Implémenter {backlog_ref}"
      description = text or f"Traiter l'item backlog {backlog_ref}."
      department, specialization = infer_department(title, description, payload.agents)
      deliverable_type = infer_type(title)
      context_files = ["docs/backlog.md"]
      if payload.documents.gdd:
        context_files.append("docs/gdd.md")
      if payload.documents.techSpec:
        context_files.append("docs/tech-spec.md")
      if payload.documents.dataArch:
        context_files.append("docs/data-arch.md")

      tasks.append(
        PlanningTask(
          title=title,
          description=description,
          backlog_ref=backlog_ref,
          agent_department=department,
          specialization=specialization,
          deliverable_type=deliverable_type,
          deliverable_path=normalize_path(title, deliverable_type),
          context_files=context_files,
          depends_on_refs=[chunk[task_index - 1][0]] if task_index > 0 else [],
          planning_notes="Fallback heuristique locale: à remplacer par un plan LLM plus précis si nécessaire.",
        )
      )

    waves.append(
      PlanningWave(
        number=wave_number,
        goal=f"Wave {wave_number} - {payload.project.title}",
        tasks=tasks,
      )
    )

  return PlanningResponse(
    planningSummary=f"Plan heuristique généré pour {payload.project.title} à partir du backlog.",
    warnings=["OpenRouter indisponible: fallback heuristique utilisé."] if not os.getenv("OPENROUTER_API_KEY") else [],
    waves=waves,
    token_usage=None,
  )


def build_planning_prompt(payload: PlanningRequest) -> str:
  docs = []
  docs.append(f"## Backlog\n{payload.documents.backlogMarkdown}")
  if payload.documents.gdd:
    docs.append(f"## GDD\n{payload.documents.gdd}")
  if payload.documents.techSpec:
    docs.append(f"## Tech Spec\n{payload.documents.techSpec}")
  if payload.documents.dataArch:
    docs.append(f"## Data Arch\n{payload.documents.dataArch}")

  agents = "\n".join(
    f"- {agent.name} ({agent.slug}) dept={agent.department} spec={agent.specialization or 'n/a'}"
    for agent in payload.agents
  ) or "- aucun agent fourni"

  schema = {
    "planningSummary": "string",
    "warnings": ["string"],
    "waves": [
      {
        "number": 1,
        "goal": "string",
        "tasks": [
          {
            "title": "string",
            "description": "string",
            "backlog_ref": "string",
            "agent_department": "string",
            "specialization": "string|null",
            "deliverable_type": "code|markdown|json|config|repo-init",
            "deliverable_path": "string",
            "context_files": ["string"],
            "depends_on_refs": ["string"],
            "planning_notes": "string|null",
          }
        ],
      }
    ],
  }

  return f"""
You are the backlog planning orchestrator for Eden Studio.

Return strict JSON only. No markdown. No prose outside JSON.
Rules:
- Eden Studio ships compact, polished web mini-games that must actually be finishable.
- Target scope is arcade-scale: think Pong, Tetris, or a very small Mario Bros style slice, not a broad production roadmap.
- The first wave should move the project toward a playable build quickly: core loop, readable UI, and the minimum integration surface.
- Keep tasks small, reviewable and repo-oriented.
- Respect maxTasksPerWave={payload.constraints.maxTasksPerWave}.
- Always include deliverable_path and context_files.
- Use repo paths relative to project root.
- Keep dependencies only when they are real blockers.
- Prefer the programming department unless a different department is explicitly better.
- Never assume Godot, native export, console, or desktop packaging.
- Do not emit warnings for engine/platform ambiguity when the provided context already states a web-only direction.

Project:
- id: {payload.project.id}
- title: {payload.project.title}
- description: {payload.project.description}
- genre: {payload.project.genre}
- engine: {payload.project.engine}
- platforms: {', '.join(payload.project.platforms)}

Studio context:
- identity: {payload.context.studioIdentity}
- product: {payload.context.productDirective}
- technical: {payload.context.technicalDirective}

Agents:
{agents}

Documents:
{"\n\n".join(docs)}

Output schema example:
{json.dumps(schema, ensure_ascii=True, indent=2)}
""".strip()


def filter_warnings(payload: PlanningRequest, warnings: list[str]) -> list[str]:
  filtered: list[str] = []
  engine_known = bool(payload.project.engine.strip())
  web_only = any(platform.strip().lower() == "web" for platform in payload.project.platforms)
  web_context = " ".join([
    payload.context.studioIdentity,
    payload.context.productDirective,
    payload.context.technicalDirective,
  ]).lower()
  web_direction_known = web_only or "web" in web_context or "browser" in web_context

  for warning in warnings:
    lower = warning.lower()
    if ("engine not yet defined" in lower or "no engine specified" in lower) and (
      engine_known or web_direction_known
    ):
      continue
    if ("assuming godot" in lower or "assuming web-based delivery" in lower) and (
      engine_known or web_direction_known
    ):
      continue
    if (
      "platform targets not specified" in lower
      or "no platform targets specified" in lower
      or "browser-first" in lower
      or "web export" in lower
    ) and web_direction_known:
      continue
    filtered.append(warning)

  return filtered


def normalize_planning_summary(payload: PlanningRequest, summary: str) -> str:
  raw_summary = summary.strip()
  lower = raw_summary.lower()
  useful_tokens = ["playable", "jouable", "web", "browser", "ui", "interface", "vertical slice"]
  if raw_summary and any(token in lower for token in useful_tokens):
    return raw_summary

  return (
    f"Plan centré sur un mini-jeu web compact pour {payload.project.title}: "
    "amener rapidement une boucle jouable, une UI lisible et l'integration VN minimale avant d'elargir le scope."
  )


async def call_openrouter(payload: PlanningRequest) -> PlanningResponse:
  api_key = os.getenv("OPENROUTER_API_KEY") or os.getenv("OPEN_ROUTE_SERVICE_API_KEY")
  if not api_key:
    return build_heuristic_plan(payload)

  model = os.getenv("CREWAI_PLANNER_MODEL", "deepseek/deepseek-chat-v3-0324")
  prompt = build_planning_prompt(payload)

  async with httpx.AsyncClient(timeout=90) as client:
    response = await client.post(
      "https://openrouter.ai/api/v1/chat/completions",
      headers={
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": os.getenv("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),
        "X-Title": "Eden Studio Crew Planner",
      },
      json={
        "model": model,
        "messages": [
          {
            "role": "system",
            "content": "You generate strict JSON backlog planning outputs for a game studio pipeline.",
          },
          {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
        "max_tokens": 4096,
      },
    )

  if response.status_code >= 400:
    raise HTTPException(status_code=502, detail=f"OpenRouter error {response.status_code}: {response.text}")

  body = response.json()
  raw_content = body.get("choices", [{}])[0].get("message", {}).get("content", "")
  try:
    parsed = json.loads(extract_json(raw_content))
    parsed.setdefault("warnings", [])
    parsed["warnings"] = filter_warnings(payload, parsed["warnings"])
    parsed["planningSummary"] = normalize_planning_summary(
      payload, str(parsed.get("planningSummary", ""))
    )
    parsed["token_usage"] = body.get("usage", {}).get("total_tokens")
    return PlanningResponse.model_validate(parsed)
  except Exception:
    heuristic = build_heuristic_plan(payload)
    heuristic.warnings.append("La sortie LLM n'était pas un JSON strict. Fallback heuristique appliqué.")
    heuristic.token_usage = body.get("usage", {}).get("total_tokens")
    return heuristic


@app.get("/health")
async def health() -> dict[str, Any]:
  return {
    "ok": True,
    "envLoaded": ENV_PATH.exists(),
    "openrouterConfigured": bool(os.getenv("OPENROUTER_API_KEY") or os.getenv("OPEN_ROUTE_SERVICE_API_KEY")),
    "model": os.getenv("CREWAI_PLANNER_MODEL", "deepseek/deepseek-chat-v3-0324"),
  }


@app.post("/plan-backlog", response_model=PlanningResponse)
async def plan_backlog(payload: PlanningRequest) -> PlanningResponse:
  try:
    return await call_openrouter(payload)
  except HTTPException:
    raise
  except Exception as error:
    raise HTTPException(status_code=500, detail=str(error)) from error