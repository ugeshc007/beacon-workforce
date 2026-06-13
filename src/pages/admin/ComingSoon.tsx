export default function ComingSoon({ title }: { title: string }) {
  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold text-white">{title}</h1>
      <p className="text-slate-400 text-sm mt-2">Coming in the next phase.</p>
    </div>
  );
}
