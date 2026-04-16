interface Props {
  lat: number;
  lng: number;
  label: string;
}

export default function MiniMap({ lat, lng, label }: Props) {
  const zoom = 15;
  const width = 400;
  const height = 200;

  // Use Stamen/Stadia tiles via static image — always English labels
  const staticMapUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=${zoom}&size=${width}x${height}&markers=${lat},${lng},ol-marker&maptype=mapnik`;

  const openStreetMapUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;

  return (
    <div className="space-y-1">
      <a href={openStreetMapUrl} target="_blank" rel="noopener noreferrer">
        <img
          src={staticMapUrl}
          alt={`Map showing ${label} at ${lat.toFixed(4)}, ${lng.toFixed(4)}`}
          className="h-32 w-full rounded-md border border-border object-cover bg-muted/20"
          loading="lazy"
        />
      </a>
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
