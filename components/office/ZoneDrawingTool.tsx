"use client";

import { useState, useEffect, useCallback } from "react";
import { Rect, Line, Circle, Group } from "react-konva";
import type { ZoneBoundsData, RectangleBounds, PolygonBounds, NormalizedPoint } from "@/lib/types/office";
import { ZoneService } from "@/lib/services/zoneService";

interface ZoneDrawingToolProps {
  width: number;
  height: number;
  isDrawing: boolean;
  shapeType: 'rectangle' | 'polygon';
  onDrawingComplete: (bounds: ZoneBoundsData) => void;
  onDrawingCancel: () => void;
  existingZones?: ZoneBoundsData[];
}

export function ZoneDrawingTool({
  width,
  height,
  isDrawing,
  shapeType,
  onDrawingComplete,
  onDrawingCancel,
  existingZones = [],
}: ZoneDrawingToolProps) {
  const [drawingPoints, setDrawingPoints] = useState<NormalizedPoint[]>([]);
  const [currentPoint, setCurrentPoint] = useState<NormalizedPoint | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startPoint, setStartPoint] = useState<NormalizedPoint | null>(null);

  // Reset drawing state when tool changes
  useEffect(() => {
    setDrawingPoints([]);
    setCurrentPoint(null);
    setStartPoint(null);
    setIsDragging(false);
  }, [shapeType, isDrawing]);

  // Handle mouse move for preview
  const handleMouseMove = useCallback((e: any) => {
    if (!isDrawing) return;

    const stage = e.target.getStage();
    const pointerPos = stage.getPointerPosition();
    
    if (!pointerPos) return;

    const normalizedPoint = ZoneService.normalizeCoordinates(
      pointerPos.x,
      pointerPos.y,
      width,
      height
    );

    setCurrentPoint(normalizedPoint);

    if (shapeType === 'rectangle' && startPoint && isDragging) {
      // For rectangle dragging
      setDrawingPoints([startPoint, normalizedPoint]);
    }
  }, [isDrawing, shapeType, startPoint, isDragging, width, height]);

  // Handle mouse down
  const handleMouseDown = useCallback((e: any) => {
    if (!isDrawing) return;

    const stage = e.target.getStage();
    const pointerPos = stage.getPointerPosition();
    
    if (!pointerPos) return;

    const normalizedPoint = ZoneService.normalizeCoordinates(
      pointerPos.x,
      pointerPos.y,
      width,
      height
    );

    if (shapeType === 'rectangle') {
      // Start rectangle drag
      setStartPoint(normalizedPoint);
      setDrawingPoints([normalizedPoint]);
      setIsDragging(true);
    } else if (shapeType === 'polygon') {
      // Add point to polygon
      const newPoints = [...drawingPoints, normalizedPoint];
      setDrawingPoints(newPoints);
      
      // Check if polygon is complete (click near first point)
      if (newPoints.length >= 3) {
        const firstPoint = newPoints[0];
        const distance = Math.sqrt(
          Math.pow(normalizedPoint.x - firstPoint.x, 2) + 
          Math.pow(normalizedPoint.y - firstPoint.y, 2)
        );
        
        if (distance < 0.05) { // 5% threshold for closing
          completePolygon(newPoints.slice(0, -1)); // Remove the closing click
        }
      }
    }
  }, [isDrawing, shapeType, drawingPoints, width, height]);

  // Handle mouse up for rectangle
  const handleMouseUp = useCallback(() => {
    if (!isDrawing || shapeType !== 'rectangle' || !isDragging) return;

    if (drawingPoints.length === 2) {
      completeRectangle(drawingPoints[0], drawingPoints[1]);
    }
    
    setIsDragging(false);
    setStartPoint(null);
  }, [isDrawing, shapeType, isDragging, drawingPoints]);

  // Complete rectangle drawing
  const completeRectangle = (p1: NormalizedPoint, p2: NormalizedPoint) => {
    const x1 = Math.min(p1.x, p2.x);
    const y1 = Math.min(p1.y, p2.y);
    const x2 = Math.max(p1.x, p2.x);
    const y2 = Math.max(p1.y, p2.y);

    // Check minimum size
    const minSize = 0.05; // 5% minimum
    if (x2 - x1 < minSize || y2 - y1 < minSize) {
      alert(`La zone doit faire au moins ${minSize * 100}% de la taille du canvas`);
      onDrawingCancel();
      return;
    }

    const bounds: ZoneBoundsData = {
      type: 'rectangle',
      bounds: { x1, y1, x2, y2 },
    };

    onDrawingComplete(bounds);
  };

  // Complete polygon drawing
  const completePolygon = (points: NormalizedPoint[]) => {
    if (points.length < 3) {
      alert("Un polygone doit avoir au moins 3 points");
      onDrawingCancel();
      return;
    }

    // Convert to polygon format
    const polygonPoints: PolygonBounds = points.map(p => [p.x, p.y]);

    const bounds: ZoneBoundsData = {
      type: 'polygon',
      points: polygonPoints,
    };

    onDrawingComplete(bounds);
  };

  // Cancel drawing with Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDrawing) {
        onDrawingCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawing, onDrawingCancel]);

  // Render drawing preview
  const renderDrawingPreview = () => {
    if (!isDrawing || (!currentPoint && drawingPoints.length === 0)) {
      return null;
    }

    const denormalize = (point: NormalizedPoint) => {
      return ZoneService.denormalizeCoordinates(point.x, point.y, width, height);
    };

    if (shapeType === 'rectangle') {
      if (drawingPoints.length === 1 && currentPoint) {
        const p1 = drawingPoints[0];
        const p2 = currentPoint;
        const x1 = Math.min(p1.x, p2.x);
        const y1 = Math.min(p1.y, p2.y);
        const x2 = Math.max(p1.x, p2.x);
        const y2 = Math.max(p1.y, p2.y);

        const { x: screenX1, y: screenY1 } = denormalize({ x: x1, y: y1 });
        const { x: screenX2, y: screenY2 } = denormalize({ x: x2, y: y2 });

        return (
          <Group>
            <Rect
              x={screenX1}
              y={screenY1}
              width={screenX2 - screenX1}
              height={screenY2 - screenY1}
              stroke="#3b82f6"
              strokeWidth={2}
              dash={[5, 5]}
              fill="rgba(59, 130, 246, 0.1)"
            />
            <Circle
              x={screenX1}
              y={screenY1}
              radius={4}
              fill="#3b82f6"
            />
            <Circle
              x={screenX2}
              y={screenY2}
              radius={4}
              fill="#3b82f6"
            />
          </Group>
        );
      }
    } else if (shapeType === 'polygon') {
      const points: number[] = [];
      
      // Add existing points
      drawingPoints.forEach(point => {
        const { x, y } = denormalize(point);
        points.push(x, y);
      });

      // Add current point for preview
      if (currentPoint && drawingPoints.length > 0) {
        const { x: currentX, y: currentY } = denormalize(currentPoint);
        const lastPoint = drawingPoints[drawingPoints.length - 1];
        const { x: lastX, y: lastY } = denormalize(lastPoint);
        
        points.push(lastX, lastY, currentX, currentY);
      }

      // Add line back to first point if we have at least 2 points
      if (drawingPoints.length >= 2 && currentPoint) {
        const firstPoint = drawingPoints[0];
        const { x: firstX, y: firstY } = denormalize(firstPoint);
        const { x: currentX, y: currentY } = denormalize(currentPoint);
        
        points.push(currentX, currentY, firstX, firstY);
      }

      return (
        <Group>
          {/* Polygon fill */}
          {drawingPoints.length >= 3 && (
            <Line
              points={drawingPoints.flatMap(p => {
                const { x, y } = denormalize(p);
                return [x, y];
              })}
              closed
              fill="rgba(59, 130, 246, 0.1)"
              stroke="rgba(59, 130, 246, 0.3)"
              strokeWidth={1}
            />
          )}

          {/* Lines between points */}
          <Line
            points={points}
            stroke="#3b82f6"
            strokeWidth={2}
            dash={[5, 5]}
          />

          {/* Points */}
          {drawingPoints.map((point, index) => {
            const { x, y } = denormalize(point);
            return (
              <Circle
                key={index}
                x={x}
                y={y}
                radius={4}
                fill="#3b82f6"
                stroke="#ffffff"
                strokeWidth={1}
              />
            );
          })}

          {/* Current point */}
          {currentPoint && (
            <Circle
              x={denormalize(currentPoint).x}
              y={denormalize(currentPoint).y}
              radius={3}
              fill="#ef4444"
            />
          )}
        </Group>
      );
    }

    return null;
  };

  // Render existing zones for reference
  const renderExistingZones = () => {
    return existingZones.map((zone, index) => {
      if (zone.type === 'rectangle') {
        const { x1, y1, x2, y2 } = zone.bounds;
        const { x: screenX1, y: screenY1 } = ZoneService.denormalizeCoordinates(x1, y1, width, height);
        const { x: screenX2, y: screenY2 } = ZoneService.denormalizeCoordinates(x2, y2, width, height);

        return (
          <Rect
            key={`existing-${index}`}
            x={screenX1}
            y={screenY1}
            width={screenX2 - screenX1}
            height={screenY2 - screenY1}
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth={1}
            dash={[3, 3]}
            fill="rgba(255, 255, 255, 0.05)"
          />
        );
      }
      return null;
    });
  };

  // Instructions overlay
  const renderInstructions = () => {
    if (!isDrawing) return null;

    const instructions = shapeType === 'rectangle'
      ? "Cliquez et glissez pour dessiner un rectangle. Échap pour annuler."
      : "Cliquez pour ajouter des points. Cliquez près du premier point pour fermer. Échap pour annuler.";

    return (
      <Group>
        <Rect
          x={10}
          y={10}
          width={width - 20}
          height={40}
          fill="rgba(0, 0, 0, 0.7)"
          cornerRadius={8}
        />
        <Rect
          x={10}
          y={10}
          width={width - 20}
          height={40}
          stroke="#3b82f6"
          strokeWidth={1}
          cornerRadius={8}
        />
        <Line
          points={[15, 30, width - 15, 30]}
          stroke="#3b82f6"
          strokeWidth={1}
          dash={[3, 3]}
        />
      </Group>
    );
  };

  return (
    <Group
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      {/* Existing zones (reference) */}
      {renderExistingZones()}

      {/* Drawing preview */}
      {renderDrawingPreview()}

      {/* Instructions */}
      {renderInstructions()}

      {/* Full-screen hit area for drawing */}
      {isDrawing && (
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="transparent"
          listening={true}
        />
      )}
    </Group>
  );
}