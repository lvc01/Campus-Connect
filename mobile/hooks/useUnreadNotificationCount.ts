import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api-client";

export function useUnreadNotificationCount(): number {
  const { data } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => api.get<{ count: number }>("/notifications/unread-count"),
    refetchInterval: 30000,
  });

  return data?.count ?? 0;
}
