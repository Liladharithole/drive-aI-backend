import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.core-central.prisma",
  migrations: {
    path: "prisma/migrations-central-core",
  },
  datasource: {
    url: process.env["CENTRAL_CORE_DATABASE_URL"],
  },
});
