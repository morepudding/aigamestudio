export interface ZoneBounds {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export type PolygonPoint = [number, number];

export interface RectangleZoneBounds {
  type: "rectangle";
  bounds: ZoneBounds;
}

export interface PolygonZoneBounds {
  type: "polygon";
  points: PolygonPoint[];
}

export type ZoneBoundsData = RectangleZoneBounds | PolygonZoneBounds;

export type ZoneType = "department" | "restricted" | "common" | "custom";

export interface OfficeZone {
  id: string;
  name: string;
  description: string | null;
  bounds: ZoneBoundsData;
  color: string;
  opacity: number;
  zone_type: ZoneType;
  department: string | null;
  agent_slug: string | null;
  is_active: boolean;
  is_exclusive: boolean;
  allow_crossing: boolean;
  created_at: string;
  updated_at: string;
}

export interface UIZone {
  id: string;
  name: string;
  color: string;
  opacity: number;
  bounds: ZoneBoundsData;
  is_active: boolean;
  is_exclusive: boolean;
}

export interface ZoneCreatePayload {
  name: string;
  description?: string;
  bounds: ZoneBoundsData;
  color?: string;
  opacity?: number;
  zone_type?: ZoneType;
  department?: string | null;
  agent_slug?: string | null;
  is_active?: boolean;
  is_exclusive?: boolean;
  allow_crossing?: boolean;
}

export interface ZoneUpdatePayload extends Partial<ZoneCreatePayload> {
  id: string;
}

export interface ZoneAssignment {
  zone_id: string;
  agent_slug: string;
  priority: number;
}

export interface DepartmentZoneConfig {
  department: string;
  default_zone_id?: string;
  allowed_zone_ids: string[];
}

export interface ZoneValidationResult {
  isValid: boolean;
  errors: string[];
  warning?: string;
}

export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface ZoneDrawingState {
  isDrawing: boolean;
  currentPoints: NormalizedPoint[];
  isComplete: boolean;
}

export interface ZoneSelection {
  zoneId: string | null;
  isEditing: boolean;
}

export type PointInZoneCheck = (point: NormalizedPoint, zone: OfficeZone) => boolean;
export type ZoneBoundsConverter = (zone: OfficeZone, containerWidth: number, containerHeight: number) => ZoneBounds;

export const DEFAULT_ZONE_COLORS: Record<ZoneType, string> = {
  department: "#3b82f6",
  restricted: "#ef4444",
  common: "#10b981",
  custom: "#f59e0b",
};

export const DEFAULT_DEPARTMENT_ZONES: Record<string, Partial<OfficeZone>> = {
  Art: {
    name: "Zone Art",
    description: "Zone pour les artistes et graphistes",
    zone_type: "department",
    color: "#ef4444",
    is_exclusive: true,
  },
  Programming: {
    name: "Zone Programmation",
    description: "Zone pour les développeurs",
    zone_type: "department",
    color: "#3b82f6",
    is_exclusive: true,
  },
  "Game Design": {
    name: "Zone Game Design",
    description: "Zone pour les game designers",
    zone_type: "department",
    color: "#10b981",
    is_exclusive: true,
  },
  Audio: {
    name: "Zone Audio",
    description: "Zone pour les sound designers",
    zone_type: "department",
    color: "#8b5cf6",
    is_exclusive: true,
  },
  Narrative: {
    name: "Zone Narrative",
    description: "Zone pour les writers et narrative designers",
    zone_type: "department",
    color: "#f59e0b",
    is_exclusive: true,
  },
  QA: {
    name: "Zone QA",
    description: "Zone pour les testeurs",
    zone_type: "department",
    color: "#06b6d4",
    is_exclusive: true,
  },
  Marketing: {
    name: "Zone Marketing",
    description: "Zone pour le marketing et la communication",
    zone_type: "department",
    color: "#ec4899",
    is_exclusive: true,
  },
  Direction: {
    name: "Zone Direction",
    description: "Zone pour la direction et production",
    zone_type: "department",
    color: "#6366f1",
    is_exclusive: true,
  },
};

export function isRectangleBounds(bounds: ZoneBoundsData): bounds is RectangleZoneBounds {
  return bounds.type === "rectangle";
}

export function isPolygonBounds(bounds: ZoneBoundsData): bounds is PolygonZoneBounds {
  return bounds.type === "polygon";
}

export function toZoneBounds(bounds: ZoneBoundsData): ZoneBounds {
  if (isRectangleBounds(bounds)) {
    return bounds.bounds;
  }

  const xs = bounds.points.map(([x]) => x);
  const ys = bounds.points.map(([, y]) => y);

  return {
    x1: Math.min(...xs),
    y1: Math.min(...ys),
    x2: Math.max(...xs),
    y2: Math.max(...ys),
  };
}

export function isPointInPolygon(point: NormalizedPoint, points: PolygonPoint[]): boolean {
  let isInside = false;

  for (let index = 0, previousIndex = points.length - 1; index < points.length; previousIndex = index++) {
    const [currentX, currentY] = points[index];
    const [previousX, previousY] = points[previousIndex];

    const crossesEdge = (currentY > point.y) !== (previousY > point.y);
    if (!crossesEdge) {
      continue;
    }

    const edgeX = ((previousX - currentX) * (point.y - currentY)) / (previousY - currentY) + currentX;
    if (point.x < edgeX) {
      isInside = !isInside;
    }
  }

  return isInside;
}

export function isPointInZone(point: NormalizedPoint, zone: OfficeZone): boolean {
  if (isRectangleBounds(zone.bounds)) {
    const { x1, y1, x2, y2 } = zone.bounds.bounds;
    return point.x >= x1 && point.x <= x2 && point.y >= y1 && point.y <= y2;
  }

  return isPointInPolygon(point, zone.bounds.points);
}