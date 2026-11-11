import pg from "pg";

// Même forme de résultat partout : bigint -> nombre, dates et intervalles -> texte.
pg.types.setTypeParser(20, Number); // int8 (dont count(*) et le prix)
pg.types.setTypeParser(1082, (value) => value); // date
pg.types.setTypeParser(1186, (value) => value); // interval

/**
 * Accès PostgreSQL. Les valeurs passent toujours en paramètres ($1, $2…), jamais concaténées au texte SQL.
 *  - query(texte, paramètres) -> lignes
 *  - transaction(fn) : fn reçoit { query } lié à une seule connexion ; commit si fn réussit, rollback sinon
 */
export function createDb(connectionString) {
  const pool = new pg.Pool({ connectionString, max: 10 });
  return {
    async query(text, params = []) {
      return (await pool.query(text, params)).rows;
    },
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const result = await fn({ query: async (text, params = []) => (await client.query(text, params)).rows });
        await client.query("commit");
        return result;
      } catch (error) {
        await client.query("rollback").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}
