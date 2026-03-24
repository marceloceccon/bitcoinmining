"use client";

import { useEffect, useState, useCallback } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import type { LatLng } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LocationData } from "@/types";

// Fix leaflet default marker icons broken by webpack
if (typeof window !== "undefined") {
  // eslint-disable-next-line
  const L = require("leaflet");
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

interface Props {
  onConfirm: (location: LocationData) => void;
  onClose: () => void;
}

interface PickState {
  lat: number;
  lng: number;
  city: string;
  avgYearlyTempC: number;
  maxTempC: number;
  minTempC: number;
  avgHumidityPercent: number;
}

function MapClickHandler({
  onPick,
}: {
  onPick: (latlng: LatLng) => void;
}) {
  useMapEvents({
    click(e) {
      onPick(e.latlng);
    },
  });
  return null;
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await res.json();
    const addr = data.address || {};
    return (
      addr.city ||
      addr.town ||
      addr.village ||
      addr.county ||
      addr.state ||
      data.display_name?.split(",")[0] ||
      `${lat.toFixed(2)}, ${lng.toFixed(2)}`
    );
  } catch {
    return `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
  }
}

async function fetchClimate(lat: number, lng: number) {
  const year = new Date().getFullYear() - 1;
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const url =
    `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}` +
    `&start_date=${start}&end_date=${end}` +
    `&daily=temperature_2m_max,temperature_2m_min` +
    `&hourly=relative_humidity_2m&timezone=auto`;

  const res = await fetch(url);
  const data = await res.json();

  const maxTemps: number[] = data.daily?.temperature_2m_max ?? [];
  const minTemps: number[] = data.daily?.temperature_2m_min ?? [];
  const humidity: number[] = data.hourly?.relative_humidity_2m ?? [];

  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 20;

  const avgYearlyTempC = parseFloat(
    ((avg(maxTemps) + avg(minTemps)) / 2).toFixed(1)
  );
  const maxTempC = parseFloat(Math.max(...maxTemps).toFixed(1));
  const minTempC = parseFloat(Math.min(...minTemps).toFixed(1));
  const avgHumidityPercent = parseFloat(avg(humidity).toFixed(1));

  return { avgYearlyTempC, maxTempC, minTempC, avgHumidityPercent };
}

export default function LocationMapModal({ onConfirm, onClose }: Props) {
  const [markerPos, setMarkerPos] = useState<{ lat: number; lng: number } | null>(null);
  const [pick, setPick] = useState<PickState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleMapClick = useCallback(async (latlng: LatLng) => {
    const { lat, lng } = latlng;
    setMarkerPos({ lat, lng });
    setLoading(true);
    setError(null);
    setPick(null);
    try {
      const [city, climate] = await Promise.all([
        reverseGeocode(lat, lng),
        fetchClimate(lat, lng),
      ]);
      setPick({ lat, lng, city, ...climate });
    } catch {
      setError("Could not fetch location data. Try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center glass-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative glass-modal w-full max-w-3xl mx-4 overflow-hidden flex flex-col animate-fade-in-scale">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/50">
          <h2 className="text-lg font-bold text-slate-900">Choose Location</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors text-xl leading-none"
          >
            x
          </button>
        </div>

        {/* Map */}
        <div className="relative" style={{ height: 380 }}>
          <MapContainer
            center={[20, 0]}
            zoom={2}
            style={{ height: "100%", width: "100%", background: "#f1f5f9" }}
            scrollWheelZoom={true}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
            />
            <MapClickHandler onPick={handleMapClick} />
            {markerPos && <Marker position={[markerPos.lat, markerPos.lng]} />}
          </MapContainer>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 z-[1000]">
              <span className="text-slate-700 text-sm animate-pulse">Fetching climate data...</span>
            </div>
          )}
        </div>

        {/* Bottom panel */}
        <div className="px-6 py-4 space-y-4">
          <p className="text-xs text-slate-400">
            Click anywhere on the map to auto-fill climate data for that location.
          </p>

          {error && (
            <p className="text-red-600 text-sm">{error}</p>
          )}

          {pick && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div className="space-y-1">
                <label className="text-xs text-slate-500">City</label>
                <input
                  className="w-full bg-white/50 border border-slate-200/60 rounded-xl px-2 py-1 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blueprint-deep/20"
                  value={pick.city}
                  onChange={(e) => setPick({ ...pick, city: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Avg Yearly Temp (C)</label>
                <input
                  type="number"
                  step="0.1"
                  className="w-full bg-white/50 border border-slate-200/60 rounded-xl px-2 py-1 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blueprint-deep/20"
                  value={pick.avgYearlyTempC}
                  onChange={(e) => setPick({ ...pick, avgYearlyTempC: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Max Temp (C)</label>
                <input
                  type="number"
                  step="0.1"
                  className="w-full bg-white/50 border border-slate-200/60 rounded-xl px-2 py-1 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blueprint-deep/20"
                  value={pick.maxTempC}
                  onChange={(e) => setPick({ ...pick, maxTempC: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Min Temp (C)</label>
                <input
                  type="number"
                  step="0.1"
                  className="w-full bg-white/50 border border-slate-200/60 rounded-xl px-2 py-1 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blueprint-deep/20"
                  value={pick.minTempC}
                  onChange={(e) => setPick({ ...pick, minTempC: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Avg Humidity (%)</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  className="w-full bg-white/50 border border-slate-200/60 rounded-xl px-2 py-1 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blueprint-deep/20"
                  value={pick.avgHumidityPercent}
                  onChange={(e) => setPick({ ...pick, avgHumidityPercent: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={!pick}
              onClick={() => {
                if (pick) onConfirm({ lat: pick.lat, lng: pick.lng, city: pick.city, avgYearlyTempC: pick.avgYearlyTempC, maxTempC: pick.maxTempC, minTempC: pick.minTempC, avgHumidityPercent: pick.avgHumidityPercent });
              }}
              className="px-5 py-2 text-sm font-semibold bg-blueprint-deep text-white rounded-xl hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md"
            >
              Confirm Location
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
