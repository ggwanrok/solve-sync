function LoadingBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-muted ${className}`} />
}

export default function AppPageLoading() {
  return (
    <div
      className="page-container"
      role="status"
      aria-label="페이지 불러오는 중"
    >
      <div className="space-y-2">
        <LoadingBlock className="h-8 w-32" />
        <LoadingBlock className="h-4 w-full max-w-sm" />
      </div>

      <LoadingBlock className="h-11 w-full" />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="space-y-4 rounded-2xl bg-card p-5 shadow-sm ring-1 ring-foreground/[0.055]">
            <LoadingBlock className="h-5 w-2/3" />
            <div className="space-y-2">
              <LoadingBlock className="h-4 w-full" />
              <LoadingBlock className="h-4 w-4/5" />
            </div>
            <LoadingBlock className="h-10 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
