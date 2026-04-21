"use client";

import { useState, useEffect } from "react";
import { 
  Map, 
  Plus, 
  Edit2, 
  Trash2, 
  Eye, 
  EyeOff, 
  Users,
  Building,
  Globe,
  User,
  Check,
  X,
  Save,
  Loader2
} from "lucide-react";
import { ZoneService } from "@/lib/services/zoneService";
import type { OfficeZone, ZoneCreatePayload, ZoneType } from "@/lib/types/office";

interface ZoneManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onZoneSelect?: (zone: OfficeZone) => void;
  onZoneCreate?: (zone: OfficeZone) => void;
  onZoneUpdate?: (zone: OfficeZone) => void;
  onZoneDelete?: (zoneId: string) => void;
}

export function ZoneManager({ 
  isOpen, 
  onClose,
  onZoneSelect,
  onZoneCreate,
  onZoneUpdate,
  onZoneDelete
}: ZoneManagerProps) {
  const [zones, setZones] = useState<OfficeZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // État pour la création/édition
  const [isCreating, setIsCreating] = useState(false);
  const [editingZone, setEditingZone] = useState<OfficeZone | null>(null);
  
  // Formulaire
  const [formData, setFormData] = useState<Partial<ZoneCreatePayload>>({
    name: "",
    description: "",
    zone_type: "custom",
    color: "#3b82f6",
    opacity: 0.2,
    is_active: true,
    is_exclusive: false,
    allow_crossing: true,
  });

  // Charger les zones
  useEffect(() => {
    if (isOpen) {
      loadZones();
    }
  }, [isOpen]);

  const loadZones = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const fetchedZones = await ZoneService.getAllZones();
      setZones(fetchedZones);
    } catch (err) {
      console.error("Error loading zones:", err);
      setError("Erreur lors du chargement des zones");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateZone = () => {
    setIsCreating(true);
    setEditingZone(null);
    setFormData({
      name: "",
      description: "",
      zone_type: "custom",
      color: "#3b82f6",
      opacity: 0.2,
      is_active: true,
      is_exclusive: false,
      allow_crossing: true,
    });
  };

  const handleEditZone = (zone: OfficeZone) => {
    setEditingZone(zone);
    setIsCreating(false);
    setFormData({
      name: zone.name,
      description: zone.description || "",
      zone_type: zone.zone_type,
      color: zone.color,
      opacity: zone.opacity,
      department: zone.department,
      agent_slug: zone.agent_slug,
      is_active: zone.is_active,
      is_exclusive: zone.is_exclusive,
      allow_crossing: zone.allow_crossing,
    });
  };

  const handleSaveZone = async () => {
    if (!formData.name?.trim()) {
      setError("Le nom de la zone est requis");
      return;
    }

    try {
      let savedZone: OfficeZone | null = null;
      
      if (editingZone) {
        // Mise à jour
        savedZone = await ZoneService.updateZone({
          id: editingZone.id,
          ...formData,
        });
        if (savedZone && onZoneUpdate) {
          onZoneUpdate(savedZone);
        }
      } else {
        // Création (nécessite bounds, à définir via l'outil de dessin)
        if (!formData.bounds) {
          setError("Veuillez d'abord dessiner la zone sur le canvas");
          return;
        }
        
        savedZone = await ZoneService.createZone(formData as ZoneCreatePayload);
        if (savedZone && onZoneCreate) {
          onZoneCreate(savedZone);
        }
      }

      if (savedZone) {
        await loadZones();
        resetForm();
      }
    } catch (err) {
      console.error("Error saving zone:", err);
      setError("Erreur lors de la sauvegarde de la zone");
    }
  };

  const handleDeleteZone = async (zoneId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette zone ?")) {
      return;
    }

    try {
      const success = await ZoneService.deleteZone(zoneId);
      if (success) {
        if (onZoneDelete) {
          onZoneDelete(zoneId);
        }
        await loadZones();
      }
    } catch (err) {
      console.error("Error deleting zone:", err);
      setError("Erreur lors de la suppression de la zone");
    }
  };

  const handleToggleActive = async (zone: OfficeZone) => {
    try {
      const updatedZone = await ZoneService.updateZone({
        id: zone.id,
        is_active: !zone.is_active,
      });
      
      if (updatedZone && onZoneUpdate) {
        onZoneUpdate(updatedZone);
      }
      
      await loadZones();
    } catch (err) {
      console.error("Error toggling zone active:", err);
    }
  };

  const resetForm = () => {
    setIsCreating(false);
    setEditingZone(null);
    setFormData({
      name: "",
      description: "",
      zone_type: "custom",
      color: "#3b82f6",
      opacity: 0.2,
      is_active: true,
      is_exclusive: false,
      allow_crossing: true,
    });
  };

  const getZoneTypeIcon = (type: ZoneType) => {
    switch (type) {
      case 'department': return <Building className="w-4 h-4" />;
      case 'restricted': return <EyeOff className="w-4 h-4" />;
      case 'common': return <Globe className="w-4 h-4" />;
      case 'custom': return <Map className="w-4 h-4" />;
    }
  };

  const getZoneTypeLabel = (type: ZoneType) => {
    switch (type) {
      case 'department': return 'Département';
      case 'restricted': return 'Restreinte';
      case 'common': return 'Commune';
      case 'custom': return 'Personnalisée';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Map className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-white">Gestion des zones de déplacement</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex h-[calc(90vh-80px)]">
          {/* Sidebar - Liste des zones */}
          <div className="w-1/3 border-r border-white/10 bg-slate-950/50 overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-white/70">Zones disponibles</h3>
                <button
                  onClick={handleCreateZone}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Nouvelle zone
                </button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                </div>
              ) : error ? (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              ) : zones.length === 0 ? (
                <div className="p-6 text-center">
                  <Map className="w-8 h-8 text-white/20 mx-auto mb-2" />
                  <p className="text-sm text-white/40">Aucune zone définie</p>
                  <p className="text-xs text-white/30 mt-1">
                    Créez votre première zone pour restreindre les déplacements
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {zones.map((zone) => (
                    <div
                      key={zone.id}
                      className={`p-3 rounded-lg border transition-all cursor-pointer hover:bg-white/5 ${
                        editingZone?.id === zone.id
                          ? 'border-indigo-500 bg-indigo-500/10'
                          : 'border-white/10 bg-slate-900/50'
                      }`}
                      onClick={() => handleEditZone(zone)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: zone.color }}
                            />
                            <span className="text-sm font-medium text-white">
                              {zone.name}
                            </span>
                            {!zone.is_active && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/50">
                                Inactive
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-3 text-xs text-white/50">
                            <span className="flex items-center gap-1">
                              {getZoneTypeIcon(zone.zone_type)}
                              {getZoneTypeLabel(zone.zone_type)}
                            </span>
                            
                            {zone.department && (
                              <span className="flex items-center gap-1">
                                <Building className="w-3 h-3" />
                                {zone.department}
                              </span>
                            )}
                            
                            {zone.agent_slug && (
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {zone.agent_slug}
                              </span>
                            )}
                          </div>
                          
                          {zone.description && (
                            <p className="text-xs text-white/40 mt-2 line-clamp-2">
                              {zone.description}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleActive(zone);
                            }}
                            className="p-1.5 rounded hover:bg-white/10 transition-colors"
                            title={zone.is_active ? "Désactiver" : "Activer"}
                          >
                            {zone.is_active ? (
                              <Eye className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <EyeOff className="w-3.5 h-3.5 text-white/40" />
                            )}
                          </button>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteZone(zone.id);
                            }}
                            className="p-1.5 rounded hover:bg-red-500/20 transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Main content - Formulaire */}
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-2xl">
              <h3 className="text-lg font-semibold text-white mb-6">
                {editingZone ? "Modifier la zone" : isCreating ? "Créer une nouvelle zone" : "Sélectionnez une zone"}
              </h3>

              {(isCreating || editingZone) ? (
                <div className="space-y-6">
                  {error && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                      <p className="text-sm text-red-400">{error}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-white/70 mb-1.5">
                        Nom de la zone *
                      </label>
                      <input
                        type="text"
                        value={formData.name || ""}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500"
                        placeholder="Ex: Zone Art, Salle de pause..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-white/70 mb-1.5">
                        Type de zone
                      </label>
                      <select
                        value={formData.zone_type || "custom"}
                        onChange={(e) => setFormData({ ...formData, zone_type: e.target.value as ZoneType })}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-indigo-500"
                      >
                        <option value="department">Département</option>
                        <option value="restricted">Restreinte</option>
                        <option value="common">Commune</option>
                        <option value="custom">Personnalisée</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-1.5">
                      Description
                    </label>
                    <textarea
                      value={formData.description || ""}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500"
                      placeholder="Description de la zone..."
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-white/70 mb-1.5">
                        Couleur
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={formData.color || "#3b82f6"}
                          onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                          className="w-10 h-10 rounded-lg cursor-pointer"
                        />
                        <input
                          type="text"
                          value={formData.color || "#3b82f6"}
                          onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                          className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white font-mono text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-white/70 mb-1.5">
                        Opacité: {((formData.opacity || 0.2) * 100).toFixed(0)}%
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={formData.opacity || 0.2}
                        onChange={(e) => setFormData({ ...formData, opacity: parseFloat(e.target.value) })}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-white/70 mb-1.5">
                        Département
                      </label>
                      <select
                        value={formData.department || ""}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          department: e.target.value || null,
                          agent_slug: e.target.value ? null : formData.agent_slug
                        })}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-indigo-500"
                      >
                        <option value="">Aucun (zone commune)</option>
                        <option value="Art">Art</option>
                        <option value="Programming">Programmation</option>
                        <option value="Game Design">Game Design</option>
                        <option value="Audio">Audio</option>
                        <option value="Narrative">Narrative</option>
                        <option value="QA">QA</option>
                        <option value="Marketing">Marketing</option>
                        <option value="Direction">Direction</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-white/70">
                      Comportement
                    </label>
                    
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_exclusive || false}
                          onChange={(e) => setFormData({ ...formData, is_exclusive: e.target.checked })}
                          className="rounded border-white/20 bg-white/5"
                        />
                        <span className="text-sm text-white/70">Zone exclusive</span>
                        <span className="text-xs text-white/40">(les agents ne peuvent pas quitter)</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.allow_crossing || true}
                          onChange={(e) => setFormData({ ...formData, allow_crossing: e.target.checked })}
                          className="rounded border-white/20 bg-white/5"
                        />
                        <span className="text-sm text-white/70">Autoriser le passage</span>
                        <span className="text-xs text-white/40">(autres agents peuvent traverser)</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_active !== false}
                          onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                          className="rounded border-white/20 bg-white/5"
                        />
                        <span className="text-sm text-white/70">Active</span>
                      </label>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3">
                    <button
                      onClick={resetForm}
                      className="px-4 py-2 rounded-lg border border-white/20 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      Annuler
                    </button>
                    
                    <button
                      onClick={handleSaveZone}
                      disabled={!formData.name?.trim()}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Save className="w-4 h-4" />
                      {editingZone ? "Mettre à jour" : "Créer la zone"}
                    </button>
                  </div>

                  {!formData.bounds && (
                    <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <p className="text-sm text-amber-400">
                        ⚠️ Pour finaliser la création, dessinez la zone sur le canvas après avoir fermé ce panneau.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Map className="w-16 h-16 text-white/20 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-white/70 mb-2">
                    Sélectionnez ou créez une zone
                  </h4>
                  <p className="text-sm text-white/40 max-w-md mx-auto">
                    Les zones permettent de restreindre les déplacements des collaborateurs dans le bureau.
                    Sélectionnez une zone existante pour la modifier, ou créez-en une nouvelle.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}