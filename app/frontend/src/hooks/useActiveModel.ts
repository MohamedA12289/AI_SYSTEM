import { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api";

export function useActiveModel() {
  const [models, setModels] = useState<string[]>([]);
  const [activeModel, setActiveModelState] = useState<string>("");
  const [activeProvider, setActiveProvider] = useState<string>("ollama");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const providerState = await api.provider.get();
        const provider = providerState.active || "ollama";
        setActiveProvider(provider);
        if (provider === "ollama") {
          const d = await api.models.list();
          setModels(d.models ?? []);
          setActiveModelState(d.active_model ?? "");
          return;
        }
        const catalog = await api.provider.list();
        const providerModels = (catalog as any)[provider];
        setModels(providerModels?.models ?? []);
        setActiveModelState(providerModels?.active ?? "");
      } finally {
        setLoading(false);
      }
    }
    load().catch(() => setLoading(false));
  }, []);

  const switchModel = useCallback(async (model: string) => {
    try {
      if (activeProvider === "ollama") {
        await api.models.activate(model);
      } else {
        await api.provider.setModel(activeProvider as any, model);
      }
      setActiveModelState(model);
    } catch {}
  }, [activeProvider]);

  return { models, activeModel, activeProvider, loading, switchModel };
}
