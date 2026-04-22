import type { AssetVariant, OfficeAssetType } from "@/lib/services/officeAssetService";

export type ReviewStatus = "raw" | "approved" | "rejected";

export type ReviewTarget = {
  assetType: OfficeAssetType;
  variant: AssetVariant;
  label: string;
};

export type ReviewModuleDefinition = {
  key: string;
  label: string;
  role: string;
  priority: number;
  targets: ReviewTarget[];
  plannedVariants: string[];
};

export const OFFICE_REVIEW_MODULES: ReviewModuleDefinition[] = [
  {
    key: "desk_workstation_main",
    label: "Bureau de travail complet",
    role: "Point de vie principal du studio.",
    priority: 1,
    targets: [
      { assetType: "desk_workstation", variant: 1, label: "Desk NO" },
      { assetType: "desk_workstation", variant: 2, label: "Desk NE" },
      { assetType: "desk_workstation", variant: 3, label: "Desk SE" },
    ],
    plannedVariants: ["desk_workstation v1", "desk_workstation v2", "desk_workstation v3"],
  },
  {
    key: "coffee_corner_compact",
    label: "Coin cafe compact",
    role: "Ajoute une fonction sociale lisible.",
    priority: 2,
    targets: [
      { assetType: "coffee_machine", variant: 1, label: "Coffee NO" },
      { assetType: "coffee_machine", variant: 2, label: "Coffee NE" },
      { assetType: "water_fountain", variant: 1, label: "Water NO" },
    ],
    plannedVariants: ["coffee_machine v1", "coffee_machine v2", "water_fountain v1"],
  },
  {
    key: "decorative_plant",
    label: "Plante decorative",
    role: "Casse la rigidite du decor.",
    priority: 3,
    targets: [
      { assetType: "plant_green_1", variant: 1, label: "Plant broad v1" },
      { assetType: "plant_green_2", variant: 1, label: "Plant tall v1" },
      { assetType: "plant_green_3", variant: 1, label: "Plant fern v1" },
    ],
    plannedVariants: ["plant_green_1 v1", "plant_green_2 v1", "plant_green_3 v1"],
  },
  {
    key: "storage_module",
    label: "Rangement ou etagere",
    role: "Donne de la credibilite au lieu.",
    priority: 4,
    targets: [
      { assetType: "cabinet_storage", variant: 1, label: "Cabinet NO" },
      { assetType: "cabinet_storage", variant: 2, label: "Cabinet NE" },
      { assetType: "cabinet_storage", variant: 3, label: "Cabinet SE" },
    ],
    plannedVariants: ["cabinet_storage v1", "cabinet_storage v2", "cabinet_storage v3"],
  },
  {
    key: "wall_decor",
    label: "Deco murale",
    role: "Ajoute de la personnalite sans encombrer le sol.",
    priority: 5,
    targets: [
      { assetType: "wall_poster", variant: 1, label: "Poster mural A" },
      { assetType: "wall_shelf", variant: 1, label: "Etagere murale B" },
      { assetType: "wall_neon_sign", variant: 1, label: "Neon mural C" },
    ],
    plannedVariants: ["poster mural A", "etagere murale B", "neon mural C"],
  },
  {
    key: "decorative_light",
    label: "Source lumineuse decorative",
    role: "Renforce l'ambiance et les etats jour/nuit.",
    priority: 6,
    targets: [
      { assetType: "desk_lamp", variant: 1, label: "Lampe chaude A" },
      { assetType: "floor_lamp", variant: 1, label: "Lampe froide B" },
      { assetType: "neon_light", variant: 1, label: "Enseigne neon C" },
    ],
    plannedVariants: ["lampe chaude A", "lampe froide B", "enseigne neon C"],
  },
];

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  raw: "A revoir",
  approved: "Approved",
  rejected: "Rejete",
};