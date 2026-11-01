import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import s1s from "@/assets/slides/slide-1-800.webp";
import s1l from "@/assets/slides/slide-1-1600.webp";
import s2s from "@/assets/slides/slide-2-800.webp";
import s2l from "@/assets/slides/slide-2-1600.webp";
import s3s from "@/assets/slides/slide-3-800.webp";
import s3l from "@/assets/slides/slide-3-1600.webp";
import s4s from "@/assets/slides/slide-4-800.webp";
import s4l from "@/assets/slides/slide-4-1600.webp";

/** Интервал автопрокрутки слайдера, мс. */
export const SLIDE_INTERVAL_MS = 3000;

const SLIDES = [
  { small: s1s, large: s1l, alt: "Зал конференции с участниками перед сценой", caption: "Конференции" },
  { small: s2s, large: s2l, alt: "Студенты знакомятся на встрече", caption: "Нетворкинг" },
  { small: s3s, large: s3l, alt: "Проход на мероприятие по QR-билету", caption: "Вход по QR" },
  { small: s4s, large: s4l, alt: "Практический мастер-класс в аудитории", caption: "Мастер-классы" },
];

/**
 * Слайдер на 4 изображения: автопрокрутка каждые 3 секунды, пауза при наведении,
 * стрелки, точки и свайп на телефоне. Картинки в WebP, два размера (srcSet),
 * первая грузится сразу, остальные — лениво.
 */
export function HeroSlider() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [touchX, setTouchX] = useState<number | null>(null);
  const count = SLIDES.length;

  const go = useCallback((i: number) => setIndex(((i % count) + count) % count), [count]);

  useEffect(() => {
    if (paused) return;
    const id = window.setTimeout(() => go(index + 1), SLIDE_INTERVAL_MS);
    return () => window.clearTimeout(id);
  }, [index, paused, go]);

  return (
    <div
      className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-border shadow-2xl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => setTouchX(e.touches[0]?.clientX ?? null)}
      onTouchEnd={(e) => {
        const end = e.changedTouches[0]?.clientX;
        if (touchX !== null && end !== undefined && Math.abs(end - touchX) > 40) {
          go(end < touchX ? index + 1 : index - 1);
        }
        setTouchX(null);
      }}
      aria-roledescription="carousel"
    >
      <div
        className="flex h-full transition-transform duration-700 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {SLIDES.map((slide, i) => (
          <figure key={slide.caption} className="relative h-full w-full shrink-0" aria-hidden={i !== index}>
            <img
              src={slide.small}
              srcSet={`${slide.small} 800w, ${slide.large} 1600w`}
              sizes="(min-width: 1024px) 560px, 100vw"
              alt={slide.alt}
              width={1600}
              height={900}
              loading={i === 0 ? "eager" : "lazy"}
              decoding="async"
              {...(i === 0 ? { fetchPriority: "high" as const } : {})}
              className="h-full w-full object-cover"
            />
            <figcaption className="absolute bottom-3 left-3 rounded-full bg-background/85 px-3 py-1 text-xs font-semibold text-foreground backdrop-blur">
              {slide.caption}
            </figcaption>
          </figure>
        ))}
      </div>

      <button
        onClick={() => go(index - 1)}
        aria-label="Предыдущий слайд"
        className="absolute left-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-background/80 text-foreground shadow"
      >
        <ChevronLeft className="size-5" />
      </button>
      <button
        onClick={() => go(index + 1)}
        aria-label="Следующий слайд"
        className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-background/80 text-foreground shadow"
      >
        <ChevronRight className="size-5" />
      </button>

      <div className="absolute bottom-3 right-3 flex gap-1.5">
        {SLIDES.map((slide, i) => (
          <button
            key={slide.caption}
            onClick={() => go(i)}
            aria-label={`Слайд ${i + 1}`}
            aria-current={i === index}
            className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-primary" : "w-2 bg-background/80"}`}
          />
        ))}
      </div>
    </div>
  );
}
