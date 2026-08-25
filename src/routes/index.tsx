import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_CARNET, rowToCarnet, type CarnetData, type CarnetRow } from "@/lib/carnet";
import { FormEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";

type View = "inicio" | "carnet" | "vehiculo" | "vehiculo-detalle" | "permiso-circulacion";
type EntryStage = "access" | "loading" | "app";

type Profile = CarnetData;

type PhotoCrop = {
  zoom: number;
  x: number;
  y: number;
};

const DEFAULT_PROFILE: Profile = DEFAULT_CARNET;

const DEFAULT_PHOTO_CROP: PhotoCrop = {
  zoom: 1,
  x: 0,
  y: 0,
};

const APP_IMAGE_ASSETS = [
  "/home-points-background.jpg",
  "/profile-photo.jpg",
  "/carnet-wallet-icon.png",
  "/document-security-background.jpg",
  "/spain-eu-flag.jpg",
  "/licence-class-am.png",
  "/licence-class-a1.png",
  "/licence-class-b.png",
  "/vehicle-city-background.jpg",
  "/environment-c.png",
];

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizePhotoCrop(value: Partial<PhotoCrop> | null | undefined): PhotoCrop {
  return {
    zoom: clamp(Number(value?.zoom) || 1, 1, 3),
    x: clamp(Number(value?.x) || 0, -45, 45),
    y: clamp(Number(value?.y) || 0, -45, 45),
  };
}

async function optimizeProfilePhoto(file: File) {
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = new window.Image();
    image.src = sourceUrl;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("No se pudo leer la imagen"));
    });

    const maxSide = 1200;
    const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No se pudo preparar la imagen");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", .84);
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

function ProfilePhoto({ src, crop, alt }: { src: string; crop: PhotoCrop; alt: string }) {
  return (
    <img
      className="editable-profile-photo"
      src={src}
      alt={alt}
      draggable={false}
      style={{ transform: `translate3d(${crop.x}%, ${crop.y}%, 0) scale(${crop.zoom})` }}
    />
  );
}

function formatDate(date: string, separator: "." | "-") {
  return date.split("/").join(separator);
}

const navItems: { id: Exclude<View, "vehiculo-detalle" | "permiso-circulacion">; label: string; icon: string }[] = [
  { id: "inicio", label: "Inicio", icon: "⌂" },
  { id: "carnet", label: "Mi carnet", icon: "▣" },
  { id: "vehiculo", label: "Vehículo", icon: "◇" },
];

function CarArt({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`car-art ${compact ? "car-art--compact" : ""}`} aria-hidden="true">
      <div className="car-shadow" />
      <div className="car-body">
        <div className="car-roof" />
        <div className="car-window car-window--left" />
        <div className="car-window car-window--right" />
        <div className="car-light car-light--front" />
        <div className="car-light car-light--back" />
        <div className="car-bumper" />
      </div>
      <div className="car-wheel car-wheel--left" />
      <div className="car-wheel car-wheel--right" />
    </div>
  );
}

function DgtLogo({ className }: { className: string }) {
  return <img className={className} src="/dgt-logo.png" alt="miDGT" decoding="async" />;
}

function AppHeader({ onMenu, isHome = false }: { onMenu: () => void; isHome?: boolean }) {
  return (
    <header className={`app-header ${isHome ? "app-header--home" : ""}`}>
      {isHome ? <span className="header-spacer" /> : (
        <button className="icon-button menu-button" onClick={onMenu} aria-label="Abrir menú">
          <span />
          <span />
          <span />
        </button>
      )}
      <div className="brand">
        <DgtLogo className="brand-logo" />
      </div>
      <button className="icon-button bell-button" aria-label="Notificaciones">
        <span className="bell-shape">●</span>
        <span className="notification-dot" />
      </button>
    </header>
  );
}

function EntryScreen({
  name,
  loading,
  onAccess,
}: {
  name: string;
  loading: boolean;
  onAccess: () => void;
}) {
  return (
    <div className="entry-screen">
      <div className="entry-brand">
        <DgtLogo className="entry-brand-logo" />
      </div>

      <h1>¡Hola {name}!</h1>
      <p>Desbloquea tu dispositivo para acceder a <strong>miDGT</strong>.</p>

      <div className="entry-lock-badge" aria-hidden="true">
        <span className="entry-lock-shackle" />
        <span className="entry-lock-body"><i /><b /></span>
      </div>

      <div className="entry-actions">
        <button className="entry-access-button" onClick={onAccess} disabled={loading}>Acceder</button>
        <button className="entry-other-button" type="button" aria-disabled="true">
          No soy {name}.<br />Autenticarse de otro modo
        </button>
      </div>

      {loading && (
        <div className="entry-loading" role="status" aria-label="Cargando la aplicación">
          <div className="loading-logo" aria-hidden="true">
            <DgtLogo className="loading-brand-logo" />
          </div>
        </div>
      )}
    </div>
  );
}

function HomeScreen({
  profile,
  photoSrc,
  photoCrop,
  onNavigate,
  onEdit,
}: {
  profile: Profile;
  photoSrc: string;
  photoCrop: PhotoCrop;
  onNavigate: (view: View) => void;
  onEdit: () => void;
}) {
  return (
    <div className="screen-content home-screen">
      <section className="reference-hero">
        <button className="profile-placeholder" onClick={onEdit} aria-label="Personalizar mis datos">
          <ProfilePhoto src={photoSrc} crop={photoCrop} alt="Retrato de perfil" />
        </button>
        <div className="reference-greeting">
          <span>Hola,</span>
          <strong>{profile.name}</strong>
          <button onClick={() => onNavigate("carnet")} className="text-link">
            VER MI CARNET <span aria-hidden="true">→</span>
          </button>
        </div>
        <div className="reward-copy">
          <strong>Conducir bien tiene<br />premio.</strong>
          <span>¡Sigue así!</span>
        </div>
        <div className="reference-points" aria-label={`${profile.points} puntos disponibles`}>
          <strong>{profile.points}</strong>
          <span>Puntos</span>
        </div>
      </section>

      <section className="reference-vehicles">
        <button className="reference-heading" type="button" onClick={() => onNavigate("vehiculo")}>
          <strong>MIS VEHÍCULOS</strong>
          <span>(1)</span>
        </button>
        <div className="reference-heading-line" />
        <button className="reference-vehicle-card" onClick={() => onNavigate("vehiculo")}>
          <div className="reference-vehicle-top">
            <CarArt compact />
          </div>
          <div className="vehicle-warning-line">
            <span className="vehicle-warning" aria-label="Aviso del vehículo">△</span>
          </div>
          <div className="reference-vehicle-copy">
            <strong>{profile.plate}</strong>
            <span>{profile.vehicleModel}</span>
          </div>
        </button>
      </section>

    </div>
  );
}

function LicenseScreen({ profile, photoSrc, photoCrop, onBack }: { profile: Profile; photoSrc: string; photoCrop: PhotoCrop; onBack: () => void }) {
  const [showBack, setShowBack] = useState(false);
  const licenseFields = [
    ["1.", profile.surname.toUpperCase()],
    ["2.", profile.name.toUpperCase()],
    ["3.", formatDate(profile.birthDate, "-")],
    ["4b.", formatDate(profile.licenceExpiry, "-")],
    ["5.", profile.documentNumber],
    ["9.", "AM A1 B"],
  ];
  const licenceClasses = [
    ["AM", "/licence-class-am.png", "Ciclomotor", formatDate(profile.licenceAM, "."), formatDate(profile.licenceExpiry, ".")],
    ["A1", "/licence-class-a1.png", "Motocicleta", formatDate(profile.licenceA1, "."), formatDate(profile.licenceExpiry, ".")],
    ["B", "/licence-class-b.png", "Turismo", formatDate(profile.licenceB, "."), formatDate(profile.licenceExpiry, ".")],
  ];

  return (
    <div className="screen-content carnet-screen">
      <div className="vehicles-safe-top carnet-safe-top" aria-hidden="true" />
      <header className="carnet-toolbar">
        <button type="button" onClick={onBack} aria-label="Cerrar mi carnet">×</button>
        <button
          className="carnet-flip-button"
          type="button"
          onClick={() => setShowBack((current) => !current)}
          aria-label={showBack ? "Mostrar anverso del carnet" : "Mostrar reverso del carnet"}
          aria-pressed={showBack}
        >
          <img className="carnet-wallet-icon" src="/carnet-wallet-icon.png" alt="" aria-hidden="true" />
        </button>
      </header>
      <div className={`carnet-document-background ${showBack ? "carnet-document-background--back" : ""}`}>
        {showBack ? (
          <section className="carnet-license-back" aria-label="Reverso del carnet ficticio">
            <div className="carnet-back-grid carnet-back-header" aria-hidden="true">
              <span>9.</span><span /><span>10.</span><span>11.</span><span>12.</span>
            </div>
            {licenceClasses.map(([licenceClass, icon, iconAlt, start, end]) => (
              <div className="carnet-back-grid carnet-back-row" key={licenceClass}>
                <strong>{licenceClass}</strong>
                <img className="carnet-class-icon" src={icon} alt={iconAlt} />
                <span>{start}</span>
                <span>{end}</span>
                <span />
              </div>
            ))}
            <div className="carnet-back-restrictions">12.</div>
          </section>
        ) : (
          <>
            <section className="carnet-license-heading">
              <img src="/spain-eu-flag.jpg" alt="Identificador europeo España" />
              <div>
                <h1>PERMISO DE CONDUCCIÓN</h1>
                <h2>REINO DE ESPAÑA</h2>
              </div>
            </section>
            <div className="carnet-license-divider" aria-hidden="true" />
            <section className="carnet-license-person" aria-label="Datos del carnet ficticio">
              <div className="carnet-profile-photo">
                <ProfilePhoto src={photoSrc} crop={photoCrop} alt={`Retrato de ${profile.name} ${profile.surname}`} />
              </div>
              <dl>
                {licenseFields.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </>
        )}
        <button className="carnet-qr-button" type="button" aria-label="Código decorativo">
          <span>{Array.from({ length: 36 }, (_, index) => <i key={index} />)}</span>
        </button>
      </div>
    </div>
  );
}

function OfflineBanner({ time = "18:50:14" }: { time?: string }) {
  return (
    <section className="offline-banner" aria-label="Estado de conexión">
      <span className="offline-icon" aria-hidden="true">
        <svg viewBox="0 0 32 32">
          <path d="M5 13.5c6.2-5.1 15.8-5.1 22 0M9.2 18c3.9-3.2 9.7-3.2 13.6 0M13.5 22.2c1.4-1 3.6-1 5 0" />
          <path d="M7 7l18 18" />
        </svg>
      </span>
      <div className="offline-copy">
        <strong>Modo sin conexión</strong>
        <span>Última conexión 15/08/2026 - {time}</span>
        <span>Último intento 15/08/2026 - {time}</span>
      </div>
      <button type="button">CONECTAR</button>
      <span className="offline-chevron" aria-hidden="true">›</span>
    </section>
  );
}

function VehicleScreen({ profile, onOpen }: { profile: Profile; onOpen: () => void }) {
  return (
    <div className="screen-content vehicles-list-screen">
      <div className="vehicles-safe-top" aria-hidden="true" />

      <header className="vehicles-list-title">
        <h1>Mis vehículos</h1>
      </header>

      <OfflineBanner />

      <section className="vehicles-list-body">
        <button className="vehicles-list-card" type="button" onClick={onOpen} aria-label={`Abrir vehículo ${profile.plate}`}>
          <div className="vehicles-card-main">
            <div className="vehicles-card-copy">
              <strong>{profile.plate}</strong>
              <span>{profile.vehicleModel}</span>
              <b>ALTA</b>
            </div>
            <div className="vehicles-card-skyline" aria-hidden="true">
              <i /><i /><i /><i /><i /><i />
            </div>
            <CarArt compact />
          </div>
          <div className="review-alert">
            <span aria-hidden="true">△</span>
            <strong>Aviso de llamada a revisión</strong>
          </div>
        </button>

        <button className="receive-docs" type="button">
          Recibir documentación de un vehículo de otro propietario.
        </button>
      </section>
    </div>
  );
}

function VehicleDetailScreen({ profile, onBack, onOpenPermit }: { profile: Profile; onBack: () => void; onOpenPermit: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  function moveScroll() {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTo({ top: scrolled ? 0 : element.scrollHeight, behavior: "smooth" });
  }

  return (
    <div className="vehicle-detail-shell">
      <div
        className="screen-content vehicle-detail-screen"
        ref={scrollRef}
        onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 180)}
      >
        <div className="vehicle-detail-sticky">
          <div className="vehicles-safe-top" aria-hidden="true" />
          <header className="vehicle-detail-toolbar">
            <button type="button" onClick={onBack} aria-label="Volver a mis vehículos">‹</button>
            <button type="button" aria-label="Más opciones">⋮</button>
          </header>
          <OfflineBanner />
        </div>

        <section className="vehicle-detail-hero" aria-label={`Vehículo ${profile.plate}`}>
          <h1>{profile.plate}</h1>
          <span className="vehicle-detail-dot" aria-hidden="true" />
          <img className="environment-badge" src="/environment-c.png" alt="Distintivo ambiental C" />
          <span className="headlight-beam" aria-hidden="true" />
          <CarArt />
        </section>

        <section className="vehicle-detail-content">
          <button className="detail-review-row" type="button">
            <span aria-hidden="true">△</span>
            <strong>Aviso de llamada a revisión</strong>
            <i aria-hidden="true">›</i>
          </button>

          <div className="detail-document-links">
            <button type="button" onClick={onOpenPermit}><strong>Permiso de circulación</strong><span aria-hidden="true">›</span></button>
            <button type="button"><strong>Datos técnicos</strong><span aria-hidden="true">›</span></button>
          </div>

          <dl className="vehicle-data-card">
            <div><dt>Marca y Modelo</dt><dd>{profile.vehicleModel}</dd></div>
            <div><dt>Carburante</dt><dd>DIESEL</dd></div>
            <div><dt>Cilindrada (CM)</dt><dd>1995</dd></div>
            <div><dt>Bastidor</dt><dd>WBA2C11080V903193</dd></div>
            <div><dt>NIVE</dt><dd>0E059094BE2949A6BD63F6F1CBF8E735</dd></div>
            <div><dt>Fecha matriculación</dt><dd>{profile.registrationDate}</dd></div>
            <div><dt>Fecha de primera matriculación</dt><dd>{profile.registrationDate}</dd></div>
            <div><dt>Distintivo ambiental</dt><dd>C</dd></div>
          </dl>

          <dl className="vehicle-data-card vehicle-data-card--compact">
            <div><dt>ITV</dt><dd>FAVORABLE</dd></div>
            <div><dt>Fecha Fin ITV</dt><dd>{profile.itvExpiry}</dd></div>
            <div><dt>kilómetros</dt><dd>150595</dd></div>
          </dl>

          <dl className="vehicle-data-card vehicle-data-card--compact">
            <div><dt>Entidad Aseguradora</dt><dd>{profile.insurer}</dd></div>
            <div><dt>Fecha Inicio</dt><dd>{profile.insuranceStart}</dd></div>
          </dl>

          <dl className="vehicle-data-card vehicle-data-card--compact vehicle-data-card--owner">
            <div><dt>Titular</dt><dd>{profile.name.toUpperCase()} {profile.surname.toUpperCase()}</dd></div>
            <div><dt>DNI titular</dt><dd>{profile.documentNumber}</dd></div>
            <div><dt>Municipio Fiscal</dt><dd>{profile.fiscalMunicipality}</dd></div>
          </dl>
        </section>
      </div>

      <button className="detail-scroll-fab" type="button" onClick={moveScroll} aria-label={scrolled ? "Volver arriba" : "Deslizar hacia abajo"}>
        <span aria-hidden="true">{scrolled ? "▲" : "▼"}</span>
      </button>
    </div>
  );
}

function PermitScreen({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const fields = [
    ["A", profile.plate.replace(" ", "")],
    ["B", profile.registrationDate],
    ["I", profile.registrationDate],
    ["C.1.1", profile.surname.toUpperCase()],
    ["C.1.2", profile.name.toUpperCase()],
    ["D.1", "BMW"],
    ["D.2", "UKL-L/2C11/6A1500C0"],
    ["D.3", "218D ACTIVE TOURER"],
    ["(D.4)", "PART-SIN ESPECIFICAR"],
    ["E", "WBA2C11080V903193"],
    ["F.1", "1965"],
    ["F.2", "1965"],
    ["G", "1485"],
    ["K", "E1*2007/46*0371*24"],
    ["P.1", "1995.0"],
    ["P.2", "110.0"],
    ["P.3", "DIESEL"],
    ["Q", "0.0"],
    ["S.1", "5"],
    ["S.2", "0"],
  ];

  function moveScroll() {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTo({ top: scrolled ? 0 : element.scrollHeight, behavior: "smooth" });
  }

  return (
    <div className="vehicle-detail-shell permit-shell">
      <div
        className="screen-content permit-screen"
        ref={scrollRef}
        onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 180)}
      >
        <div className="permit-sticky">
          <div className="vehicles-safe-top permit-safe-top" aria-hidden="true" />
          <header className="permit-toolbar">
            <button type="button" onClick={onClose} aria-label="Cerrar permiso">×</button>
            <button type="button" aria-label="Ayuda">?</button>
          </header>
          <OfflineBanner />
        </div>

        <div className="permit-document">
          <section className="permit-cover">
            <h1>REINO DE ESPAÑA</h1>
            <img className="eu-permit-badge" src="/spain-eu-flag.jpg" alt="Identificador europeo España" />
            <h2>PERMISO DE CIRCULACIÓN</h2>
          </section>

          <dl className="permit-fields">
            {fields.map(([label, value]) => (
              <div className="permit-row" key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <button className="permit-qr-fab" type="button" aria-label="Código decorativo">
        <span>{Array.from({ length: 36 }, (_, index) => <i key={index} />)}</span>
      </button>
      <button className="detail-scroll-fab permit-scroll-fab" type="button" onClick={moveScroll} aria-label={scrolled ? "Volver arriba" : "Deslizar hacia abajo"}>
        <span aria-hidden="true">{scrolled ? "▲" : "▼"}</span>
      </button>
    </div>
  );
}

function PersonalizeSheet({
  profile,
  photoSrc,
  photoCrop,
  onClose,
  onSave,
}: {
  profile: Profile;
  photoSrc: string;
  photoCrop: PhotoCrop;
  onClose: () => void;
  onSave: (profile: Profile, crop: PhotoCrop, photoDataUrl?: string) => void;
}) {
  const [draft, setDraft] = useState(profile);
  const [draftPhotoSrc, setDraftPhotoSrc] = useState(photoSrc);
  const [draftPhotoCrop, setDraftPhotoCrop] = useState(photoCrop);
  const [pendingPhoto, setPendingPhoto] = useState<string>();
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    onSave({
      name: draft.name.trim() || DEFAULT_PROFILE.name,
      surname: draft.surname.trim() || DEFAULT_PROFILE.surname,
      plate: draft.plate.trim().toUpperCase() || DEFAULT_PROFILE.plate,
      points: Math.max(0, Math.min(15, Number(draft.points) || 0)),
    }, draftPhotoCrop, pendingPhoto);
  }

  async function choosePhoto(file?: File) {
    if (!file || !file.type.startsWith("image/")) return;
    setPhotoBusy(true);
    setPhotoError("");
    try {
      const optimized = await optimizeProfilePhoto(file);
      setDraftPhotoSrc(optimized);
      setPendingPhoto(optimized);
      setDraftPhotoCrop(DEFAULT_PHOTO_CROP);
    } catch {
      setPhotoError("No se pudo preparar esa imagen. Prueba con otra foto.");
    } finally {
      setPhotoBusy(false);
    }
  }

  function startPhotoDrag(event: ReactPointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      baseX: draftPhotoCrop.x,
      baseY: draftPhotoCrop.y,
    };
  }

  function movePhoto(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setDraftPhotoCrop((current) => normalizePhotoCrop({
      ...current,
      x: drag.baseX + ((event.clientX - drag.startX) / bounds.width) * 100 / current.zoom,
      y: drag.baseY + ((event.clientY - drag.startY) / bounds.height) * 100 / current.zoom,
    }));
  }

  function stopPhotoDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }

  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <form className="personalize-sheet" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title">
          <div><span className="eyebrow">Tu aplicación</span><h2>Personalizar datos</h2></div>
          <button type="button" onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <section className="photo-editor" aria-label="Editar fotografía de perfil">
          <div
            className="photo-crop-frame"
            onPointerDown={startPhotoDrag}
            onPointerMove={movePhoto}
            onPointerUp={stopPhotoDrag}
            onPointerCancel={stopPhotoDrag}
          >
            <ProfilePhoto src={draftPhotoSrc} crop={draftPhotoCrop} alt="Previsualización del retrato" />
            <span aria-hidden="true" />
          </div>
          <div className="photo-editor-controls">
            <strong>Foto y encuadre</strong>
            <small>Arrastra la imagen para colocarla.</small>
            <div className="photo-zoom-control">
              <button type="button" onClick={() => setDraftPhotoCrop((current) => ({ ...current, zoom: clamp(current.zoom - .1, 1, 3) }))} aria-label="Reducir zoom">−</button>
              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={draftPhotoCrop.zoom}
                onChange={(event) => setDraftPhotoCrop((current) => ({ ...current, zoom: Number(event.target.value) }))}
                aria-label="Zoom de la fotografía"
              />
              <button type="button" onClick={() => setDraftPhotoCrop((current) => ({ ...current, zoom: clamp(current.zoom + .1, 1, 3) }))} aria-label="Aumentar zoom">+</button>
            </div>
            <div className="photo-editor-actions">
              <label className={photoBusy ? "is-busy" : ""}>
                <input
                  type="file"
                  accept="image/*"
                  disabled={photoBusy}
                  onChange={(event) => {
                    void choosePhoto(event.target.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                />
                {photoBusy ? "Preparando…" : "Elegir otra foto"}
              </label>
              <button type="button" onClick={() => setDraftPhotoCrop(DEFAULT_PHOTO_CROP)}>Recentrar</button>
            </div>
            {photoError && <span className="photo-error" role="alert">{photoError}</span>}
          </div>
        </section>
        <div className="form-grid">
          <label>Nombre<input value={draft.name} maxLength={18} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
          <label>Apellidos<input value={draft.surname} maxLength={24} onChange={(e) => setDraft({ ...draft, surname: e.target.value })} /></label>
          <label>Matrícula<input value={draft.plate} maxLength={10} onChange={(e) => setDraft({ ...draft, plate: e.target.value })} /></label>
          <label>Puntos<input value={draft.points} type="number" min="0" max="15" onChange={(e) => setDraft({ ...draft, points: Number(e.target.value) })} /></label>
        </div>
        <p className="form-note">La foto y los datos se comprimen y guardan solo en este dispositivo.</p>
        <button className="primary-button" type="submit" disabled={photoBusy}>Guardar cambios</button>
      </form>
    </div>
  );
}

function SideMenu({ onClose, onNavigate }: { onClose: () => void; onNavigate: (view: View) => void }) {
  return (
    <div className="menu-backdrop" role="presentation" onMouseDown={onClose}>
      <aside className="side-menu" aria-label="Menú principal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="side-menu__brand"><DgtLogo className="side-menu__logo" /></div>
        <button className="menu-close" onClick={onClose} aria-label="Cerrar menú">×</button>
        <p>Tu cartera personal, siempre contigo.</p>
        {navItems.map((item) => (
          <button key={item.id} onClick={() => { onNavigate(item.id); onClose(); }}>
            <span>{item.icon}</span>{item.label}<i>›</i>
          </button>
        ))}
      </aside>
    </div>
  );
}

function MiCarnetApp() {
  const [entryStage, setEntryStage] = useState<EntryStage>("access");
  const [view, setView] = useState<View>("inicio");
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [profilePhotoSrc, setProfilePhotoSrc] = useState("/profile-photo.jpg");
  const [profilePhotoCrop, setProfilePhotoCrop] = useState<PhotoCrop>(DEFAULT_PHOTO_CROP);
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    APP_IMAGE_ASSETS.forEach((src) => {
      const image = new window.Image();
      image.decoding = "async";
      image.src = src;
    });
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem("mi-carnet-profile-v4");
    if (saved) {
      try { setProfile({ ...DEFAULT_PROFILE, ...JSON.parse(saved) }); } catch { /* Ignore invalid local data. */ }
    }
    const savedPhoto = window.localStorage.getItem("mi-carnet-profile-photo-v1");
    if (savedPhoto) setProfilePhotoSrc(savedPhoto);
    const savedCrop = window.localStorage.getItem("mi-carnet-profile-crop-v1");
    if (savedCrop) {
      try { setProfilePhotoCrop(normalizePhotoCrop(JSON.parse(savedCrop))); } catch { /* Ignore invalid local data. */ }
    }
  }, []);

  useEffect(() => {
    if (entryStage !== "loading") return;
    const timer = window.setTimeout(() => {
      setView("inicio");
      setEntryStage("app");
    }, 1450);
    return () => window.clearTimeout(timer);
  }, [entryStage]);

  const viewLabel = useMemo(() => view === "vehiculo-detalle" ? "Detalle del vehículo" : view === "permiso-circulacion" ? "Permiso de circulación" : navItems.find((item) => item.id === view)?.label ?? "Inicio", [view]);

  function saveProfile(next: Profile, crop: PhotoCrop, photoDataUrl?: string) {
    setProfile(next);
    setProfilePhotoCrop(crop);
    window.localStorage.setItem("mi-carnet-profile-v4", JSON.stringify(next));
    window.localStorage.setItem("mi-carnet-profile-crop-v1", JSON.stringify(crop));
    if (photoDataUrl) {
      setProfilePhotoSrc(photoDataUrl);
      window.localStorage.setItem("mi-carnet-profile-photo-v1", photoDataUrl);
    }
    setEditing(false);
  }

  return (
    <main className="site-stage">
      <div className="stage-copy">
        <div className="stage-kicker"><span /> Tu cartera personal</div>
        <h1>Todo lo importante,<br /><em>siempre contigo.</em></h1>
        <p>Una experiencia móvil inspirada en la claridad de las mejores apps de documentación, adaptada a tu propia identidad visual.</p>
        <div className="stage-features"><span>✓ Diseño móvil</span><span>✓ Datos locales</span><span>✓ Proyecto visual</span></div>
      </div>

      <div className="phone-shell">
        <div className="phone-hardware" aria-hidden="true"><span className="camera" /><span className="speaker" /></div>
        <div className={`phone-screen ${entryStage !== "app" ? "phone-screen--entry" : view === "inicio" ? "phone-screen--home" : "phone-screen--vehicle"}`}>
          {entryStage !== "app" ? (
            <EntryScreen name={profile.name} loading={entryStage === "loading"} onAccess={() => setEntryStage("loading")} />
          ) : (
            <>
              {view === "inicio" && <AppHeader isHome onMenu={() => setMenuOpen(true)} />}
              <div className={`screen-viewport ${view === "inicio" ? "screen-viewport--home" : "screen-viewport--vehicle"}`} key={view}>
                {view === "inicio" && <HomeScreen profile={profile} photoSrc={profilePhotoSrc} photoCrop={profilePhotoCrop} onNavigate={setView} onEdit={() => setEditing(true)} />}
                {view === "carnet" && <LicenseScreen profile={profile} photoSrc={profilePhotoSrc} photoCrop={profilePhotoCrop} onBack={() => setView("inicio")} />}
                {view === "vehiculo" && <VehicleScreen profile={profile} onOpen={() => setView("vehiculo-detalle")} />}
                {view === "vehiculo-detalle" && <VehicleDetailScreen profile={profile} onBack={() => setView("vehiculo")} onOpenPermit={() => setView("permiso-circulacion")} />}
                {view === "permiso-circulacion" && <PermitScreen profile={profile} onClose={() => setView("vehiculo-detalle")} />}
              </div>
              {editing && <PersonalizeSheet profile={profile} photoSrc={profilePhotoSrc} photoCrop={profilePhotoCrop} onClose={() => setEditing(false)} onSave={saveProfile} />}
              {menuOpen && <SideMenu onClose={() => setMenuOpen(false)} onNavigate={setView} />}
            </>
          )}
        </div>
        <div className="phone-home" aria-hidden="true" />
      </div>

      <div className="stage-status" aria-live="polite"><span /> Pantalla actual: {entryStage === "app" ? viewLabel : entryStage === "loading" ? "Cargando" : "Acceso"}</div>
      <aside className="portfolio-disclosure" aria-label="Información del proyecto">
        PROYECTO NO OFICIAL
      </aside>
      <div className="city-backdrop" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /></div>
    </main>
  );
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "miDGT UI — Proyecto de portfolio" },
      { name: "description", content: "Recreación visual no oficial de una cartera de documentación del conductor, creada como proyecto de portfolio." },
      { property: "og:title", content: "miDGT UI — Proyecto de portfolio" },
      { property: "og:description", content: "Recreación visual no oficial de una cartera de documentación del conductor, creada como proyecto de portfolio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MiCarnetApp,
});
