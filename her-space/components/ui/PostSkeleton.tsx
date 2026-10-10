import Card from "@/components/ui/Card";

export default function PostSkeleton() {
  return (
    <Card as="article" className="post-card space-y-4" aria-hidden="true">
      <div className="flex items-center justify-between gap-3">
        <div className="skeleton-shimmer h-6 w-28 rounded-full" />
        <div className="skeleton-shimmer h-4 w-20 rounded" />
      </div>
      <div className="space-y-2">
        <div className="skeleton-shimmer h-5 w-3/4 rounded" />
        <div className="skeleton-shimmer h-4 w-1/2 rounded" />
      </div>
      <div className="space-y-2">
        <div className="skeleton-shimmer h-4 w-full rounded" />
        <div className="skeleton-shimmer h-4 w-full rounded" />
        <div className="skeleton-shimmer h-4 w-2/3 rounded" />
      </div>
      <div className="flex items-center justify-between border-t border-rose-100 pt-3">
        <div className="flex items-center gap-2">
          <div className="skeleton-shimmer h-8 w-8 rounded-full" />
          <div className="skeleton-shimmer h-4 w-28 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="skeleton-shimmer h-11 w-11 rounded-full" />
          <div className="skeleton-shimmer h-11 w-11 rounded-full" />
          <div className="skeleton-shimmer h-11 w-11 rounded-full" />
        </div>
      </div>
    </Card>
  );
}