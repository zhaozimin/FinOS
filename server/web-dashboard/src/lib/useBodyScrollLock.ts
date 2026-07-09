import { useLayoutEffect } from "react";

let lockCount = 0;
let previousOverflow = "";
let previousPaddingRight = "";

function lockBodyScroll() {
  if (typeof window === "undefined") return () => {};

  if (lockCount === 0) {
    previousOverflow = document.body.style.overflow;
    previousPaddingRight = document.body.style.paddingRight;

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
  }

  lockCount += 1;
  let released = false;

  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(lockCount - 1, 0);

    if (lockCount === 0) {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      previousOverflow = "";
      previousPaddingRight = "";
    }
  };
}

export function useBodyScrollLock(active: boolean) {
  useLayoutEffect(() => {
    if (!active) return;
    return lockBodyScroll();
  }, [active]);
}
