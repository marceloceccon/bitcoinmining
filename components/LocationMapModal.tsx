"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Search } from "lucide-react";
import type { LocationData } from "@/types";
import { fetchClimate, reverseGeocode, searchPlaces, type PlaceResult } from "@/lib/climate";
import Dialog from "@/components/ui/Dialog";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

interface Props {
  onConfirm: (location: LocationData) => void;
  onClose: () => void;
}

/** Inline SVG pin (no image requests); the drop animation is CSS and respects reduced motion. */
const PIN_ICON = L.divIcon({
  className: "site-pin",
  html: `<svg width="28" height="38" viewBox="0 0 28 38" aria-hidden="true"><path d="M14 37s12-13.4 12-23A12 12 0 0 0 2 14c0 9.6 12 23 12 23z" fill="rgb(247 147 26)" stroke="rgb(12 14 16)" stroke-width="1.5"/><circle cx="14" cy="14" r="4.5" fill="rgb(12 14 16)"/></svg>`,
  iconSize: [28, 38],
  iconAnchor: [14, 37],
});

const SEARCH_DEBOUNCE_MS = 600; // Nominatim: at most 1 request per second

function MapClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

function FlyTo({ target }: { target: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 6), { duration: 0.8 });
  }, [map, target]);
  return null;
}

const FIELDS: { key: keyof Omit<LocationData, "lat" | "lng" | "city">; label: string; step: string }[] = [
  { key: "avgYearlyTempC", label: "Avg yearly temp (°C)", step: "0.1" },
  { key: "maxTempC", label: "Max temp (°C)", step: "0.1" },
  { key: "minTempC", label: "Min temp (°C)", step: "0.1" },
  { key: "avgHumidityPercent", label: "Avg humidity (%)", step: "1" },
];

export default function LocationMapModal({ onConfirm, onClose }: Props) {
  const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(null);
  const [pick, setPick] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const pickAbort = useRef<AbortController | null>(null);
  // The label of the result the user just picked: don't search for it again
  const chosenLabel = useRef<string | null>(null);

  const pickPoint = useCallback(async (lat: number, lng: number, knownName?: string) => {
    pickAbort.current?.abort();
    const controller = new AbortController();
    pickAbort.current = controller;
    setMarker({ lat, lng });
    setLoading(true);
    setError(null);
    setPick(null);
    try {
      const [city, climate] = await Promise.all([
        knownName ? Promise.resolve(knownName) : reverseGeocode(lat, lng, { signal: controller.signal }),
        fetchClimate(lat, lng, { signal: controller.signal }),
      ]);
      if (!controller.signal.aborted) setPick({ lat, lng, city, ...climate });
    } catch {
      if (!controller.signal.aborted) setError("Couldn't load climate data for this point. Try again or pick another spot.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  // Debounced place search
  useEffect(() => {
    if (query.trim().length < 3 || query === chosenLabel.current) {
      setResults([]);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await searchPlaces(query, { signal: controller.signal }));
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => () => pickAbort.current?.abort(), []);

  const flyTarget = useMemo(() => marker, [marker]);

  return (
    <Dialog
      open
      onClose={onClose}
      title="Choose Location"
      description="Search for a place or click the map. Climate comes from a full year of ERA5 reanalysis."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!pick} onClick={() => pick && onConfirm(pick)}>
            Confirm location
          </Button>
        </>
      }
    >
      <div className="relative border-b border-line px-5 py-3">
        <label htmlFor="place-search" className="sr-only">
          Search for a place
        </label>
        <Search className="pointer-events-none absolute left-8 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden />
        <Input
          id="place-search"
          type="search"
          autoComplete="off"
          placeholder="Search a city or region, e.g. Asunción or West Texas"
          className="pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-controls="place-results"
        />
        {(results.length > 0 || searching) && (
          <ul id="place-results" className="dialog absolute inset-x-5 top-full z-[1100] mt-1 max-h-60 overflow-auto py-1" role="listbox" aria-label="Places">
            {searching && results.length === 0 && <li className="px-3 py-2 text-sm text-muted">Searching…</li>}
            {results.map((r) => (
              <li key={`${r.lat},${r.lng}`} role="option" aria-selected={false}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm text-fg hover:bg-surface-2"
                  onClick={() => {
                    chosenLabel.current = r.label;
                    setQuery(r.label);
                    setResults([]);
                    pickPoint(r.lat, r.lng, r.name);
                  }}
                >
                  {r.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="map-frame relative h-[340px]">
        <MapContainer center={[20, 0]} zoom={2} className="h-full w-full bg-surface-2" scrollWheelZoom>
          <TileLayer
            className="map-tiles"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <MapClickHandler onPick={(lat, lng) => pickPoint(lat, lng)} />
          <FlyTo target={flyTarget} />
          {marker && <Marker key={`${marker.lat},${marker.lng}`} position={[marker.lat, marker.lng]} icon={PIN_ICON} />}
        </MapContainer>
        {loading && (
          <div className="absolute inset-x-0 bottom-0 z-[1000] bg-surface/90 px-4 py-2 text-sm text-fg-2" role="status">
            Fetching a year of climate data…
          </div>
        )}
      </div>

      <div className="space-y-3 px-5 py-4" aria-live="polite">
        {error && <p className="text-sm text-bad">{error}</p>}
        {!pick && !error && <p className="text-xs text-muted">Pick a point to fill in its climate. Every value stays editable.</p>}
        {pick && (
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
            <div className="col-span-2 space-y-1 sm:col-span-1">
              <label htmlFor="pick-city" className="text-xs text-muted">City</label>
              <Input id="pick-city" className="h-9" value={pick.city} onChange={(e) => setPick({ ...pick, city: e.target.value })} />
            </div>
            {FIELDS.map((f) => (
              <div key={f.key} className="space-y-1">
                <label htmlFor={`pick-${f.key}`} className="text-xs text-muted">{f.label}</label>
                <Input
                  id={`pick-${f.key}`}
                  type="number"
                  step={f.step}
                  className="h-9 font-mono"
                  value={pick[f.key]}
                  onChange={(e) => setPick({ ...pick, [f.key]: parseFloat(e.target.value) || 0 })}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}
