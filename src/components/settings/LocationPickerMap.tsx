import { useEffect, useState } from "react";
import "leaflet/dist/leaflet.css";

interface Props {
  lat: number | null;
  lng: number | null;
  onSelect: (lat: number, lng: number) => void;
}

export default function LocationPickerMap({ lat, lng, onSelect }: Props) {
  const [mapReady, setMapReady] = useState(false);
  const [L, setL] = useState<any>(null);
  const mapContainerRef = useState<string>(() => `map-${Math.random().toString(36).slice(2)}`)[0];

  useEffect(() => {
    let mounted = true;
    import("leaflet").then((leaflet) => {
      if (!mounted) return;
      
      // Fix default marker icon
      delete (leaflet.Icon.Default.prototype as any)._getIconUrl;
      leaflet.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });
      
      setL(leaflet);
      setMapReady(true);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!mapReady || !L) return;

    const container = document.getElementById(mapContainerRef);
    if (!container) return;

    // Clear previous map
    container.innerHTML = "";

    const center: [number, number] = [lat ?? 25.2048, lng ?? 55.2708];
    const map = L.map(container).setView(center, 14);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    let marker: any = null;
    if (lat !== null && lng !== null) {
      marker = L.marker([lat, lng]).addTo(map);
    }

    map.on("click", (e: any) => {
      const { lat: clickLat, lng: clickLng } = e.latlng;
      if (marker) {
        marker.setLatLng([clickLat, clickLng]);
      } else {
        marker = L.marker([clickLat, clickLng]).addTo(map);
      }
      onSelect(clickLat, clickLng);
    });

    // Fix map rendering in dialog
    setTimeout(() => map.invalidateSize(), 200);

    return () => {
      map.remove();
    };
  }, [mapReady, L, mapContainerRef]);

  return (
    <div className="space-y-1">
      <div
        id={mapContainerRef}
        className="w-full h-[250px] rounded-lg overflow-hidden border border-border/50"
        style={{ zIndex: 0 }}
      />
      <p className="text-[10px] text-muted-foreground px-1">Click on the map to set coordinates</p>
    </div>
  );
}
