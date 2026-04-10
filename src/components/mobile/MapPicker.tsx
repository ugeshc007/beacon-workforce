import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MapPin, X, Check } from "lucide-react";

interface MapPickerProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (lat: number, lng: number) => void;
  initialLat?: number;
  initialLng?: number;
}

/**
 * Lightweight map fallback for when GPS is unavailable or inaccurate.
 * Opens an embedded OpenStreetMap iframe with a pin-drop UI.
 * User can drag the map and tap "Confirm Location" to set their position.
 */
export function MapPicker({ open, onClose, onConfirm, initialLat = 25.2048, initialLng = 55.2708 }: MapPickerProps) {
  const [lat, setLat] = useState(initialLat);
  const [lng, setLng] = useState(initialLng);
  const [confirmed, setConfirmed] = useState(false);

  const handleConfirm = useCallback(() => {
    setConfirmed(true);
    onConfirm(lat, lng);
  }, [lat, lng, onConfirm]);

  if (!open) return null;

  // Use OpenStreetMap embed for the map view
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.005},${lat - 0.005},${lng + 0.005},${lat + 0.005}&layer=mapnik&marker=${lat},${lng}`;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 flex flex-col safe-area-inset">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-brand" />
          <h2 className="font-semibold text-foreground">Pick Your Location</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Info */}
      <Card className="mx-4 mt-3 p-3 border-amber-500/30 bg-amber-500/5">
        <p className="text-xs text-muted-foreground">
          GPS signal is weak. Please manually position the marker on your current location by adjusting coordinates, then confirm.
        </p>
      </Card>

      {/* Map iframe */}
      <div className="flex-1 mx-4 mt-3 rounded-xl overflow-hidden border border-border/50">
        <iframe
          src={mapUrl}
          className="w-full h-full border-0"
          title="Location picker"
          loading="lazy"
        />
      </div>

      {/* Coordinate inputs */}
      <div className="px-4 mt-3 flex gap-2">
        <div className="flex-1">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Latitude</label>
          <input
            type="number"
            step="0.0001"
            value={lat}
            onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
            className="w-full h-9 px-2 rounded-lg bg-card border border-border/50 text-sm text-foreground"
          />
        </div>
        <div className="flex-1">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Longitude</label>
          <input
            type="number"
            step="0.0001"
            value={lng}
            onChange={(e) => setLng(parseFloat(e.target.value) || 0)}
            className="w-full h-9 px-2 rounded-lg bg-card border border-border/50 text-sm text-foreground"
          />
        </div>
      </div>

      {/* Confirm button */}
      <div className="p-4 pb-8">
        <Button
          className="w-full h-12 text-base font-bold rounded-xl"
          onClick={handleConfirm}
          disabled={confirmed}
        >
          <Check className="mr-2 h-5 w-5" />
          Confirm Location
        </Button>
      </div>
    </div>
  );
}
