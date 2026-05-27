export type RolUsuario = 'ADMINISTRADOR' | 'OPERADOR' | 'SOLO LECTURA';

export type EstadoExpediente = string;

export interface Expediente {
  reclamo: string; // N° de Reclamo (Primary Key)
  apellido: string;
  nombre: string;
  dni: string;
  telefono: string;
  localidad: string;
  rubro: string;
  categoria: string;
  motivos: string;
  denunciada1: string;
  denunciada2: string;
  denunciada3: string;
  denunciada4: string;
  notificacionSale: string;  // Fecha de salida de notificación (YYYY-MM-DD or string)
  notificacionVuelta: string; // Fecha de vuelta o estado de notificación (YYYY-MM-DD or string)
  audiencia: string;          // Fecha y hora de audiencia (YYYY-MM-DDTHH:mm or empty)
  estado: EstadoExpediente;
  usuario: string;            // Último usuario que modificó el expediente
  fechaActualizacion: string; // Fecha y hora de última actualización (ISO string)
  auditado?: boolean;
}

export interface Movimiento {
  id: string;
  reclamo: string;
  fecha: string;        // YYYY-MM-DD HH:mm:ss
  usuario: string;
  estadoAnterior: EstadoExpediente | 'NINGUNO';
  estadoNuevo: EstadoExpediente;
  observaciones: string;
}

export interface AuditoriaLog {
  id: string;
  usuario: string;
  fecha: string;        // YYYY-MM-DD HH:mm:ss
  reclamo: string;
  campoModificado: string; // "TODO" (for creation) / "ESTADO" / etc.
  valorAnterior: string;
  nuevoValor: string;
  ip: string;
  accion: 'CREACIÓN' | 'MODIFICACIÓN' | 'ELIMINACIÓN' | 'ACCESO' | 'PROGRAMACIÓN';
}

export interface Usuario {
  id: string;
  username: string;
  nombre: string;
  rol: RolUsuario;
  correo: string;
}

export interface AudienciaResumen {
  fecha: string; // YYYY-MM-DD
  cantidad: number;
}
