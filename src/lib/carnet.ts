export type CarnetData = {
  name: string;
  surname: string;
  points: number;
  birthDate: string;
  documentNumber: string;
  licenceExpiry: string;
  licenceAM: string;
  licenceA1: string;
  licenceB: string;
  photoUrl: string;
  photoZoom: number;
  photoX: number;
  photoY: number;
  plate: string;
  vehicleModel: string;
  registrationDate: string;
  itvExpiry: string;
  insurer: string;
  insuranceStart: string;
  fiscalMunicipality: string;
};

export const DEFAULT_CARNET: CarnetData = {
  name: "Carlos",
  surname: "Medina",
  points: 13,
  birthDate: "29/09/2005",
  documentNumber: "51255926N",
  licenceExpiry: "21/03/2035",
  licenceAM: "07/05/2022",
  licenceA1: "13/01/2024",
  licenceB: "21/03/2025",
  photoUrl: "/profile-photo.jpg",
  photoZoom: 1,
  photoX: 0,
  photoY: 0,
  plate: "8263 JTR",
  vehicleModel: "BMW 218D ACTIVE TOURER",
  registrationDate: "03/11/2016",
  itvExpiry: "03/11/2026",
  insurer: "MUTUA LEVANTE",
  insuranceStart: "02/04/2025",
  fiscalMunicipality: "ALICANTE",
};

/** Shape of a row coming from the database (snake_case). */
export type CarnetRow = {
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
  photo_zoom: number | string;
  photo_x: number | string;
  photo_y: number | string;
  plate: string;
  vehicle_model: string;
  registration_date: string;
  itv_expiry: string;
  insurer: string;
  insurance_start: string;
  fiscal_municipality: string;
};

export function rowToCarnet(row: CarnetRow): CarnetData {
  return {
    name: row.name,
    surname: row.surname,
    points: Number(row.points),
    birthDate: row.birth_date,
    documentNumber: row.document_number,
    licenceExpiry: row.licence_expiry,
    licenceAM: row.licence_am,
    licenceA1: row.licence_a1,
    licenceB: row.licence_b,
    photoUrl: row.photo_url || "/profile-photo.jpg",
    photoZoom: Number(row.photo_zoom) || 1,
    photoX: Number(row.photo_x) || 0,
    photoY: Number(row.photo_y) || 0,
    plate: row.plate,
    vehicleModel: row.vehicle_model,
    registrationDate: row.registration_date,
    itvExpiry: row.itv_expiry,
    insurer: row.insurer,
    insuranceStart: row.insurance_start,
    fiscalMunicipality: row.fiscal_municipality,
  };
}

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
