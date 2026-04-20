export default function SavedSearchesPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Saved Searches</h1>
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        <p>Coming in Phase 1.5.</p>
        <p className="mt-2">
          The <code className="font-mono">saved_searches</code> and{" "}
          <code className="font-mono">alerts</code> tables are already wired up
          in the schema — UI + Resend delivery come next.
        </p>
      </div>
    </div>
  );
}
