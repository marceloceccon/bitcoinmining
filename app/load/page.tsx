"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useFarmStore } from "@/lib/store";
import { loadFarm } from "@/lib/supabase";

function LoadPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const loadConfig = useFarmStore((state) => state.loadConfig);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const farmId = searchParams.get("farm");

    if (!farmId) {
      setStatus("error");
      setError("No farm ID provided in URL");
      return;
    }

    loadFarmData(farmId);
  }, [searchParams]);

  async function loadFarmData(farmId: string) {
    try {
      const farmData = await loadFarm(farmId);

      if (!farmData) {
        throw new Error("Farm not found");
      }

      const config = JSON.parse(farmData.config);
      loadConfig(config);
      setStatus("success");

      setTimeout(() => {
        router.push("/");
      }, 1000);
    } catch (err: any) {
      console.error("Failed to load farm:", err);
      setStatus("error");
      setError(err.message || "Failed to load farm");
    }
  }

  return (
    <div className="min-h-screen bg-bitcoin-dark flex items-center justify-center p-4">
      <div className="glass rounded-lg p-8 max-w-md w-full text-center">
        {status === "loading" && (
          <>
            <Loader2 className="h-12 w-12 text-bitcoin-orange animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gradient mb-2">
              Loading Farm...
            </h2>
            <p className="text-muted-foreground">
              Fetching your configuration
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-xl font-bold text-gradient mb-2">
              Farm Loaded!
            </h2>
            <p className="text-muted-foreground">
              Redirecting to calculator...
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="text-6xl mb-4">❌</div>
            <h2 className="text-xl font-bold text-red-500 mb-2">
              Failed to Load
            </h2>
            <p className="text-muted-foreground mb-4">
              {error}
            </p>
            <button
              onClick={() => router.push("/")}
              className="bitcoin-gradient text-bitcoin-dark px-6 py-2 rounded-md font-semibold"
            >
              Go Home
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function LoadPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-bitcoin-dark flex items-center justify-center p-4">
        <div className="glass rounded-lg p-8 max-w-md w-full text-center">
          <Loader2 className="h-12 w-12 text-bitcoin-orange animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gradient mb-2">
            Loading...
          </h2>
        </div>
      </div>
    }>
      <LoadPageContent />
    </Suspense>
  );
}
