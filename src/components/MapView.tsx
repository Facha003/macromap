"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MlMap, Marker } from "maplibre-gl";

export interface MapPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  hasMenu: boolean;
  subtitle: string;
}

function circle(lat: number, lng: number, radiusM: number) {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * 2 * Math.PI;
    pts.push([lng + (radiusM / (111_320 * Math.cos((lat * Math.PI) / 180))) * Math.cos(a), lat + (radiusM / 111_320) * Math.sin(a)]);
  }
  return { type: "Feature" as const, properties: {}, geometry: { type: "Polygon" as const, coordinates: [pts] } };
}

const isDark = () =>
  document.documentElement.dataset.theme === "dark" ||
  (!document.documentElement.dataset.theme && window.matchMedia("(prefers-color-scheme: dark)").matches);

/** MapLibre map with OpenFreeMap vector tiles (free, no key, OSM attribution). */
export function MapView({ center, radiusM, points }: { center: { lat: number; lng: number }; radiusM: number; points: MapPoint[] }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ml = await import("maplibre-gl");
      if (cancelled || !el.current || map.current) return;
      ml.setWorkerUrl(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/maplibre-gl-worker.mjs`);
      map.current = new ml.Map({
        container: el.current,
        style: `https://tiles.openfreemap.org/styles/${isDark() ? "dark" : "positron"}`,
        center: [center.lng, center.lat],
        zoom: 13.5,
        attributionControl: { compact: true },
      });
      map.current.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
      map.current.on("load", () => draw(ml));
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const draw = (ml: typeof import("maplibre-gl")) => {
    const m = map.current;
    if (!m || !m.isStyleLoaded()) return;
    const data = circle(center.lat, center.lng, radiusM);
    const src = m.getSource("radius") as import("maplibre-gl").GeoJSONSource | undefined;
    if (src) src.setData(data);
    else {
      m.addSource("radius", { type: "geojson", data });
      m.addLayer({ id: "radius-fill", type: "fill", source: "radius", paint: { "fill-color": "#2a78d6", "fill-opacity": 0.06 } });
      m.addLayer({ id: "radius-line", type: "line", source: "radius", paint: { "line-color": "#2a78d6", "line-width": 1.5, "line-opacity": 0.5 } });
    }
    markers.current.forEach((x) => x.remove());
    markers.current = [];

    const me = document.createElement("div");
    me.className = "h-4 w-4 rounded-full border-[3px] border-white bg-[#2a78d6] shadow-md";
    me.setAttribute("aria-label", "Your location");
    markers.current.push(new ml.Marker({ element: me }).setLngLat([center.lng, center.lat]).addTo(m));

    for (const p of points) {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.title = p.name;
      dot.setAttribute("aria-label", `${p.name}${p.hasMenu ? ", has nutrition data" : ""}`);
      dot.className = p.hasMenu
        ? "h-[18px] w-[18px] rounded-full border-2 border-[var(--surface)] bg-[var(--ink)] shadow ring-2 ring-[var(--ink)]/10 cursor-pointer"
        : "h-3 w-3 rounded-full border-2 border-[var(--surface)] bg-[var(--ink-3)] cursor-pointer";
      const popup = new ml.Popup({ offset: 12, closeButton: false }).setHTML(
        `<div style="font:13px var(--font-sans);color:#111"><strong>${p.name.replace(/</g, "&lt;")}</strong><br/><span style="color:#555">${p.subtitle.replace(/</g, "&lt;")}</span><br/><a href="${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/r/?id=${encodeURIComponent(p.id)}" style="color:#2a78d6;font-weight:600">Open menu →</a></div>`,
      );
      dot.addEventListener("dblclick", () => router.push(`/r/?id=${encodeURIComponent(p.id)}`));
      markers.current.push(new ml.Marker({ element: dot }).setLngLat([p.lng, p.lat]).setPopup(popup).addTo(m));
    }
  };

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    m.easeTo({ center: [center.lng, center.lat], zoom: radiusM > 3000 ? 12.5 : radiusM > 1500 ? 13.2 : 14 });
    import("maplibre-gl").then((ml) => (m.isStyleLoaded() ? draw(ml) : m.once("load", () => draw(ml))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng, radiusM, points]);

  return <div ref={el} className="h-[60vh] min-h-80 w-full overflow-hidden rounded-[20px] border border-line md:h-[520px]" />;
}
