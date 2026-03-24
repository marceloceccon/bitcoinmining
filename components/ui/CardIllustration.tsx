type Theme =
  | "circuit"
  | "racks"
  | "network"
  | "chart"
  | "sun"
  | "thermal"
  | "tools"
  | "bitcoin"
  | "gauge"
  | "shield";

const ACCENT = "#1E40AF";

function CircuitSvg() {
  return (
    <svg viewBox="0 0 400 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Horizontal traces */}
      <line x1="20" y1="30" x2="180" y2="30" stroke={ACCENT} strokeOpacity="0.12" strokeWidth="1.5" />
      <line x1="220" y1="30" x2="380" y2="30" stroke={ACCENT} strokeOpacity="0.08" strokeWidth="1" />
      <line x1="40" y1="55" x2="260" y2="55" stroke={ACCENT} strokeOpacity="0.10" strokeWidth="1.5" />
      <line x1="280" y1="55" x2="360" y2="55" stroke={ACCENT} strokeOpacity="0.06" strokeWidth="1" />
      <line x1="60" y1="75" x2="340" y2="75" stroke={ACCENT} strokeOpacity="0.08" strokeWidth="1" />
      {/* Vertical traces */}
      <line x1="180" y1="20" x2="180" y2="65" stroke={ACCENT} strokeOpacity="0.10" strokeWidth="1" />
      <line x1="260" y1="45" x2="260" y2="85" stroke={ACCENT} strokeOpacity="0.08" strokeWidth="1" />
      <line x1="100" y1="25" x2="100" y2="80" stroke={ACCENT} strokeOpacity="0.06" strokeWidth="1" />
      {/* Nodes */}
      <circle cx="180" cy="30" r="3" fill={ACCENT} fillOpacity="0.18" />
      <circle cx="260" cy="55" r="3" fill={ACCENT} fillOpacity="0.15" />
      <circle cx="100" cy="55" r="2.5" fill={ACCENT} fillOpacity="0.12" />
      <circle cx="340" cy="75" r="2" fill={ACCENT} fillOpacity="0.10" />
      <circle cx="40" cy="55" r="2" fill={ACCENT} fillOpacity="0.10" />
      {/* Chip outline */}
      <rect x="155" y="42" width="50" height="26" rx="4" stroke={ACCENT} strokeOpacity="0.14" strokeWidth="1.5" fill={ACCENT} fillOpacity="0.03" />
      <rect x="290" y="22" width="35" height="18" rx="3" stroke={ACCENT} strokeOpacity="0.10" strokeWidth="1" fill={ACCENT} fillOpacity="0.02" />
    </svg>
  );
}

function RacksSvg() {
  return (
    <svg viewBox="0 0 400 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Rack 1 */}
      <rect x="40" y="15" width="60" height="70" rx="4" stroke={ACCENT} strokeOpacity="0.12" strokeWidth="1.5" fill={ACCENT} fillOpacity="0.03" />
      <rect x="48" y="23" width="44" height="8" rx="2" fill={ACCENT} fillOpacity="0.06" />
      <rect x="48" y="35" width="44" height="8" rx="2" fill={ACCENT} fillOpacity="0.05" />
      <rect x="48" y="47" width="44" height="8" rx="2" fill={ACCENT} fillOpacity="0.04" />
      <rect x="48" y="59" width="44" height="8" rx="2" fill={ACCENT} fillOpacity="0.03" />
      <circle cx="88" cy="27" r="1.5" fill={ACCENT} fillOpacity="0.20" />
      <circle cx="88" cy="39" r="1.5" fill={ACCENT} fillOpacity="0.15" />
      {/* Rack 2 */}
      <rect x="120" y="15" width="60" height="70" rx="4" stroke={ACCENT} strokeOpacity="0.10" strokeWidth="1.5" fill={ACCENT} fillOpacity="0.02" />
      <rect x="128" y="23" width="44" height="8" rx="2" fill={ACCENT} fillOpacity="0.05" />
      <rect x="128" y="35" width="44" height="8" rx="2" fill={ACCENT} fillOpacity="0.04" />
      <rect x="128" y="47" width="44" height="8" rx="2" fill={ACCENT} fillOpacity="0.03" />
      <rect x="128" y="59" width="44" height="8" rx="2" fill={ACCENT} fillOpacity="0.025" />
      {/* Rack 3 (faded) */}
      <rect x="200" y="15" width="60" height="70" rx="4" stroke={ACCENT} strokeOpacity="0.07" strokeWidth="1" fill={ACCENT} fillOpacity="0.015" />
      <rect x="208" y="23" width="44" height="8" rx="2" fill={ACCENT} fillOpacity="0.03" />
      <rect x="208" y="35" width="44" height="8" rx="2" fill={ACCENT} fillOpacity="0.025" />
      {/* Connection lines */}
      <line x1="100" y1="50" x2="120" y2="50" stroke={ACCENT} strokeOpacity="0.08" strokeWidth="1" strokeDasharray="3 3" />
      <line x1="180" y1="50" x2="200" y2="50" stroke={ACCENT} strokeOpacity="0.06" strokeWidth="1" strokeDasharray="3 3" />
    </svg>
  );
}

function NetworkSvg() {
  return (
    <svg viewBox="0 0 400 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Nodes */}
      <circle cx="80" cy="35" r="6" stroke={ACCENT} strokeOpacity="0.15" strokeWidth="1.5" fill={ACCENT} fillOpacity="0.04" />
      <circle cx="200" cy="25" r="8" stroke={ACCENT} strokeOpacity="0.18" strokeWidth="1.5" fill={ACCENT} fillOpacity="0.05" />
      <circle cx="320" cy="40" r="5" stroke={ACCENT} strokeOpacity="0.12" strokeWidth="1.5" fill={ACCENT} fillOpacity="0.03" />
      <circle cx="140" cy="65" r="7" stroke={ACCENT} strokeOpacity="0.14" strokeWidth="1.5" fill={ACCENT} fillOpacity="0.04" />
      <circle cx="270" cy="70" r="5.5" stroke={ACCENT} strokeOpacity="0.12" strokeWidth="1.5" fill={ACCENT} fillOpacity="0.03" />
      <circle cx="350" cy="75" r="4" stroke={ACCENT} strokeOpacity="0.08" strokeWidth="1" fill={ACCENT} fillOpacity="0.02" />
      <circle cx="50" cy="70" r="4" stroke={ACCENT} strokeOpacity="0.08" strokeWidth="1" fill={ACCENT} fillOpacity="0.02" />
      {/* Edges */}
      <line x1="80" y1="35" x2="200" y2="25" stroke={ACCENT} strokeOpacity="0.08" strokeWidth="1" />
      <line x1="200" y1="25" x2="320" y2="40" stroke={ACCENT} strokeOpacity="0.07" strokeWidth="1" />
      <line x1="80" y1="35" x2="140" y2="65" stroke={ACCENT} strokeOpacity="0.07" strokeWidth="1" />
      <line x1="200" y1="25" x2="140" y2="65" stroke={ACCENT} strokeOpacity="0.06" strokeWidth="1" />
      <line x1="200" y1="25" x2="270" y2="70" stroke={ACCENT} strokeOpacity="0.06" strokeWidth="1" />
      <line x1="320" y1="40" x2="270" y2="70" stroke={ACCENT} strokeOpacity="0.06" strokeWidth="1" />
      <line x1="140" y1="65" x2="270" y2="70" stroke={ACCENT} strokeOpacity="0.05" strokeWidth="1" />
      <line x1="50" y1="70" x2="80" y2="35" stroke={ACCENT} strokeOpacity="0.05" strokeWidth="1" />
      <line x1="320" y1="40" x2="350" y2="75" stroke={ACCENT} strokeOpacity="0.04" strokeWidth="1" />
    </svg>
  );
}

function ChartSvg() {
  return (
    <svg viewBox="0 0 400 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ACCENT} stopOpacity="0.08" />
          <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Grid lines */}
      <line x1="40" y1="20" x2="40" y2="85" stroke={ACCENT} strokeOpacity="0.06" strokeWidth="1" />
      <line x1="40" y1="85" x2="370" y2="85" stroke={ACCENT} strokeOpacity="0.06" strokeWidth="1" />
      <line x1="40" y1="55" x2="370" y2="55" stroke={ACCENT} strokeOpacity="0.03" strokeWidth="1" strokeDasharray="4 4" />
      <line x1="40" y1="35" x2="370" y2="35" stroke={ACCENT} strokeOpacity="0.03" strokeWidth="1" strokeDasharray="4 4" />
      {/* Area fill */}
      <path d="M40 75 L100 60 L160 65 L220 45 L280 35 L340 25 L370 20 L370 85 L40 85 Z" fill="url(#chartFill)" />
      {/* Trend line */}
      <polyline points="40,75 100,60 160,65 220,45 280,35 340,25 370,20" stroke={ACCENT} strokeOpacity="0.18" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* Dots */}
      <circle cx="100" cy="60" r="2.5" fill={ACCENT} fillOpacity="0.15" />
      <circle cx="220" cy="45" r="2.5" fill={ACCENT} fillOpacity="0.15" />
      <circle cx="340" cy="25" r="3" fill={ACCENT} fillOpacity="0.20" />
    </svg>
  );
}

function SunSvg() {
  return (
    <svg viewBox="0 0 400 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Sun circle */}
      <circle cx="200" cy="50" r="20" stroke="#F59E0B" strokeOpacity="0.15" strokeWidth="1.5" fill="#F59E0B" fillOpacity="0.04" />
      <circle cx="200" cy="50" r="12" fill="#F59E0B" fillOpacity="0.06" />
      {/* Rays */}
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle) => {
        const rad = (angle * Math.PI) / 180;
        const x1 = 200 + Math.cos(rad) * 26;
        const y1 = 50 + Math.sin(rad) * 26;
        const x2 = 200 + Math.cos(rad) * 38;
        const y2 = 50 + Math.sin(rad) * 38;
        return (
          <line key={angle} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#F59E0B" strokeOpacity="0.10" strokeWidth="1.5" strokeLinecap="round" />
        );
      })}
      {/* Panels (right side) */}
      <rect x="270" y="55" width="28" height="18" rx="2" stroke={ACCENT} strokeOpacity="0.10" strokeWidth="1" fill={ACCENT} fillOpacity="0.03" />
      <line x1="270" y1="64" x2="298" y2="64" stroke={ACCENT} strokeOpacity="0.08" strokeWidth="0.5" />
      <line x1="284" y1="55" x2="284" y2="73" stroke={ACCENT} strokeOpacity="0.08" strokeWidth="0.5" />
      <rect x="305" y="55" width="28" height="18" rx="2" stroke={ACCENT} strokeOpacity="0.08" strokeWidth="1" fill={ACCENT} fillOpacity="0.02" />
      <line x1="305" y1="64" x2="333" y2="64" stroke={ACCENT} strokeOpacity="0.06" strokeWidth="0.5" />
      <line x1="319" y1="55" x2="319" y2="73" stroke={ACCENT} strokeOpacity="0.06" strokeWidth="0.5" />
    </svg>
  );
}

function ThermalSvg() {
  return (
    <svg viewBox="0 0 400 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Wavy heat lines */}
      <path d="M30 30 Q80 20 130 30 Q180 40 230 30 Q280 20 330 30 Q355 35 380 30" stroke={ACCENT} strokeOpacity="0.10" strokeWidth="1.5" fill="none" />
      <path d="M30 50 Q80 40 130 50 Q180 60 230 50 Q280 40 330 50 Q355 55 380 50" stroke={ACCENT} strokeOpacity="0.08" strokeWidth="1.5" fill="none" />
      <path d="M30 70 Q80 60 130 70 Q180 80 230 70 Q280 60 330 70 Q355 75 380 70" stroke={ACCENT} strokeOpacity="0.06" strokeWidth="1.5" fill="none" />
      {/* Thermometer */}
      <rect x="60" y="25" width="8" height="40" rx="4" stroke={ACCENT} strokeOpacity="0.14" strokeWidth="1.5" fill="none" />
      <circle cx="64" cy="72" r="8" stroke={ACCENT} strokeOpacity="0.14" strokeWidth="1.5" fill={ACCENT} fillOpacity="0.06" />
      <rect x="62" y="40" width="4" height="25" rx="2" fill={ACCENT} fillOpacity="0.10" />
      {/* Droplet */}
      <path d="M340 35 Q345 25 350 35 Q350 42 345 45 Q340 42 340 35 Z" stroke={ACCENT} strokeOpacity="0.10" strokeWidth="1" fill={ACCENT} fillOpacity="0.04" />
    </svg>
  );
}

function ToolsSvg() {
  return (
    <svg viewBox="0 0 400 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Wrench */}
      <path d="M160 30 L190 60 L185 65 L155 35 Z" stroke={ACCENT} strokeOpacity="0.12" strokeWidth="1.5" fill={ACCENT} fillOpacity="0.03" />
      <circle cx="155" cy="30" r="10" stroke={ACCENT} strokeOpacity="0.10" strokeWidth="1.5" fill="none" />
      <path d="M148 23 L155 30 L162 23" stroke={ACCENT} strokeOpacity="0.10" strokeWidth="1.5" fill="none" />
      {/* Gear */}
      <circle cx="230" cy="50" r="14" stroke={ACCENT} strokeOpacity="0.12" strokeWidth="1.5" fill={ACCENT} fillOpacity="0.03" />
      <circle cx="230" cy="50" r="6" stroke={ACCENT} strokeOpacity="0.10" strokeWidth="1.5" fill="none" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
        const rad = (angle * Math.PI) / 180;
        const x1 = 230 + Math.cos(rad) * 14;
        const y1 = 50 + Math.sin(rad) * 14;
        const x2 = 230 + Math.cos(rad) * 18;
        const y2 = 50 + Math.sin(rad) * 18;
        return <line key={angle} x1={x1} y1={y1} x2={x2} y2={y2} stroke={ACCENT} strokeOpacity="0.10" strokeWidth="3" strokeLinecap="round" />;
      })}
      {/* Hard hat */}
      <path d="M300 55 Q300 35 320 30 Q340 35 340 55" stroke={ACCENT} strokeOpacity="0.10" strokeWidth="1.5" fill={ACCENT} fillOpacity="0.03" />
      <line x1="295" y1="55" x2="345" y2="55" stroke={ACCENT} strokeOpacity="0.10" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function BitcoinSvg() {
  return (
    <svg viewBox="0 0 400 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Large BTC circle */}
      <circle cx="200" cy="50" r="30" stroke="#F59E0B" strokeOpacity="0.12" strokeWidth="1.5" fill="#F59E0B" fillOpacity="0.03" />
      <circle cx="200" cy="50" r="22" stroke="#F59E0B" strokeOpacity="0.08" strokeWidth="1" fill="none" />
      {/* B symbol */}
      <text x="200" y="58" textAnchor="middle" fontSize="28" fontWeight="bold" fill="#F59E0B" fillOpacity="0.15" fontFamily="system-ui">&#x20BF;</text>
      {/* Accent lines */}
      <line x1="40" y1="50" x2="160" y2="50" stroke="#F59E0B" strokeOpacity="0.06" strokeWidth="1" />
      <line x1="240" y1="50" x2="370" y2="50" stroke="#F59E0B" strokeOpacity="0.06" strokeWidth="1" />
      {/* Small orbiting circles */}
      <circle cx="130" cy="30" r="4" stroke="#F59E0B" strokeOpacity="0.08" strokeWidth="1" fill="#F59E0B" fillOpacity="0.02" />
      <circle cx="270" cy="70" r="3" stroke="#F59E0B" strokeOpacity="0.06" strokeWidth="1" fill="#F59E0B" fillOpacity="0.02" />
      <circle cx="300" cy="25" r="5" stroke="#F59E0B" strokeOpacity="0.07" strokeWidth="1" fill="#F59E0B" fillOpacity="0.02" />
    </svg>
  );
}

function GaugeSvg() {
  return (
    <svg viewBox="0 0 400 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Gauge arc */}
      <path d="M140 75 A60 60 0 0 1 260 75" stroke={ACCENT} strokeOpacity="0.10" strokeWidth="2" fill="none" />
      <path d="M155 75 A45 45 0 0 1 245 75" stroke={ACCENT} strokeOpacity="0.06" strokeWidth="6" fill="none" strokeLinecap="round" />
      {/* Tick marks */}
      {[-60, -30, 0, 30, 60].map((angle, i) => {
        const rad = ((angle - 90) * Math.PI) / 180;
        const x1 = 200 + Math.cos(rad) * 52;
        const y1 = 75 + Math.sin(rad) * 52;
        const x2 = 200 + Math.cos(rad) * 58;
        const y2 = 75 + Math.sin(rad) * 58;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={ACCENT} strokeOpacity="0.12" strokeWidth="1.5" strokeLinecap="round" />;
      })}
      {/* Needle */}
      <line x1="200" y1="75" x2="230" y2="40" stroke={ACCENT} strokeOpacity="0.18" strokeWidth="2" strokeLinecap="round" />
      <circle cx="200" cy="75" r="4" fill={ACCENT} fillOpacity="0.12" />
      {/* Side meters */}
      <rect x="40" y="30" width="50" height="30" rx="4" stroke={ACCENT} strokeOpacity="0.06" strokeWidth="1" fill={ACCENT} fillOpacity="0.015" />
      <rect x="310" y="30" width="50" height="30" rx="4" stroke={ACCENT} strokeOpacity="0.06" strokeWidth="1" fill={ACCENT} fillOpacity="0.015" />
    </svg>
  );
}

function ShieldSvg() {
  return (
    <svg viewBox="0 0 400 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Shield */}
      <path d="M180 15 L220 15 L225 20 L225 55 Q225 75 200 85 Q175 75 175 55 L175 20 Z" stroke={ACCENT} strokeOpacity="0.12" strokeWidth="1.5" fill={ACCENT} fillOpacity="0.03" />
      {/* Checkmark */}
      <polyline points="190,50 198,58 212,42" stroke={ACCENT} strokeOpacity="0.18" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* Side decorations */}
      <line x1="60" y1="45" x2="150" y2="45" stroke={ACCENT} strokeOpacity="0.05" strokeWidth="1" />
      <line x1="250" y1="45" x2="340" y2="45" stroke={ACCENT} strokeOpacity="0.05" strokeWidth="1" />
      <circle cx="80" cy="35" r="3" stroke={ACCENT} strokeOpacity="0.06" strokeWidth="1" fill="none" />
      <circle cx="320" cy="55" r="3" stroke={ACCENT} strokeOpacity="0.06" strokeWidth="1" fill="none" />
    </svg>
  );
}

const THEME_MAP: Record<Theme, () => React.JSX.Element> = {
  circuit: CircuitSvg,
  racks: RacksSvg,
  network: NetworkSvg,
  chart: ChartSvg,
  sun: SunSvg,
  thermal: ThermalSvg,
  tools: ToolsSvg,
  bitcoin: BitcoinSvg,
  gauge: GaugeSvg,
  shield: ShieldSvg,
};

export default function CardIllustration({ theme }: { theme: Theme }) {
  const SvgComponent = THEME_MAP[theme];
  return (
    <div className="w-full h-24 lg:h-28 mb-4 -mt-1 select-none pointer-events-none opacity-80" aria-hidden="true">
      <SvgComponent />
    </div>
  );
}
