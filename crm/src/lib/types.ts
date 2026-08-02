export type Role = "titolare" | "agente";

export interface User {
  id: number;
  email: string;
  name: string;
  password_hash: string;
  role: Role;
  office: string;
  active: number;
  created_at: string;
}

export type SessionUser = Pick<User, "id" | "email" | "name" | "role" | "office">;

export interface Client {
  id: number;
  first_name: string;
  last_name: string;
  company: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  tax_code: string | null;
  birth_date: string | null;
  roles: string;
  source: string | null;
  status: string;
  owner_id: number | null;
  tags: string;
  notes: string | null;
  privacy_consent: number;
  privacy_date: string | null;
  privacy_scope: string | null;
  aml_doc_type: string | null;
  aml_doc_number: string | null;
  aml_doc_expiry: string | null;
  aml_checked_at: string | null;
  last_contact_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Property {
  id: number;
  ref: string;
  title: string;
  kind: string;
  contract: string;
  address: string | null;
  city: string | null;
  zone: string | null;
  sqm: number | null;
  rooms: number | null;
  bathrooms: number | null;
  floor: string | null;
  elevator: number;
  outdoor: string | null;
  garage: number;
  condition: string | null;
  energy_class: string | null;
  price: number | null;
  min_price: number | null;
  status: string;
  owner_client_id: number | null;
  agent_id: number | null;
  mandate_start: string | null;
  mandate_end: string | null;
  exclusive: number;
  commission_pct: number | null;
  sold_price: number | null;
  preliminary_date: string | null;
  deed_date: string | null;
  commission_seller: number | null;
  commission_buyer: number | null;
  commission_paid: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Requirement {
  id: number;
  client_id: number;
  contract: string;
  kind: string | null;
  city: string | null;
  zones: string;
  budget_min: number | null;
  budget_max: number | null;
  sqm_min: number | null;
  rooms_min: number | null;
  needs: string;
  urgency: string;
  financing: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: number;
  type: string;
  title: string;
  notes: string | null;
  client_id: number | null;
  property_id: number | null;
  user_id: number | null;
  due_at: string | null;
  done_at: string | null;
  outcome: string | null;
  interest: string | null;
  created_at: string;
}

export interface Offer {
  id: number;
  property_id: number;
  client_id: number;
  amount: number;
  offered_at: string;
  valid_until: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

export interface Valuation {
  id: number;
  property_id: number | null;
  client_id: number | null;
  city: string | null;
  zone: string | null;
  sqm: number | null;
  eur_sqm_min: number | null;
  eur_sqm_max: number | null;
  value_min: number | null;
  value_max: number | null;
  method: string | null;
  notes: string | null;
  user_id: number | null;
  created_at: string;
}

// ------------------------------------------------------------- vocabolari
// Un solo posto dove vivono le opzioni dei menu a tendina.

export const CLIENT_ROLES = [
  "venditore",
  "acquirente",
  "locatore",
  "conduttore",
  "segnalatore",
  "collega",
] as const;

export const CLIENT_STATUSES = [
  { value: "attivo", label: "Attivo" },
  { value: "in_trattativa", label: "In trattativa" },
  { value: "dormiente", label: "Dormiente" },
  { value: "chiuso", label: "Chiuso" },
  { value: "non_interessato", label: "Non piu' interessato" },
] as const;

export const CLIENT_SOURCES = [
  "Sito web",
  "Immobiliare.it",
  "Idealista",
  "Casa.it",
  "Passaparola",
  "Cartello",
  "Social",
  "Cliente storico",
  "Altro",
] as const;

export const PROPERTY_KINDS = [
  "Appartamento",
  "Attico",
  "Villa",
  "Villetta a schiera",
  "Casa indipendente",
  "Trullo / Pajara",
  "Masseria",
  "Terreno",
  "Locale commerciale",
  "Box / Garage",
  "Rustico",
] as const;

export const PROPERTY_STATUSES = [
  { value: "acquisizione", label: "In acquisizione" },
  { value: "in_vendita", label: "In vendita" },
  { value: "proposta", label: "Proposta ricevuta" },
  { value: "compromesso", label: "Compromesso" },
  { value: "venduto", label: "Venduto" },
  { value: "ritirato", label: "Ritirato" },
] as const;

/** Stati in cui un immobile e' ancora proponibile a un acquirente. */
export const AVAILABLE_STATUSES = ["acquisizione", "in_vendita"] as const;

export const PROPERTY_CONDITIONS = [
  "Nuovo / In costruzione",
  "Ristrutturato",
  "Buono stato",
  "Da ristrutturare",
] as const;

export const ENERGY_CLASSES = ["A4", "A3", "A2", "A1", "B", "C", "D", "E", "F", "G"] as const;

export const ACTIVITY_TYPES = [
  { value: "chiamata", label: "Telefonata" },
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "visita", label: "Visita" },
  { value: "appuntamento", label: "Appuntamento" },
  { value: "nota", label: "Nota" },
  { value: "task", label: "Da fare" },
] as const;

export const OFFER_STATUSES = [
  { value: "in_attesa", label: "In attesa" },
  { value: "accettata", label: "Accettata" },
  { value: "rifiutata", label: "Rifiutata" },
  { value: "ritirata", label: "Ritirata" },
] as const;

export const REQUIREMENT_STATUSES = [
  { value: "aperta", label: "Aperta" },
  { value: "pausa", label: "In pausa" },
  { value: "soddisfatta", label: "Soddisfatta" },
  { value: "persa", label: "Persa" },
] as const;

export const URGENCIES = ["bassa", "media", "alta"] as const;

export const FINANCING = [
  { value: "contanti", label: "Contanti" },
  { value: "mutuo_deliberato", label: "Mutuo gia' deliberato" },
  { value: "mutuo_da_valutare", label: "Mutuo da valutare" },
] as const;

export const OFFICES = ["Lecce", "Porto Cesareo"] as const;

/**
 * Zone di riferimento del mercato locale. Servono ai filtri e al matching:
 * l'utente puo' comunque scrivere una zona libera.
 */
export const ZONES = [
  "Centro storico",
  "Mazzini",
  "Salesiani",
  "Rudiae",
  "San Lazzaro",
  "Ariosto",
  "Santa Rosa",
  "Leuca",
  "Periferia",
  "Frigole",
  "San Cataldo",
  "Torre Chianca",
  "Porto Cesareo",
  "Torre Lapillo",
] as const;
