import { useEffect, useMemo, useState } from "react";

import { api } from "./api";
import { buildDepartmentCatalog, getFallbackDepartmentOption } from "./academic";
import { DepartmentSummary } from "./types";
import { getErrorMessage } from "./utils";

export const useDepartmentCatalog = (enabled = true) => {
  const [departments, setDepartments] = useState<DepartmentSummary[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    const loadDepartments = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await api.get<DepartmentSummary[]>("/departments");
        setDepartments(response.data);
      } catch (loadError) {
        setError(getErrorMessage(loadError, "Unable to load departments"));
      } finally {
        setLoading(false);
      }
    };

    void loadDepartments();
  }, [enabled]);

  const catalog = useMemo(() => buildDepartmentCatalog(departments), [departments]);
  const fallbackDepartment = useMemo(() => getFallbackDepartmentOption(catalog), [catalog]);

  return {
    departments,
    catalog,
    fallbackDepartment,
    loading,
    error,
  };
};
