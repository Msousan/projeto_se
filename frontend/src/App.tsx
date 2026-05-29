import { useEffect, useState } from "react";
import { ClipboardList, Factory, LayoutDashboard, LogOut, Package, Play, Store as StoreIcon, Users } from "lucide-react";
import { api, Operator, pauseReasons, Product, Production, RequestRecord, Store, tokenStore, units, User } from "./api";

type Page = "dashboard" | "stores" | "operators" | "products" | "requests" | "new-request" | "request-detail" | "productions" | "queue";
const fmtDate = (value?: string | null) => value ? new Date(value).toLocaleString("pt-BR") : "-";
const statusLabel: Record<string, string> = {
  PENDING: "Pendente", IN_PROGRESS: "Em andamento", PAUSED: "Pausada", PRODUCED: "Finalizada", CANCELED: "Cancelada",
  REQUESTED: "Solicitada", IN_PRODUCTION: "Em producao", FINISHED: "Finalizada"
};

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [page, setPage] = useState<Page>("dashboard");
  const [selectedRequest, setSelectedRequest] = useState<number | null>(null);

  useEffect(() => {
    if (!tokenStore.get()) return;
    api<User>("/auth/me").then((me) => {
      setUser(me);
      setPage(me.role === "OPERATOR" ? "queue" : "dashboard");
    }).catch(() => tokenStore.clear());
  }, []);

  if (!user) return <Login onLogin={(next) => { setUser(next); setPage(next.role === "OPERATOR" ? "queue" : "dashboard"); }} />;

  const nav = [
    user.role === "MANAGER" && ["dashboard", "Dashboard", LayoutDashboard],
    user.role === "MANAGER" && ["stores", "Lojas", StoreIcon],
    user.role === "MANAGER" && ["operators", "Operadores", Users],
    user.role === "MANAGER" && ["products", "Produtos", Package],
    user.role !== "OPERATOR" && ["requests", "Solicitacoes", ClipboardList],
    user.role === "MANAGER" && ["productions", "Producoes", Factory],
    user.role === "OPERATOR" && ["queue", "Minha Fila", Play]
  ].filter(Boolean) as [Page, string, typeof LayoutDashboard][];

  return (
    <div className="min-h-screen lg:flex">
      <aside className="sticky top-0 z-10 border-b border-white/70 bg-paper/90 p-4 backdrop-blur lg:h-screen lg:w-72 lg:border-b-0 lg:border-r">
        <div className="mb-5">
          <h1 className="font-display text-2xl font-black">Produzir</h1>
          <p className="text-sm text-stone-600">{user.name} - {user.role}</p>
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
        {page === "requests" && <Requests user={user} onNew={() => setPage("new-request")} onOpen={(id) => { setSelectedRequest(id); setPage("request-detail"); }} />}
        {page === "new-request" && <NewRequest user={user} onSaved={(id) => { setSelectedRequest(id); setPage("request-detail"); }} />}
        {page === "request-detail" && selectedRequest && <RequestDetail id={selectedRequest} user={user} />}
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
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const data = await api<{ token: string; user: User }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      tokenStore.set(data.token);
      onLogin(data.user);
    } catch (err) { setError((err as Error).message); }
  }
  return (
    <div className="grid min-h-screen place-items-center p-4">
      <form onSubmit={submit} className="card w-full max-w-md space-y-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-clay">MVP local</p>
          <h1 className="font-display text-4xl font-black">Controle de solicitacoes e producoes</h1>
        </div>
        <input className="w-full" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" />
        <input className="w-full" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="senha" />
        {error && <p className="rounded-2xl bg-red-50 p-3 text-red-700">{error}</p>}
        <button className="btn-primary w-full">Entrar</button>
        <p className="text-sm text-stone-600">Teste: gestor@empresa.com, supervisora1@empresa.com, joao@empresa.com ou maria@empresa.com. Senha 123456.</p>
      </form>
    </div>
  );
}

function Header({ title, action }: { title: string; action?: React.ReactNode }) {
  return <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="font-display text-3xl font-black">{title}</h2>{action}</div>;
}

function Dashboard() {
  const [data, setData] = useState<any>();
  useEffect(() => { api("/dashboard/manager").then(setData); }, []);
  if (!data) return <p>Carregando dashboard...</p>;
  const cards = [
    ["Solicitacoes", data.cards.totalRequests], ["Semana", data.cards.weekRequests], ["Pendentes", data.cards.pending],
    ["Andamento", data.cards.inProgress], ["Pausadas", data.cards.paused], ["Finalizadas", data.cards.produced], ["Operadores ativos", data.cards.activeOperators]
  ];
  return <><Header title="Dashboard do gestor" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value]) => <div className="card" key={label}><p className="text-sm font-bold text-stone-500">{label}</p><strong className="text-4xl">{value}</strong></div>)}</div><div className="mt-6 grid gap-4 xl:grid-cols-3"><SimpleTable title="Producoes por operador" rows={data.byOperator} cols={["operator", "status", "_count"]} /><SimpleTable title="Producoes por loja" rows={data.byStore} cols={["store", "status", "_count"]} /><SimpleTable title="Ultimas solicitacoes" rows={data.latestRequests} cols={["request_code", "reference_week", "status"]} /></div></>;
}

function SimpleTable({ title, rows, cols }: { title: string; rows: any[]; cols: string[] }) {
  return <div className="card overflow-auto"><h3 className="mb-3 font-display text-xl font-black">{title}</h3><table className="w-full text-left text-sm"><tbody>{rows.map((row, i) => <tr className="border-t" key={i}>{cols.map((c) => <td className="py-2 pr-3" key={c}>{c === "_count" ? row[c] : row[c]}</td>)}</tr>)}</tbody></table></div>;
}

function Stores() {
  const [rows, setRows] = useState<Store[]>([]);
  const [form, setForm] = useState({ name: "", distance_km: 0, logistics_type: "PROXIMA", active: true });
  const load = () => api<Store[]>("/stores").then(setRows);
  useEffect(() => { void load(); }, []);
  return <Crud title="Cadastro de lojas" onSubmit={() => api("/stores", { method: "POST", body: JSON.stringify(form) }).then(load)}>
    <input placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><input type="number" placeholder="Distancia km" value={form.distance_km} onChange={(e) => setForm({ ...form, distance_km: Number(e.target.value) })} /><select value={form.logistics_type} onChange={(e) => setForm({ ...form, logistics_type: e.target.value })}><option>PROXIMA</option><option>DISTANTE</option></select>
    <Table rows={rows} cols={["name", "distance_km", "logistics_type", "active"]} toggle={(row) => api(`/stores/${row.id}/deactivate`, { method: "PATCH", body: JSON.stringify({ active: !row.active }) }).then(load)} />
  </Crud>;
}

function Operators() {
  const [rows, setRows] = useState<Operator[]>([]);
  const [form, setForm] = useState({ name: "", email: "", sector: "Producao", status: "ACTIVE", daily_capacity: 30, observation: "" });
  const load = () => api<Operator[]>("/operators").then(setRows);
  useEffect(() => { void load(); }, []);
  return <Crud title="Cadastro de operadores" onSubmit={() => api("/operators", { method: "POST", body: JSON.stringify(form) }).then(load)}>
    <input placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /><input placeholder="Setor" value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} /><input type="number" value={form.daily_capacity} onChange={(e) => setForm({ ...form, daily_capacity: Number(e.target.value) })} />
    <Table rows={rows} cols={["name", "email", "sector", "status", "daily_capacity"]} toggle={(row) => api(`/operators/${row.id}/status`, { method: "PATCH", body: JSON.stringify({ status: row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }) }).then(load)} />
  </Crud>;
}

function Products() {
  const [rows, setRows] = useState<Product[]>([]);
  const [form, setForm] = useState({ name: "", package_weight: 0, unit: "g", category: "", average_time_minutes: 5, active: true, observation: "" });
  const load = () => api<Product[]>("/products").then(setRows);
  useEffect(() => { void load(); }, []);
  return <Crud title="Cadastro de produtos" onSubmit={() => api("/products", { method: "POST", body: JSON.stringify(form) }).then(load)}>
    <input placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><input type="number" placeholder="Peso" value={form.package_weight} onChange={(e) => setForm({ ...form, package_weight: Number(e.target.value) })} /><select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>{units.map((u) => <option key={u}>{u}</option>)}</select><input placeholder="Categoria" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /><input type="number" value={form.average_time_minutes} onChange={(e) => setForm({ ...form, average_time_minutes: Number(e.target.value) })} />
    <Table rows={rows} cols={["name", "package_weight", "unit", "category", "average_time_minutes", "active"]} toggle={(row) => api(`/products/${row.id}/status`, { method: "PATCH", body: JSON.stringify({ active: !row.active }) }).then(load)} />
  </Crud>;
}

function Crud({ title, onSubmit, children }: { title: string; onSubmit: () => Promise<unknown>; children: React.ReactNode }) {
  const [msg, setMsg] = useState("");
  const kids = Array.isArray(children) ? children : [children];
  return <><Header title={title} /><form className="card mb-5 grid gap-3 md:grid-cols-3" onSubmit={(e) => { e.preventDefault(); onSubmit().then(() => setMsg("Salvo com sucesso.")).catch((err) => setMsg((err as Error).message)); }}>{kids.slice(0, -1)}<button className="btn-primary">Salvar</button>{msg && <p className="md:col-span-3">{msg}</p>}</form>{kids.at(-1)}</>;
}

function Table({ rows, cols, toggle }: { rows: any[]; cols: string[]; toggle?: (row: any) => void }) {
  return <div className="card overflow-auto"><table className="w-full text-left text-sm"><thead><tr>{cols.map((c) => <th className="pb-2 pr-4" key={c}>{c}</th>)}{toggle && <th>Ação</th>}</tr></thead><tbody>{rows.map((row) => <tr className="border-t" key={row.id}>{cols.map((c) => <td className="py-3 pr-4" key={c}>{String(row[c])}</td>)}{toggle && <td><button className="btn-secondary" onClick={() => toggle(row)}>Alternar</button></td>}</tr>)}</tbody></table></div>;
}

function Requests({ user, onNew, onOpen }: { user: User; onNew: () => void; onOpen: (id: number) => void }) {
  const [rows, setRows] = useState<RequestRecord[]>([]);
  useEffect(() => { api<RequestRecord[]>("/requests").then(setRows); }, []);
  return <><Header title="Solicitacoes" action={<button className="btn-primary" onClick={onNew}>Criar solicitacao</button>} /><div className="card overflow-auto"><table className="w-full text-left text-sm"><tbody>{rows.map((r) => <tr className="border-t" key={r.id}><td className="py-3 font-bold">{r.request_code}</td><td>{r.store?.name}</td><td>{r.reference_week}</td><td>{statusLabel[r.status] ?? r.status}</td><td>{r.items.length} itens</td><td><button className="btn-secondary" onClick={() => onOpen(r.id)}>Detalhes</button></td></tr>)}</tbody></table>{!rows.length && <p>Nenhuma solicitacao encontrada para {user.role === "SUPERVISOR" ? "sua loja" : "exibir"}.</p>}</div></>;
}

function NewRequest({ user, onSaved }: { user: User; onSaved: (id: number) => void }) {
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState({ request_date: new Date().toISOString().slice(0, 10), reference_week: "", store_id: user.store_id ?? 0, responsible_name: user.name, desired_receipt_date: "" });
  const [items, setItems] = useState<any[]>([{ product_name: "", package_weight: 0, unit: "g", requested_quantity: 1, current_store_stock: 0, ideal_stock: 0 }]);
  const [msg, setMsg] = useState("");
  useEffect(() => { api<Store[]>("/stores").then(setStores); api<Product[]>("/products").then(setProducts); }, []);
  function selectProduct(index: number, id: string) {
    const product = products.find((p) => p.id === Number(id));
    if (!product) return;
    const next = [...items];
    next[index] = { ...next[index], product_id: product.id, product_name: product.name, package_weight: product.package_weight, unit: product.unit };
    setItems(next);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const saved = await api<RequestRecord>("/requests", { method: "POST", body: JSON.stringify({ ...form, items }) });
      onSaved(saved.id);
    } catch (err) { setMsg((err as Error).message); }
  }
  return <><Header title="Criar solicitacao" /><form onSubmit={submit} className="space-y-5"><div className="card grid gap-3 md:grid-cols-3"><input type="date" value={form.request_date} onChange={(e) => setForm({ ...form, request_date: e.target.value })} /><input placeholder="Semana de referencia" value={form.reference_week} onChange={(e) => setForm({ ...form, reference_week: e.target.value })} /><select value={form.store_id} disabled={user.role === "SUPERVISOR"} onChange={(e) => setForm({ ...form, store_id: Number(e.target.value) })}><option value={0}>Selecione a loja</option>{stores.map((s) => <option value={s.id} key={s.id}>{s.name}</option>)}</select><input placeholder="Responsavel" value={form.responsible_name} onChange={(e) => setForm({ ...form, responsible_name: e.target.value })} /><input type="date" value={form.desired_receipt_date} onChange={(e) => setForm({ ...form, desired_receipt_date: e.target.value })} /></div><div className="card space-y-3"><h3 className="font-display text-xl font-black">Produtos solicitados</h3>{items.map((item, index) => <div className="grid gap-2 rounded-3xl bg-white p-3 md:grid-cols-8" key={index}><select onChange={(e) => selectProduct(index, e.target.value)}><option>Produto cadastrado</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select><input placeholder="Nome" value={item.product_name} onChange={(e) => { const n = [...items]; n[index].product_name = e.target.value; setItems(n); }} /><input type="number" placeholder="Peso" value={item.package_weight} onChange={(e) => { const n = [...items]; n[index].package_weight = Number(e.target.value); setItems(n); }} /><select value={item.unit} onChange={(e) => { const n = [...items]; n[index].unit = e.target.value; setItems(n); }}>{units.map((u) => <option key={u}>{u}</option>)}</select><input type="number" placeholder="Qtd" value={item.requested_quantity} onChange={(e) => { const n = [...items]; n[index].requested_quantity = Number(e.target.value); setItems(n); }} /><input type="number" placeholder="Estoque atual" value={item.current_store_stock} onChange={(e) => { const n = [...items]; n[index].current_store_stock = Number(e.target.value); setItems(n); }} /><input type="number" placeholder="Estoque ideal" value={item.ideal_stock} onChange={(e) => { const n = [...items]; n[index].ideal_stock = Number(e.target.value); setItems(n); }} /><div className="flex items-center justify-between gap-2"><strong>Sug. {Math.max(0, item.ideal_stock - item.current_store_stock)}</strong><button type="button" className="btn-danger" onClick={() => setItems(items.filter((_, i) => i !== index))}>Remover</button></div></div>)}<button type="button" className="btn-secondary" disabled={items.length >= 100} onClick={() => setItems([...items, { product_name: "", package_weight: 0, unit: "g", requested_quantity: 1, current_store_stock: 0, ideal_stock: 0 }])}>Adicionar produto</button></div>{msg && <p className="rounded-2xl bg-red-50 p-3 text-red-700">{msg}</p>}<button className="btn-primary w-full md:w-auto">Salvar solicitacao</button></form></>;
}

function RequestDetail({ id, user }: { id: number; user: User }) {
  const [req, setReq] = useState<RequestRecord>();
  const [msg, setMsg] = useState("");
  const load = () => api<RequestRecord>(`/requests/${id}`).then(setReq);
  useEffect(() => { void load(); }, [id]);
  if (!req) return <p>Carregando...</p>;
  const canGenerate = user.role === "MANAGER" && !req.productions?.length;
  return <><Header title={`Solicitacao ${req.request_code}`} action={canGenerate && <button className="btn-primary" onClick={() => api(`/requests/${id}/generate-productions`, { method: "POST" }).then(load).catch((err) => setMsg((err as Error).message))}>Gerar producoes</button>} /><div className="card mb-5"><p><strong>Loja:</strong> {req.store.name}</p><p><strong>Semana:</strong> {req.reference_week}</p><p><strong>Status:</strong> {statusLabel[req.status] ?? req.status}</p>{msg && <p className="text-red-700">{msg}</p>}</div><Table rows={req.items} cols={["product_name", "package_weight", "unit", "requested_quantity", "current_store_stock", "ideal_stock", "suggested_quantity"]} />{Boolean(req.productions?.length) && <div className="mt-5"><Table rows={req.productions ?? []} cols={["production_code", "product_name", "production_quantity", "status"]} /></div>}</>;
}

function Productions() {
  const [rows, setRows] = useState<Production[]>([]);
  const load = () => api<Production[]>("/productions").then(setRows);
  useEffect(() => { void load(); }, []);
  return <><Header title="Producoes" /><div className="card overflow-auto"><table className="w-full text-left text-sm"><tbody>{rows.map((p) => <tr className="border-t" key={p.id}><td className="py-3 font-bold">{p.production_code}</td><td>{p.store.name}</td><td>{p.product_name}</td><td>{p.production_quantity} {p.unit}</td><td>{p.operator.name}</td><td>{statusLabel[p.status] ?? p.status}</td><td>{fmtDate(p.started_at)}</td><td>{fmtDate(p.finished_at)}</td><td>{p.gross_time_minutes ?? "-"}</td><td>{p.paused_time_minutes ?? "-"}</td><td>{p.net_time_minutes ?? "-"}</td><td>{p.status !== "CANCELED" && <button className="btn-danger" onClick={() => api(`/productions/${p.id}/cancel`, { method: "POST" }).then(load)}>Cancelar</button>}</td></tr>)}</tbody></table></div></>;
}

function Queue() {
  const [rows, setRows] = useState<Production[]>([]);
  const [pauseId, setPauseId] = useState<number | null>(null);
  const load = () => api<Production[]>("/productions/my-queue").then(setRows);
  useEffect(() => { void load(); }, []);
  const act = (id: number, action: string, body?: any) => api(`/productions/${id}/${action}`, { method: "POST", body: JSON.stringify(body ?? {}) }).then(() => { setPauseId(null); load(); });
  return <><Header title="Minha Fila" /><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{rows.map((p) => <div className="card space-y-3" key={p.id}><div><span className="rounded-full bg-moss/10 px-3 py-1 text-xs font-black text-moss">{statusLabel[p.status] ?? p.status}</span><h3 className="mt-3 font-display text-2xl font-black">{p.product_name}</h3><p>{p.package_weight} {p.unit} - quantidade {p.production_quantity}</p><p className="text-stone-600">{p.store.name} - {p.request.reference_week}</p></div><div className="flex flex-wrap gap-2">{p.status === "PENDING" && <button className="btn-primary flex-1" onClick={() => act(p.id, "start")}>Iniciar Producao</button>}{p.status === "IN_PROGRESS" && <><button className="btn-secondary flex-1" onClick={() => setPauseId(p.id)}>Pausar</button><button className="btn-primary flex-1" onClick={() => act(p.id, "finish")}>Finalizar</button></>}{p.status === "PAUSED" && <button className="btn-primary flex-1" onClick={() => act(p.id, "resume")}>Retomar</button>}{p.status === "PRODUCED" && <p className="font-bold text-moss">Producao finalizada.</p>}</div><div className="rounded-2xl bg-white p-3"><strong>Historico de pausas</strong>{p.pauses.length ? p.pauses.map((pause) => <p className="text-sm" key={pause.id}>{pause.reason}: {fmtDate(pause.pause_started_at)} ate {fmtDate(pause.pause_finished_at)} ({pause.duration_minutes ?? "-"} min)</p>) : <p className="text-sm text-stone-500">Sem pausas.</p>}</div></div>)}</div>{pauseId && <div className="fixed inset-0 grid place-items-end bg-black/40 p-4 sm:place-items-center"><div className="card w-full max-w-md"><h3 className="mb-3 font-display text-2xl font-black">Motivo da pausa</h3><div className="grid gap-2">{pauseReasons.map(([value, label]) => <button className="btn-secondary text-left" key={value} onClick={() => act(pauseId, "pause", { reason: value })}>{label}</button>)}</div><button className="mt-3 w-full text-stone-600" onClick={() => setPauseId(null)}>Cancelar</button></div></div>}</>;
}
