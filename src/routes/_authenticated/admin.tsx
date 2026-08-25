import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/lib/carnet";

type CarnetUser = {
  id: string;
  slug: string;
  active: boolean;
  label: string;
  name: string;
  surname: string;
  points: number;
  birth_date: string;
  document_number: string;
  licence_expiry: string;
  licence_am: string;
  licence_a1: string;
  licence_b: string;
  photo_url: string | null;
  photo_zoom: number;
  photo_x: number;
  photo_y: number;
  plate: string;
  vehicle_model: string;
  registration_date: string;
  itv_expiry: string;
  insurer: string;
  insurance_start: string;
  fiscal_municipality: string;
};

const TEXT_FIELDS: Array<{ key: keyof CarnetUser; label: string }> = [
  { key: "label", label: "Etiqueta interna" },
  { key: "name", label: "Nombre" },
  { key: "surname", label: "Apellidos" },
  { key: "birth_date", label: "Fecha de nacimiento" },
  { key: "document_number", label: "DNI / Nº documento" },
  { key: "licence_expiry", label: "Caducidad del permiso" },
  { key: "licence_am", label: "Expedición AM" },
  { key: "licence_a1", label: "Expedición A1" },
  { key: "licence_b", label: "Expedición B" },
  { key: "plate", label: "Matrícula" },
  { key: "vehicle_model", label: "Modelo del vehículo" },
  { key: "registration_date", label: "Fecha de matriculación" },
  { key: "itv_expiry", label: "Caducidad ITV" },
  { key: "insurer", label: "Aseguradora" },
  { key: "insurance_start", label: "Inicio del seguro" },
  { key: "fiscal_municipality", label: "Municipio fiscal" },
];

async function optimizePhoto(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new window.Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("Imagen no válida"));
    element.src = dataUrl;
  });
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return dataUrl;
  const scale = Math.max(size / image.width, size / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

function AdminPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<CarnetUser[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CarnetUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(true);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const { data: adminCheck } = await supabase.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
      setIsAdmin(Boolean(adminCheck));
    }
    const { data, error } = await supabase.from("carnet_users").select("*").order("created_at", { ascending: false });
    if (error) setMessage(error.message);
    setUsers((data ?? []) as CarnetUser[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const found = users.find((user) => user.id === selectedId) ?? null;
    setDraft(found ? { ...found } : null);
  }, [selectedId, users]);

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const link = useMemo(() => (draft ? `${origin}/?u=${draft.slug}` : ""), [draft, origin]);

  function update<K extends keyof CarnetUser>(key: K, value: CarnetUser[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  async function createUser() {
    setMessage("");
    const label = window.prompt("Nombre para identificar al usuario", "Nuevo usuario");
    if (!label) return;
    const base = slugify(label) || "usuario";
    const slug = `${base}-${Math.random().toString(36).slice(2, 7)}`;
    const { data, error } = await supabase.from("carnet_users").insert({ label, slug }).select("*").single();
    if (error) { setMessage(error.message); return; }
    setUsers((current) => [data as CarnetUser, ...current]);
    setSelectedId((data as CarnetUser).id);
  }

  async function save() {
    if (!draft) return;
    setMessage("");
    const { id, ...payload } = draft;
    const { error } = await supabase.from("carnet_users").update(payload).eq("id", id);
    if (error) { setMessage(error.message); return; }
    setMessage("Cambios guardados");
    await load();
  }

  async function toggleActive(user: CarnetUser) {
    const { error } = await supabase.from("carnet_users").update({ active: !user.active }).eq("id", user.id);
    if (error) { setMessage(error.message); return; }
    await load();
  }

  async function removeUser(user: CarnetUser) {
    if (!window.confirm(`¿Eliminar a ${user.label}? Esta acción no se puede deshacer.`)) return;
    const { error } = await supabase.from("carnet_users").delete().eq("id", user.id);
    if (error) { setMessage(error.message); return; }
    if (selectedId === user.id) setSelectedId(null);
    await load();
  }

  async function onPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const optimized = await optimizePhoto(file);
      update("photo_url", optimized);
      setMessage("Foto cargada. Recuerda guardar los cambios.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo procesar la foto");
    } finally {
      event.target.value = "";
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }

  if (!isAdmin) {
    return (
      <main className="admin-auth">
        <div className="admin-card admin-auth__form">
          <h1>Sin permisos</h1>
          <p>Tu cuenta no tiene rol de administrador.</p>
          <button className="admin-primary" type="button" onClick={signOut}>Cerrar sesión</button>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <div>
          <h1>Gestión de usuarios</h1>
          <p>Crea accesos personalizados y controla la información de cada carnet.</p>
        </div>
        <div className="admin-topbar__actions">
          <button className="admin-primary" type="button" onClick={createUser}>Nuevo usuario</button>
          <button className="admin-link" type="button" onClick={signOut}>Cerrar sesión</button>
        </div>
      </header>

      {message && <p className="admin-message" role="status">{message}</p>}

      <div className={`admin-layout ${draft ? "is-editing" : ""}`}>
        <aside className="admin-card admin-list">
          {loading && <p>Cargando…</p>}
          {!loading && users.length === 0 && <p>Todavía no hay usuarios.</p>}
          {users.map((user) => (
            <div key={user.id} className={`admin-list__item ${selectedId === user.id ? "is-active" : ""}`}>
              <button type="button" onClick={() => setSelectedId(user.id)}>
                <strong>{user.label}</strong>
                <span>{user.name} {user.surname} · {user.plate}</span>
                <span className={`admin-badge ${user.active ? "is-on" : "is-off"}`}>{user.active ? "Activo" : "Desactivado"}</span>
              </button>
              <div className="admin-list__buttons">
                <button type="button" onClick={() => toggleActive(user)}>{user.active ? "Desactivar" : "Activar"}</button>
                <button type="button" className="is-danger" onClick={() => removeUser(user)}>Eliminar</button>
              </div>
            </div>
          ))}
        </aside>

        <section className="admin-card admin-editor">
          {!draft ? (
            <p>Selecciona un usuario para editar su información.</p>
          ) : (
            <>
              <button className="admin-back" type="button" onClick={() => setSelectedId(null)}>← Volver a la lista</button>
              <div className="admin-editor__head">

                <h2>{draft.label}</h2>
                <label className="admin-switch">
                  <input type="checkbox" checked={draft.active} onChange={(e) => update("active", e.target.checked)} />
                  Acceso activo
                </label>
              </div>

              <label className="admin-field">Enlace personalizado
                <div className="admin-linkrow">
                  <input readOnly value={link} onFocus={(e) => e.target.select()} />
                  <button type="button" onClick={() => void navigator.clipboard.writeText(link)}>Copiar</button>
                </div>
              </label>

              <label className="admin-field">Identificador del enlace (slug)
                <input value={draft.slug} onChange={(e) => update("slug", slugify(e.target.value))} />
              </label>

              <div className="admin-photo">
                <img src={draft.photo_url || "/profile-photo.jpg"} alt={`Foto de ${draft.name}`} />
                <div>
                  <input type="file" accept="image/*" onChange={onPhoto} />
                  <label className="admin-field">Zoom ({draft.photo_zoom.toFixed(2)})
                    <input type="range" min={1} max={2.5} step={0.01} value={draft.photo_zoom} onChange={(e) => update("photo_zoom", Number(e.target.value))} />
                  </label>
                  <label className="admin-field">Horizontal ({draft.photo_x})
                    <input type="range" min={-60} max={60} step={1} value={draft.photo_x} onChange={(e) => update("photo_x", Number(e.target.value))} />
                  </label>
                  <label className="admin-field">Vertical ({draft.photo_y})
                    <input type="range" min={-60} max={60} step={1} value={draft.photo_y} onChange={(e) => update("photo_y", Number(e.target.value))} />
                  </label>
                </div>
              </div>

              <div className="admin-grid">
                {TEXT_FIELDS.map((field) => (
                  <label className="admin-field" key={String(field.key)}>{field.label}
                    <input
                      value={String(draft[field.key] ?? "")}
                      onChange={(e) => update(field.key, e.target.value as CarnetUser[typeof field.key])}
                    />
                  </label>
                ))}
                <label className="admin-field">Puntos
                  <input type="number" min={0} max={15} value={draft.points} onChange={(e) => update("points", Number(e.target.value))} />
                </label>
              </div>

              <div className="admin-editor__actions">
                <button className="admin-primary" type="button" onClick={save}>Guardar cambios</button>
                <a className="admin-link" href={link} target="_blank" rel="noreferrer">Ver la app del usuario</a>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Panel de usuarios — miDGT UI" },
      { name: "description", content: "Panel privado para gestionar los usuarios y la información mostrada en la app miDGT UI." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Panel de usuarios — miDGT UI" },
      { property: "og:description", content: "Panel privado de gestión de usuarios de miDGT UI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});
