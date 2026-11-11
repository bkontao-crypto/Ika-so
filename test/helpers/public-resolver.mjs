// Permet d'importer les modules du navigateur (« /js/... ») depuis Node, pour tester le rendu des pages sur un faux DOM.
import { pathToFileURL } from "node:url";
const root = new URL("../../public", import.meta.url).pathname;
export async function resolve(specifier, context, next) {
  if (specifier.startsWith("/js/")) return next(pathToFileURL(root + specifier).href, context);
  return next(specifier, context);
}
