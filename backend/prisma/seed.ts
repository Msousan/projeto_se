import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const password_hash = await bcrypt.hash("123456", 10);

  const store1 = await prisma.store.upsert({
    where: { id: 1 },
    update: {},
    create: { name: "Loja 01 - Proxima", distance_km: 20, logistics_type: "PROXIMA" }
  });

  await prisma.store.upsert({
    where: { id: 2 },
    update: {},
    create: { name: "Loja 02 - Distante", distance_km: 600, logistics_type: "DISTANTE" }
  });

  const joao = await prisma.operator.upsert({
    where: { email: "joao@empresa.com" },
    update: {},
    create: { name: "Joao", email: "joao@empresa.com", sector: "Producao", status: "ACTIVE", daily_capacity: 30 }
  });

  const maria = await prisma.operator.upsert({
    where: { email: "maria@empresa.com" },
    update: {},
    create: { name: "Maria", email: "maria@empresa.com", sector: "Producao", status: "ACTIVE", daily_capacity: 30 }
  });

  await prisma.operator.upsert({
    where: { email: "carlos@empresa.com" },
    update: {},
    create: { name: "Carlos", email: "carlos@empresa.com", sector: "Producao", status: "ACTIVE", daily_capacity: 30 }
  });

  const users: Array<{ name: string; email: string; role: string; operator_id?: number; store_id?: number }> = [
    { name: "Gestor", email: "gestor@empresa.com", role: "MANAGER" },
    { name: "Supervisora Loja 01", email: "supervisora1@empresa.com", role: "SUPERVISOR", store_id: store1.id },
    { name: "Operador Joao", email: "joao@empresa.com", role: "OPERATOR", operator_id: joao.id },
    { name: "Operador Maria", email: "maria@empresa.com", role: "OPERATOR", operator_id: maria.id }
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: { password_hash, operator_id: user.operator_id, store_id: user.store_id },
      create: { ...user, password_hash }
    });
  }

  const products = [
    { name: "Produto A", package_weight: 30, unit: "g", category: "Pequeno", average_time_minutes: 5 },
    { name: "Produto B", package_weight: 500, unit: "g", category: "Medio", average_time_minutes: 8 },
    { name: "Produto C", package_weight: 1.5, unit: "kg", category: "Grande", average_time_minutes: 12 },
    { name: "Produto D", package_weight: 1500, unit: "kg", category: "Industrial", average_time_minutes: 20 }
  ] as const;

  for (const product of products) {
    const existing = await prisma.product.findFirst({ where: { name: product.name } });
    if (!existing) await prisma.product.create({ data: product });
  }
}

main()
  .finally(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
