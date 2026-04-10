import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface Props {
  lat: number | null;
  lng: number | null;
  onSelect: (lat: number, lng: number) => void;
}

function ClickHandler({ onSelect }: { onSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
}

export default function LocationPickerMap({ lat, lng, onSelect }: Props) {
  const center: [number, number] = [lat ?? 25.2048, lng ?? 55.2708]; // Default: Dubai

  return (
    <div className="w-full h-[250px] rounded-lg overflow-hidden border border-border/50">
      <MapContainer
        center={center}
        zoom={14}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onSelect={onSelect} />
        {lat !== null && lng !== null && (
          <>
            <Marker position={[lat, lng]} />
            <RecenterMap lat={lat} lng={lng} />
          </>
        )}
      </MapContainer>
      <p className="text-[10px] text-muted-foreground mt-1 px-1">Click on the map to set coordinates</p>
    </div>
  );
}
