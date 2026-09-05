import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { ExternalLink, MapPin, Navigation, Loader2 } from "lucide-react";

const RIYADH: [number, number] = [24.7136, 46.6753];
const GEOCODE_CACHE_KEY = "wafra_geocode_cache_v1";

function loadCache(): Record<string, [number, number]> {
  try {
    return JSON.parse(localStorage.getItem(GEOCODE_CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveCache(cache: Record<string, [number, number]>) {
  try {
    localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* ignore */
  }
}

async function geocode(address: string): Promise<[number, number] | null> {
  const trimmed = address?.trim();
  if (!trimmed || trimmed === "—") return null;
  const cache = loadCache();
  if (cache[trimmed]) return cache[trimmed];
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=sa&q=${encodeURIComponent(trimmed)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const lat = parseFloat(data[0].lat);
    const lon = parseFloat(data[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const point: [number, number] = [lat, lon];
    cache[trimmed] = point;
    saveCache(cache);
    return point;
  } catch {
    return null;
  }
}

function makeIcon(color: string, label: string) {
  return L.divIcon({
    className: "wafra-pin",
    html: `<div style="background:${color};color:#fff;border-radius:50% 50% 50% 0;width:30px;height:30px;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.3);border:2px solid #fff;"><span style="transform:rotate(45deg);font-weight:900;font-size:13px;">${label}</span></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -28],
  });
}

const PICKUP_ICON = makeIcon("#ef4444", "م");
const DROPOFF_ICON = makeIcon("#22c55e", "ج");

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [points, map]);
  return null;
}

interface DeliveryMapProps {
  pickupAddress: string;
  dropoffAddress: string;
  pickupLabel?: string;
  dropoffLabel?: string;
}

export default function DeliveryMap({
  pickupAddress,
  dropoffAddress,
  pickupLabel = "المطعم",
  dropoffLabel = "الجمعية",
}: DeliveryMapProps) {
  const [pickup, setPickup] = useState<[number, number] | null>(null);
  const [dropoff, setDropoff] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setWarning(null);
    (async () => {
      const [p, d] = await Promise.all([geocode(pickupAddress), geocode(dropoffAddress)]);
      if (cancelled) return;
      setPickup(p);
      setDropoff(d);
      if (!p && !d) setWarning("تعذّر تحديد موقع الاستلام والتسليم على الخريطة. استخدم رابط الخرائط أدناه.");
      else if (!p) setWarning("تعذّر تحديد موقع الاستلام بدقة.");
      else if (!d) setWarning("تعذّر تحديد موقع التسليم بدقة.");
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [pickupAddress, dropoffAddress]);

  const points = useMemo(() => {
    const arr: [number, number][] = [];
    if (pickup) arr.push(pickup);
    if (dropoff) arr.push(dropoff);
    return arr;
  }, [pickup, dropoff]);

  const center: [number, number] = points[0] || RIYADH;
  const distanceKm = useMemo(() => {
    if (!pickup || !dropoff) return null;
    const R = 6371;
    const toRad = (x: number) => (x * Math.PI) / 180;
    const dLat = toRad(dropoff[0] - pickup[0]);
    const dLon = toRad(dropoff[1] - pickup[1]);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(pickup[0])) * Math.cos(toRad(dropoff[0])) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(1);
  }, [pickup, dropoff]);

  const gmapsHref = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    pickupAddress,
  )}&destination=${encodeURIComponent(dropoffAddress)}&travelmode=driving`;

  return (
    <div className="space-y-3" dir="rtl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
        <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-100 dark:border-red-900/30">
          <MapPin className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <div>
            <div className="font-bold text-red-700 dark:text-red-300 text-xs">{pickupLabel}</div>
            <div className="text-foreground" data-testid="text-map-pickup">{pickupAddress}</div>
          </div>
        </div>
        <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-100 dark:border-green-900/30">
          <Navigation className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
          <div>
            <div className="font-bold text-green-700 dark:text-green-300 text-xs">{dropoffLabel}</div>
            <div className="text-foreground" data-testid="text-map-dropoff">{dropoffAddress}</div>
          </div>
        </div>
      </div>

      <div className="relative h-[360px] rounded-xl overflow-hidden border-2 border-muted" data-testid="container-map">
        {loading && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="mr-2 font-bold">جاري تحميل الخريطة...</span>
          </div>
        )}
        <MapContainer
          center={center}
          zoom={12}
          scrollWheelZoom={true}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {pickup && (
            <Marker position={pickup} icon={PICKUP_ICON}>
              <Popup>
                <strong>{pickupLabel}</strong>
                <br />
                {pickupAddress}
              </Popup>
            </Marker>
          )}
          {dropoff && (
            <Marker position={dropoff} icon={DROPOFF_ICON}>
              <Popup>
                <strong>{dropoffLabel}</strong>
                <br />
                {dropoffAddress}
              </Popup>
            </Marker>
          )}
          {pickup && dropoff && (
            <Polyline positions={[pickup, dropoff]} pathOptions={{ color: "#2563eb", weight: 4, dashArray: "8 6", opacity: 0.8 }} />
          )}
          <FitBounds points={points} />
        </MapContainer>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          {distanceKm ? (
            <span className="font-bold text-primary" data-testid="text-distance">
              المسافة التقريبية: {distanceKm} كم
            </span>
          ) : (
            <span className="text-muted-foreground">{warning}</span>
          )}
        </div>
        <Button asChild variant="outline" size="sm" className="gap-2" data-testid="link-open-gmaps">
          <a href={gmapsHref} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-4 h-4" />
            افتح في خرائط جوجل للتنقل
          </a>
        </Button>
      </div>
    </div>
  );
}
