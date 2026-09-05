import { useEffect, useRef } from "react";

interface MapMarker {
  id: number;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  urgent?: boolean;
}

interface LeafletMapProps {
  markers?: MapMarker[];
  center?: [number, number];
  zoom?: number;
}

export default function LeafletMap({ markers = [], center = [24.7136, 46.6753], zoom = 12 }: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let L: any;
    let map: any;

    const init = async () => {
      L = await import("leaflet");

      // Fix default icon paths for Vite
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const urgentIcon = L.icon({
        iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
      });

      if (!containerRef.current) return;
      map = L.map(containerRef.current).setView(center, zoom);
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      markers.forEach(m => {
        const marker = L.marker([m.lat, m.lng], { icon: m.urgent ? urgentIcon : new L.Icon.Default() }).addTo(map);
        const popupContent = `
          <div style="min-width:120px">
            <div style="font-weight:600;font-size:13px">${m.title}</div>
            ${m.subtitle ? `<div style="font-size:11px;color:#888;margin-top:2px">${m.subtitle}</div>` : ""}
            ${m.urgent ? `<div style="font-size:11px;color:#ef4444;font-weight:700;margin-top:4px">⚡ Urgent</div>` : ""}
          </div>
        `;
        marker.bindPopup(popupContent);
      });

      // Fit bounds if multiple markers
      if (markers.length > 1) {
        const group = L.featureGroup(
          markers.map(m => L.marker([m.lat, m.lng]))
        );
        map.fitBounds(group.getBounds().pad(0.1));
      }
    };

    init();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
