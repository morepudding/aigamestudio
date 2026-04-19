"use client";

/**
 * LpcWalker — displays a walking LPC pixel-art sprite.
 *
 * Spritesheet layout (576×256 px):
 *   Row 0 = walk North   (y=0)
 *   Row 1 = walk West    (y=64)
 *   Row 2 = walk South   (y=128)  ← default idle direction
 *   Row 3 = walk East    (y=192)
 *
 * 9 frames per row × 64 px each → background-position-x cycles from 0 to -512
 * The CSS animation steps through frames using `steps(9)`.
 */

import { useEffect, useRef, useState, useCallback } from "react";

const FRAME_SIZE = 64;   // px — one LPC tile
const FRAMES = 9;        // frames per row
const SCALE = 2;         // pixel-perfect ×2 upscale
const DISPLAY = FRAME_SIZE * SCALE; // 128 px on screen

// Row index → y offset inside the spritesheet
const DIR_ROW: Record<"N" | "W" | "S" | "E", number> = {
  N: 0, W: 1, S: 2, E: 3,
};

type Direction = "N" | "W" | "S" | "E";

export interface LpcWalkerProps {
  /** Absolute URL of the 576×256 spritesheet stored in Supabase */
  spriteUrl: string;
  /** If false, shows idle (no walk animation) */
  walking?: boolean;
  /** Direction the character faces */
  direction?: Direction;
  /** Extra className for the outer wrapper */
  className?: string;
  /** Title text for accessibility */
  title?: string;
}

export function LpcWalker({
  spriteUrl,
  walking = false,
  direction = "S",
  className = "",
  title,
}: LpcWalkerProps) {
  const row = DIR_ROW[direction];
  const yOffset = -(row * FRAME_SIZE * SCALE);

  // The animation is pure CSS. The background-image cycles frames automatically.
  const animName = walking ? "lpcWalk" : undefined;

  return (
    <div
      role="img"
      aria-label={title}
      title={title}
      className={`lpc-walker ${className}`}
      style={{
        width: DISPLAY,
        height: DISPLAY,
        imageRendering: "pixelated",
        backgroundImage: `url(${spriteUrl})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${FRAMES * DISPLAY}px ${4 * DISPLAY}px`,
        backgroundPositionY: `${yOffset}px`,
        animation: animName
          ? `lpcWalk 0.8s steps(${FRAMES}) infinite`
          : undefined,
      }}
    />
  );
}

// ── Autonomous walker — moves between random waypoints ────────────────────

interface Waypoint { x: number; y: number }

export interface ZoneBounds {
  /** Fractional coordinates (0–1) relative to container */
  x1: number; y1: number; x2: number; y2: number;
}

function randomWaypoint(
  containerW: number,
  containerH: number,
  bounds?: ZoneBounds
): Waypoint {
  const margin = DISPLAY * 0.6;
  if (bounds) {
    const minX = bounds.x1 * containerW + margin;
    const maxX = bounds.x2 * containerW - margin;
    const minY = bounds.y1 * containerH + margin;
    const maxY = bounds.y2 * containerH - margin;
    if (maxX > minX && maxY > minY) {
      return {
        x: minX + Math.random() * (maxX - minX),
        y: minY + Math.random() * (maxY - minY),
      };
    }
  }
  return {
    x: margin + Math.random() * (containerW - margin * 2),
    y: margin + Math.random() * (containerH - margin * 2),
  };
}

function dirFromDelta(dx: number, dy: number): Direction {
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "E" : "W";
  return dy > 0 ? "S" : "N";
}

export interface LpcAutoWalkerProps extends Omit<LpcWalkerProps, "walking" | "direction"> {
  /** Agent name shown in tooltip */
  agentName?: string;
  /** Called on click */
  onClick?: () => void;
  /** Parent container width in px */
  containerW: number;
  /** Parent container height in px */
  containerH: number;
  /** Initial position (fractional 0–1) */
  initialX?: number;
  initialY?: number;
  /** Optional zone the agent must stay within */
  zoneBounds?: ZoneBounds;
}

export function LpcAutoWalker({
  spriteUrl,
  agentName,
  onClick,
  containerW,
  containerH,
  initialX = 0.5,
  initialY = 0.5,
  className = "",
  zoneBounds,
}: LpcAutoWalkerProps) {
  const [pos, setPos] = useState<Waypoint>({
    x: initialX * containerW,
    y: initialY * containerH,
  });
  const [target, setTarget] = useState<Waypoint | null>(null);
  const [direction, setDirection] = useState<Direction>("S");
  const [walking, setWalking] = useState(false);
  const [hovered, setHovered] = useState(false);
  const animRef = useRef<number | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pickNewTarget = useCallback(() => {
    const wp = randomWaypoint(containerW, containerH, zoneBounds);
    setTarget(wp);
    setWalking(true);
  }, [containerW, containerH, zoneBounds]);

  // Schedule next walk after an idle pause
  const scheduleNextWalk = useCallback(() => {
    const delay = 1500 + Math.random() * 3000;
    idleTimerRef.current = setTimeout(pickNewTarget, delay);
  }, [pickNewTarget]);

  // When zone changes and agent is outside, pick a new target inside
  useEffect(() => {
    if (!zoneBounds) return;
    setPos((current) => {
      const minX = zoneBounds.x1 * containerW;
      const maxX = zoneBounds.x2 * containerW;
      const minY = zoneBounds.y1 * containerH;
      const maxY = zoneBounds.y2 * containerH;
      if (current.x < minX || current.x > maxX || current.y < minY || current.y > maxY) {
        // Immediately pick a target inside the zone
        const wp = randomWaypoint(containerW, containerH, zoneBounds);
        setTarget(wp);
        setWalking(true);
      }
      return current;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneBounds]);

  // Kick off on mount
  useEffect(() => {
    scheduleNextWalk();
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [scheduleNextWalk]);

  // Animate toward target
  useEffect(() => {
    if (!target) return;

    const SPEED = 1.2; // px per frame (~60fps → ~72px/s)
    let prevTime: number | null = null;

    function step(ts: number) {
      if (!prevTime) prevTime = ts;
      const dt = Math.min(ts - prevTime, 50); // cap delta to avoid jumps
      prevTime = ts;

      setPos((current) => {
        const dx = target!.x - current.x;
        const dy = target!.y - current.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 2) {
          setTarget(null);
          setWalking(false);
          scheduleNextWalk();
          return current;
        }

        const moved = SPEED * (dt / 16.67);
        const nx = current.x + (dx / dist) * moved;
        const ny = current.y + (dy / dist) * moved;
        setDirection(dirFromDelta(dx, dy));
        return { x: nx, y: ny };
      });

      animRef.current = requestAnimationFrame(step);
    }

    animRef.current = requestAnimationFrame(step);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [target, scheduleNextWalk]);

  return (
    <div
      className={`absolute cursor-pointer select-none group ${className}`}
      style={{
        left: pos.x - DISPLAY / 2,
        top: pos.y - DISPLAY / 2,
        zIndex: Math.round(pos.y), // isometric depth sort
        transition: "none",
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <LpcWalker
        spriteUrl={spriteUrl}
        walking={walking}
        direction={direction}
      />
      {/* Name badge on hover */}
      {hovered && agentName && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-0.5 rounded bg-black/80 text-white text-xs whitespace-nowrap pointer-events-none"
          style={{ imageRendering: "auto" }}
        >
          {agentName}
        </div>
      )}
    </div>
  );
}
