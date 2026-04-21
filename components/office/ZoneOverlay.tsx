"use client";

import { Rect, Line, Group, Text } from "react-konva";
import type { OfficeZone, ZoneBoundsData } from "@/lib/types/office";
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

export function ZoneOverlay({
  width,
  height,
  zones,
  showLabels = true,
  showOnlyActive = true,
  selectedZoneId = null,
  onZoneClick,
}: ZoneOverlayProps) {
  // Filter zones if needed
  const filteredZones = showOnlyActive 
    ? zones.filter(zone => zone.is_active)
    : zones;

  if (filteredZones.length === 0) {
    return null;
  }

  // Helper to convert normalized coordinates to screen coordinates
  const denormalize = (x: number, y: number) => {
    return ZoneService.denormalizeCoordinates(x, y, width, height);
  };

  // Render a single zone
  const renderZone = (zone: OfficeZone, index: number) => {
    const isSelected = zone.id === selectedZoneId;
    const zoneColor = zone.color;
    const zoneOpacity = zone.opacity;
    
    // Calculate stroke width based on selection
    const strokeWidth = isSelected ? 3 : 1.5;
    
    // Calculate fill opacity
    const fillOpacity = isSelected ? zoneOpacity * 1.5 : zoneOpacity;
    
    if (zone.bounds.type === 'rectangle') {
      const { x1, y1, x2, y2 } = zone.bounds.bounds;
      const { x: screenX1, y: screenY1 } = denormalize(x1, y1);
      const { x: screenX2, y: screenY2 } = denormalize(x2, y2);
      
      const zoneWidth = screenX2 - screenX1;
      const zoneHeight = screenY2 - screenY1;
      
      return (
        <Group
          key={zone.id}
          onClick={() => onZoneClick?.(zone)}
          onTap={() => onZoneClick?.(zone)}
        >
          {/* Zone fill */}
          <Rect
            x={screenX1}
            y={screenY1}
            width={zoneWidth}
            height={zoneHeight}
            fill={`${zoneColor}${Math.round(fillOpacity * 255).toString(16).padStart(2, '0')}`}
            stroke={isSelected ? '#ffffff' : zoneColor}
            strokeWidth={strokeWidth}
            dash={zone.zone_type === 'common' ? [5, 5] : undefined}
            cornerRadius={4}
          />
          
          {/* Zone label */}
          {showLabels && zoneWidth > 50 && zoneHeight > 30 && (
            <Text
              x={screenX1 + 5}
              y={screenY1 + 5}
              width={zoneWidth - 10}
              height={zoneHeight - 10}
              text={zone.name}
              fontSize={12}
              fontFamily="Inter, sans-serif"
              fill="#ffffff"
              align="left"
              verticalAlign="top"
              padding={4}
              listening={false}
            />
          )}
          
          {/* Department/agent indicator */}
          {(zone.department || zone.agent_slug) && zoneWidth > 80 && zoneHeight > 40 && (
            <Text
              x={screenX1 + 5}
              y={screenY1 + (showLabels ? 25 : 5)}
              width={zoneWidth - 10}
              height={zoneHeight - 10}
              text={zone.department || `Agent: ${zone.agent_slug}`}
              fontSize={10}
              fontFamily="Inter, sans-serif"
              fill="rgba(255, 255, 255, 0.7)"
              align="left"
              verticalAlign="top"
              padding={4}
              listening={false}
            />
          )}
          
          {/* Exclusive zone indicator */}
          {zone.is_exclusive && (
            <Rect
              x={screenX1 + zoneWidth - 20}
              y={screenY1 + 5}
              width={15}
              height={15}
              fill="#ef4444"
              cornerRadius={3}
              listening={false}
            />
          )}
        </Group>
      );
    } else if (zone.bounds.type === 'polygon') {
      const points = zone.bounds.points;
      const screenPoints = points.flatMap(([x, y]) => {
        const { x: screenX, y: screenY } = denormalize(x, y);
        return [screenX, screenY];
      });
      
      // Calculate bounding box for label placement
      const xs = points.map(p => denormalize(p[0], p[1]).x);
      const ys = points.map(p => denormalize(p[0], p[1]).y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const labelWidth = maxX - minX;
      const labelHeight = maxY - minY;
      
      return (
        <Group
          key={zone.id}
          onClick={() => onZoneClick?.(zone)}
          onTap={() => onZoneClick?.(zone)}
        >
          {/* Polygon fill */}
          <Line
            points={screenPoints}
            closed
            fill={`${zoneColor}${Math.round(fillOpacity * 255).toString(16).padStart(2, '0')}`}
            stroke={isSelected ? '#ffffff' : zoneColor}
            strokeWidth={strokeWidth}
            dash={zone.zone_type === 'common' ? [5, 5] : undefined}
          />
          
          {/* Zone label */}
          {showLabels && labelWidth > 50 && labelHeight > 30 && (
            <Text
              x={minX + 5}
              y={minY + 5}
              width={labelWidth - 10}
              height={labelHeight - 10}
              text={zone.name}
              fontSize={12}
              fontFamily="Inter, sans-serif"
              fill="#ffffff"
              align="center"
              verticalAlign="middle"
              padding={4}
              listening={false}
            />
          )}
          
          {/* Exclusive zone indicator */}
          {zone.is_exclusive && (
            <Rect
              x={maxX - 20}
              y={minY + 5}
              width={15}
              height={15}
              fill="#ef4444"
              cornerRadius={3}
              listening={false}
            />
          )}
        </Group>
      );
    }
    
    return null;
  };

  // Render zone type legend
  const renderLegend = () => {
    if (!showLabels || width < 300) return null;

    const zoneTypes = Array.from(new Set(filteredZones.map(z => z.zone_type)));
    if (zoneTypes.length <= 1) return null;

    const legendItems = zoneTypes.map(type => {
      const sampleZone = filteredZones.find(z => z.zone_type === type);
      if (!sampleZone) return null;

      const label = type === 'department' ? 'Département' :
                   type === 'restricted' ? 'Restreinte' :
                   type === 'common' ? 'Commune' : 'Personnalisée';

      return { type, color: sampleZone.color, label };
    }).filter(Boolean);

    return (
      <Group x={width - 150} y={10}>
        <Rect
          x={0}
          y={0}
          width={140}
          height={legendItems.length * 25 + 10}
          fill="rgba(0, 0, 0, 0.7)"
          cornerRadius={6}
          listening={false}
        />
        
        <Text
          x={5}
          y={5}
          text="Légende des zones"
          fontSize={10}
          fontFamily="Inter, sans-serif"
          fill="#ffffff"
          fontStyle="bold"
          listening={false}
        />
        
        {legendItems.map((item, index) => (
          <Group key={item!.type} x={5} y={25 + index * 25} listening={false}>
            <Rect
              x={0}
              y={0}
              width={12}
              height={12}
              fill={item!.color}
              cornerRadius={2}
            />
            <Text
              x={18}
              y={-2}
              text={item!.label}
              fontSize={10}
              fontFamily="Inter, sans-serif"
              fill="rgba(255, 255, 255, 0.8)"
            />
          </Group>
        ))}
      </Group>
    );
  };

  // Render statistics
  const renderStats = () => {
    if (!showLabels || width < 400) return null;

    const activeZones = filteredZones.length;
    const exclusiveZones = filteredZones.filter(z => z.is_exclusive).length;
    const departmentZones = filteredZones.filter(z => z.department).length;
    const agentZones = filteredZones.filter(z => z.agent_slug).length;

    return (
      <Group x={10} y={10}>
        <Rect
          x={0}
          y={0}
          width={180}
          height={80}
          fill="rgba(0, 0, 0, 0.7)"
          cornerRadius={6}
          listening={false}
        />
        
        <Text
          x={5}
          y={5}
          text="Statistiques des zones"
          fontSize={10}
          fontFamily="Inter, sans-serif"
          fill="#ffffff"
          fontStyle="bold"
          listening={false}
        />
        
        <Group x={5} y={25} listening={false}>
          <Text
            x={0}
            y={0}
            text={`Zones actives: ${activeZones}`}
            fontSize={9}
            fontFamily="Inter, sans-serif"
            fill="rgba(255, 255, 255, 0.8)"
          />
          <Text
            x={0}
            y={15}
            text={`Exclusives: ${exclusiveZones}`}
            fontSize={9}
            fontFamily="Inter, sans-serif"
            fill="rgba(255, 255, 255, 0.8)"
          />
          <Text
            x={0}
            y={30}
            text={`Par département: ${departmentZones}`}
            fontSize={9}
            fontFamily="Inter, sans-serif"
            fill="rgba(255, 255, 255, 0.8)"
          />
          <Text
            x={0}
            y={45}
            text={`Par agent: ${agentZones}`}
            fontSize={9}
            fontFamily="Inter, sans-serif"
            fill="rgba(255, 255, 255, 0.8)"
          />
        </Group>
      </Group>
    );
  };

  return (
    <Group>
      {/* Render all zones */}
      {filteredZones.map((zone, index) => renderZone(zone, index))}
      
      {/* Legend */}
      {renderLegend()}
      
      {/* Statistics */}
      {renderStats()}
      
      {/* Selected zone highlight (additional layer) */}
      {selectedZoneId && (
        <Group>
          {filteredZones
            .filter(zone => zone.id === selectedZoneId)
            .map(zone => {
              if (zone.bounds.type === 'rectangle') {
                const { x1, y1, x2, y2 } = zone.bounds.bounds;
                const { x: screenX1, y: screenY1 } = denormalize(x1, y1);
                const { x: screenX2, y: screenY2 } = denormalize(x2, y2);
                
                return (
                  <Rect
                    key={`highlight-${zone.id}`}
                    x={screenX1 - 3}
                    y={screenY1 - 3}
                    width={screenX2 - screenX1 + 6}
                    height={screenY2 - screenY1 + 6}
                    stroke="#ffffff"
                    strokeWidth={2}
                    dash={[4, 4]}
                    listening={false}
                  />
                );
              }
              return null;
            })}
        </Group>
      )}
    </Group>
  );
}