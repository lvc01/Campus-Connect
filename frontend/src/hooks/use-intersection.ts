import { useEffect, RefObject } from "react";

export function useIntersectionObserver(
  ref: RefObject<HTMLElement | null>,
  callback: () => void,
  enabled = true
) {
  useEffect(() => {
    if (!enabled) return;

    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting) {
          callback();
        }
      },
      {
        threshold: 0.1, // Trigger when 10% of the element is visible
        rootMargin: "200px", // Pre-fetch content 200px before reaching the bottom
      }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [ref, callback, enabled]);
}
