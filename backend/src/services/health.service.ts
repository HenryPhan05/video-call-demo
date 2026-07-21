import { prisma } from '../lib/prisma';
export class HealthService { async status(){await prisma.$queryRaw`SELECT 1`;return {status:'ok',database:'connected'};} }
