// Vue de consultation du journal d'audit de modération (E11)
// À brancher dans le centre d'administration (admin.html) ou via une route dédiée.

import { api, h, mount, fail } from "/js/dom.js";

export async function adminAuditPage() {
  const root = h("section", { class: "stack", style: "display:grid;gap:16px;max-width:960px;margin:0 auto" },
    h("h1", { class: "title" }, "Journal d'audit de modération"),
    h("p", { class: "muted small" }, "Actions sensibles tracées (append-only).")
  );

  const filters = h("form", { class: "card row wrap gap-sm", style: "align-items:end", onSubmit: (ev) => { ev.preventDefault(); load(); } },
    h("label", null, "Type cible",
      h("select", { name: "targetType" },
        h("option", { value: "" }, "Tous"),
        h("option", { value: "listing" }, "Annonce"),
        h("option", { value: "user" }, "Compte"),
        h("option", { value: "report" }, "Signalement"),
        h("option", { value: "comment" }, "Commentaire")
      )
    ),
    h("label", null, "ID cible (optionnel)",
      h("input", { name: "targetId", placeholder: "uuid" })
    ),
    h("button", { class: "btn", type: "submit" }, "Filtrer"),
    h("button", { class: "btn btn-quiet", type: "button", onClick: () => { filters.reset(); load(); } }, "Réinitialiser"),
    h("button", { class: "btn btn-outline", type: "button", onClick: () => exportCsv() }, "Exporter CSV")
  );

  const tableWrap = h("div", { class: "card" }, h("p", { class: "muted" }, "Chargement…"));

  async function load() {
    const fd = new FormData(filters);
    const q = new URLSearchParams();
    if (fd.get("targetType")) q.set("targetType", fd.get("targetType"));
    if (fd.get("targetId")) q.set("targetId", fd.get("targetId"));
    q.set("limit", "100");
    try {
      const rows = await api(`/staff/moderation-audit?${q}`);
      if (!rows.length) {
        tableWrap.replaceChildren(h("p", { class: "muted" }, "Aucune entrée."));
        return;
      }
      const table = h("table", { class: "table", style: "width:100%;border-collapse:collapse" },
        h("thead", null, h("tr", null,
          h("th", null, "Date"),
          h("th", null, "Action"),
          h("th", null, "Cible"),
          h("th", null, "Acteur"),
          h("th", null, "Détails")
        )),
        h("tbody", null, ...rows.map(r =>
          h("tr", null,
            h("td", null, new Date(r.created_at).toLocaleString("fr-FR")),
            h("td", null, r.action),
            h("td", null, `${r.target_type}${r.target_id ? " · " + r.target_id.slice(0, 8) : ""}`),
            h("td", null, r.actor_id ? r.actor_id.slice(0, 8) : "—"),
            h("td", { class: "small" }, r.details ? JSON.stringify(r.details) : "—")
          )
        ))
      );
      tableWrap.replaceChildren(table);
    } catch (e) {
      fail(e);
      tableWrap.replaceChildren(h("p", { class: "notice" }, e.message || "Erreur de chargement."));
    }
  }


  function exportCsv() {
    const table = tableWrap.querySelector("table");
    if (!table) { alert("Aucune donnée à exporter."); return; }
    const rows = [...table.querySelectorAll("tr")].map(tr =>
      [...tr.querySelectorAll("th,td")].map(td => `"${(td.textContent || "").replace(/"/g, '""')}"`).join(",")
    );
    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = h("a", { href: URL.createObjectURL(blob), download: `audit-moderation-${new Date().toISOString().slice(0,10)}.csv` });
    a.click();
    URL.revokeObjectURL(a.href);
  }

  root.append(filters, tableWrap);
  const app = document.getElementById("app") || document.querySelector("main") || document.body;
  mount(app, root);
  await load();
}
