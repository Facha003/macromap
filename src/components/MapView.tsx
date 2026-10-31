"use client";
import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { GeoJSONSource, Map as MlMap, Marker, Popup } from "maplibre-gl";

export interface MapPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  hasMenu: boolean;
  subtitle: string;
}

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

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

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/**
 * MapLibre map with OpenFreeMap vector tiles (free, no key, OSM attribution).
 * Restaurants are drawn as one GeoJSON circle layer so thousands of points stay smooth.
 */
export function MapView({ center, radiusM, points }: { center: { lat: number; lng: number }; radiusM: number; points: MapPoint[] }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const me = useRef<Marker | null>(null);
  const popup = useRef<Popup | null>(null);
  const latest = useRef({ center, radiusM, points });
  latest.current = { center, radiusM, points };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ml = await import("maplibre-gl");
      if (cancelled || !el.current || map.current) return;
      ml.setWorkerUrl(`${BASE}/maplibre-gl-worker.mjs`);
      const dark = isDark();
      const m = new ml.Map({
        container: el.current,
        style: `https://tiles.openfreemap.org/styles/${dark ? "dark" : "positron"}`,
        center: [center.lng, center.lat],
        zoom: 13.5,
        attributionControl: { compact: true },
      });
      map.current = m;
      m.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
      popup.current = new ml.Popup({ offset: 10, closeButton: false });
      m.on("load", () => {
        const ink = dark ? "#f0efec" : "#111110";
        const muted = dark ? "#8d8c84" : "#8a8983";
        const surface = dark ? "#1a1a19" : "#ffffff";
        m.addSource("radius", { type: "geojson", data: circle(center.lat, center.lng, radiusM) });
        m.addLayer({ id: "radius-fill", type: "fill", source: "radius", paint: { "fill-color": "#2a78d6", "fill-opacity": 0.06 } });
        m.addLayer({ id: "radius-line", type: "line", source: "radius", paint: { "line-color": "#2a78d6", "line-width": 1.5, "line-opacity": 0.5 } });
        m.addSource("places", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        m.addLayer({
          id: "places",
          type: "circle",
          source: "places",
          paint: {
            "circle-radius": ["case", ["get", "hasMenu"], 8, 5],
            "circle-color": ["case", ["get", "hasMenu"], ink, muted],
            "circle-stroke-color": surface,
            "circle-stroke-width": 2,
          },
        });
        m.on("mouseenter", "places", () => (m.getCanvas().style.cursor = "pointer"));
        m.on("mouseleave", "places", () => (m.getCanvas().style.cursor = ""));
        m.on("click", "places", (e) => {
          const f = e.features?.[0];
          if (!f) return;
          const p = f.properties as { id: string; name: string; subtitle: string };
          popup.current!
            .setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
            .setHTML(`<div style="font:13px var(--font-sans);color:#111"><strong>${esc(p.name)}</strong><br/><span style="color:#555">${esc(p.subtitle)}</span><br/><a href="${BASE}/r/?id=${encodeURIComponent(p.id)}" style="color:#2a78d6;font-weight:600">Open menu →</a></div>`)
            .addTo(m);
        });
        const dot = document.createElement("div");
        dot.className = "h-4 w-4 rounded-full border-[3px] border-white bg-[#2a78d6] shadow-md";
        dot.setAttribute("aria-label", "Your location");
        me.current = new ml.Marker({ element: dot }).setLngLat([center.lng, center.lat]).addTo(m);
        draw();
      });
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const draw = () => {
    const m = map.current;
    if (!m || !m.getSource("places")) return;
    const { center: c, radiusM: r, points: pts } = latest.current;
    (m.getSource("radius") as GeoJSONSource).setData(circle(c.lat, c.lng, r));
    (m.getSource("places") as GeoJSONSource).setData({
      type: "FeatureCollection",
      // Restaurants with nutrition data are drawn last so they sit on top.
      features: [...pts].sort((a, b) => Number(a.hasMenu) - Number(b.hasMenu)).map((p) => ({
        type: "Feature",
        properties: { id: p.id, name: p.name, subtitle: p.subtitle, hasMenu: p.hasMenu },
        geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      })),
    });
    me.current?.setLngLat([c.lng, c.lat]);
  };

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    m.easeTo({ center: [center.lng, center.lat], zoom: radiusM > 3000 ? 12.5 : radiusM > 1500 ? 13.2 : 14 });
    draw();
  }, [center.lat, center.lng, radiusM, points]);

  return <div ref={el} className="h-[60vh] min-h-80 w-full overflow-hidden rounded-[20px] border border-line md:h-[520px]" />;
}
