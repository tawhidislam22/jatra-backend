import { prisma } from './src/app/lib/prisma'; async function main() { const u = await prisma.user.findFirst({ where: { role: 'OWNER' } }); console.log(u); } main().finally(() => process.exit(0));
