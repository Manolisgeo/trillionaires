export default function AppLoading() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse">
      <div className="h-8 w-48 rounded bg-black/5" />
      <div className="mt-3 h-4 w-80 rounded bg-black/5" />
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <div className="h-24 rounded-xl bg-black/5" />
        <div className="h-24 rounded-xl bg-black/5" />
        <div className="h-24 rounded-xl bg-black/5" />
      </div>
      <div className="mt-10 h-48 rounded-xl bg-black/5" />
    </div>
  );
}
