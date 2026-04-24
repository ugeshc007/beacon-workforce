import { useState, useRef, useCallback, useEffect, forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface HoldToConfirmProps {
  onConfirm: () => void;
  holdDurationMs?: number;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  variant?: "primary" | "secondary";
  children: React.ReactNode;
}

/**
 * Hold-to-confirm button. User must long-press for the specified duration.
 * - Background fills left-to-right as the user holds.
 * - After release/confirm, a loading overlay with spinner appears so the
 *   user knows the request is in flight (prevents double-taps).
 */
export function HoldToConfirm({
  onConfirm,
  holdDurationMs = 1500,
  disabled = false,
  loading = false,
  className,
  variant = "primary",
  children,
}: HoldToConfirmProps) {
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const frameRef = useRef<number | null>(null);
  const confirmedRef = useRef(false);

  // Reset progress when external loading finishes
  useEffect(() => {
    if (!loading) {
      setProgress(0);
      confirmedRef.current = false;
    }
  }, [loading]);

  const animate = useCallback(() => {
    const elapsed = Date.now() - startTimeRef.current;
    const pct = Math.min(elapsed / holdDurationMs, 1);
    setProgress(pct);

    if (pct >= 1 && !confirmedRef.current) {
      confirmedRef.current = true;
      setHolding(false);
      // Haptic feedback if available
      import("@capacitor/haptics").then(({ Haptics, ImpactStyle }) => {
        Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
      }).catch(() => {});
      onConfirm();
      return;
    }

    if (pct < 1) {
      frameRef.current = requestAnimationFrame(animate);
    }
  }, [holdDurationMs, onConfirm]);

  const startHold = useCallback(() => {
    if (disabled || loading) return;
    confirmedRef.current = false;
    setHolding(true);
    startTimeRef.current = Date.now();
    // Light haptic on start
    import("@capacitor/haptics").then(({ Haptics, ImpactStyle }) => {
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    }).catch(() => {});
    frameRef.current = requestAnimationFrame(animate);
  }, [disabled, loading, animate]);

  const cancelHold = useCallback(() => {
    if (confirmedRef.current) return; // already fired — let loading state take over
    setHolding(false);
    setProgress(0);
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const isPrimary = variant === "primary";
  const heightCls = isPrimary ? "h-16 text-lg" : "h-14 text-base";

  return (
    <button
      onMouseDown={startHold}
      onMouseUp={cancelHold}
      onMouseLeave={cancelHold}
      onTouchStart={startHold}
      onTouchEnd={cancelHold}
      onTouchCancel={cancelHold}
      onContextMenu={(e) => e.preventDefault()}
      disabled={disabled || loading}
      className={cn(
        "relative w-full overflow-hidden rounded-2xl font-bold shadow-lg select-none touch-none",
        "transition-transform duration-100",
        heightCls,
        isPrimary
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-secondary-foreground border border-border",
        disabled && "opacity-50 cursor-not-allowed",
        holding && "scale-[0.98]",
        className
      )}
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      {/* Fill overlay — left-to-right hold progress */}
      <div
        className={cn(
          "absolute inset-0 origin-left",
          isPrimary ? "bg-white/25" : "bg-primary/20"
        )}
        style={{
          transform: `scaleX(${progress})`,
          transition: holding ? "none" : "transform 200ms ease-out",
        }}
      />

      {/* Content */}
      <span className={cn(
        "relative z-10 flex items-center justify-center gap-2",
        loading && "opacity-0"
      )}>
        {children}
      </span>

      {/* Loading overlay (after release, while server call in flight) */}
      {loading && (
        <span className="absolute inset-0 z-20 flex items-center justify-center gap-2 bg-black/10">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm font-semibold">Processing…</span>
        </span>
      )}

      {/* Hold hint */}
      {!holding && progress === 0 && !loading && !disabled && (
        <span className="absolute bottom-1 left-0 right-0 text-center text-[10px] opacity-70 z-10 pointer-events-none">
          Press &amp; hold
        </span>
      )}
    </button>
  );
}
