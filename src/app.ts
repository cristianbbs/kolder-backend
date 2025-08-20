import express from "express";
import cors from "cors";

import { authRouter } from "./routes/auth.ts";
import { companyRouter } from "./routes/company.ts";
import { ordersRouter } from "./routes/orders.ts";
import { productsRouter } from "./routes/products.ts";

export const app = express();

app.use(cors());
app.use(express.json());

// Health
app.get("/health", (_req, res) => res.type("text/plain").send("OK"));

// Routers
app.use("/auth", authRouter);
app.use("/company", companyRouter);
app.use("/orders", ordersRouter);
app.use("/products", productsRouter);
