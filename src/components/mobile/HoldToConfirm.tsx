import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

interface HoldToConfirmProps {
  onConfirm: () => void;
  holdDurationMs?: number;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Hold-to-confirm button. User must long-press for the specified duration.
 * Shows a fill animation as visual feedback.
 */
export function HoldToConfirm({
  onConfirm,
  holdDurationMs = 1500,
  disabled = false,
  loading = false,
  className,
  children,
}: HoldToConfirmProps) {
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const frameRef = useRef<number | null>(null);
  const confirmedRef = useRef(false);

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
    setHolding(false);
    setProgress(0);
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return (
    <button
      onMouseDown={startHold}
      onMouseUp={cancelHold}
      onMouseLeave={cancelHold}
      onTouchStart={startHold}
      onTouchEnd={cancelHold}
      onTouchCancel={cancelHold}
      disabled={disabled || loading}
      className={cn(
        "relative h-16 w-full overflow-hidden rounded-2xl text-lg font-bold shadow-lg transition-all select-none",
        "bg-primary text-primary-foreground",
        disabled && "opacity-50 cursor-not-allowed",
        holding && "scale-[0.98]",
        className
      )}
    >
      {/* Fill overlay */}
      <div
        className="absolute inset-0 bg-white/20 origin-left transition-none"
        style={{ transform: `scaleX(${progress})` }}
      />

      {/* Content */}
      <span className="relative z-10 flex items-center justify-center gap-2">
        {children}
      </span>

      {/* Hold hint */}
      {!holding && progress === 0 && !loading && (
        <span className="absolute bottom-1 left-0 right-0 text-center text-[10px] opacity-60 z-10">
          Hold to confirm
        </span>
      )}
    </button>
  );
}
