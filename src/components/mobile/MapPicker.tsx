import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MapPin, X, Check, WifiOff, RotateCcw } from "lucide-react";

interface MapPickerProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (lat: number, lng: number) => void;
  onRetry?: () => Promise<{ lat: number; lng: number } | null>;
  initialLat?: number;
  initialLng?: number;
}

/**
 * Offline-safe location fallback for when GPS is unavailable or inaccurate.
 * Avoids internet map embeds so workers can still confirm coordinates offline.
 */
export function MapPicker({ open, onClose, onConfirm, onRetry, initialLat = 25.2048, initialLng = 55.2708 }: MapPickerProps) {
  const [lat, setLat] = useState(initialLat);
  const [lng, setLng] = useState(initialLng);
  const [confirmed, setConfirmed] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLat(initialLat);
    setLng(initialLng);
    setConfirmed(false);
  }, [initialLat, initialLng, open]);

  const handleConfirm = useCallback(() => {
    setConfirmed(true);
    onConfirm(lat, lng);
  }, [lat, lng, onConfirm]);

  const handleRetry = useCallback(async () => {
    if (!onRetry) return;
    setRetrying(true);
    const reading = await onRetry();
    if (reading) {
      setLat(reading.lat);
      setLng(reading.lng);
    }
    setRetrying(false);
  }, [onRetry]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col safe-area-inset">
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
          GPS signal is weak. Confirm the captured coordinates below, or adjust them if needed. This works even when the phone is offline.
        </p>
      </Card>

      {/* Offline-safe coordinate view */}
      <div className="flex-1 mx-4 mt-3 rounded-xl overflow-hidden border border-border/50 bg-card flex flex-col items-center justify-center px-6 text-center">
        <div className="relative mb-5 flex h-28 w-28 items-center justify-center rounded-full border border-brand/30 bg-brand/10">
          <div className="absolute h-20 w-20 rounded-full border border-brand/20" />
          <MapPin className="h-12 w-12 text-brand" />
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          <WifiOff className="h-4 w-4 text-amber-500" />
          <span className="text-xs font-medium text-foreground">Map unavailable offline</span>
        </div>
        <p className="mt-3 max-w-xs text-xs leading-relaxed text-muted-foreground">
          We will save these coordinates with the work action and sync them when internet returns.
        </p>
      </div>

      {/* Coordinate inputs */}
      <div className="px-4 mt-3 space-y-3">
        {onRetry && (
          <Button
            type="button"
            variant="outline"
            className="w-full h-10"
            onClick={handleRetry}
            disabled={retrying || confirmed}
          >
            <RotateCcw className={`mr-2 h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
            Retry GPS
          </Button>
        )}
        <div className="flex gap-2">
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
      </div>

      {/* Confirm button — sticky above any nav, with safe-area padding */}
      <div
        className="sticky bottom-0 left-0 right-0 p-4 bg-background border-t border-border/50"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
      >
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
