import "dotenv/config";
import bcrypt from "bcryptjs";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();
const app = express();
const jwtSecret = process.env.JWT_SECRET ?? "dev-secret";

app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));

type AuthUser = { id: number; role: Role; operator_id: number | null; store_id: number | null; name: string; email: string };
type Role = "MANAGER" | "SUPERVISOR" | "OPERATOR";
type ProductionStatus = "PENDING" | "IN_PROGRESS" | "PAUSED" | "PRODUCED" | "CANCELED";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => void fn(req, res, next).catch(next);

function minutesBetween(start: Date, end: Date) {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ message: "Token nao informado." });
  try {
    req.user = jwt.verify(token, jwtSecret) as AuthUser;
    next();
  } catch {
    res.status(401).json({ message: "Token invalido." });
  }
}

const allowRoles = (...roles: Role[]) => (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ message: "Acesso negado." });
  next();
};

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const idParam = z.object({ id: z.coerce.number().int().positive() });

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/auth/login", asyncHandler(async (req, res) => {
  const data = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user || !(await bcrypt.compare(data.password, user.password_hash))) {
    return res.status(401).json({ message: "Email ou senha invalidos." });
  }
  const payload: AuthUser = {
    id: user.id,
    role: user.role as Role,
    operator_id: user.operator_id,
    store_id: user.store_id,
    name: user.name,
    email: user.email
  };
  res.json({ token: jwt.sign(payload, jwtSecret, { expiresIn: "8h" }), user: payload });
}));

app.get("/auth/me", requireAuth, (req, res) => res.json(req.user));

app.get("/stores", requireAuth, asyncHandler(async (_req, res) => {
  res.json(await prisma.store.findMany({ orderBy: { name: "asc" } }));
}));

app.post("/stores", requireAuth, allowRoles("MANAGER"), asyncHandler(async (req, res) => {
  const data = z.object({
    name: z.string().min(1),
    distance_km: z.coerce.number().nonnegative(),
    logistics_type: z.enum(["PROXIMA", "DISTANTE"]),
    active: z.boolean().optional()
  }).parse(req.body);
  res.status(201).json(await prisma.store.create({ data }));
}));

app.put("/stores/:id", requireAuth, allowRoles("MANAGER"), asyncHandler(async (req, res) => {
  const { id } = idParam.parse(req.params);
  const data = z.object({
    name: z.string().min(1),
    distance_km: z.coerce.number().nonnegative(),
    logistics_type: z.enum(["PROXIMA", "DISTANTE"]),
    active: z.boolean()
  }).parse(req.body);
  res.json(await prisma.store.update({ where: { id }, data }));
}));

app.patch("/stores/:id/deactivate", requireAuth, allowRoles("MANAGER"), asyncHandler(async (req, res) => {
  const { id } = idParam.parse(req.params);
  const active = Boolean(req.body.active);
  res.json(await prisma.store.update({ where: { id }, data: { active } }));
}));

app.get("/operators", requireAuth, allowRoles("MANAGER"), asyncHandler(async (_req, res) => {
  res.json(await prisma.operator.findMany({ orderBy: { name: "asc" } }));
}));

app.post("/operators", requireAuth, allowRoles("MANAGER"), asyncHandler(async (req, res) => {
  const data = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    sector: z.string().min(1),
    status: z.enum(["ACTIVE", "INACTIVE", "VACATION", "AWAY"]).default("ACTIVE"),
    daily_capacity: z.coerce.number().int().positive(),
    observation: z.string().optional()
  }).parse(req.body);
  res.status(201).json(await prisma.operator.create({ data }));
}));

app.put("/operators/:id", requireAuth, allowRoles("MANAGER"), asyncHandler(async (req, res) => {
  const { id } = idParam.parse(req.params);
  const data = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    sector: z.string().min(1),
    status: z.enum(["ACTIVE", "INACTIVE", "VACATION", "AWAY"]),
    daily_capacity: z.coerce.number().int().positive(),
    observation: z.string().optional().nullable()
  }).parse(req.body);
  res.json(await prisma.operator.update({ where: { id }, data }));
}));

app.patch("/operators/:id/status", requireAuth, allowRoles("MANAGER"), asyncHandler(async (req, res) => {
  const { id } = idParam.parse(req.params);
  const { status } = z.object({ status: z.enum(["ACTIVE", "INACTIVE", "VACATION", "AWAY"]) }).parse(req.body);
  res.json(await prisma.operator.update({ where: { id }, data: { status } }));
}));

app.get("/products", requireAuth, asyncHandler(async (_req, res) => {
  res.json(await prisma.product.findMany({ orderBy: { name: "asc" } }));
}));

app.post("/products", requireAuth, allowRoles("MANAGER"), asyncHandler(async (req, res) => {
  const data = z.object({
    name: z.string().min(1),
    package_weight: z.coerce.number().positive(),
    unit: z.enum(["g", "kg", "unidade", "caixa", "pacote", "fardo"]),
    category: z.string().min(1),
    average_time_minutes: z.coerce.number().int().positive(),
    active: z.boolean().optional(),
    observation: z.string().optional()
  }).parse(req.body);
  res.status(201).json(await prisma.product.create({ data }));
}));

app.put("/products/:id", requireAuth, allowRoles("MANAGER"), asyncHandler(async (req, res) => {
  const { id } = idParam.parse(req.params);
  const data = z.object({
    name: z.string().min(1),
    package_weight: z.coerce.number().positive(),
    unit: z.enum(["g", "kg", "unidade", "caixa", "pacote", "fardo"]),
    category: z.string().min(1),
    average_time_minutes: z.coerce.number().int().positive(),
    active: z.boolean(),
    observation: z.string().optional().nullable()
  }).parse(req.body);
  res.json(await prisma.product.update({ where: { id }, data }));
}));

app.patch("/products/:id/status", requireAuth, allowRoles("MANAGER"), asyncHandler(async (req, res) => {
  const { id } = idParam.parse(req.params);
  const active = Boolean(req.body.active);
  res.json(await prisma.product.update({ where: { id }, data: { active } }));
}));

const requestInclude = {
  store: true,
  items: true,
  productions: { include: { operator: true } }
} satisfies Prisma.RequestInclude;

app.get("/requests", requireAuth, asyncHandler(async (req, res) => {
  const where: Prisma.RequestWhereInput = req.user?.role === "SUPERVISOR" ? { store_id: req.user.store_id ?? -1 } : {};
  res.json(await prisma.request.findMany({ where, include: { store: true, items: true, productions: true }, orderBy: { created_at: "desc" } }));
}));

app.post("/requests", requireAuth, allowRoles("MANAGER", "SUPERVISOR"), asyncHandler(async (req, res) => {
  const schema = z.object({
    request_date: z.coerce.date(),
    reference_week: z.string().min(1),
    store_id: z.coerce.number().int().positive(),
    responsible_name: z.string().min(1),
    desired_receipt_date: z.coerce.date(),
    items: z.array(z.object({
      product_id: z.coerce.number().int().positive().optional().nullable(),
      product_name: z.string().min(1),
      package_weight: z.coerce.number().positive(),
      unit: z.enum(["g", "kg", "unidade", "caixa", "pacote", "fardo"]),
      requested_quantity: z.coerce.number().int().positive(),
      current_store_stock: z.coerce.number().int().nonnegative(),
      ideal_stock: z.coerce.number().int().nonnegative()
    })).min(1).max(100)
  });
  const data = schema.parse(req.body);
  if (req.user?.role === "SUPERVISOR" && req.user.store_id !== data.store_id) {
    return res.status(403).json({ message: "Supervisora so pode criar solicitacao para sua loja." });
  }
  const count = await prisma.request.count();
  const request_code = `SOL-${String(count + 1).padStart(5, "0")}`;
  const request = await prisma.request.create({
    data: {
      request_code,
      request_date: data.request_date,
      reference_week: data.reference_week,
      store_id: data.store_id,
      responsible_name: data.responsible_name,
      desired_receipt_date: data.desired_receipt_date,
      status: "REQUESTED",
      items: {
        create: data.items.map((item) => ({
          ...item,
          suggested_quantity: Math.max(0, item.ideal_stock - item.current_store_stock)
        }))
      }
    },
    include: requestInclude
  });
  res.status(201).json(request);
}));

app.get("/requests/:id", requireAuth, asyncHandler(async (req, res) => {
  const { id } = idParam.parse(req.params);
  const request = await prisma.request.findUnique({ where: { id }, include: requestInclude });
  if (!request) return res.status(404).json({ message: "Solicitacao nao encontrada." });
  if (req.user?.role === "SUPERVISOR" && req.user.store_id !== request.store_id) return res.status(403).json({ message: "Acesso negado." });
  res.json(request);
}));

app.put("/requests/:id", requireAuth, allowRoles("MANAGER"), asyncHandler(async (req, res) => {
  const { id } = idParam.parse(req.params);
  const data = z.object({ status: z.enum(["REQUESTED", "UNDER_REVIEW", "APPROVED", "IN_PRODUCTION", "FINISHED", "SENT", "DELIVERED", "CANCELED"]) }).parse(req.body);
  res.json(await prisma.request.update({ where: { id }, data }));
}));

app.post("/requests/:id/generate-productions", requireAuth, allowRoles("MANAGER"), asyncHandler(async (req, res) => {
  const { id } = idParam.parse(req.params);
  const request = await prisma.request.findUnique({ where: { id }, include: { items: true } });
  if (!request) return res.status(404).json({ message: "Solicitacao nao encontrada." });
  if (await prisma.production.count({ where: { request_id: id } })) return res.status(409).json({ message: "Producoes ja foram geradas para esta solicitacao." });
  const operators = await prisma.operator.findMany({ where: { status: "ACTIVE" }, orderBy: [{ name: "asc" }, { id: "asc" }] });
  if (!operators.length) return res.status(400).json({ message: "Nao ha operadores ativos para distribuir producoes." });
  const baseCount = await prisma.production.count();
  const productions = await prisma.$transaction(request.items.map((item, index) => prisma.production.create({
    data: {
      production_code: `PROD-${String(baseCount + index + 1).padStart(5, "0")}`,
      request_item_id: item.id,
      request_id: request.id,
      store_id: request.store_id,
      product_name: item.product_name,
      package_weight: item.package_weight,
      unit: item.unit,
      production_quantity: item.requested_quantity,
      operator_id: operators[index % operators.length].id,
      status: "PENDING"
    },
    include: { operator: true, store: true, request: true, pauses: true }
  })));
  await prisma.request.update({ where: { id }, data: { status: "IN_PRODUCTION" } });
  res.status(201).json(productions);
}));

function productionWhereForUser(req: Request): Prisma.ProductionWhereInput {
  if (req.user?.role === "OPERATOR") return { operator_id: req.user.operator_id ?? -1 };
  return {};
}

app.get("/productions", requireAuth, allowRoles("MANAGER"), asyncHandler(async (req, res) => {
  const where: Prisma.ProductionWhereInput = {};
  if (req.query.status) where.status = req.query.status as ProductionStatus;
  if (req.query.store_id) where.store_id = Number(req.query.store_id);
  if (req.query.operator_id) where.operator_id = Number(req.query.operator_id);
  if (req.query.product) where.product_name = { contains: String(req.query.product) };
  if (req.query.reference_week) where.request = { reference_week: String(req.query.reference_week) };
  res.json(await prisma.production.findMany({ where, include: { operator: true, store: true, request: true, pauses: true }, orderBy: { created_at: "desc" } }));
}));

app.get("/productions/my-queue", requireAuth, allowRoles("OPERATOR"), asyncHandler(async (req, res) => {
  res.json(await prisma.production.findMany({
    where: productionWhereForUser(req),
    include: { store: true, request: true, pauses: true, operator: true },
    orderBy: [{ status: "asc" }, { created_at: "asc" }]
  }));
}));

app.get("/productions/:id", requireAuth, asyncHandler(async (req, res) => {
  const { id } = idParam.parse(req.params);
  const production = await prisma.production.findUnique({ where: { id }, include: { store: true, request: true, pauses: true, operator: true } });
  if (!production) return res.status(404).json({ message: "Producao nao encontrada." });
  if (req.user?.role === "OPERATOR" && production.operator_id !== req.user.operator_id) return res.status(403).json({ message: "Acesso negado." });
  res.json(production);
}));

async function getOwnProduction(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  const production = await prisma.production.findUnique({ where: { id }, include: { pauses: true } });
  if (!production) {
    res.status(404).json({ message: "Producao nao encontrada." });
    return null;
  }
  if (req.user?.role === "OPERATOR" && production.operator_id !== req.user.operator_id) {
    res.status(403).json({ message: "Operador nao pode alterar producao de outro operador." });
    return null;
  }
  return production;
}

app.post("/productions/:id/start", requireAuth, allowRoles("OPERATOR"), asyncHandler(async (req, res) => {
  const production = await getOwnProduction(req, res);
  if (!production) return;
  if (production.status !== "PENDING") return res.status(400).json({ message: "Somente producao pendente pode ser iniciada." });
  res.json(await prisma.production.update({ where: { id: production.id }, data: { status: "IN_PROGRESS", started_at: new Date() } }));
}));

app.post("/productions/:id/pause", requireAuth, allowRoles("OPERATOR"), asyncHandler(async (req, res) => {
  const production = await getOwnProduction(req, res);
  if (!production) return;
  if (production.status !== "IN_PROGRESS" || !production.started_at) return res.status(400).json({ message: "Somente producao em andamento pode ser pausada." });
  const { reason } = z.object({ reason: z.enum(["WATER", "BATHROOM", "BREAK", "WAITING_MATERIAL", "MAINTENANCE", "OTHER"]) }).parse(req.body);
  const pause = await prisma.$transaction(async (tx) => {
    await tx.production.update({ where: { id: production.id }, data: { status: "PAUSED" } });
    return tx.pause.create({ data: { production_id: production.id, operator_id: production.operator_id, reason, pause_started_at: new Date() } });
  });
  res.status(201).json(pause);
}));

app.post("/productions/:id/resume", requireAuth, allowRoles("OPERATOR"), asyncHandler(async (req, res) => {
  const production = await getOwnProduction(req, res);
  if (!production) return;
  if (production.status !== "PAUSED") return res.status(400).json({ message: "Somente producao pausada pode ser retomada." });
  const openPause = await prisma.pause.findFirst({ where: { production_id: production.id, pause_finished_at: null }, orderBy: { pause_started_at: "desc" } });
  if (!openPause) return res.status(400).json({ message: "Nao ha pausa aberta para retomar." });
  const now = new Date();
  await prisma.$transaction([
    prisma.pause.update({ where: { id: openPause.id }, data: { pause_finished_at: now, duration_minutes: minutesBetween(openPause.pause_started_at, now) } }),
    prisma.production.update({ where: { id: production.id }, data: { status: "IN_PROGRESS" } })
  ]);
  res.json({ message: "Producao retomada." });
}));

app.post("/productions/:id/finish", requireAuth, allowRoles("OPERATOR"), asyncHandler(async (req, res) => {
  const production = await getOwnProduction(req, res);
  if (!production) return;
  if (!production.started_at) return res.status(400).json({ message: "Producao precisa ser iniciada antes de finalizar." });
  if (production.status === "PAUSED") return res.status(400).json({ message: "Retome a producao antes de finalizar." });
  if (production.status !== "IN_PROGRESS") return res.status(400).json({ message: "Somente producao em andamento pode ser finalizada." });
  const now = new Date();
  const pauses = await prisma.pause.findMany({ where: { production_id: production.id, pause_finished_at: { not: null } } });
  const paused_time_minutes = pauses.reduce((sum, pause) => sum + (pause.duration_minutes ?? 0), 0);
  const gross_time_minutes = minutesBetween(production.started_at, now);
  const net_time_minutes = Math.max(0, gross_time_minutes - paused_time_minutes);
  res.json(await prisma.production.update({
    where: { id: production.id },
    data: { status: "PRODUCED", finished_at: now, gross_time_minutes, paused_time_minutes, net_time_minutes }
  }));
}));

app.post("/productions/:id/cancel", requireAuth, allowRoles("MANAGER"), asyncHandler(async (req, res) => {
  const { id } = idParam.parse(req.params);
  res.json(await prisma.production.update({ where: { id }, data: { status: "CANCELED" } }));
}));

app.get("/dashboard/manager", requireAuth, allowRoles("MANAGER"), asyncHandler(async (_req, res) => {
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const [totalRequests, weekRequests, pending, inProgress, paused, produced, activeOperators, byOperator, byStore, latestRequests] = await Promise.all([
    prisma.request.count(),
    prisma.request.count({ where: { request_date: { gte: weekStart } } }),
    prisma.production.count({ where: { status: "PENDING" } }),
    prisma.production.count({ where: { status: "IN_PROGRESS" } }),
    prisma.production.count({ where: { status: "PAUSED" } }),
    prisma.production.count({ where: { status: "PRODUCED" } }),
    prisma.operator.count({ where: { status: "ACTIVE" } }),
    prisma.production.groupBy({ by: ["operator_id", "status"], _count: true }),
    prisma.production.groupBy({ by: ["store_id", "status"], _count: true }),
    prisma.request.findMany({ take: 5, include: { store: true, items: true }, orderBy: { created_at: "desc" } })
  ]);
  const [operators, stores] = await Promise.all([prisma.operator.findMany(), prisma.store.findMany()]);
  res.json({
    cards: { totalRequests, weekRequests, pending, inProgress, paused, produced, activeOperators },
    byOperator: byOperator.map((row) => ({ ...row, operator: operators.find((op) => op.id === row.operator_id)?.name ?? "Sem operador" })),
    byStore: byStore.map((row) => ({ ...row, store: stores.find((store) => store.id === row.store_id)?.name ?? "Sem loja" })),
    latestRequests
  });
}));

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof z.ZodError) return res.status(400).json({ message: "Dados invalidos.", issues: error.flatten() });
  if (error instanceof Prisma.PrismaClientKnownRequestError) return res.status(400).json({ message: "Erro de banco de dados.", code: error.code });
  console.error(error);
  res.status(500).json({ message: "Erro interno do servidor." });
});

const port = Number(process.env.PORT ?? 3333);
app.listen(port, () => console.log(`API rodando em http://localhost:${port}`));
