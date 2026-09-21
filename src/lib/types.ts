export interface SheetRow {
  estado: string;
  email: string;
  solicitadaPor: string;
  lineaPresupuestaria: string;
  marcaTemporal: string;
  mes: string;
  proyecto: string;
  nroOC: string;
  proveedor: string;
  monto: number;
  descripcion: string;
  rendirA: string;
  col13: string;
  col14: string;
  tipoDocumento: string;
  nroDocumento: string;
  rut: string;
  banco: string;
  numeroCuenta: string;
  correoProveedor: string;
  account: string;
  linkOC: string;
  linkFactura: string;
  fechaFactura: string;
  linkPago: string;
}

export type UserRole = 'admin' | 'viewer';

export interface UserMetadata {
  role: UserRole;
  // Puede ser un string ("019") o un array (["020","023-05"]).
  // El match es por prefijo: "008" deja ver "008-01-01", "008-02-01", etc.
  linea_presupuestaria?: string | string[];
}

export interface BudgetLine {
  codigo: string;            // 3-level code, e.g. "006-01-01"
  descripcion: string;       // descripción del ítem (col F)
  categoria: string;         // categoría topsheet, ej: "PRODUCTION STAFF" (col D)
  subcuenta: string;         // sub-cuenta, ej: "GASTOS GENERALES" (col E)
  presupuesto: number;       // monto presupuestado en CLP
}
