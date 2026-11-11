import pg from "pg";
import { getConfig } from "./server/config.js";

const config = getConfig();

console.log("Mapbox accepté :", Boolean(config.mapbox.token));
console.log("Mapbox rejeté :", config.mapbox.rejected);
console.log("DATABASE_URL présente :", Boolean(config.databaseUrl));
console.log("DATABASE_URL_TEST présente :", Boolean(process.env.DATABASE_URL_TEST));

if (!config.databaseUrl || !process.env.DATABASE_URL_TEST) {
  console.error("ERREUR : connexion manquante.");
  process.exit(1);
}

const dev = new URL(config.databaseUrl);
const test = new URL(process.env.DATABASE_URL_TEST);

console.log("Base développement :", dev.pathname.slice(1));
console.log("Base de tests :", test.pathname.slice(1));

if (dev.hostname !== "localhost" || dev.pathname !== "/ika_so_dev" ||
    test.hostname !== "localhost" || test.pathname !== "/ika_so_test") {
  console.error("ERREUR : bases incorrectes.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: config.databaseUrl });

try {
  const result = await pool.query(
    "SELECT current_database() AS database, current_user AS username"
  );
  console.log("Connexion PostgreSQL :", result.rows[0].database);
  console.log("Utilisateur :", result.rows[0].username);
  console.log("VERIFICATION REUSSIE");
} catch (error) {
  console.error("Connexion impossible :", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}