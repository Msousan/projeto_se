import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Factory,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  PauseCircle,
  Play,
  Store as StoreIcon,
  TimerReset,
  Trash2,
  Users
} from "lucide-react";
import { api, Operator, pauseReasons, Product, Production, RequestRecord, Store, tokenStore, units, User } from "./api";

type Page = "dashboard" | "stores" | "operators" | "products" | "requests" | "new-request" | "request-detail" | "productions" | "queue";
type ConfirmState = {
  title: string;
  message: string;
  warning?: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
};

const fmtDate = (value?: string | null) => value ? new Date(value).toLocaleString("pt-BR") : "-";
const fmtShortDate = (value?: string | null) => value ? new Date(value).toLocaleDateString("pt-BR") : "-";

const roleLabel: Record<string, string> = {
  MANAGER: "Gestor",
  SUPERVISOR: "Supervisora",
  OPERATOR: "Operador"
};

const statusLabel: Record<string, string> = {
  PENDING: "Pendente",
  IN_PROGRESS: "Em produção",
  PAUSED: "Pausado",
  PRODUCED: "Produzido",
  CANCELED: "Cancelado",
  REQUESTED: "Solicitado",
  UNDER_REVIEW: "Em análise",
  APPROVED: "Aprovado",
  IN_PRODUCTION: "Em produção",
  FINISHED: "Finalizado",
  SENT: "Enviado",
  DELIVERED: "Entregue"
};

const statusTone: Record<string, string> = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-800",
  IN_PROGRESS: "border-blue-200 bg-blue-50 text-blue-800",
  PAUSED: "border-orange-200 bg-orange-50 text-orange-800",
  PRODUCED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  CANCELED: "border-red-200 bg-red-50 text-red-800"
};

const valueLabel: Record<string, string> = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  VACATION: "Férias",
  AWAY: "Afastado",
  PROXIMA: "Próxima",
  DISTANTE: "Distante",
  true: "Sim",
  false: "Não",
  WATER: "Água",
  BATHROOM: "Banheiro",
  BREAK: "Intervalo",
  WAITING_MATERIAL: "Aguardando material",
  MAINTENANCE: "Manutenção",
  OTHER: "Outro"
};

const columnLabel: Record<string, string> = {
  name: "Nome",
  email: "E-mail",
  sector: "Setor",
  status: "Status",
  daily_capacity: "Capacidade diária",
  distance_km: "Distância (km)",
  logistics_type: "Tipo de logística",
  active: "Ativo",
  package_weight: "Peso/embalagem",
  unit: "Unidade",
  category: "Categoria",
  average_time_minutes: "Tempo médio (min)",
  request_code: "Código",
  reference_week: "Semana de referência",
  product_name: "Produto",
  requested_quantity: "Quantidade solicitada",
  current_store_stock: "Estoque atual",
  ideal_stock: "Estoque ideal",
  suggested_quantity: "Quantidade sugerida",
  production_code: "Código",
  production_quantity: "Quantidade",
  operator: "Operador",
  store: "Loja",
  _count: "Total"
};

function displayValue(value: unknown) {
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "string") return statusLabel[value] ?? valueLabel[value] ?? value;
  if (value && typeof value === "object" && "_count" in value) return String(value._count);
  return value == null || value === "" ? "-" : String(value);
}

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [page, setPage] = useState<Page>("dashboard");
  const [selectedRequest, setSelectedRequest] = useState<number | null>(null);
  const [requestFlash, setRequestFlash] = useState("");

  useEffect(() => {
    if (!tokenStore.get()) return;
    api<User>("/auth/me").then((me) => {
      setUser(me);
      setPage(me.role === "OPERATOR" ? "queue" : "dashboard");
    }).catch(() => tokenStore.clear());
  }, []);

  if (!user) return <Login onLogin={(next) => { setUser(next); setPage(next.role === "OPERATOR" ? "queue" : "dashboard"); }} />;

  const nav = [
    user.role === "MANAGER" && ["dashboard", "Painel", LayoutDashboard],
    user.role === "MANAGER" && ["stores", "Lojas", StoreIcon],
    user.role === "MANAGER" && ["operators", "Operadores", Users],
    user.role === "MANAGER" && ["products", "Produtos", Package],
    user.role !== "OPERATOR" && ["requests", "Solicitações", ClipboardList],
    user.role === "MANAGER" && ["productions", "Produções", Factory],
    user.role === "OPERATOR" && ["queue", "Minha Fila", Play]
  ].filter(Boolean) as [Page, string, typeof LayoutDashboard][];

  return (
    <div className="min-h-screen lg:flex">
      <aside className="sticky top-0 z-10 border-b border-white/70 bg-paper/90 p-4 backdrop-blur lg:h-screen lg:w-72 lg:border-b-0 lg:border-r">
        <div className="mb-5">
          <h1 className="font-display text-2xl font-black">Produzir</h1>
          <p className="text-sm text-stone-600">{user.name} - {roleLabel[user.role]}</p>
        </div>
        <nav className="flex gap-2 overflow-x-auto lg:flex-col">
          {nav.map(([key, label, Icon]) => (
            <button key={key} onClick={() => setPage(key)} className={`flex shrink-0 items-center gap-2 rounded-2xl px-4 py-3 font-bold ${page === key ? "bg-ink text-white" : "bg-white text-ink"}`}>
              <Icon size={18} /> {label}
            </button>
          ))}
          <button onClick={() => { tokenStore.clear(); setUser(null); }} className="flex shrink-0 items-center gap-2 rounded-2xl bg-white px-4 py-3 font-bold text-red-700">
            <LogOut size={18} /> Sair
          </button>
        </nav>
      </aside>
      <main className="mx-auto w-full max-w-7xl p-4 lg:p-8">
        {page === "dashboard" && <Dashboard />}
        {page === "stores" && <Stores />}
        {page === "operators" && <Operators />}
        {page === "products" && <Products />}
        {page === "requests" && <Requests user={user} flashMessage={requestFlash} onFlashShown={() => setRequestFlash("")} onNew={() => setPage("new-request")} onOpen={(id) => { setSelectedRequest(id); setPage("request-detail"); }} />}
        {page === "new-request" && <NewRequest user={user} onSaved={(id) => { setSelectedRequest(id); setPage("request-detail"); }} />}
        {page === "request-detail" && selectedRequest && <RequestDetail id={selectedRequest} user={user} onDeleted={(message) => { setRequestFlash(message); setSelectedRequest(null); setPage("requests"); }} />}
        {page === "productions" && <Productions />}
        {page === "queue" && <Queue />}
      </main>
    </div>
  );
}

function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState("gestor@empresa.com");
  const [password, setPassword] = useState("123456");
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const data = await api<{ token: string; user: User }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      tokenStore.set(data.token);
      onLogin(data.user);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center p-4">
      <form onSubmit={submit} className="card w-full max-w-md space-y-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-clay">Acesso ao sistema</p>
          <h1 className="font-display text-4xl font-black">Controle de solicitações e produções</h1>
          <p className="mt-2 text-stone-600">Entre com seu usuário para acessar as telas permitidas ao seu perfil.</p>
        </div>
        <Field label="E-mail" help="Informe o e-mail cadastrado para entrar no sistema.">
          <input className="w-full" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Digite seu e-mail de acesso" />
        </Field>
        <Field label="Senha" help="Use a senha cadastrada para o seu usuário.">
          <input className="w-full" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Digite sua senha" />
        </Field>
        {error && <p className="rounded-2xl bg-red-50 p-3 text-red-700">{error}</p>}
        <button className="btn-primary w-full">Entrar</button>
        <p className="text-sm text-stone-600">Usuários de teste: gestor@empresa.com, supervisora1@empresa.com, joao@empresa.com ou maria@empresa.com. Senha: 123456.</p>
      </form>
    </div>
  );
}

function Header({ title, action }: { title: string; action?: ReactNode }) {
  return <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="font-display text-3xl font-black">{title}</h2>{action}</div>;
}

function Field({ label, help, children }: { label: string; help: string; children: ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className="text-sm font-black text-ink">{label}</span>
      {children}
      <span className="text-xs leading-snug text-stone-500">{help}</span>
    </label>
  );
}

function ConfirmModal({ confirm, onCancel }: { confirm: ConfirmState; onCancel: () => void }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function handleConfirm() {
    setError("");
    setLoading(true);
    try {
      await confirm.onConfirm();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 grid place-items-end bg-black/50 p-3 sm:place-items-center sm:p-4">
      <div className="card w-full max-w-lg rounded-t-[2rem] sm:rounded-[2rem]">
        <div className="mb-4 flex gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-red-50 text-red-700">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3 className="font-display text-3xl font-black">{confirm.title}</h3>
            <p className="mt-1 text-stone-700">{confirm.message}</p>
          </div>
        </div>
        {confirm.warning && <p className="mb-4 rounded-2xl bg-amber-50 p-3 font-semibold text-amber-800">{confirm.warning}</p>}
        {error && <p className="mb-4 rounded-2xl bg-red-50 p-3 font-semibold text-red-700">{error}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <button className="min-h-12 rounded-2xl bg-white px-4 py-3 font-black text-ink ring-1 ring-stone-200" disabled={loading} onClick={onCancel}>Cancelar</button>
          <button className="min-h-12 rounded-2xl bg-red-600 px-4 py-3 font-black text-white hover:bg-red-700 disabled:opacity-60" disabled={loading} onClick={() => void handleConfirm()}>{loading ? "Apagando..." : confirm.confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const [data, setData] = useState<any>();
  useEffect(() => { api("/dashboard/manager").then(setData); }, []);
  if (!data) return <p>Carregando painel...</p>;
  const cards = [
    ["Total de solicitações", data.cards.totalRequests],
    ["Solicitações da semana", data.cards.weekRequests],
    ["Produções pendentes", data.cards.pending],
    ["Produções em andamento", data.cards.inProgress],
    ["Produções pausadas", data.cards.paused],
    ["Produções finalizadas", data.cards.produced],
    ["Operadores ativos", data.cards.activeOperators]
  ];
  return (
    <>
      <Header title="Painel do gestor" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value]) => <div className="card" key={label}><p className="text-sm font-bold text-stone-500">{label}</p><strong className="text-4xl">{value}</strong></div>)}
      </div>
      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <SimpleTable title="Produções por operador" rows={data.byOperator} cols={["operator", "status", "_count"]} />
        <SimpleTable title="Produções por loja" rows={data.byStore} cols={["store", "status", "_count"]} />
        <SimpleTable title="Últimas solicitações" rows={data.latestRequests} cols={["request_code", "reference_week", "status"]} />
      </div>
    </>
  );
}

function SimpleTable({ title, rows, cols }: { title: string; rows: any[]; cols: string[] }) {
  return (
    <div className="card overflow-auto">
      <h3 className="mb-3 font-display text-xl font-black">{title}</h3>
      <table className="w-full text-left text-sm">
        <thead><tr>{cols.map((c) => <th className="pb-2 pr-3" key={c}>{columnLabel[c] ?? c}</th>)}</tr></thead>
        <tbody>{rows.map((row, i) => <tr className="border-t" key={i}>{cols.map((c) => <td className="py-2 pr-3" key={c}>{displayValue(row[c])}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function Stores() {
  const [rows, setRows] = useState<Store[]>([]);
  const [form, setForm] = useState({ name: "", distance_km: 0, logistics_type: "PROXIMA", active: true });
  const load = () => api<Store[]>("/stores").then(setRows);
  useEffect(() => { void load(); }, []);
  return (
    <>
      <Header title="Cadastro de lojas" />
      <form className="card mb-5 grid gap-3 md:grid-cols-3" onSubmit={(e) => { e.preventDefault(); api("/stores", { method: "POST", body: JSON.stringify(form) }).then(load); }}>
        <Field label="Nome da loja" help="Informe o nome usado para identificar a loja no sistema.">
          <input placeholder="Exemplo: Loja 01 - Próxima" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Distância em quilômetros" help="Informe a distância aproximada da loja até a base de distribuição.">
          <input type="number" placeholder="Exemplo: 20" value={form.distance_km} onChange={(e) => setForm({ ...form, distance_km: Number(e.target.value) })} />
        </Field>
        <Field label="Tipo de logística" help="Escolha se a loja fica próxima ou distante da base.">
          <select value={form.logistics_type} onChange={(e) => setForm({ ...form, logistics_type: e.target.value })}><option value="PROXIMA">Próxima</option><option value="DISTANTE">Distante</option></select>
        </Field>
        <button className="btn-primary md:col-span-3">Salvar loja</button>
      </form>
      <DataTable rows={rows} cols={["name", "distance_km", "logistics_type", "active"]} actionLabel="Ativar/Inativar" onAction={(row) => api(`/stores/${row.id}/deactivate`, { method: "PATCH", body: JSON.stringify({ active: !row.active }) }).then(load)} />
    </>
  );
}

function Operators() {
  const [rows, setRows] = useState<Operator[]>([]);
  const [form, setForm] = useState({ name: "", email: "", sector: "Produção", status: "ACTIVE", daily_capacity: 30, observation: "" });
  const load = () => api<Operator[]>("/operators").then(setRows);
  useEffect(() => { void load(); }, []);
  return (
    <>
      <Header title="Cadastro de operadores" />
      <form className="card mb-5 grid gap-3 md:grid-cols-3" onSubmit={(e) => { e.preventDefault(); api("/operators", { method: "POST", body: JSON.stringify(form) }).then(load); }}>
        <Field label="Nome do operador" help="Informe o nome completo do operador.">
          <input placeholder="Exemplo: João Silva" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="E-mail" help="Informe o e-mail que identifica o operador no sistema.">
          <input placeholder="Exemplo: joao@empresa.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Setor" help="Informe o setor em que o operador atua.">
          <input placeholder="Exemplo: Produção" value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} />
        </Field>
        <Field label="Capacidade diária" help="Informe a quantidade média de produções por dia.">
          <input type="number" placeholder="Exemplo: 30" value={form.daily_capacity} onChange={(e) => setForm({ ...form, daily_capacity: Number(e.target.value) })} />
        </Field>
        <button className="btn-primary md:col-span-3">Salvar operador</button>
      </form>
      <DataTable rows={rows} cols={["name", "email", "sector", "status", "daily_capacity"]} actionLabel="Ativar/Inativar" onAction={(row) => api(`/operators/${row.id}/status`, { method: "PATCH", body: JSON.stringify({ status: row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }) }).then(load)} />
    </>
  );
}

function Products() {
  const [rows, setRows] = useState<Product[]>([]);
  const [form, setForm] = useState({ name: "", package_weight: 0, unit: "g", category: "", average_time_minutes: 5, active: true, observation: "" });
  const load = () => api<Product[]>("/products").then(setRows);
  useEffect(() => { void load(); }, []);
  return (
    <>
      <Header title="Cadastro de produtos" />
      <form className="card mb-5 grid gap-3 md:grid-cols-3" onSubmit={(e) => { e.preventDefault(); api("/products", { method: "POST", body: JSON.stringify(form) }).then(load); }}>
        <Field label="Nome do produto" help="Informe o nome usado para identificar o produto.">
          <input placeholder="Exemplo: Produto A" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Peso/embalagem" help="Informe o peso de cada embalagem. A unidade será escolhida no campo ao lado.">
          <input type="number" placeholder="Exemplo: 500" value={form.package_weight} onChange={(e) => setForm({ ...form, package_weight: Number(e.target.value) })} />
        </Field>
        <Field label="Unidade de medida" help="Escolha a unidade correspondente ao peso ou tipo de embalagem.">
          <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>{units.map((u) => <option key={u}>{u}</option>)}</select>
        </Field>
        <Field label="Categoria" help="Informe uma categoria simples para agrupar o produto.">
          <input placeholder="Exemplo: Médio" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
        </Field>
        <Field label="Tempo médio em minutos" help="Informe o tempo médio necessário para produzir uma unidade.">
          <input type="number" placeholder="Exemplo: 8" value={form.average_time_minutes} onChange={(e) => setForm({ ...form, average_time_minutes: Number(e.target.value) })} />
        </Field>
        <button className="btn-primary md:col-span-3">Salvar produto</button>
      </form>
      <DataTable rows={rows} cols={["name", "package_weight", "unit", "category", "average_time_minutes", "active"]} actionLabel="Ativar/Inativar" onAction={(row) => api(`/products/${row.id}/status`, { method: "PATCH", body: JSON.stringify({ active: !row.active }) }).then(load)} />
    </>
  );
}

function DataTable({ rows, cols, actionLabel, onAction }: { rows: any[]; cols: string[]; actionLabel?: string; onAction?: (row: any) => void }) {
  return (
    <div className="card overflow-auto">
      <table className="w-full text-left text-sm">
        <thead><tr>{cols.map((c) => <th className="pb-2 pr-4" key={c}>{columnLabel[c] ?? c}</th>)}{onAction && <th>Ação</th>}</tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr className="border-t" key={row.id}>
              {cols.map((c) => <td className="py-3 pr-4" key={c}>{displayValue(row[c])}</td>)}
              {onAction && <td><button className="btn-secondary" onClick={() => onAction(row)}>{actionLabel ?? "Alterar"}</button></td>}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p className="py-4 text-stone-600">Nenhum registro encontrado.</p>}
    </div>
  );
}

function Requests({ user, flashMessage, onFlashShown, onNew, onOpen }: { user: User; flashMessage: string; onFlashShown: () => void; onNew: () => void; onOpen: (id: number) => void }) {
  const [rows, setRows] = useState<RequestRecord[]>([]);
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const load = () => api<RequestRecord[]>("/requests").then(setRows);
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!flashMessage) return;
    setMessage(flashMessage);
    onFlashShown();
  }, [flashMessage, onFlashShown]);

  function askDelete(request: RequestRecord) {
    setConfirm({
      title: "Confirmar exclusão",
      message: "Tem certeza de que deseja apagar esta solicitação? Essa ação não poderá ser desfeita.",
      warning: request.productions?.length ? "Esta solicitação possui produções vinculadas. Ao apagá-la, as produções relacionadas também serão removidas." : undefined,
      confirmLabel: "Apagar solicitação",
      onConfirm: async () => {
        const result = await api<{ message: string }>(`/requests/${request.id}`, { method: "DELETE" });
        setConfirm(null);
        setMessage(result.message);
        await load();
      }
    });
  }

  return (
    <>
      <Header title="Solicitações" action={<button className="btn-primary" onClick={onNew}>Criar solicitação</button>} />
      {message && <p className="mb-4 rounded-2xl bg-emerald-50 p-3 font-bold text-emerald-800">{message}</p>}
      <div className="card overflow-auto">
        <table className="w-full text-left text-sm">
          <thead><tr><th>Código</th><th>Loja</th><th>Semana de referência</th><th>Data do pedido</th><th>Recebimento desejado</th><th>Status</th><th>Itens</th><th>Ações</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr className="border-t" key={r.id}>
                <td className="py-3 font-bold">{r.request_code}</td>
                <td>{r.store?.name}</td>
                <td>{r.reference_week}</td>
                <td>{fmtShortDate(r.request_date)}</td>
                <td>{fmtShortDate(r.desired_receipt_date)}</td>
                <td>{statusLabel[r.status] ?? r.status}</td>
                <td>{r.items.length}</td>
                <td className="flex gap-2 py-2">
                  <button className="btn-secondary" onClick={() => onOpen(r.id)}>Ver detalhes</button>
                  {user.role === "MANAGER" && <button className="btn-danger inline-flex items-center gap-2" onClick={() => askDelete(r)}><Trash2 size={16} /> Apagar</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="py-4">Nenhuma solicitação encontrada para {user.role === "SUPERVISOR" ? "sua loja" : "exibir"}.</p>}
      </div>
      {confirm && <ConfirmModal confirm={confirm} onCancel={() => setConfirm(null)} />}
    </>
  );
}

function NewRequest({ user, onSaved }: { user: User; onSaved: (id: number) => void }) {
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState({ request_date: new Date().toISOString().slice(0, 10), reference_week: "", store_id: user.store_id ?? 0, responsible_name: user.name, desired_receipt_date: "" });
  const [items, setItems] = useState<any[]>([{ product_name: "", package_weight: 0, unit: "g", requested_quantity: 1, current_store_stock: 0, ideal_stock: 0 }]);
  const [msg, setMsg] = useState("");
  useEffect(() => { api<Store[]>("/stores").then(setStores); api<Product[]>("/products").then(setProducts); }, []);

  function updateItem(index: number, key: string, value: unknown) {
    const next = [...items];
    next[index] = { ...next[index], [key]: value };
    setItems(next);
  }

  function selectProduct(index: number, id: string) {
    const product = products.find((p) => p.id === Number(id));
    if (!product) return;
    const next = [...items];
    next[index] = { ...next[index], product_id: product.id, product_name: product.name, package_weight: product.package_weight, unit: product.unit };
    setItems(next);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      const saved = await api<RequestRecord>("/requests", { method: "POST", body: JSON.stringify({ ...form, items }) });
      onSaved(saved.id);
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  return (
    <>
      <Header title="Criar solicitação" />
      <form onSubmit={submit} className="space-y-5">
        <div className="card grid gap-3 md:grid-cols-3">
          <Field label="Data do pedido" help="Informe a data em que a solicitação está sendo registrada.">
            <input type="date" value={form.request_date} onChange={(e) => setForm({ ...form, request_date: e.target.value })} />
          </Field>
          <Field label="Semana de referência" help="Informe o período da semana para o qual os produtos estão sendo solicitados.">
            <input placeholder="Exemplo: 26/05/2026 a 01/06/2026" value={form.reference_week} onChange={(e) => setForm({ ...form, reference_week: e.target.value })} />
          </Field>
          <Field label="Loja" help="Escolha a loja que receberá os produtos.">
            <select value={form.store_id} disabled={user.role === "SUPERVISOR"} onChange={(e) => setForm({ ...form, store_id: Number(e.target.value) })}><option value={0}>Selecione a loja</option>{stores.map((s) => <option value={s.id} key={s.id}>{s.name}</option>)}</select>
          </Field>
          <Field label="Responsável pela solicitação" help="Informe o nome da pessoa que está solicitando os produtos.">
            <input placeholder="Exemplo: Ana Silva" value={form.responsible_name} onChange={(e) => setForm({ ...form, responsible_name: e.target.value })} />
          </Field>
          <Field label="Data desejada para recebimento" help="Informe a data em que a loja deseja receber os produtos.">
            <input type="date" value={form.desired_receipt_date} onChange={(e) => setForm({ ...form, desired_receipt_date: e.target.value })} />
          </Field>
        </div>

        <div className="card space-y-3">
          <h3 className="font-display text-xl font-black">Produtos solicitados</h3>
          {items.map((item, index) => (
            <div className="grid gap-3 rounded-3xl bg-white p-4 md:grid-cols-4" key={index}>
              <Field label="Produto cadastrado" help="Selecione um produto existente, se ele já estiver cadastrado.">
                <select onChange={(e) => selectProduct(index, e.target.value)}><option value="">Produto cadastrado</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              </Field>
              <Field label="Nome do produto" help="Informe o nome do produto solicitado pela loja.">
                <input placeholder="Exemplo: Produto A" value={item.product_name} onChange={(e) => updateItem(index, "product_name", e.target.value)} />
              </Field>
              <Field label="Peso/embalagem" help="Informe o peso de cada embalagem. A unidade será escolhida no campo ao lado.">
                <input type="number" placeholder="Exemplo: 500" value={item.package_weight} onChange={(e) => updateItem(index, "package_weight", Number(e.target.value))} />
              </Field>
              <Field label="Unidade de medida" help="Escolha a unidade correspondente ao peso ou tipo de embalagem.">
                <select value={item.unit} onChange={(e) => updateItem(index, "unit", e.target.value)}>{units.map((u) => <option key={u}>{u}</option>)}</select>
              </Field>
              <Field label="Quantidade solicitada" help="Informe a quantidade de embalagens ou unidades solicitadas pela loja.">
                <input type="number" placeholder="Exemplo: 40" value={item.requested_quantity} onChange={(e) => updateItem(index, "requested_quantity", Number(e.target.value))} />
              </Field>
              <Field label="Estoque atual da loja" help="Informe quantas unidades a loja possui atualmente.">
                <input type="number" placeholder="Exemplo: 8" value={item.current_store_stock} onChange={(e) => updateItem(index, "current_store_stock", Number(e.target.value))} />
              </Field>
              <Field label="Estoque ideal" help="Informe a quantidade ideal que a loja deveria ter em estoque.">
                <input type="number" placeholder="Exemplo: 50" value={item.ideal_stock} onChange={(e) => updateItem(index, "ideal_stock", Number(e.target.value))} />
              </Field>
              <div className="grid gap-1">
                <span className="text-sm font-black text-ink">Quantidade sugerida</span>
                <div className="rounded-2xl bg-moss/10 px-3 py-2 font-black text-moss">{Math.max(0, item.ideal_stock - item.current_store_stock)}</div>
                <span className="text-xs leading-snug text-stone-500">Calculada automaticamente com base no estoque ideal menos o estoque atual.</span>
              </div>
              <button type="button" className="btn-danger md:col-span-4" onClick={() => setItems(items.filter((_, i) => i !== index))}>Remover produto</button>
            </div>
          ))}
          <button type="button" className="btn-secondary" disabled={items.length >= 100} onClick={() => setItems([...items, { product_name: "", package_weight: 0, unit: "g", requested_quantity: 1, current_store_stock: 0, ideal_stock: 0 }])}>Adicionar produto</button>
        </div>
        {msg && <p className="rounded-2xl bg-red-50 p-3 text-red-700">{msg}</p>}
        <button className="btn-primary w-full md:w-auto">Salvar solicitação</button>
      </form>
    </>
  );
}

function RequestDetail({ id, user, onDeleted }: { id: number; user: User; onDeleted: (message: string) => void }) {
  const [req, setReq] = useState<RequestRecord>();
  const [msg, setMsg] = useState("");
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const load = () => api<RequestRecord>(`/requests/${id}`).then(setReq);
  useEffect(() => { void load(); }, [id]);
  if (!req) return <p>Carregando...</p>;
  const canGenerate = user.role === "MANAGER" && !req.productions?.length;

  function askDelete() {
    setConfirm({
      title: "Confirmar exclusão",
      message: "Tem certeza de que deseja apagar esta solicitação? Essa ação não poderá ser desfeita.",
      warning: req?.productions?.length ? "Esta solicitação possui produções vinculadas. Ao apagá-la, as produções relacionadas também serão removidas." : undefined,
      confirmLabel: "Apagar solicitação",
      onConfirm: async () => {
        const result = await api<{ message: string }>(`/requests/${id}`, { method: "DELETE" });
        setMsg(result.message);
        setConfirm(null);
        onDeleted(result.message);
      }
    });
  }

  return (
    <>
      <Header title={`Solicitação ${req.request_code}`} action={<div className="flex flex-wrap gap-2">{canGenerate && <button className="btn-primary" onClick={() => api(`/requests/${id}/generate-productions`, { method: "POST" }).then(load).catch((err) => setMsg((err as Error).message))}>Gerar produções</button>}{user.role === "MANAGER" && <button className="btn-danger inline-flex items-center gap-2" onClick={askDelete}><Trash2 size={16} /> Apagar solicitação</button>}</div>} />
      <div className="card mb-5">
        <p><strong>Loja:</strong> {req.store.name}</p>
        <p><strong>Semana de referência:</strong> {req.reference_week}</p>
        <p><strong>Data do pedido:</strong> {fmtShortDate(req.request_date)}</p>
        <p><strong>Recebimento desejado:</strong> {fmtShortDate(req.desired_receipt_date)}</p>
        <p><strong>Status:</strong> {statusLabel[req.status] ?? req.status}</p>
        {msg && <p className="text-red-700">{msg}</p>}
      </div>
      <DataTable rows={req.items} cols={["product_name", "package_weight", "unit", "requested_quantity", "current_store_stock", "ideal_stock", "suggested_quantity"]} />
      {Boolean(req.productions?.length) && <div className="mt-5"><DataTable rows={req.productions ?? []} cols={["production_code", "product_name", "production_quantity", "status"]} /></div>}
      {confirm && <ConfirmModal confirm={confirm} onCancel={() => setConfirm(null)} />}
    </>
  );
}

function Productions() {
  const [rows, setRows] = useState<Production[]>([]);
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const load = () => api<Production[]>("/productions").then(setRows);
  useEffect(() => { void load(); }, []);

  function askDelete(production: Production) {
    setConfirm({
      title: "Confirmar exclusão",
      message: "Tem certeza de que deseja apagar esta produção? Essa ação não poderá ser desfeita.",
      confirmLabel: "Apagar produção",
      onConfirm: async () => {
        const result = await api<{ message: string }>(`/productions/${production.id}`, { method: "DELETE" });
        setConfirm(null);
        setMessage(result.message);
        await load();
      }
    });
  }

  return (
    <>
      <Header title="Produções" />
      {message && <p className="mb-4 rounded-2xl bg-emerald-50 p-3 font-bold text-emerald-800">{message}</p>}
      <div className="card overflow-auto">
        <table className="w-full text-left text-sm">
          <thead><tr><th>Código</th><th>Loja</th><th>Produto</th><th>Peso/embalagem</th><th>Quantidade</th><th>Operador</th><th>Status</th><th>Início</th><th>Finalização</th><th>Tempo bruto</th><th>Tempo pausado</th><th>Tempo líquido</th><th>Ações</th></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr className="border-t" key={p.id}>
                <td className="py-3 font-bold">{p.production_code}</td>
                <td>{p.store.name}</td>
                <td>{p.product_name}</td>
                <td>{p.package_weight} {p.unit}</td>
                <td>{p.production_quantity}</td>
                <td>{p.operator.name}</td>
                <td>{statusLabel[p.status] ?? p.status}</td>
                <td>{fmtDate(p.started_at)}</td>
                <td>{fmtDate(p.finished_at)}</td>
                <td>{p.gross_time_minutes ?? "-"}</td>
                <td>{p.paused_time_minutes ?? "-"}</td>
                <td>{p.net_time_minutes ?? "-"}</td>
                <td className="flex gap-2 py-2">
                  {p.status !== "CANCELED" && <button className="btn-secondary" onClick={() => api(`/productions/${p.id}/cancel`, { method: "POST" }).then(load)}>Cancelar produção</button>}
                  <button className="btn-danger inline-flex items-center gap-2" onClick={() => askDelete(p)}><Trash2 size={16} /> Apagar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="py-4 text-stone-600">Nenhuma produção encontrada.</p>}
      </div>
      {confirm && <ConfirmModal confirm={confirm} onCancel={() => setConfirm(null)} />}
    </>
  );
}

function Queue() {
  const [rows, setRows] = useState<Production[]>([]);
  const [pauseId, setPauseId] = useState<number | null>(null);
  const load = () => api<Production[]>("/productions/my-queue").then(setRows);
  useEffect(() => { void load(); }, []);
  const act = (id: number, action: string, body?: any) => api(`/productions/${id}/${action}`, { method: "POST", body: JSON.stringify(body ?? {}) }).then(() => { setPauseId(null); load(); });

  return (
    <>
      <div className="mb-5">
        <p className="text-sm font-black uppercase tracking-[0.22em] text-clay">Operador</p>
        <h2 className="font-display text-4xl font-black leading-tight sm:text-5xl">Minha Fila</h2>
        <p className="mt-2 max-w-xl text-base text-stone-600">Toque em uma ação grande para atualizar somente as produções atribuídas a você.</p>
      </div>

      {!rows.length && (
        <div className="card text-center">
          <Package className="mx-auto mb-3 text-stone-400" size={42} />
          <h3 className="font-display text-2xl font-black">Fila vazia</h3>
          <p className="text-stone-600">Nenhuma produção atribuída para este operador no momento.</p>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((p) => (
          <article className="overflow-hidden rounded-[2rem] border border-white bg-paper shadow-soft" key={p.id}>
            <div className={`flex items-center justify-between gap-3 border-b px-5 py-4 ${statusTone[p.status] ?? "border-stone-200 bg-white text-ink"}`}>
              <span className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-wide">
                {p.status === "IN_PROGRESS" && <Play size={18} />}
                {p.status === "PAUSED" && <PauseCircle size={18} />}
                {p.status === "PRODUCED" && <CheckCircle2 size={18} />}
                {p.status === "PENDING" && <TimerReset size={18} />}
                {statusLabel[p.status] ?? p.status}
              </span>
              <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-black">{p.production_code}</span>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-stone-500">Produto</p>
                <h3 className="font-display text-3xl font-black leading-none sm:text-4xl">{p.product_name}</h3>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-3xl bg-white p-4">
                  <p className="text-xs font-black uppercase tracking-widest text-stone-500">Quantidade</p>
                  <p className="mt-1 text-4xl font-black leading-none text-clay">{p.production_quantity}</p>
                </div>
                <div className="rounded-3xl bg-white p-4">
                  <p className="text-xs font-black uppercase tracking-widest text-stone-500">Embalagem</p>
                  <p className="mt-1 text-2xl font-black">{p.package_weight} {p.unit}</p>
                </div>
              </div>

              <div className="rounded-3xl bg-moss/10 p-4">
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-moss"><MapPin size={16} /> Loja de destino</p>
                <p className="mt-1 text-xl font-black">{p.store.name}</p>
                <p className="text-sm text-stone-600">Semana: {p.request.reference_week}</p>
              </div>

              <div className="grid gap-3">
                {p.status === "PENDING" && <button className="min-h-16 rounded-3xl bg-ink px-5 py-4 text-xl font-black text-white shadow-soft hover:bg-clay" onClick={() => act(p.id, "start")}>Iniciar produção</button>}
                {p.status === "IN_PROGRESS" && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button className="min-h-16 rounded-3xl bg-white px-5 py-4 text-xl font-black text-ink ring-2 ring-stone-200 hover:bg-stone-50" onClick={() => setPauseId(p.id)}>Pausar</button>
                    <button className="min-h-16 rounded-3xl bg-moss px-5 py-4 text-xl font-black text-white shadow-soft hover:bg-ink" onClick={() => act(p.id, "finish")}>Finalizar produção</button>
                  </div>
                )}
                {p.status === "PAUSED" && <button className="min-h-16 rounded-3xl bg-clay px-5 py-4 text-xl font-black text-white shadow-soft hover:bg-ink" onClick={() => act(p.id, "resume")}>Retomar</button>}
                {p.status === "PRODUCED" && <div className="rounded-3xl bg-emerald-50 p-4 font-black text-emerald-800">Produção finalizada. Sem ações pendentes.</div>}
              </div>

              <section className="rounded-3xl bg-white p-4">
                <h4 className="mb-2 font-display text-lg font-black">Histórico de pausas</h4>
                {p.pauses.length ? (
                  <div className="space-y-2">
                    {p.pauses.map((pause) => (
                      <div className="rounded-2xl bg-stone-50 p-3 text-sm" key={pause.id}>
                        <p className="font-black">{valueLabel[pause.reason] ?? pause.reason}</p>
                        <p className="text-stone-600">{fmtDate(pause.pause_started_at)} até {fmtDate(pause.pause_finished_at)}</p>
                        <p className="font-bold text-stone-700">{pause.duration_minutes ?? "-"} min</p>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-stone-500">Sem pausas registradas.</p>}
              </section>
            </div>
          </article>
        ))}
      </div>

      {pauseId && (
        <div className="fixed inset-0 z-20 grid place-items-end bg-black/50 p-3 sm:place-items-center sm:p-4">
          <div className="card w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem]">
            <h3 className="mb-1 font-display text-3xl font-black">Motivo da pausa</h3>
            <p className="mb-4 text-stone-600">Selecione o motivo da pausa antes de confirmar.</p>
            <div className="grid gap-3">
              {pauseReasons.map(([value]) => (
                <button className="min-h-14 rounded-3xl bg-white px-5 py-4 text-left text-lg font-black text-ink ring-1 ring-stone-200 hover:bg-stone-50" key={value} onClick={() => act(pauseId, "pause", { reason: value })}>
                  {valueLabel[value]}
                </button>
              ))}
            </div>
            <button className="mt-4 min-h-12 w-full rounded-3xl font-black text-stone-600" onClick={() => setPauseId(null)}>Cancelar</button>
          </div>
        </div>
      )}
    </>
  );
}
