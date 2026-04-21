"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Circle, Group, Line, Rect, Text } from "react-konva";
import type { NormalizedPoint, ZoneBoundsData } from "@/lib/types/office";
import { isPolygonBounds, isRectangleBounds, toZoneBounds } from "@/lib/types/office";
import { ZoneService } from "@/lib/services/zoneService";

interface ZoneDrawingToolProps {
  width: number;
  height: number;
  isDrawing: boolean;
  onDrawingComplete: (bounds: ZoneBoundsData) => void;
  onDrawingCancel: () => void;
  existingZones?: ZoneBoundsData[];
}

export function ZoneDrawingTool({
  width,
  height,
  isDrawing,
  onDrawingComplete,
  onDrawingCancel,
  existingZones = [],
}: ZoneDrawingToolProps) {
  const [points, setPoints] = useState<NormalizedPoint[]>([]);
  const [hoverPoint, setHoverPoint] = useState<NormalizedPoint | null>(null);

  useEffect(() => {
    if (!isDrawing) {
      setPoints([]);
      setHoverPoint(null);
    }
  }, [isDrawing]);

  const completePolygon = useCallback(() => {
    if (points.length < 3) {
      return;
    }

    onDrawingComplete({
      type: "polygon",
      points: points.map(({ x, y }) => [x, y]),
    });
  }, [onDrawingComplete, points]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isDrawing) {
        return;
      }

      if (event.key === "Escape") {
        onDrawingCancel();
      }

      if (event.key === "Enter") {
        completePolygon();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [completePolygon, isDrawing, onDrawingCancel]);

  const toScreen = useCallback(
    (point: NormalizedPoint) => ZoneService.denormalizeCoordinates(point.x, point.y, width, height),
    [height, width]
  );

  const currentPolyline = useMemo(() => {
    const previewPoints = hoverPoint ? [...points, hoverPoint] : points;
    return previewPoints.flatMap((point) => {
      const screenPoint = toScreen(point);
      return [screenPoint.x, screenPoint.y];
    });
  }, [hoverPoint, points, toScreen]);

  const handleMouseMove = useCallback(
    (event: any) => {
      if (!isDrawing) {
        return;
      }

      const stage = event.target.getStage();
      const pointerPos = stage?.getPointerPosition();
      if (!pointerPos) {
        return;
      }

      setHoverPoint(ZoneService.normalizeCoordinates(pointerPos.x, pointerPos.y, width, height));
    },
    [height, isDrawing, width]
  );

  const handleMouseDown = useCallback(
    (event: any) => {
      if (!isDrawing) {
        return;
      }

      const stage = event.target.getStage();
      const pointerPos = stage?.getPointerPosition();
      if (!pointerPos) {
        return;
      }

      const normalizedPoint = ZoneService.normalizeCoordinates(pointerPos.x, pointerPos.y, width, height);
      setPoints((currentPoints) => [...currentPoints, normalizedPoint]);
    },
    [height, isDrawing, width]
  );

  const renderExistingZones = () => {
    return existingZones.map((zone, index) => {
      if (isRectangleBounds(zone)) {
        const { x1, y1, x2, y2 } = zone.bounds;
        const p1 = ZoneService.denormalizeCoordinates(x1, y1, width, height);
        const p2 = ZoneService.denormalizeCoordinates(x2, y2, width, height);

        return (
          <Rect
            key={`existing-zone-${index}`}
            x={p1.x}
            y={p1.y}
            width={p2.x - p1.x}
            height={p2.y - p1.y}
            stroke="rgba(255,255,255,0.25)"
            strokeWidth={1}
            dash={[6, 4]}
            fill="rgba(255,255,255,0.05)"
          />
        );
      }

      if (isPolygonBounds(zone)) {
        const polygonPoints = zone.points.flatMap(([x, y]) => {
          const point = ZoneService.denormalizeCoordinates(x, y, width, height);
          return [point.x, point.y];
        });

        return (
          <Line
            key={`existing-zone-${index}`}
            points={polygonPoints}
            closed
            stroke="rgba(255,255,255,0.25)"
            strokeWidth={1}
            dash={[6, 4]}
            fill="rgba(255,255,255,0.05)"
          />
        );
      }

      const fallbackBounds = toZoneBounds(zone);
      const p1 = ZoneService.denormalizeCoordinates(fallbackBounds.x1, fallbackBounds.y1, width, height);
      const p2 = ZoneService.denormalizeCoordinates(fallbackBounds.x2, fallbackBounds.y2, width, height);

      return (
        <Rect
          key={`existing-zone-${index}`}
          x={p1.x}
          y={p1.y}
          width={p2.x - p1.x}
          height={p2.y - p1.y}
          stroke="rgba(255,255,255,0.25)"
          strokeWidth={1}
          dash={[6, 4]}
          fill="rgba(255,255,255,0.05)"
        />
      );
    });
  };

  const renderPreview = () => {
    if (!isDrawing || points.length === 0) {
      return null;
    }

    return (
      <Group>
        {points.length >= 2 && (
          <Line
            points={currentPolyline}
            stroke="#3b82f6"
            strokeWidth={2}
            lineCap="round"
            lineJoin="round"
          />
        )}
        {points.length >= 3 && (
          <Line
            points={currentPolyline}
            closed={false}
            stroke="rgba(59,130,246,0.35)"
            strokeWidth={10}
            lineCap="round"
            lineJoin="round"
          />
        )}
        {points.map((point, index) => {
          const screenPoint = toScreen(point);
          return (
            <Circle
              key={`point-${index}`}
              x={screenPoint.x}
              y={screenPoint.y}
              radius={5}
              fill="#3b82f6"
              stroke="#ffffff"
              strokeWidth={1}
            />
          );
        })}
        {hoverPoint && points.length > 0 && (() => {
          const screenPoint = toScreen(hoverPoint);
          return <Circle x={screenPoint.x} y={screenPoint.y} radius={4} fill="rgba(59,130,246,0.45)" />;
        })()}
      </Group>
    );
  };

  const renderInstructions = () => {
    if (!isDrawing) {
      return null;
    }

    const panelWidth = Math.min(width - 20, 420);

    return (
      <Group>
        <Rect x={10} y={10} width={panelWidth} height={96} fill="rgba(0,0,0,0.72)" cornerRadius={10} />
        <Rect x={10} y={10} width={panelWidth} height={96} stroke="#3b82f6" strokeWidth={1} cornerRadius={10} />
        <Line points={[20, 37, panelWidth, 37]} stroke="rgba(59,130,246,0.5)" strokeWidth={1} dash={[4, 4]} />
        <Text
          x={20}
          y={18}
          text="Mode dessin actif"
          fontSize={13}
          fontStyle="bold"
          fill="#dbeafe"
          listening={false}
        />
        <Text
          x={20}
          y={45}
          width={panelWidth - 20}
          text="Cliquez pour poser les points. Double-cliquez ou appuyez sur Entrée pour terminer."
          fontSize={12}
          fill="rgba(255,255,255,0.85)"
          listening={false}
        />
        <Text
          x={20}
          y={68}
          width={panelWidth - 20}
          text="Échap annule. Une confirmation apparaîtra ensuite pour enregistrer la zone."
          fontSize={11}
          fill="rgba(191,219,254,0.9)"
          listening={false}
        />
      </Group>
    );
  };

  return (
    <Group onMouseMove={handleMouseMove} onMouseDown={handleMouseDown} onDblClick={completePolygon}>
      {renderExistingZones()}
      {renderPreview()}
      {renderInstructions()}
      {isDrawing && <Rect x={0} y={0} width={width} height={height} fill="transparent" listening />}
    </Group>
  );
}