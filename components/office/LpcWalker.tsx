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

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { ZoneBounds, ZoneBoundsData } from "@/lib/types/office";
import { isPolygonBounds, isPointInPolygon, isRectangleBounds, toZoneBounds } from "@/lib/types/office";

const FRAME_SIZE = 64;   // px — one LPC tile
const FRAMES = 9;        // frames per row
const SCALE = 2;         // pixel-perfect ×2 upscale
const DISPLAY = FRAME_SIZE * SCALE; // 128 px on screen
const FRAME_DURATION_MS = 110;

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
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    if (!walking) {
      setFrameIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setFrameIndex((current) => (current + 1) % FRAMES);
    }, FRAME_DURATION_MS);

    return () => window.clearInterval(timer);
  }, [walking]);

  return (
    <div
      role="img"
      aria-label={title}
      title={title}
      className={`lpc-walker ${className}`}
      style={{
        width: DISPLAY,
        height: DISPLAY,
        overflow: "hidden",
        position: "relative",
        imageRendering: "pixelated",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          width: FRAMES * DISPLAY,
          height: 4 * DISPLAY,
          imageRendering: "pixelated",
          backgroundImage: `url(${spriteUrl})`,
          backgroundRepeat: "no-repeat",
          backgroundSize: `${FRAMES * DISPLAY}px ${4 * DISPLAY}px`,
          transform: `translate(${-frameIndex * DISPLAY}px, ${-row * DISPLAY}px)`,
          transformOrigin: "top left",
          willChange: walking ? "transform" : undefined,
        }}
      />
    </div>
  );
}

// ── Autonomous walker — moves between random waypoints ────────────────────

interface Waypoint { x: number; y: number }

// Extended interface for multiple zones support
export interface AgentZone {
  id: string;
  bounds: ZoneBoundsData;
  isExclusive: boolean;
  priority: number;
}

function randomPointInRectangle(bounds: ZoneBounds, containerW: number, containerH: number): Waypoint | null {
  const margin = DISPLAY * 0.6;
  const minX = bounds.x1 * containerW + margin;
  const maxX = bounds.x2 * containerW - margin;
  const minY = bounds.y1 * containerH + margin;
  const maxY = bounds.y2 * containerH - margin;

  if (maxX <= minX || maxY <= minY) {
    return null;
  }

  return {
    x: minX + Math.random() * (maxX - minX),
    y: minY + Math.random() * (maxY - minY),
  };
}

function randomPointInPolygon(bounds: ZoneBoundsData, containerW: number, containerH: number): Waypoint | null {
  if (!isPolygonBounds(bounds)) {
    return null;
  }

  const box = toZoneBounds(bounds);

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const candidate = randomPointInRectangle(box, containerW, containerH);
    if (!candidate) {
      return null;
    }

    const normalizedPoint = {
      x: candidate.x / containerW,
      y: candidate.y / containerH,
    };

    if (isPointInPolygon(normalizedPoint, bounds.points)) {
      return candidate;
    }
  }

  return null;
}

function randomWaypoint(
  containerW: number,
  containerH: number,
  zones?: AgentZone[]
): Waypoint {
  const margin = DISPLAY * 0.6;
  
  // If no zones or empty zones array, use full container
  if (!zones || zones.length === 0) {
    return {
      x: margin + Math.random() * (containerW - margin * 2),
      y: margin + Math.random() * (containerH - margin * 2),
    };
  }
  
  // Filter for exclusive zones first, then sort by priority
  const exclusiveZones = zones.filter(z => z.isExclusive);
  const availableZones = exclusiveZones.length > 0 ? exclusiveZones : zones;
  const sortedZones = [...availableZones].sort((a, b) => b.priority - a.priority);
  
  // Try each zone in order of priority
  for (const zone of sortedZones) {
    if (isRectangleBounds(zone.bounds)) {
      const rectanglePoint = randomPointInRectangle(zone.bounds.bounds, containerW, containerH);
      if (rectanglePoint) {
        return rectanglePoint;
      }
    }

    if (isPolygonBounds(zone.bounds)) {
      const polygonPoint = randomPointInPolygon(zone.bounds, containerW, containerH);
      if (polygonPoint) {
        return polygonPoint;
      }
    }
  }
  
  // Fallback to full container if no valid zones
  return {
    x: margin + Math.random() * (containerW - margin * 2),
    y: margin + Math.random() * (containerH - margin * 2),
  };
}

// Helper function to check if a point is within any zone
function isPointInZones(
  x: number,
  y: number,
  zones: AgentZone[],
  containerW: number,
  containerH: number
): boolean {
  if (!zones || zones.length === 0) return true;
  
  const normalizedX = x / containerW;
  const normalizedY = y / containerH;
  
  for (const zone of zones) {
    const isInside = isRectangleBounds(zone.bounds)
      ? normalizedX >= zone.bounds.bounds.x1 && normalizedX <= zone.bounds.bounds.x2 && normalizedY >= zone.bounds.bounds.y1 && normalizedY <= zone.bounds.bounds.y2
      : isPointInPolygon({ x: normalizedX, y: normalizedY }, zone.bounds.points);

    if (isInside) {
      return true;
    }
  }
  
  // Check if agent is in an exclusive zone (must stay inside)
  const exclusiveZones = zones.filter(z => z.isExclusive);
  if (exclusiveZones.length > 0) {
    // If in exclusive zone, must stay in that zone
    for (const zone of exclusiveZones) {
      const isInside = isRectangleBounds(zone.bounds)
        ? normalizedX >= zone.bounds.bounds.x1 && normalizedX <= zone.bounds.bounds.x2 && normalizedY >= zone.bounds.bounds.y1 && normalizedY <= zone.bounds.bounds.y2
        : isPointInPolygon({ x: normalizedX, y: normalizedY }, zone.bounds.points);

      if (isInside) {
        return true;
      }
    }
    return false;
  }
  
  return true; // Non-exclusive zones allow movement outside
}

function dirFromDelta(dx: number, dy: number): Direction {
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "E" : "W";
  return dy > 0 ? "S" : "N";
}

export interface LpcAutoWalkerProps extends Omit<LpcWalkerProps, "walking" | "direction"> {
  /** Agent name shown in tooltip */
  agentName?: string;
  /** Agent department for zone filtering */
  agentDepartment?: string;
  /** Called on click */
  onClick?: () => void;
  /** Parent container width in px */
  containerW: number;
  /** Parent container height in px */
  containerH: number;
  /** Initial position (fractional 0–1) */
  initialX?: number;
  initialY?: number;
  /** Optional single zone (backward compatibility) */
  zoneBounds?: ZoneBounds;
  /** Multiple zones with priorities */
  zones?: AgentZone[];
  /** Visual scale multiplier */
  scale?: number;
  /** Show selected outline */
  selected?: boolean;
}

export function LpcAutoWalker({
  spriteUrl,
  agentName,
  agentDepartment,
  onClick,
  containerW,
  containerH,
  initialX = 0.5,
  initialY = 0.5,
  className = "",
  zoneBounds,
  zones = [],
  scale = 1,
  selected = false,
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

  // Convert legacy zoneBounds to zones array for backward compatibility
  const effectiveZones = useMemo<AgentZone[]>(() => {
    if (zones && zones.length > 0) {
      return zones;
    }
    if (zoneBounds) {
      return [{
        id: "legacy-zone",
        bounds: { type: "rectangle" as const, bounds: zoneBounds },
        isExclusive: true,
        priority: 1,
      }];
    }
    return [];
  }, [zoneBounds, zones]);

  const pickNewTarget = useCallback(() => {
    const wp = randomWaypoint(containerW, containerH, effectiveZones);
    setTarget(wp);
    setWalking(true);
  }, [containerW, containerH, effectiveZones]);

  // Schedule next walk after an idle pause
  const scheduleNextWalk = useCallback(() => {
    const delay = 1500 + Math.random() * 3000;
    idleTimerRef.current = setTimeout(pickNewTarget, delay);
  }, [pickNewTarget]);

  // When zones change and agent is outside, pick a new target inside
  useEffect(() => {
    if (effectiveZones.length === 0) return;
    
    setPos((current) => {
      const isInside = isPointInZones(current.x, current.y, effectiveZones, containerW, containerH);
      if (!isInside) {
        const wp = randomWaypoint(containerW, containerH, effectiveZones);
        setTarget(null);
        setWalking(false);
        return wp;
      }
      return current;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerH, containerW, effectiveZones]);

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
        
        // Check if new position is within allowed zones
        const isInside = isPointInZones(nx, ny, effectiveZones, containerW, containerH);
        if (!isInside) {
          // If moving outside zones, pick a new target inside
          const newTarget = randomWaypoint(containerW, containerH, effectiveZones);
          setTarget(newTarget);
          return current; // Stay at current position
        }
        
        setDirection(dirFromDelta(dx, dy));
        return { x: nx, y: ny };
      });

      animRef.current = requestAnimationFrame(step);
    }

    animRef.current = requestAnimationFrame(step);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [target, scheduleNextWalk, effectiveZones, containerW, containerH]);

  return (
    <div
      className={`absolute cursor-pointer select-none group ${className}`}
      style={{
        left: pos.x - DISPLAY / 2,
        top: pos.y - DISPLAY / 2,
        zIndex: Math.round(pos.y), // isometric depth sort
        transition: "none",
        transform: `scale(${scale})`,
        transformOrigin: "center",
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
      {selected && (
        <div className="absolute -inset-2 border-2 border-indigo-400 rounded-lg pointer-events-none animate-pulse" />
      )}
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
