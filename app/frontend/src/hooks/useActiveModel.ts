import { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api";

export function useActiveModel() {
  const [models, setModels] = useState<string[]>([]);
  const [activeModel, setActiveModelState] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.models.list().then((d) => {
      setModels(d.models ?? []);
      setActiveModelState(d.active_model ?? "");
    }).catch(() => null).finally(() => setLoading(false));
  }, []);

  const switchModel = useCallback(async (model: string) => {
    try {
      await api.models.activate(model);
      setActiveModelState(model);
    } catch {}
  }, []);

  return { models, activeModel, loading, switchModel };
}
