/**
 * Types pour la gestion des zones de bureau et des assets
 */

// Zone bounds types (from LpcWalker.tsx)
export interface ZoneBounds {
  /** Fractional coordinates (0–1) relative to container */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// Zone types for classification
export type ZoneType = 'department' | 'restricted' | 'common' | 'custom';

// Zone shape types
export type ZoneShape = 'rectangle' | 'polygon';

// Rectangle bounds (compatible with existing ZoneBounds)
export interface RectangleBounds {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// Polygon bounds (array of [x, y] points, normalized 0-1)
export type PolygonBounds = Array<[number, number]>;

// Union type for all possible bounds
export type ZoneBoundsData = 
  | { type: 'rectangle'; bounds: RectangleBounds }
  | { type: 'polygon'; points: PolygonBounds };

// Main office zone interface (matches Supabase table)
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

// Simplified zone for UI display
export interface UIZone {
  id: string;
  name: string;
  color: string;
  opacity: number;
  bounds: ZoneBoundsData;
  is_active: boolean;
  is_exclusive: boolean;
}

// Zone creation/update payload
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

// Zone assignment for agents
export interface ZoneAssignment {
  zone_id: string;
  agent_slug: string;
  priority: number; // Higher priority zones take precedence
}

// Department zones mapping
export interface DepartmentZoneConfig {
  department: string;
  default_zone_id?: string;
  allowed_zone_ids: string[];
}

// Zone validation result
export interface ZoneValidationResult {
  isValid: boolean;
  errors: string[];
  warning?: string;
}

// Point in normalized coordinates (0-1)
export interface NormalizedPoint {
  x: number;
  y: number;
}

// Zone drawing state
export interface ZoneDrawingState {
  isDrawing: boolean;
  shapeType: ZoneShape;
  currentPoints: NormalizedPoint[];
  isComplete: boolean;
}

// Zone selection state
export interface ZoneSelection {
  zoneId: string | null;
  isEditing: boolean;
}

// Helper functions type definitions
export type PointInZoneCheck = (point: NormalizedPoint, zone: OfficeZone) => boolean;
export type ZoneBoundsConverter = (zone: OfficeZone, containerWidth: number, containerHeight: number) => ZoneBounds;

// Default zone colors by type
export const DEFAULT_ZONE_COLORS: Record<ZoneType, string> = {
  department: '#3b82f6', // blue-500
  restricted: '#ef4444', // red-500
  common: '#10b981',     // emerald-500
  custom: '#8b5cf6',     // violet-500
};

// Default department zones (for initialization)
export const DEFAULT_DEPARTMENT_ZONES: Record<string, Partial<OfficeZone>> = {
  Art: {
    name: 'Zone Art',
    description: 'Zone pour les artistes et graphistes',
    zone_type: 'department',
    color: '#ef4444', // red-500
    is_exclusive: true,
  },
  Programming: {
    name: 'Zone Programmation',
    description: 'Zone pour les développeurs',
    zone_type: 'department',
    color: '#3b82f6', // blue-500
    is_exclusive: true,
  },
  'Game Design': {
    name: 'Zone Game Design',
    description: 'Zone pour les game designers',
    zone_type: 'department',
    color: '#10b981', // emerald-500
    is_exclusive: true,
  },
  Audio: {
    name: 'Zone Audio',
    description: 'Zone pour les sound designers',
    zone_type: 'department',
    color: '#8b5cf6', // violet-500
    is_exclusive: true,
  },
  Narrative: {
    name: 'Zone Narrative',
    description: 'Zone pour les writers et narrative designers',
    zone_type: 'department',
    color: '#f59e0b', // amber-500
    is_exclusive: true,
  },
  QA: {
    name: 'Zone QA',
    description: 'Zone pour les testeurs',
    zone_type: 'department',
    color: '#06b6d4', // cyan-500
    is_exclusive: true,
  },
  Marketing: {
    name: 'Zone Marketing',
    description: 'Zone pour le marketing et la communication',
    zone_type: 'department',
    color: '#ec4899', // pink-500
    is_exclusive: true,
  },
  Direction: {
    name: 'Zone Direction',
    description: 'Zone pour la direction et production',
    zone_type: 'department',
    color: '#6366f1', // indigo-500
    is_exclusive: true,
  },
};

// Utility type guards
export function isRectangleBounds(bounds: ZoneBoundsData): bounds is { type: 'rectangle'; bounds: RectangleBounds } {
  return bounds.type === 'rectangle';
}

export function isPolygonBounds(bounds: ZoneBoundsData): bounds is { type: 'polygon'; points: PolygonBounds } {
  return bounds.type === 'polygon';
}

// Utility function to convert ZoneBoundsData to ZoneBounds (rectangle approximation for polygons)
export function toZoneBounds(zoneData: ZoneBoundsData): ZoneBounds {
  if (isRectangleBounds(zoneData)) {
    return zoneData.bounds;
  } else {
    // For polygons, calculate bounding box
    const points = zoneData.points;
    const xs = points.map(p => p[0]);
    const ys = points.map(p => p[1]);
    return {
      x1: Math.min(...xs),
      y1: Math.min(...ys),
      x2: Math.max(...xs),
      y2: Math.max(...ys),
    };
  }
}

// Utility function to check if a point is in a zone
export function isPointInZone(point: NormalizedPoint, zone: OfficeZone): boolean {
  const { x, y } = point;
  
  if (isRectangleBounds(zone.bounds)) {
    const { x1, y1, x2, y2 } = zone.bounds.bounds;
    return x >= x1 && x <= x2 && y >= y1 && y <= y2;
  } else {
    // Ray casting algorithm for polygons
    const points = zone.bounds.points;
    let inside = false;
    
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const xi = points[i][0];
      const yi = points[i][1];
      const xj = points[j][0];
      const yj = points[j][1];
      
      const intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      
      if (intersect) inside = !inside;
    }
    
    return inside;
  }
}