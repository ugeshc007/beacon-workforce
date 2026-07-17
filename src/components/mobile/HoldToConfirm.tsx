import { useState, useRef, useCallback, useEffect, forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface HoldToConfirmProps {
  onConfirm: () => void;
  holdDurationMs?: number;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  variant?: "primary" | "secondary" | "ghost";
  children: React.ReactNode;
}

/**
 * Hold-to-confirm button. User must long-press for the specified duration.
 * - Background fills left-to-right as the user holds.
 * - After release/confirm, a loading overlay with spinner appears so the
 *   user knows the request is in flight (prevents double-taps).
 */
export const HoldToConfirm = forwardRef<HTMLButtonElement, HoldToConfirmProps>(function HoldToConfirm({
  onConfirm,
  holdDurationMs = 1500,
  disabled = false,
  loading = false,
  className,
  variant = "primary",
  children,
}, ref) {
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const startTimeRef = useRef<number>(0);
  const frameRef = useRef<number | null>(null);
  const confirmedRef = useRef(false);
  const holdingRef = useRef(false);
  const activePointerRef = useRef<number | null>(null);

  // Reset when external loading finishes (defensive — also reset on cancel)
  useEffect(() => {
    if (!loading) {
      setProgress(0);
      confirmedRef.current = false;
    }
  }, [loading]);

  const stopFrame = () => {
    if (frameRef.current != null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  };

  const animate = useCallback(() => {
    if (!holdingRef.current) return;
    const elapsed = Date.now() - startTimeRef.current;
    const pct = Math.min(elapsed / holdDurationMs, 1);
    setProgress(pct);

    if (pct >= 1 && !confirmedRef.current) {
      confirmedRef.current = true;
      holdingRef.current = false;
      setHolding(false);
      stopFrame();
      import("@capacitor/haptics").then(({ Haptics, ImpactStyle }) => {
        Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
      }).catch(() => {});
      onConfirm();
      // Safety: clear confirmed flag shortly after in case parent never
      // toggles `loading` (offline enqueue path returns synchronously).
      setTimeout(() => {
        confirmedRef.current = false;
        setProgress(0);
      }, 400);
      return;
    }

    frameRef.current = requestAnimationFrame(animate);
  }, [holdDurationMs, onConfirm]);

  const startHold = useCallback(() => {
    if (disabled || loading) return;
    if (holdingRef.current || confirmedRef.current) return; // ignore re-entry
    holdingRef.current = true;
    setHolding(true);
    startTimeRef.current = Date.now();
    import("@capacitor/haptics").then(({ Haptics, ImpactStyle }) => {
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    }).catch(() => {});
    stopFrame();
    frameRef.current = requestAnimationFrame(animate);
  }, [disabled, loading, animate]);

  const cancelHold = useCallback(() => {
    activePointerRef.current = null;
    if (confirmedRef.current) return; // already fired
    if (!holdingRef.current) return;
    holdingRef.current = false;
    setHolding(false);
    setProgress(0);
    stopFrame();
  }, []);

  // Clean up on unmount
  useEffect(() => () => stopFrame(), []);

  const isPrimary = variant === "primary";
  const isGhost = variant === "ghost";
  const heightCls = isPrimary ? "h-16 text-lg" : isGhost ? "h-11 text-sm" : "h-14 text-base";

  return (
    <button
      ref={ref}
      onPointerDown={(e) => {
        // Only accept one active pointer; ignore synthetic duplicates.
        if (activePointerRef.current != null) return;
        activePointerRef.current = e.pointerId;
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
        startHold();
      }}
      onPointerUp={(e) => {
        if (activePointerRef.current !== e.pointerId) return;
        try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
        cancelHold();
      }}
      onPointerCancel={(e) => {
        if (activePointerRef.current !== e.pointerId) return;
        cancelHold();
      }}
      onPointerLeave={(e) => {
        // Only cancel if the pointer is no longer pressed (mouse leaving while up).
        // Touch pointers keep capture, so this won't fire mid-hold.
        if (activePointerRef.current !== e.pointerId) return;
        if (e.buttons === 0) cancelHold();
      }}
      onContextMenu={(e) => e.preventDefault()}
      disabled={disabled || loading}
      className={cn(
        "relative w-full overflow-hidden rounded-2xl font-bold shadow-lg select-none touch-none",
        "transition-transform duration-100",
        heightCls,
        isPrimary
          ? "bg-primary text-white"
          : isGhost
          ? "bg-transparent text-muted-foreground border border-dashed border-border/60 shadow-none font-medium"
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
});
