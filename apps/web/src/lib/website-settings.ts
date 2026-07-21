import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

export function usePublicWebsiteSettings() {
  return useQuery({
    queryKey: ["public-settings"],
    queryFn: api.publicSettings,
    select: (response) => response.data.value,
    staleTime: 30_000,
    retry: false,
  });
}
