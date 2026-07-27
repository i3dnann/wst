import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

export function usePublicWebsiteSettings() {
  return useQuery({
    queryKey: ["public-settings"],
    queryFn: async ({ signal }) => {
      const controller = new AbortController();
      const timeoutError = new Error("Public website settings timed out.");
      const abort = () => {
        controller.abort();
      };
      const timeout = window.setTimeout(() => {
        controller.abort(timeoutError);
      }, 1_500);
      signal.addEventListener("abort", abort, { once: true });
      try {
        return await api.publicSettings(controller.signal);
      } catch (error) {
        if (controller.signal.reason === timeoutError) throw timeoutError;
        throw error;
      } finally {
        window.clearTimeout(timeout);
        signal.removeEventListener("abort", abort);
      }
    },
    select: (response) => response.data.value,
    staleTime: 30_000,
    retry: false,
  });
}
