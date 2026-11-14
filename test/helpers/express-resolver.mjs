// Test uniquement : remplace « express » par un mini routeur (voir express-stub.mjs) quand Express n'est pas installé.
export async function resolve(specifier, context, next) {
  if (specifier === "express") return { url: new URL("./express-stub.mjs", import.meta.url).href, shortCircuit: true };
  return next(specifier, context);
}
