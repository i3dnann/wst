import type { CSSProperties } from "react";
import type { LiveDrawParticipant } from "@/lib/api";

const FULL_TURN = 360;

function polarPoint(angle: number, radius = 49): [number, number] {
  const radians = ((angle - 90) * Math.PI) / 180;
  return [50 + radius * Math.cos(radians), 50 + radius * Math.sin(radians)];
}

function wheelSlice(startAngle: number, endAngle: number): string {
  const [startX, startY] = polarPoint(startAngle);
  const [endX, endY] = polarPoint(endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M 50 50 L ${String(startX)} ${String(startY)} A 49 49 0 ${String(largeArc)} 1 ${String(endX)} ${String(endY)} Z`;
}

function wheelLabel(name: string): [string, string?] {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return [words[0]?.slice(0, 11) ?? name.slice(0, 11)];
  return [words[0]?.slice(0, 9) ?? "", words.slice(1).join(" ").slice(0, 11)];
}

export function DrawWheelGraphic({
  participants,
  rotation,
  spinning,
  durationMs,
}: {
  participants: LiveDrawParticipant[];
  rotation: number;
  spinning: boolean;
  durationMs: number;
}) {
  const sliceAngle = participants.length
    ? FULL_TURN / participants.length
    : FULL_TURN;
  const wheelStyle = {
    "--draw-wheel-duration": `${String(spinning ? durationMs : 0)}ms`,
    transform: `rotate(${String(rotation)}deg)`,
  } as CSSProperties;

  return (
    <>
      <div className="champions-draw__pointer" aria-hidden="true" />
      <div
        className={`champions-draw__wheel${spinning ? " is-spinning" : ""}`}
        style={wheelStyle}
        aria-hidden="true"
      >
        <svg viewBox="0 0 100 100">
          {participants.length ? (
            participants.map((participant, index) => {
              const start = index * sliceAngle;
              const end = start + sliceAngle;
              const mid = start + sliceAngle / 2;
              const [labelX, labelY] = polarPoint(mid, 34);
              const [firstLine, secondLine] = wheelLabel(participant.gang.name);
              return (
                <g key={participant.id}>
                  <path
                    d={wheelSlice(start, end)}
                    className={index % 2 ? "is-dark" : "is-red"}
                  />
                  <text
                    x={labelX}
                    y={labelY - (secondLine ? 1.4 : 0)}
                    textAnchor="middle"
                    style={{
                      fontSize:
                        participants.length > 12
                          ? "1.9px"
                          : participants.length > 8
                            ? "2.35px"
                            : "2.8px",
                    }}
                  >
                    <tspan x={labelX}>{firstLine}</tspan>
                    {secondLine ? (
                      <tspan x={labelX} dy="2.8">
                        {secondLine}
                      </tspan>
                    ) : null}
                  </text>
                </g>
              );
            })
          ) : (
            <circle cx="50" cy="50" r="49" />
          )}
          <circle
            className="champions-draw__wheel-ring"
            cx="50"
            cy="50"
            r="18"
          />
        </svg>
        <img src="/assets/wst/wst-logo.png" alt="" />
      </div>
    </>
  );
}
