"use client";

import { useEffect, useRef } from "react";

/**
 * Adiciona .sr-ready no mount (client-only) e .sr-visible quando
 * o elemento entra no viewport. Robusto contra SSR e hydration flash.
 */
export function useScrollReveal(delay = 0) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Marca como pronto para animação (evita flash SSR)
    el.classList.add("sr", "sr-ready");

    const show = () => {
      setTimeout(() => el.classList.add("sr-visible"), delay);
    };

    // Se já está visível na tela, anima imediatamente
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight - 60) {
      show();
      return;
    }

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          show();
          obs.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [delay]);

  return ref;
}
