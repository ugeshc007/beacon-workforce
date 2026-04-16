interface Props {
  lat: number;
  lng: number;
  label: string;
}

export default function MiniMap({ lat, lng, label }: Props) {
  const embedUrl = `https://maps.google.com/maps?hl=en&q=${lat},${lng}&z=16&output=embed`;
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&hl=en`;

  return (
    <div className="space-y-1">
      <iframe
        src={embedUrl}
        title={`Map showing ${label}`}
        className="h-32 w-full rounded-md border border-border bg-muted/20"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <a
        href={mapUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[10px] font-medium text-primary hover:underline"
      >
        Open larger map
      </a>
    </div>
  );
}
