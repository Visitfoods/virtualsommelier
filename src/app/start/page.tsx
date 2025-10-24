"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StartRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const installedUrl = localStorage.getItem("vc:installedStartUrl");
    const lastPath = localStorage.getItem("vc:lastPath");
    const target = installedUrl || lastPath || "/";
    if (target && target !== window.location.pathname + window.location.search) {
      router.replace(target);
    }
  }, [router]);

  return null;
}


