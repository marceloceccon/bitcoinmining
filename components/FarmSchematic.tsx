"use client";

import { useMemo } from "react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import type { FarmConfig } from "@/types";
import type { FarmReport } from "@/lib/farmReport";
import { SCHEMATIC_HEIGHT, SCHEMATIC_WIDTH, layoutSchematic, schematicInputFromFarm } from "@/lib/schematicLayout";
import { cn } from "@/lib/utils";

interface FarmSchematicProps {
  config: FarmConfig;
  report: FarmReport | null;
  className?: string;
  /** Hide small labels (for compact placements) */
  compact?: boolean;
}

const layoutSpring = { type: "spring", stiffness: 260, damping: 30 } as const;

/**
 * The live farm schematic. Driven purely by the farm config and its computed
 * report: power flows from the grid through the transformer and PDUs into the
 * racks or containers (fill = miner count), cooling units reject the heat, and
 * the plume grows with heat load and site temperature. Changing the farm
 * morphs the layout; reduced motion shows a static diagram.
 */
export default function FarmSchematic({ config, report, className, compact = false }: FarmSchematicProps) {
  const reduce = useReducedMotion();
  const layout = useMemo(() => (report ? layoutSchematic(schematicInputFromFarm(config, report)) : null), [config, report]);

  if (!layout) {
    return (
      <div className={cn("flex aspect-[72/25] items-center justify-center text-sm text-muted", className)}>
        Add miners to see the farm schematic
      </div>
    );
  }

  const text = (x: number, y: number, label: string, anchor: "start" | "middle" | "end" = "middle") =>
    compact ? null : (
      <text x={x} y={y} textAnchor={anchor} className="fill-muted font-mono" fontSize={11}>
        {label}
      </text>
    );
  const t = layout.transformer;

  return (
    <svg
      viewBox={`0 0 ${SCHEMATIC_WIDTH} ${SCHEMATIC_HEIGHT}`}
      className={cn("block h-auto w-full max-w-full", className)}
      role="img"
      aria-label={`Farm schematic: grid connection, ${t.label}, ${layout.pdu.label}, ${layout.housing.label}, cooling ${layout.coolingLabel}${layout.exhaustLabel ? `, ${layout.exhaustLabel}` : ""}.`}
    >
      {/* Grid connection */}
      <path
        d={`M${layout.grid.x - 12} ${layout.grid.y + 35} L${layout.grid.x} ${layout.grid.y - 45} L${layout.grid.x + 12} ${layout.grid.y + 35} M${layout.grid.x - 8} ${layout.grid.y + 5} H${layout.grid.x + 8} M${layout.grid.x - 5} ${layout.grid.y - 15} H${layout.grid.x + 5} M${layout.grid.x} ${layout.grid.y - 45} V${layout.grid.y - 55}`}
        className="stroke-power"
        fill="none"
        strokeWidth={2}
      />
      {text(layout.grid.x, layout.grid.y + 58, "GRID")}

      {/* Power wires: a static track plus a flowing dash whose speed scales with MW */}
      {layout.powerPaths.map((d) => (
        <g key={d}>
          <path d={d} className="stroke-line" strokeWidth={3} />
          <path
            d={d}
            className="stroke-btc"
            strokeWidth={3}
            strokeDasharray="3 9"
            style={reduce ? undefined : { animation: `schematic-flow ${layout.flowSeconds}s linear infinite` }}
          />
        </g>
      ))}

      {/* Transformer */}
      <rect x={t.x - 32} y={t.y - 30} width={64} height={60} rx={4} className="fill-surface stroke-power" strokeWidth={1.5} />
      {t.present ? (
        <>
          <circle cx={t.x - 10} cy={t.y} r={13} fill="none" className="stroke-power" strokeWidth={1.5} />
          <circle cx={t.x + 10} cy={t.y} r={13} fill="none" className="stroke-power" strokeWidth={1.5} />
        </>
      ) : (
        <path d={`M${t.x - 14} ${t.y - 12} H${t.x + 14} M${t.x - 14} ${t.y} H${t.x + 14} M${t.x - 14} ${t.y + 12} H${t.x + 14}`} className="stroke-power" strokeWidth={1.5} />
      )}
      {text(t.x, t.y + 58, t.label)}

      {/* PDUs */}
      <rect x={layout.pdu.x - 18} y={layout.pdu.y - 22} width={36} height={44} rx={3} className="fill-surface stroke-power" strokeWidth={1.5} />
      {[-10, 0, 10].map((dy) => (
        <circle key={dy} cx={layout.pdu.x} cy={layout.pdu.y + dy} r={2.5} className="fill-power" />
      ))}
      {text(layout.pdu.x, layout.pdu.y + 58, layout.pdu.label)}

      {/* Racks or containers, filled to the share of miner slots in use */}
      <AnimatePresence initial={false}>
        {layout.housing.units.map((u) => (
          <m.g
            key={u.key}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <m.rect
              initial={false}
              animate={{ x: u.x, y: u.y, width: u.width, height: u.height }}
              transition={reduce ? { duration: 0 } : layoutSpring}
              rx={4}
              className="fill-surface stroke-power"
              strokeWidth={1.5}
            />
            <m.rect
              initial={false}
              animate={{ x: u.x + 4, y: u.y + 4 + (u.height - 8) * (1 - u.fill), width: u.width - 8, height: (u.height - 8) * u.fill }}
              transition={reduce ? { duration: 0 } : layoutSpring}
              rx={2}
              className="fill-heat"
              fillOpacity={0.75}
            />
            {u.groupCount !== undefined && (
              <text x={u.x + u.width / 2} y={u.y + u.height / 2 + 5} textAnchor="middle" className="fill-fg font-mono" fontSize={14} fontWeight={600}>
                ×{u.groupCount}
              </text>
            )}
          </m.g>
        ))}
      </AnimatePresence>
      {text(layout.housing.x + layout.housing.width / 2, 225, layout.housing.label)}

      {/* Coupling from housing to cooling */}
      <path d={`M${layout.housing.x + layout.housing.width} 125 H586`} className="stroke-cool" strokeWidth={2} strokeDasharray="2 4" />

      {/* Cooling units */}
      <AnimatePresence initial={false}>
        {layout.coolers.map((c) => (
          <m.g
            key={c.key}
            initial={reduce ? false : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.25 }}
            style={{ transformOrigin: `${c.cx}px ${c.cy}px` }}
          >
            {c.kind === "fan" ? (
              <>
                <circle cx={c.cx} cy={c.cy} r={16} fill="none" className="stroke-cool" strokeWidth={1.5} />
                <path d={`M${c.cx} ${c.cy} l0 -12 M${c.cx} ${c.cy} l10.4 6 M${c.cx} ${c.cy} l-10.4 6`} className="stroke-cool" strokeWidth={1.5} />
              </>
            ) : (
              <>
                <rect x={c.cx - 16} y={c.cy - 14} width={32} height={28} rx={3} fill="none" className="stroke-cool" strokeWidth={1.5} />
                {[-8, 0, 8].map((dx) => (
                  <path key={dx} d={`M${c.cx + dx} ${c.cy - 9} V${c.cy + 9}`} className="stroke-cool" strokeWidth={1.2} />
                ))}
              </>
            )}
            {c.groupCount !== undefined && (
              <text x={c.cx} y={c.cy + 32} textAnchor="middle" className="fill-fg font-mono" fontSize={11} fontWeight={600}>
                ×{c.groupCount}
              </text>
            )}
          </m.g>
        ))}
      </AnimatePresence>
      {text(648, 225, layout.coolingLabel)}

      {/* Heat exhaust plume: intensity follows heat load and site climate */}
      {layout.coolers.length > 0 &&
        [0, 1, 2].map((i) => (
          <path
            key={i}
            d={`M${618 + i * 26} 90 C ${608 + i * 26} 70, ${632 + i * 26} 58, ${620 + i * 26} 34`}
            className="stroke-heat"
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            opacity={i < 1 + Math.round(layout.plume * 2) ? 0.35 + layout.plume * 0.55 : 0}
            style={reduce ? undefined : { animation: `schematic-plume 3.2s ease-in-out ${i * 0.7}s infinite`, transformBox: "fill-box", transformOrigin: "bottom" }}
          />
        ))}
      {layout.exhaustLabel && text(648, 22, layout.exhaustLabel)}
    </svg>
  );
}
