// Serveur de VÉRIFICATION (non livré) : vraie app + vraies routes + vrais services, sur PostgreSQL via psql.
import { createApp } from "/home/claude/ika-so/server/app.js";
import { getConfig } from "/home/claude/ika-so/server/config.js";
import { createServices } from "/home/claude/ika-so/server/services/index.js";
import { createDb } from "./psql-adapter.mjs";

const config = getConfig({ NODE_ENV: "development", PAYMENT_PROVIDER: "fake", PAYMENT_WEBHOOK_SECRET: "secret-e2e" });
const services = createServices({ db: createDb(), config, sendSms: async () => { throw new Error("pas de SMS dans ce test"); } });
const app = createApp({ services, config });
app.listen(18080, "127.0.0.1", () => console.log("pret"));
