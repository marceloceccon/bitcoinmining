/**
 * Layout for the live farm schematic: grid → transformer → PDUs → racks or
 * containers → cooling → heat exhaust. Pure and deterministic: the same farm
 * always produces the same drawing, so it can be unit-tested and animated
 * between states (nodes keep stable keys).
 */
import type { FarmConfig } from '@/types';
import type { FarmReport } from '@/lib/farmReport';
import { CONTAINER_MINERS_CAPACITY, RACK_MINERS_CAPACITY } from '@/lib/calculations';
import { autoSelectTransformer } from '@/lib/transformerData';
import { coolingHeatLoadKw } from '@/lib/cooling';

export const SCHEMATIC_WIDTH = 720;
export const SCHEMATIC_HEIGHT = 250;
/** Housing units drawn individually; beyond this the last slot becomes a "×N" group. */
export const MAX_HOUSING_DRAWN = 4;
/** Cooling units drawn individually per kind; beyond this they're shown as "×N". */
export const MAX_COOLERS_DRAWN = 3;

export interface SchematicInput {
  totalMiners: number;
  totalPowerKw: number;
  infrastructure: FarmConfig['infrastructureType'];
  transformer: { kvaRating: number; quantity: number } | null;
  fans: number;
  dryCoolers: number;
  airHeatKw: number;
  hydroHeatKw: number;
  ventilationM3h: number;
  maxTempC: number;
}

export interface HousingUnit {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** 0–1 share of the unit's miner slots that are filled */
  fill: number;
  /** When set, this slot stands for this many identical units */
  groupCount?: number;
}

export interface CoolerUnit {
  key: string;
  kind: 'fan' | 'dryCooler';
  cx: number;
  cy: number;
  /** When set, the last icon stands for this many units */
  groupCount?: number;
}

export interface SchematicLayout {
  grid: { x: number; y: number };
  transformer: { x: number; y: number; label: string; present: boolean };
  pdu: { x: number; y: number; label: string };
  housing: { units: HousingUnit[]; label: string; x: number; width: number };
  coolers: CoolerUnit[];
  coolingLabel: string;
  /** Wire paths that carry power, in drawing order */
  powerPaths: string[];
  /** Seconds per dash cycle: busier farms (more MW) flow faster */
  flowSeconds: number;
  /** 0–1 heat plume intensity from heat load and site temperature */
  plume: number;
  exhaustLabel: string;
}

const WIRE_Y = 125;

export function schematicInputFromFarm(config: FarmConfig, report: FarmReport): SchematicInput {
  const totalMiners = config.miners.reduce((n, m) => n + m.quantity, 0);
  const tx = autoSelectTransformer(report.metrics.transformerKva);
  const sum = (sel: { quantity: number }[] | undefined) => (sel ?? []).reduce((n, s) => n + s.quantity, 0);
  return {
    totalMiners,
    totalPowerKw: report.totalPowerKw,
    infrastructure: config.infrastructureType,
    transformer: tx ? { kvaRating: tx.model.kva_rating, quantity: tx.quantity } : null,
    fans: sum(config.temperature?.airFanSelections),
    dryCoolers: sum(config.temperature?.dryCoolerSelections),
    airHeatKw: coolingHeatLoadKw(config, 'air'),
    hydroHeatKw: coolingHeatLoadKw(config, 'hydro'),
    ventilationM3h: report.ventilation.m3h,
    maxTempC: report.climate.maxTempC,
  };
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

function housingUnits(input: SchematicInput): { units: HousingUnit[]; label: string } {
  const containers = input.infrastructure === 'containers';
  const capacity = containers ? CONTAINER_MINERS_CAPACITY : RACK_MINERS_CAPACITY;
  const count = Math.max(1, Math.ceil(input.totalMiners / capacity));
  const drawn = Math.min(count, MAX_HOUSING_DRAWN);
  const areaX = 330;
  const areaW = 230;
  const gap = 8;
  const width = (areaW - gap * (drawn - 1)) / drawn;
  const height = containers ? 96 : 120;
  const units: HousingUnit[] = [];
  for (let i = 0; i < drawn; i++) {
    const isGroup = count > MAX_HOUSING_DRAWN && i === drawn - 1;
    const minersBefore = i * capacity;
    const inThis = isGroup ? capacity : Math.min(capacity, Math.max(0, input.totalMiners - minersBefore));
    units.push({
      key: `housing-${i}`,
      x: areaX + i * (width + gap),
      y: WIRE_Y - height / 2,
      width,
      height,
      fill: input.totalMiners === 0 ? 0 : inThis / capacity,
      groupCount: isGroup ? count - (MAX_HOUSING_DRAWN - 1) : undefined,
    });
  }
  const noun = containers ? (count === 1 ? '20 ft container' : '20 ft containers') : count === 1 ? 'rack' : 'racks';
  return { units, label: `${count} × ${noun} · ${fmt(input.totalMiners)} miners` };
}

function coolerUnits(input: SchematicInput): CoolerUnit[] {
  const kinds: { kind: CoolerUnit['kind']; count: number }[] = [
    { kind: 'fan', count: input.fans },
    { kind: 'dryCooler', count: input.dryCoolers },
  ].filter((k) => k.count > 0) as { kind: CoolerUnit['kind']; count: number }[];
  const units: CoolerUnit[] = [];
  kinds.forEach(({ kind, count }, row) => {
    const drawn = Math.min(count, MAX_COOLERS_DRAWN);
    const cy = kinds.length === 1 ? WIRE_Y : WIRE_Y - 26 + row * 52;
    for (let i = 0; i < drawn; i++) {
      const isGroup = count > MAX_COOLERS_DRAWN && i === drawn - 1;
      units.push({
        key: `${kind}-${i}`,
        kind,
        cx: 608 + i * 40,
        cy,
        groupCount: isGroup ? count - (MAX_COOLERS_DRAWN - 1) : undefined,
      });
    }
  });
  return units;
}

export function layoutSchematic(input: SchematicInput): SchematicLayout {
  const { units, label } = housingUnits(input);
  const coolers = coolerUnits(input);
  const tx = input.transformer;
  const racks = Math.max(1, Math.ceil(input.totalMiners / RACK_MINERS_CAPACITY));
  const heatKw = input.airHeatKw + input.hydroHeatKw;
  const mw = input.totalPowerKw / 1000;

  const coolingParts = [
    input.fans > 0 ? `${input.fans} fan${input.fans === 1 ? '' : 's'}` : '',
    input.dryCoolers > 0 ? `${input.dryCoolers} dry cooler${input.dryCoolers === 1 ? '' : 's'}` : '',
  ].filter(Boolean);

  return {
    grid: { x: 44, y: WIRE_Y },
    transformer: {
      x: 150,
      y: WIRE_Y,
      present: tx !== null,
      label: tx ? `${tx.quantity > 1 ? `${tx.quantity} × ` : ''}${fmt(tx.kvaRating)} kVA` : 'Service panel',
    },
    pdu: { x: 262, y: WIRE_Y, label: `${racks} PDU${racks === 1 ? '' : 's'}` },
    housing: { units, label, x: 330, width: 230 },
    coolers,
    coolingLabel: coolingParts.length > 0 ? coolingParts.join(' + ') : 'no cooling selected',
    powerPaths: [`M64 ${WIRE_Y} H118`, `M182 ${WIRE_Y} H244`, `M280 ${WIRE_Y} H330`],
    // 0.1 MW → ~2.4 s per cycle, 10 MW → ~0.6 s
    flowSeconds: Math.max(0.5, Math.min(2.6, 1.5 - 0.45 * Math.log10(Math.max(mw, 0.01)))),
    plume: Math.max(0, Math.min(1, (heatKw / 3000) * 0.6 + ((input.maxTempC - 15) / 30) * 0.4)),
    exhaustLabel:
      input.ventilationM3h > 0
        ? `${fmt(input.ventilationM3h)} m³/h`
        : input.hydroHeatKw > 0
          ? `${fmt(input.hydroHeatKw)} kW rejected`
          : '',
  };
}
