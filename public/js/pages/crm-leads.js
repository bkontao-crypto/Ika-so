// Page de consultation des leads CRM (E07)
import { api, h, mount, fail, toast } from "/js/dom.js";

const STATUSES = ["NEW", "CONTACTED", "VISIT", "NEGOTIATION", "WON", "LOST"];

export async function crmLeadsPage() {
  const root = h("section", { class: "stack", style: "display:grid;gap:16px;max-width:960px;margin:0 auto" },
    h("h1", { class: "title" }, "Mes leads"),
    h("p", { class: "muted small" }, "Contacts et opportunités issus du profil et des saisies manuelles.")
  );

  const form = h("form", { class: "card stack", style: "display:grid;gap:8px", onSubmit: async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    try {
      await api("/me/crm/leads", { method: "POST", body: {
        contactName: fd.get("contactName") || null,
        contactPhone: fd.get("contactPhone") || null,
        contactEmail: fd.get("contactEmail") || null,
        notes: fd.get("notes") || null,
        source: "manual",
        status: "NEW",
      }});
      toast("Lead créé");
      ev.target.reset();
      load();
    } catch (e) { fail(e); }
  }},
    h("h3", null, "Nouveau lead"),
    h("div", { class: "row wrap gap-sm" },
      h("input", { name: "contactName", placeholder: "Nom", maxlength: 120 }),
      h("input", { name: "contactPhone", placeholder: "Téléphone", maxlength: 40 }),
      h("input", { name: "contactEmail", placeholder: "Email", type: "email", maxlength: 120 })
    ),
    h("textarea", { name: "notes", placeholder: "Notes", rows: 2, maxlength: 2000 }),
    h("button", { class: "btn", type: "submit" }, "Créer")
  );

  const toolbar = h("div", { class: "row wrap gap-sm", style: "align-items:center" },
    h("label", { class: "small" }, "Statut ",
      h("select", { name: "statusFilter", onChange: () => load() },
        h("option", { value: "" }, "Tous"),
        ...STATUSES.map(s => h("option", { value: s }, s))
      )
    ),
    h("label", { class: "small" }, "Score min ",
      h("select", { name: "scoreFilter", onChange: () => load() },
        h("option", { value: "0" }, "Tous"),
        h("option", { value: "50" }, "≥ 50 (tiède+)"),
        h("option", { value: "80" }, "≥ 80 (chaud)")
      )
    ),
    h("button", { class: "btn btn-outline", type: "button", onClick: () => exportCsv() }, "Exporter CSV")
  );

  const statsEl = h("div", { class: "card" }, h("p", { class: "muted" }, "Chargement des stats…"));
  const listEl = h("div", { class: "stack", style: "display:grid;gap:12px" });

  async function load() {
    try {
      const [stats, leads] = await Promise.all([
        api("/me/crm/stats"),
        api("/me/crm/leads"),
      ]);
      // Stats
      const pills = Object.entries(stats.byStatus || {}).map(([s, n]) =>
        h("span", { class: "pill", style: "margin-right:6px" }, `${s} : ${n}`)
      );
      const evo = (stats.evolution || []).map(e => `${e.week} : ${e.count}`).join(" · ") || "—";
      statsEl.replaceChildren(
        h("strong", null, `${stats.total || 0} lead(s)`),
        h("p", { class: "small", style: "margin:6px 0" }, `Taux de conversion : ${stats.conversionRate || 0} %`),
        h("div", { class: "row wrap gap-sm", style: "margin-top:4px" }, ...pills),
        h("p", { class: "small muted", style: "margin-top:8px" }, `Évolution (4 sem.) : ${evo}`)
      );
      // List
      if (!leads.length) {
        listEl.replaceChildren(h("div", { class: "card empty-state" }, h("p", null, "Aucun lead pour le moment.")));
        return;
      }
      const statusF = toolbar.querySelector("[name=statusFilter]")?.value || "";
      const scoreF = Number(toolbar.querySelector("[name=scoreFilter]")?.value || 0);
      const filtered = leads.filter(l =>
        (!statusF || l.status === statusF) &&
        ((l.score ?? 0) >= scoreF)
      );
      const sorted = filtered.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      if (!sorted.length) {
        listEl.replaceChildren(h("div", { class: "card empty-state" }, h("p", null, "Aucun lead ne correspond aux filtres.")));
        return;
      }
      listEl.replaceChildren(...sorted.map(leadCard));
    } catch (e) {
      fail(e);
      statsEl.replaceChildren(h("p", { class: "notice" }, e.message || "Erreur"));
    }
  }


  function scoreClass(score) {
    const s = score ?? 0;
    if (s >= 80) return "pill pill-green";
    if (s >= 50) return "pill pill-gold";
    return "pill";
  }
  function scoreLabel(score) {
    const s = score ?? 0;
    if (s >= 80) return `Chaud ${s}`;
    if (s >= 50) return `Tiède ${s}`;
    return `Froid ${s}`;
  }

  function leadCard(l) {
    return h("article", { class: "card" },
      h("div", { class: "row-between" },
        h("strong", null, l.contact_name || "Contact anonyme"),
        h("div", { class: "row gap-sm" },
          h("span", { class: scoreClass(l.score), title: "Score de priorité" }, scoreLabel(l.score)),
          h("span", { class: "pill" }, l.status)
        )
      ),
      h("p", { class: "small muted", style: "margin:4px 0" },
        [l.source, l.contact_phone, l.contact_email].filter(Boolean).join(" · ") || "—"
      ),
      l.notes ? h("p", { class: "small" }, l.notes) : null,
      h("div", { class: "row wrap gap-sm", style: "margin-top:8px" },
        ...STATUSES.filter(s => s !== l.status).slice(0, 3).map(s =>
          h("button", {
            class: "btn btn-small btn-outline",
            type: "button",
            onClick: async () => {
              try {
                await api(`/me/crm/leads/${l.id}`, { method: "PUT", body: { status: s } });
                toast("Statut mis à jour");
                load();
              } catch (e) { fail(e); }
            }
          }, s)
        ),
        l.contact_phone ? h("button", {
          class: "btn btn-small",
          type: "button",
          onClick: async () => {
            const text = prompt("Message WhatsApp :", "Bonjour, suite à votre intérêt sur Ika So.");
            if (!text) return;
            try {
              await api(`/me/crm/leads/${l.id}/whatsapp`, { method: "POST", body: { text } });
              toast("Message WhatsApp envoyé");
              load();
            } catch (e) { fail(e); }
          }
        }, "Envoyer WhatsApp") : null
      )
    );
  }


  function exportCsv() {
    const cards = listEl.querySelectorAll("article");
    if (!cards.length) { toast("Aucun lead à exporter."); return; }
    const headers = ["Nom","Score","Statut","Source","Téléphone","Email","Notes"];
    const rows = [headers.map(h => `"${h}"`).join(",")];
    cards.forEach(card => {
      const name = card.querySelector("strong")?.textContent || "";
      const pills = [...card.querySelectorAll(".pill")];
      const score = pills[0]?.textContent || "";
      const status = pills[1]?.textContent || "";
      const meta = card.querySelector(".muted")?.textContent || "";
      const notes = card.querySelectorAll("p")[1]?.textContent || "";
      const parts = meta.split(" · ");
      const source = parts[0] || "";
      const phone = parts[1] || "";
      const email = parts[2] || "";
      rows.push([name, score, status, source, phone, email, notes].map(v => `"${(v||"").replace(/"/g,'""')}"`).join(","));
    });
    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `leads-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  root.append(form, toolbar, statsEl, listEl);
  const app = document.getElementById("app") || document.querySelector("main") || document.body;
  mount(app, root);
  await load();
}
