export type Role = "MANAGER" | "SUPERVISOR" | "OPERATOR";
export type User = { id: number; name: string; email: string; role: Role; operator_id?: number | null; store_id?: number | null };
export type Store = { id: number; name: string; distance_km: number; logistics_type: "PROXIMA" | "DISTANTE"; active: boolean };
export type Operator = { id: number; name: string; email: string; sector: string; status: string; daily_capacity: number; observation?: string };
export type Product = { id: number; name: string; package_weight: number; unit: Unit; category: string; average_time_minutes: number; active: boolean; observation?: string };
export type Unit = "g" | "kg" | "unidade" | "caixa" | "pacote" | "fardo";
export type RequestItem = { id: number; product_id?: number; product_name: string; package_weight: number; unit: Unit; requested_quantity: number; current_store_stock: number; ideal_stock: number; suggested_quantity: number };
export type RequestRecord = { id: number; request_code: string; request_date: string; reference_week: string; store_id: number; store: Store; responsible_name: string; desired_receipt_date: string; status: string; items: RequestItem[]; productions?: Production[] };
export type Pause = { id: number; pause_started_at: string; pause_finished_at?: string | null; reason: string; duration_minutes?: number | null };
export type Production = { id: number; production_code: string; product_name: string; package_weight: number; unit: Unit; production_quantity: number; status: string; started_at?: string | null; finished_at?: string | null; gross_time_minutes?: number | null; paused_time_minutes?: number | null; net_time_minutes?: number | null; store: Store; operator: Operator; request: RequestRecord; pauses: Pause[] };

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333";

export const tokenStore = {
  get: () => localStorage.getItem("token"),
  set: (token: string) => localStorage.setItem("token", token),
  clear: () => localStorage.removeItem("token")
};

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(tokenStore.get() ? { Authorization: `Bearer ${tokenStore.get()}` } : {}),
      ...options.headers
    }
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Erro inesperado." }));
    throw new Error(error.message ?? "Erro inesperado.");
  }
  return response.json();
}

export const units: Unit[] = ["g", "kg", "unidade", "caixa", "pacote", "fardo"];
export const pauseReasons = [
  ["WATER", "Agua"],
  ["BATHROOM", "Banheiro"],
  ["BREAK", "Intervalo"],
  ["WAITING_MATERIAL", "Aguardando material"],
  ["MAINTENANCE", "Manutencao"],
  ["OTHER", "Outro"]
] as const;
