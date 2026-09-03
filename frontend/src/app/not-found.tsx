import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-[18px] font-semibold">Page not found</p>
      <p className="text-[13px] text-fg-secondary">
        This record is not in the prototype data set.
      </p>
      <Button asChild variant="outline">
        <Link href="/login">Back to sign in</Link>
      </Button>
    </div>
  );
}
