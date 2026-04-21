import { supabase } from "@/lib/supabase/client";
import type {
  OfficeZone,
  ZoneCreatePayload,
  ZoneUpdatePayload,
  ZoneValidationResult,
  ZoneBoundsData,
  ZoneType,
  DEFAULT_ZONE_COLORS,
} from "@/lib/types/office";

/**
 * Service pour la gestion des zones de déplacement des agents
 */
export class ZoneService {
  /**
   * Récupère toutes les zones actives
   */
  static async getAllZones(): Promise<OfficeZone[]> {
    const { data, error } = await supabase
      .from('office_zones')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching zones:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Récupère les zones par département
   */
  static async getZonesByDepartment(department: string): Promise<OfficeZone[]> {
    const { data, error } = await supabase
      .from('office_zones')
      .select('*')
      .eq('department', department)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`Error fetching zones for department ${department}:`, error);
      return [];
    }

    return data || [];
  }

  /**
   * Récupère les zones assignées à un agent
   */
  static async getZonesByAgent(agentSlug: string): Promise<OfficeZone[]> {
    const { data, error } = await supabase
      .from('office_zones')
      .select('*')
      .eq('agent_slug', agentSlug)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`Error fetching zones for agent ${agentSlug}:`, error);
      return [];
    }

    return data || [];
  }

  /**
   * Récupère les zones communes (sans département ni agent spécifique)
   */
  static async getCommonZones(): Promise<OfficeZone[]> {
    const { data, error } = await supabase
      .from('office_zones')
      .select('*')
      .is('department', null)
      .is('agent_slug', null)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching common zones:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Récupère une zone par son ID
   */
  static async getZoneById(id: string): Promise<OfficeZone | null> {
    const { data, error } = await supabase
      .from('office_zones')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error(`Error fetching zone ${id}:`, error);
      return null;
    }

    return data;
  }

  /**
   * Crée une nouvelle zone
   */
  static async createZone(payload: ZoneCreatePayload): Promise<OfficeZone | null> {
    // Validation
    const validation = this.validateZone(payload);
    if (!validation.isValid) {
      console.error('Zone validation failed:', validation.errors);
      return null;
    }

    // Set defaults
    const zoneData = {
      ...payload,
      color: payload.color || DEFAULT_ZONE_COLORS[payload.zone_type || 'custom'],
      opacity: payload.opacity || 0.2,
      is_active: payload.is_active !== undefined ? payload.is_active : true,
      is_exclusive: payload.is_exclusive !== undefined ? payload.is_exclusive : false,
      allow_crossing: payload.allow_crossing !== undefined ? payload.allow_crossing : true,
      zone_type: payload.zone_type || 'custom',
    };

    const { data, error } = await supabase
      .from('office_zones')
      .insert([zoneData])
      .select()
      .single();

    if (error) {
      console.error('Error creating zone:', error);
      return null;
    }

    return data;
  }

  /**
   * Met à jour une zone existante
   */
  static async updateZone(payload: ZoneUpdatePayload): Promise<OfficeZone | null> {
    const { id, ...updateData } = payload;

    // Validation si bounds sont fournis
    if (updateData.bounds) {
      const validation = this.validateZone({ ...updateData, bounds: updateData.bounds });
      if (!validation.isValid) {
        console.error('Zone validation failed:', validation.errors);
        return null;
      }
    }

    const { data, error } = await supabase
      .from('office_zones')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`Error updating zone ${id}:`, error);
      return null;
    }

    return data;
  }

  /**
   * Supprime une zone (désactive plutôt que supprimer physiquement)
   */
  static async deleteZone(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('office_zones')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      console.error(`Error deleting zone ${id}:`, error);
      return false;
    }

    return true;
  }

  /**
   * Valide les données d'une zone
   */
  static validateZone(payload: Partial<ZoneCreatePayload>): ZoneValidationResult {
    const errors: string[] = [];

    // Check name
    if (payload.name && payload.name.trim().length === 0) {
      errors.push('Le nom de la zone ne peut pas être vide');
    }

    // Check bounds
    if (payload.bounds) {
      const boundsValidation = this.validateBounds(payload.bounds);
      if (!boundsValidation.isValid) {
        errors.push(...boundsValidation.errors);
      }
    }

    // Check color format
    if (payload.color && !/^#[0-9a-fA-F]{6}$/.test(payload.color)) {
      errors.push('La couleur doit être au format hexadécimal (#RRGGBB)');
    }

    // Check opacity
    if (payload.opacity !== undefined && (payload.opacity < 0 || payload.opacity > 1)) {
      errors.push('L\'opacité doit être entre 0 et 1');
    }

    // Check department/agent exclusivity
    if (payload.department && payload.agent_slug) {
      errors.push('Une zone ne peut pas être à la fois associée à un département et à un agent spécifique');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Valide les bounds d'une zone
   */
  static validateBounds(bounds: ZoneBoundsData): ZoneValidationResult {
    const errors: string[] = [];

    if (bounds.type === 'rectangle') {
      const { x1, y1, x2, y2 } = bounds.bounds;
      
      // Check coordinates are within 0-1 range
      [x1, y1, x2, y2].forEach((coord, index) => {
        if (coord < 0 || coord > 1) {
          errors.push(`La coordonnée ${index + 1} (${coord}) doit être entre 0 et 1`);
        }
      });

      // Check rectangle is valid (x2 > x1, y2 > y1)
      if (x2 <= x1) {
        errors.push('x2 doit être supérieur à x1');
      }
      if (y2 <= y1) {
        errors.push('y2 doit être supérieur à y1');
      }

      // Check minimum size
      const width = x2 - x1;
      const height = y2 - y1;
      if (width < 0.05) {
        errors.push('La largeur de la zone doit être d\'au moins 5%');
      }
      if (height < 0.05) {
        errors.push('La hauteur de la zone doit être d\'au moins 5%');
      }
    } else if (bounds.type === 'polygon') {
      const points = bounds.points;
      
      // Check minimum points
      if (points.length < 3) {
        errors.push('Un polygone doit avoir au moins 3 points');
      }

      // Check all points are within 0-1 range
      points.forEach(([x, y], index) => {
        if (x < 0 || x > 1 || y < 0 || y > 1) {
          errors.push(`Le point ${index + 1} (${x}, ${y}) doit être entre 0 et 1`);
        }
      });

      // Check polygon is not self-intersecting (simplified check)
      if (points.length >= 3) {
        // Simple convexity check (not perfect but good enough for UI)
        const area = this.calculatePolygonArea(points);
        if (area <= 0.0001) {
          errors.push('Le polygone est trop petit ou dégénéré');
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Calcule l'aire d'un polygone (algorithme du shoelace)
   */
  private static calculatePolygonArea(points: [number, number][]): number {
    let area = 0;
    const n = points.length;
    
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += points[i][0] * points[j][1];
      area -= points[j][0] * points[i][1];
    }
    
    return Math.abs(area) / 2;
  }

  /**
   * Récupère les zones applicables à un agent (département + communes + spécifiques)
   */
  static async getZonesForAgent(agentSlug: string, agentDepartment: string): Promise<OfficeZone[]> {
    const [departmentZones, agentZones, commonZones] = await Promise.all([
      this.getZonesByDepartment(agentDepartment),
      this.getZonesByAgent(agentSlug),
      this.getCommonZones(),
    ]);

    // Combine and deduplicate zones
    const allZones = [...departmentZones, ...agentZones, ...commonZones];
    const uniqueZones = new Map<string, OfficeZone>();
    
    allZones.forEach(zone => {
      if (!uniqueZones.has(zone.id)) {
        uniqueZones.set(zone.id, zone);
      }
    });

    return Array.from(uniqueZones.values());
  }

  /**
   * Vérifie si un point est dans une zone
   */
  static isPointInZone(x: number, y: number, zone: OfficeZone): boolean {
    if (zone.bounds.type === 'rectangle') {
      const { x1, y1, x2, y2 } = zone.bounds.bounds;
      return x >= x1 && x <= x2 && y >= y1 && y <= y2;
    } else {
      // Polygon: ray casting algorithm
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

  /**
   * Trouve la zone principale pour un agent à une position donnée
   */
  static findZoneForAgent(
    x: number, 
    y: number, 
    zones: OfficeZone[]
  ): OfficeZone | null {
    // Priorité: zones spécifiques à l'agent > zones de département > zones communes
    const agentZones = zones.filter(z => z.agent_slug !== null);
    const departmentZones = zones.filter(z => z.department !== null && z.agent_slug === null);
    const commonZones = zones.filter(z => z.department === null && z.agent_slug === null);

    // Chercher dans l'ordre de priorité
    for (const zone of [...agentZones, ...departmentZones, ...commonZones]) {
      if (this.isPointInZone(x, y, zone)) {
        return zone;
      }
    }

    return null;
  }

  /**
   * Génère des bounds par défaut pour un département
   */
  static getDefaultBoundsForDepartment(department: string): ZoneBoundsData {
    // Positions par défaut basées sur DESK_POSITIONS
    const departmentPositions: Record<string, { x1: number; y1: number; x2: number; y2: number }> = {
      Art: { x1: 0.05, y1: 0.3, x2: 0.25, y2: 0.7 },
      Programming: { x1: 0.25, y1: 0.2, x2: 0.45, y2: 0.6 },
      'Game Design': { x1: 0.45, y1: 0.15, x2: 0.65, y2: 0.55 },
      Audio: { x1: 0.65, y1: 0.25, x2: 0.85, y2: 0.65 },
      Narrative: { x1: 0.7, y1: 0.45, x2: 0.9, y2: 0.85 },
      QA: { x1: 0.4, y1: 0.5, x2: 0.6, y2: 0.9 },
      Marketing: { x1: 0.15, y1: 0.55, x2: 0.35, y2: 0.95 },
      Direction: { x1: 0.8, y1: 0.1, x2: 0.95, y2: 0.3 },
    };

    const bounds = departmentPositions[department] || { x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.9 };
    
    return {
      type: 'rectangle',
      bounds,
    };
  }

  /**
   * Convertit des coordonnées pixels en coordonnées normalisées (0-1)
   */
  static normalizeCoordinates(
    x: number, 
    y: number, 
    containerWidth: number, 
    containerHeight: number
  ): { x: number; y: number } {
    return {
      x: Math.max(0, Math.min(1, x / containerWidth)),
      y: Math.max(0, Math.min(1, y / containerHeight)),
    };
  }

  /**
   * Convertit des coordonnées normalisées en coordonnées pixels
   */
  static denormalizeCoordinates(
    normalizedX: number, 
    normalizedY: number, 
    containerWidth: number, 
    containerHeight: number
  ): { x: number; y: number } {
    return {
      x: normalizedX * containerWidth,
      y: normalizedY * containerHeight,
    };
  }
}