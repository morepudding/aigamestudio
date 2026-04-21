"use client";

import { Group, Line, Rect, Text } from "react-konva";
import type { OfficeZone } from "@/lib/types/office";
import { isPolygonBounds, isRectangleBounds, toZoneBounds } from "@/lib/types/office";
import { ZoneService } from "@/lib/services/zoneService";

interface ZoneOverlayProps {
  width: number;
  height: number;
  zones: OfficeZone[];
  showLabels?: boolean;
  showOnlyActive?: boolean;
  selectedZoneId?: string | null;
  onZoneClick?: (zone: OfficeZone) => void;
}

function withOpacity(hexColor: string, opacity: number) {
  const safeOpacity = Math.max(0, Math.min(1, opacity));
  return `${hexColor}${Math.round(safeOpacity * 255)
    .toString(16)
    .padStart(2, "0")}`;
}

export function ZoneOverlay({
  width,
  height,
  zones,
  showLabels = true,
  showOnlyActive = true,
  selectedZoneId = null,
  onZoneClick,
}: ZoneOverlayProps) {
  const visibleZones = showOnlyActive ? zones.filter((zone) => zone.is_active) : zones;

  if (visibleZones.length === 0) {
    return null;
  }

  return (
    <Group>
      {visibleZones.map((zone) => {
        const isSelected = zone.id === selectedZoneId;
        const stroke = isSelected ? "#ffffff" : zone.color;
        const strokeWidth = isSelected ? 3 : 2;
        const fill = withOpacity(zone.color, isSelected ? zone.opacity + 0.08 : zone.opacity);

        if (isRectangleBounds(zone.bounds)) {
          const { x1, y1, x2, y2 } = zone.bounds.bounds;
          const p1 = ZoneService.denormalizeCoordinates(x1, y1, width, height);
          const p2 = ZoneService.denormalizeCoordinates(x2, y2, width, height);
          const zoneWidth = p2.x - p1.x;
          const zoneHeight = p2.y - p1.y;

          return (
            <Group key={zone.id} onClick={() => onZoneClick?.(zone)} onTap={() => onZoneClick?.(zone)}>
              <Rect
                x={p1.x}
                y={p1.y}
                width={zoneWidth}
                height={zoneHeight}
                fill={fill}
                stroke={stroke}
                strokeWidth={strokeWidth}
                dash={zone.zone_type === "common" ? [6, 4] : undefined}
                cornerRadius={6}
              />
              {showLabels && zoneWidth > 80 && zoneHeight > 30 && (
                <Text
                  x={p1.x + 8}
                  y={p1.y + 8}
                  text={zone.name}
                  fontSize={12}
                  fill="#ffffff"
                  listening={false}
                />
              )}
            </Group>
          );
        }

        if (isPolygonBounds(zone.bounds)) {
          const polygonPoints = zone.bounds.points.flatMap(([x, y]) => {
            const point = ZoneService.denormalizeCoordinates(x, y, width, height);
            return [point.x, point.y];
          });

          const labelBounds = toZoneBounds(zone.bounds);
          const labelPoint = ZoneService.denormalizeCoordinates(labelBounds.x1, labelBounds.y1, width, height);

          return (
            <Group key={zone.id} onClick={() => onZoneClick?.(zone)} onTap={() => onZoneClick?.(zone)}>
              <Line
                points={polygonPoints}
                closed
                fill={fill}
                stroke={stroke}
                strokeWidth={strokeWidth}
                lineJoin="round"
                dash={zone.zone_type === "common" ? [6, 4] : undefined}
              />
              {showLabels && (
                <Text x={labelPoint.x + 8} y={labelPoint.y + 8} text={zone.name} fontSize={12} fill="#ffffff" listening={false} />
              )}
            </Group>
          );
        }

        return null;
      })}
    </Group>
  );
}