"use client";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
export default function PosterPreview({
  posterRef,
  children,
}: {
  posterRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ scale: 1, height: 900 });
  useEffect(() => {
    const measure = () => {
      if (!container.current || !posterRef.current) return;
      const scale = Math.min(1, container.current.clientWidth / 1080);
      setSize({ scale, height: posterRef.current.offsetHeight * scale });
    };
    const observer = new ResizeObserver(measure);
    if (container.current) observer.observe(container.current);
    if (posterRef.current) observer.observe(posterRef.current);
    measure();
    return () => observer.disconnect();
  }, [posterRef]);
  return (
    <div
      ref={container}
      className="poster-preview"
      style={{ height: size.height }}
    >
      <div
        style={{
          transform: `scale(${size.scale})`,
          transformOrigin: "top left",
          width: 1080,
        }}
      >
        <div ref={posterRef} className="weekly-poster">
          {children}
        </div>
      </div>
    </div>
  );
}
