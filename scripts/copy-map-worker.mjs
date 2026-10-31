// MapLibre v6 runs tiles in an ES-module web worker that bundlers can't inline;
// serve it as a static file instead (see MapView: setWorkerUrl).
import { copyFileSync, mkdirSync } from "node:fs";
mkdirSync("public", { recursive: true });
copyFileSync("node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", "public/maplibre-gl-worker.mjs");
