"use client";

import { useCallback, useEffect, useState } from "react";
import "./admin.css";

type FileRecord = { field?: string; key: string; size?: number; contentType?: string };
type Lead = {
  id: string;
  kind: "creator" | "brand" | string;
  language?: string;
  payload: Record<string, unknown>;
  files?: FileRecord[];
  status?: string;
  created_at?: number;
};
type ApiState = "loading" | "ready" | "forbidden" | "error";

const PAGE_SIZE = 20;

function text(value: unknown) {
  if (typeof value === "string") return value.trim() ? value : "—";
  if (typeof value === "number") return Number.isFinite(value) ? new Intl.NumberFormat("es-AR").format(value) : "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return "—";
}

function date(value: number | undefined) {
  return value ? new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
}

function bytes(value: number | undefined) {
  if (!value) return "";
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function contactUrl(method: unknown, contact: unknown) {
  if (typeof contact !== "string" || !contact.trim()) return null;
  const value = contact.trim();
  if (/^https?:\/\//i.test(value)) return value;
  if (typeof method === "string" && method.toLowerCase().includes("telegram")) {
    return `https://t.me/${value.replace(/^@/, "")}`;
  }
  if (typeof method === "string" && method.toLowerCase().includes("whatsapp")) {
    return `https://wa.me/${value.replace(/[^\d]/g, "")}`;
  }
  return `mailto:${value}`;
}

export default function AdminPage() {
  const [state, setState] = useState<ApiState>("loading");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState("");

  const load = useCallback(async (nextOffset: number) => {
    setState("loading");
    setError("");
    try {
      const response = await fetch(`/api/admin/leads?limit=${PAGE_SIZE}&offset=${nextOffset}`, { cache: "no-store" });
      if (response.status === 403) { setState("forbidden"); return; }
      if (!response.ok) throw new Error("No se pudieron cargar los contactos.");
      const data = await response.json() as { leads?: Lead[] };
      setLeads(Array.isArray(data.leads) ? data.leads : []);
      setOffset(nextOffset);
      setState("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ocurrió un error inesperado.");
      setState("error");
    }
  }, []);

  useEffect(() => { void load(0); }, [load]);

  async function openFile(file: FileRecord) {
    setBusyKey(file.key);
    try {
      const response = await fetch(`/api/admin/files?key=${encodeURIComponent(file.key)}`, { cache: "no-store" });
      if (response.status === 403) { setState("forbidden"); return; }
      if (!response.ok) throw new Error("No se pudo abrir el archivo.");
      const blobUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = file.key.split("/").pop() || "archivo";
      anchor.click();
      URL.revokeObjectURL(blobUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo abrir el archivo.");
      setState("error");
    } finally { setBusyKey(""); }
  }

  function openContact(lead: Lead) {
    const url = contactUrl(lead.payload.contactMethod, lead.payload.contact);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  return <main className="admin-shell">
    <meta name="robots" content="noindex,nofollow,noarchive" />
    <header className="admin-header"><div><p className="admin-kicker">PRIMATE ADC / PRIVADO</p><h1>Contactos recibidos</h1><p className="admin-intro">Revisá propuestas de creadores, marcas y partners.</p></div><button className="admin-refresh" type="button" onClick={() => void load(offset)} disabled={state === "loading"}>Actualizar</button></header>
    {state === "loading" && <div className="admin-state">Cargando contactos…</div>}
    {state === "forbidden" && <div className="admin-state admin-state-error"><strong>Acceso restringido</strong><span>Esta vista requiere la sesión del propietario de Primate ADC.</span></div>}
    {state === "error" && <div className="admin-state admin-state-error"><strong>No se pudo cargar la información</strong><span>{error}</span><button type="button" onClick={() => void load(offset)}>Reintentar</button></div>}
    {state === "ready" && <>
      {leads.length === 0 ? <div className="admin-state">Todavía no hay contactos.</div> : <section className="lead-list" aria-label="Contactos">
        {leads.map((lead) => <article className="lead-card" key={lead.id}>
          <div className="lead-card-top"><div><span className="lead-kind">{lead.kind === "creator" ? "Creador" : lead.kind === "brand" ? "Marca / partner" : lead.kind}</span><h2>{text(lead.payload.name)}</h2></div><span className={`lead-status status-${lead.status || "pending"}`}>{text(lead.status)}</span></div>
          <p className="lead-date">{date(lead.created_at)} · {text(lead.payload.country || lead.payload.targetMarkets)}</p>
          <div className="lead-details">{Object.entries(lead.payload).filter(([key, value]) => key !== "name" && key !== "contact" && key !== "contactMethod" && value !== undefined && value !== "").map(([key, value]) => <div className="detail" key={key}><span>{key}</span><strong>{Array.isArray(value) ? value.join(", ") : text(value)}</strong></div>)}</div>
          <div className="lead-actions"><button type="button" onClick={() => openContact(lead)} disabled={!contactUrl(lead.payload.contactMethod, lead.payload.contact)}>Contactar</button>{(lead.files || []).map((file) => <button className="file-button" type="button" key={file.key} onClick={() => void openFile(file)} disabled={busyKey === file.key}>{busyKey === file.key ? "Abriendo…" : `${text(file.field)} ${bytes(file.size)}`}</button>)}</div>
        </article>)}
      </section>}
      <nav className="pagination" aria-label="Paginación"><button type="button" onClick={() => void load(Math.max(0, offset - PAGE_SIZE))} disabled={offset === 0}>← Anteriores</button><span>{offset + 1}–{offset + leads.length}</span><button type="button" onClick={() => void load(offset + PAGE_SIZE)} disabled={leads.length < PAGE_SIZE}>Siguientes →</button></nav>
    </>}
  </main>;
}
