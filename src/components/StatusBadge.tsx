import { statusClasses, statusLabel } from "@/lib/format";
import type { FloodStatus } from "@/lib/types";

export default function StatusBadge({
  status,
  simulated = false,
}: {
  status: FloodStatus | string;
  simulated?: boolean;
}) {
  return (
    <span className={`badge ring-1 ring-inset ${statusClasses(status)}`}>
      {statusLabel(status)}
      {simulated ? " · SIMULATED" : ""}
    </span>
  );
}
