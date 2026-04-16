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

  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${lat}%2C${lng}`;
  const openStreetMapUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;

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
