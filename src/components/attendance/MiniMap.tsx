import { useMemo } from "react";

interface Props {
  lat: number;
  lng: number;
  label: string;
}

export default function MiniMap({ lat, lng, label }: Props) {
  const openStreetMapUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;

  const blobUrl = useMemo(() => {
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<style>html,body,#m{margin:0;padding:0;height:100%;width:100%}</style>
</head><body>
<div id="m"></div>
<script>
var map=L.map('m',{zoomControl:false,attributionControl:false,dragging:false,scrollWheelZoom:false,doubleClickZoom:false,touchZoom:false}).setView([${lat},${lng}],15);
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',{maxZoom:19}).addTo(map);
L.circleMarker([${lat},${lng}],{radius:7,color:'#0EA5E9',fillColor:'#0EA5E9',fillOpacity:0.9,weight:2}).addTo(map);
<\/script></body></html>`;
    return URL.createObjectURL(new Blob([html], { type: "text/html" }));
  }, [lat, lng]);

  return (
    <div className="space-y-1">
      <iframe
        src={blobUrl}
        title={`Map showing ${label}`}
        className="h-32 w-full rounded-md border border-border"
        style={{ border: 0 }}
        sandbox="allow-scripts"
      />
      <a
        href={openStreetMapUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[10px] font-medium text-primary hover:underline"
      >
        Open larger map
      </a>
    </div>
  );
}
