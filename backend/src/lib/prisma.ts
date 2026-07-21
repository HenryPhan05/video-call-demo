import { PrismaClient } from "@prisma/client";

const client = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

export const prisma = client.$extends({
  result: {
    user: {
      name: {
        needs: {
          firstName: true,
          lastName: true,
        },
        compute(user) {
          return [user.firstName, user.lastName].filter(Boolean).join(" ");
        },
      },
    },
  },
});
