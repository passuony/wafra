import express from "express";

// استورد routes الموجودة عندك حسب مشروعك
// import { registerRoutes } from "./routes";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// registerRoutes(app);

export default app;