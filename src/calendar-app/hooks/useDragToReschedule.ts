import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

/** How far the mouse must move before a press becomes a drag. */
const MOUSE_THRESHOLD_PX = 5;
/** How long a finger must rest before a touch becomes a drag. */
const TOUCH_HOLD_MS = 260;
/** Moving further than this before the hold fires means the user is scrolling. */
const TOUCH_CANCEL_PX = 10;

export interface DragState<T> {
  item: T;
  x: number;
  y: number;
}

/** Finds the nearest drop target under the pointer, by dataset key. */
function targetUnderPointer(x: number, y: number, attr: string): string | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  return el?.closest<HTMLElement>(`[data-${attr}]`)?.dataset[attr] ?? null;
}

/**
 * Drag-to-reschedule built on Pointer Events, so one implementation covers
 * mouse and touch without pulling in a drag-and-drop library.
 *
 * Mouse: a drag starts after a small movement, so plain clicks still open the
 * post. Touch: a drag needs a short hold, so swiping still scrolls the page.
 */
export function useDragToReschedule<T>({
  enabled,
  onDrop,
  targetAttr = "day",
}: {
  enabled: boolean;
  onDrop: (item: T, target: string) => void;
  /** dataset key marking a drop zone: "day" on the calendar, "stage" on the board. */
  targetAttr?: string;
}) {
  const [press, setPress] = useState<{
    item: T;
    x: number;
    y: number;
    touch: boolean;
  } | null>(null);
  const [drag, setDrag] = useState<DragState<T> | null>(null);
  const [overTarget, setOverTarget] = useState<string | null>(null);

  // Held in a ref so a re-render mid-drag can't tear down the listeners.
  const onDropRef = useRef(onDrop);
  useEffect(() => {
    onDropRef.current = onDrop;
  });

  const draggedRef = useRef(false);

  const startDrag = useCallback(
    (e: ReactPointerEvent, item: T) => {
      if (!enabled) return;
      if (e.pointerType === "mouse" && e.button !== 0) return; // left button only
      draggedRef.current = false;
      setPress({
        item,
        x: e.clientX,
        y: e.clientY,
        touch: e.pointerType !== "mouse",
      });
    },
    [enabled],
  );

  useEffect(() => {
    if (!press) return;

    let started = false;
    let holdTimer: number | undefined;

    const begin = (x: number, y: number) => {
      started = true;
      draggedRef.current = true;
      document.body.classList.add("ec-dragging");
      setDrag({ item: press.item, x, y });
      setOverTarget(targetUnderPointer(x, y, targetAttr));
    };

    const finish = (target: string | null) => {
      if (started && target) onDropRef.current(press.item, target);
      cleanup();
      setPress(null);
      setDrag(null);
      setOverTarget(null);
    };

    const move = (ev: PointerEvent) => {
      const dist = Math.hypot(ev.clientX - press.x, ev.clientY - press.y);
      if (!started) {
        if (press.touch) {
          // Finger moved before the hold elapsed → treat it as a scroll.
          if (dist > TOUCH_CANCEL_PX) finish(null);
          return;
        }
        if (dist < MOUSE_THRESHOLD_PX) return;
        begin(ev.clientX, ev.clientY);
      }
      ev.preventDefault(); // stop text selection / touch scrolling mid-drag
      setDrag((d) => (d ? { ...d, x: ev.clientX, y: ev.clientY } : d));
      setOverTarget(targetUnderPointer(ev.clientX, ev.clientY, targetAttr));
    };

    const up = (ev: PointerEvent) =>
      finish(started ? targetUnderPointer(ev.clientX, ev.clientY, targetAttr) : null);
    const cancel = () => finish(null);

    const cleanup = () => {
      if (holdTimer) window.clearTimeout(holdTimer);
      document.body.classList.remove("ec-dragging");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };

    if (press.touch) {
      holdTimer = window.setTimeout(() => begin(press.x, press.y), TOUCH_HOLD_MS);
    }
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    return cleanup;
  }, [press, targetAttr]);

  /**
   * Returns true when the click that just fired was the tail of a drag, so the
   * caller can swallow it instead of opening the post.
   */
  const consumeDragClick = useCallback(() => {
    if (!draggedRef.current) return false;
    draggedRef.current = false;
    return true;
  }, []);

  return { drag, overTarget, startDrag, consumeDragClick };
}
