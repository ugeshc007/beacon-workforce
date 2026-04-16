interface Props {
  lat: number;
  lng: number;
  label: string;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export default function MiniMap({ lat, lng, label }: Props) {
  const delta = 0.008;
  const left = clamp(lng - delta, -180, 180);
  const right = clamp(lng + delta, -180, 180);
  const top = clamp(lat + delta, -90, 90);
  const bottom = clamp(lat - delta, -90, 90);

  // Use CartoDB Positron tiles for English-only labels
  const tileUrl = `https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png`;
  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${lat}%2C${lng}`;
  const openStreetMapUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;

  // Build a self-contained HTML blob using Leaflet CDN with English tiles
  const mapHtml = `<!DOCTYPE html><html><head>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
    <style>html,body,#m{margin:0;padding:0;height:100%;width:100%}</style>
  </head><body><div id="m"></div><script>
    var m=L.map('m',{zoomControl:false,attributionControl:false}).setView([${lat},${lng}],15);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png').addTo(m);
    L.marker([${lat},${lng}]).addTo(m);
  <\/script></body></html>`;
  const blob = new Blob([mapHtml], { type: "text/html" });
  const blobUrl = URL.createObjectURL(blob);

  return (
    <div className="space-y-2">
      <div className="h-32 w-full overflow-hidden rounded-md border border-border bg-muted/20">
        <iframe
          title={`${label} map preview`}
          src={embedUrl}
          className="h-full w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
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
