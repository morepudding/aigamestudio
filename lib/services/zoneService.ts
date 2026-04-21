import type {
  OfficeZone,
  ZoneCreatePayload,
  ZoneUpdatePayload,
  ZoneValidationResult,
  ZoneBoundsData,
  PolygonPoint,
} from "@/lib/types/office";
import {
  DEFAULT_ZONE_COLORS,
  isPointInPolygon,
  isPolygonBounds,
  isRectangleBounds,
  toZoneBounds,
} from "@/lib/types/office";

/**
 * Service simplifié pour la gestion des zones de déplacement des agents
 * Uniquement des rectangles (polygones à 4 points)
 */
export class ZoneService {
  private static async request<T>(input: string, init?: RequestInit): Promise<T | null> {
    try {
      const response = await fetch(input, {
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
        },
        ...init,
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        console.error("Zone API request failed:", payload ?? response.statusText);
        return null;
      }

      return payload as T;
    } catch (error) {
      console.error("Zone API request error:", error);
      return null;
    }
  }

  private static normalizeZone(zone: OfficeZone): OfficeZone {
    if (!zone.bounds || typeof zone.bounds !== "object") {
      return zone;
    }

    if ("type" in zone.bounds) {
      return zone;
    }

    return {
      ...zone,
      bounds: {
        type: "rectangle",
        bounds: zone.bounds as unknown as ReturnType<typeof toZoneBounds>,
      },
    };
  }

  /**
   * Récupère toutes les zones actives
   */
  static async getAllZones(): Promise<OfficeZone[]> {
    const response = await this.request<{ zones: OfficeZone[] }>("/api/office/zones?activeOnly=true");
    return (response?.zones ?? []).map((zone) => this.normalizeZone(zone));
  }

  /**
   * Récupère les zones par département
   */
  static async getZonesByDepartment(department: string): Promise<OfficeZone[]> {
    const params = new URLSearchParams({ department, activeOnly: "true" });
    const response = await this.request<{ zones: OfficeZone[] }>(`/api/office/zones?${params.toString()}`);
    return (response?.zones ?? []).map((zone) => this.normalizeZone(zone));
  }

  /**
   * Récupère les zones assignées à un agent
   */
  static async getZonesByAgent(agentSlug: string): Promise<OfficeZone[]> {
    const params = new URLSearchParams({ agentSlug, activeOnly: "true" });
    const response = await this.request<{ zones: OfficeZone[] }>(`/api/office/zones?${params.toString()}`);
    return (response?.zones ?? []).map((zone) => this.normalizeZone(zone));
  }

  /**
   * Récupère les zones communes (sans département ni agent spécifique)
   */
  static async getCommonZones(): Promise<OfficeZone[]> {
    const response = await this.request<{ zones: OfficeZone[] }>("/api/office/zones?commonOnly=true&activeOnly=true");
    return (response?.zones ?? []).map((zone) => this.normalizeZone(zone));
  }

  /**
   * Récupère une zone par son ID
   */
  static async getZoneById(id: string): Promise<OfficeZone | null> {
    const response = await this.request<{ zone: OfficeZone | null }>(`/api/office/zones/${id}`);
    return response?.zone ? this.normalizeZone(response.zone) : null;
  }

  /**
  * Crée une nouvelle zone et remplace la précédente
   */
  static async createZone(payload: ZoneCreatePayload): Promise<OfficeZone | null> {
    // Validation
    const validation = this.validateZone(payload);
    if (!validation.isValid) {
      console.error('Zone validation failed:', validation.errors);
      return null;
    }

    const zoneData = {
      ...payload,
      color: payload.color || DEFAULT_ZONE_COLORS[payload.zone_type || 'common'],
      opacity: payload.opacity || 0.2,
      is_active: payload.is_active !== undefined ? payload.is_active : true,
      is_exclusive: payload.is_exclusive !== undefined ? payload.is_exclusive : true,
      allow_crossing: payload.allow_crossing !== undefined ? payload.allow_crossing : true,
      zone_type: payload.zone_type || 'common',
    };

    const response = await this.request<{ zone: OfficeZone }>("/api/office/zones", {
      method: "POST",
      body: JSON.stringify(zoneData),
    });

    return response?.zone ? this.normalizeZone(response.zone) : null;
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

    const response = await this.request<{ zone: OfficeZone }>(`/api/office/zones/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updateData),
    });

    return response?.zone ? this.normalizeZone(response.zone) : null;
  }

  /**
   * Supprime une zone (désactive plutôt que supprimer physiquement)
   */
  static async deleteZone(id: string): Promise<boolean> {
    const response = await this.request<{ ok: boolean }>(`/api/office/zones/${id}`, {
      method: "DELETE",
    });

    return response?.ok === true;
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

    if (isRectangleBounds(bounds)) {
      const { x1, y1, x2, y2 } = bounds.bounds;

      [x1, y1, x2, y2].forEach((coord, index) => {
        if (coord < 0 || coord > 1) {
          errors.push(`La coordonnée ${index + 1} (${coord}) doit être entre 0 et 1`);
        }
      });

      if (x2 <= x1) {
        errors.push('x2 doit être supérieur à x1');
      }
      if (y2 <= y1) {
        errors.push('y2 doit être supérieur à y1');
      }

      if (x2 - x1 < 0.05) {
        errors.push('La largeur de la zone doit être d\'au moins 5%');
      }
      if (y2 - y1 < 0.05) {
        errors.push('La hauteur de la zone doit être d\'au moins 5%');
      }
    }

    if (isPolygonBounds(bounds)) {
      if (bounds.points.length < 3) {
        errors.push('Une zone libre doit contenir au moins 3 points');
      }

      bounds.points.forEach(([x, y], index) => {
        if (x < 0 || x > 1 || y < 0 || y > 1) {
          errors.push(`Le point ${index + 1} doit rester dans le canvas`);
        }
      });

      const polygonBounds = toZoneBounds(bounds);
      if (polygonBounds.x2 - polygonBounds.x1 < 0.03 || polygonBounds.y2 - polygonBounds.y1 < 0.03) {
        errors.push('La zone dessinée est trop petite');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
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
  static isPointInZone(point: { x: number; y: number }, zone: OfficeZone): boolean {
    if (isRectangleBounds(zone.bounds)) {
      const { x1, y1, x2, y2 } = zone.bounds.bounds;
      return point.x >= x1 && point.x <= x2 && point.y >= y1 && point.y <= y2;
    }

    return isPointInPolygon(point, zone.bounds.points as PolygonPoint[]);
  }

  /**
   * Vérifie si un agent peut entrer dans une zone
   */
  static canAgentEnterZone(agentSlug: string, agentDepartment: string, zone: OfficeZone): boolean {
    // Si la zone est inactive, on ne peut pas entrer
    if (!zone.is_active) return false;

    // Si la zone est exclusive et l'agent n'est pas autorisé, on ne peut pas entrer
    if (zone.is_exclusive) {
      // Vérifier si l'agent est autorisé
      if (zone.agent_slug && zone.agent_slug !== agentSlug) return false;
      if (zone.department && zone.department !== agentDepartment) return false;
      if (!zone.agent_slug && !zone.department) return true; // Zone commune exclusive
    }

    return true;
  }

  /**
   * Convertit des coordonnées normalisées (0-1) en coordonnées écran
   */
  static denormalizeCoordinates(
    normalizedX: number, 
    normalizedY: number, 
    width: number, 
    height: number
  ): { x: number; y: number } {
    return {
      x: normalizedX * width,
      y: normalizedY * height,
    };
  }

  /**
   * Convertit des coordonnées écran en coordonnées normalisées (0-1)
   */
  static normalizeCoordinates(
    screenX: number,
    screenY: number,
    width: number,
    height: number
  ): { x: number; y: number } {
    return {
      x: screenX / width,
      y: screenY / height,
    };
  }

  /**
   * Convertit un rectangle normalisé en rectangle écran
   */
  static denormalizeBounds(
    bounds: ZoneBoundsData,
    width: number,
    height: number
  ): { x: number; y: number; width: number; height: number } {
    const { x1, y1, x2, y2 } = toZoneBounds(bounds);
    const screenX1 = x1 * width;
    const screenY1 = y1 * height;
    const screenX2 = x2 * width;
    const screenY2 = y2 * height;
    
    return {
      x: screenX1,
      y: screenY1,
      width: screenX2 - screenX1,
      height: screenY2 - screenY1,
    };
  }
}