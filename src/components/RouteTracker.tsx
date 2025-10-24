"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function RouteTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const search = searchParams?.toString();
    const currentUrl = search ? `${pathname}?${search}` : pathname;
    try {
      localStorage.setItem("vc:lastPath", currentUrl);
    } catch {}
  }, [pathname, searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleAppInstalled = () => {
      try {
        const url = window.location.pathname + window.location.search;
        localStorage.setItem("vc:installedStartUrl", url);
      } catch {}
    };

    window.addEventListener("appinstalled", handleAppInstalled);
    return () => window.removeEventListener("appinstalled", handleAppInstalled);
  }, []);

  return null;
}


