"use client";

interface DeskMarkerProps {
  occupied?: boolean;
  color?: string; // tailwind color class e.g. "bg-cyan-500"
}

export function DeskMarker({ occupied = false, color = "bg-primary" }: DeskMarkerProps) {
  return (
    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 pointer-events-none">
      {/* Ellipse shadow simulating isometric floor projection */}
      <div
        className="relative w-14 h-5 rounded-full"
        style={{
          background: occupied
            ? undefined
            : "radial-gradient(ellipse, rgba(255,255,255,0.08) 0%, transparent 70%)",
        }}
      >
        {occupied && (
          <>
            {/* Outer pulse ring */}
            <div
              className={`absolute inset-0 rounded-full ${color} opacity-20 animate-ping`}
              style={{ animationDuration: "2.5s" }}
            />
            {/* Static glow */}
            <div
              className={`absolute inset-0 rounded-full ${color} opacity-30 blur-sm`}
            />
          </>
        )}
      </div>
    </div>
  );
}
