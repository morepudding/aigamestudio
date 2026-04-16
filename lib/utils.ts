import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function normalizeLineEndings(content: string): string {
  return content.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n")
}

export function unwrapCodeFence(content: string): string {
  const normalized = normalizeLineEndings(content).trim();
  const fenceMatch = normalized.match(/^```[\w-]*[^\n]*\n([\s\S]*?)\n```$/);

  if (!fenceMatch) {
    return content;
  }

  return fenceMatch[1].trim();
}

function looksLikeMarkdown(content: string): boolean {
  return /(^|\n)(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|```|\|.+\||\*\*.+\*\*)/m.test(content)
}

function decodeEscapedMarkdown(content: string): string {
  const trimmed = content.trim()
  const hasRealNewLines = trimmed.includes("\n")
  const hasEscapedNewLines = /\\n|\\r|\\t/.test(trimmed)

  if (!hasEscapedNewLines) {
    return content
  }

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (typeof parsed === "string" && looksLikeMarkdown(parsed)) {
        return normalizeLineEndings(parsed).trim()
      }
    } catch {
      // Fall through to the lightweight decoder below.
    }
  }

  if (hasRealNewLines && !trimmed.startsWith('"')) {
    return content
  }

  const decoded = trimmed
    .replace(/^"([\s\S]*)"$/, "$1")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')

  return looksLikeMarkdown(decoded) ? decoded.trim() : content
}

export function normalizeMarkdownDeliverable(content: string): string {
  let normalized = normalizeLineEndings(content).trim()

  if (!normalized) {
    return normalized
  }

  const original = normalized

  for (let index = 0; index < 3; index += 1) {
    const unfenced = unwrapCodeFence(normalized)
    if (unfenced === normalized) {
      break
    }
    normalized = normalizeLineEndings(unfenced).trim()
  }

  if (normalized.startsWith("```")) {
    const fencedBlock = normalized.match(/```(?:markdown|md|mdx)?[^\n]*\n([\s\S]*?)\n```/i)
    if (fencedBlock) {
      const outsideFence = normalized.replace(fencedBlock[0], "").trim()
      if (!outsideFence || outsideFence.length < 80) {
        normalized = fencedBlock[1].trim()
      }
    }
  }

  normalized = decodeEscapedMarkdown(normalized)

  return looksLikeMarkdown(normalized) ? normalized : original
}
