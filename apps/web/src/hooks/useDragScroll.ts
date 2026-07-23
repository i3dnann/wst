import { useCallback, useRef, useState, type PointerEvent } from "react";

interface DragOrigin {
  pointerId: number;
  pointerX: number;
  pointerY: number;
  scrollLeft: number;
  scrollTop: number;
}

const INTERACTIVE_SELECTOR =
  "button, input, select, textarea, a, [role='button'], [contenteditable='true']";

export function useDragScroll<T extends HTMLElement>() {
  const dragOrigin = useRef<DragOrigin | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const onPointerDown = useCallback((event: PointerEvent<T>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest(INTERACTIVE_SELECTOR)) return;
    const viewport = event.currentTarget;
    dragOrigin.current = {
      pointerId: event.pointerId,
      pointerX: event.clientX,
      pointerY: event.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    };
    viewport.setPointerCapture(event.pointerId);
    setIsDragging(true);
  }, []);

  const onPointerMove = useCallback((event: PointerEvent<T>) => {
    const origin = dragOrigin.current;
    if (!origin || origin.pointerId !== event.pointerId) return;
    const viewport = event.currentTarget;
    viewport.scrollLeft = origin.scrollLeft - (event.clientX - origin.pointerX);
    viewport.scrollTop = origin.scrollTop - (event.clientY - origin.pointerY);
  }, []);

  const finishDrag = useCallback((event: PointerEvent<T>) => {
    const origin = dragOrigin.current;
    if (!origin || origin.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragOrigin.current = null;
    setIsDragging(false);
  }, []);

  return {
    isDragging,
    dragHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finishDrag,
      onPointerCancel: finishDrag,
    },
  };
}
