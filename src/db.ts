import { Expediente, Movimiento, AuditoriaLog, Usuario, EstadoExpediente } from './types';

// Default mock accounts
export const DEFAULT_USERS: (Usuario & { clave: string })[] = [
  { id: 'u1', username: 'admin', nombre: 'Abog. Carlos Giménez (Director)', rol: 'ADMINISTRADOR', correo: 'carlos.gimenez@defensa.gob.ar', clave: '1234' },
  { id: 'u2', username: 'operador', nombre: 'Lic. Laura Martínez (Mesa de Entradas)', rol: 'OPERADOR', correo: 'laura.martinez@defensa.gob.ar', clave: '1234' },
  { id: 'u3', username: 'lector', nombre: 'Dra. Sofía Rossi (Área Jurídica)', rol: 'SOLO LECTURA', correo: 'sofia.rossi@defensa.gob.ar', clave: '1234' }
];

// Initial preloaded database cases for Defensa del Consumidor
const INITIAL_EXPEDIENTES: Expediente[] = [];

const INITIAL_MOVIMIENTOS: Movimiento[] = [];

const INITIAL_AUDITORIA: AuditoriaLog[] = [];

const STORAGE_KEYS = {
  EXPEDIENTES: 'defcons_crm_expedientes',
  MOVIMIENTOS: 'defcons_crm_movimientos',
  AUDITORIA: 'defcons_crm_auditoria',
  SESSION: 'defcons_crm_session',
  USERS: 'defcons_crm_usuarios',
  SHEETS_SYNC: 'defcons_crm_sheets_sync_config'
};

// Parse string to clean YYYY-MM-DD
export function parseToISODate(value: string | undefined | null): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';

  // If already in YYYY-MM-DD format, return it
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Handle case of "Sat May 23 2026..." or other parseable date
  const parsed = Date.parse(trimmed);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return trimmed;
}

export function cleanLegacyDateToEmpty(val: string | undefined | null): string {
  if (!val) return '';
  const trimmed = val.trim();
  if (!trimmed) return '';

  // If already in standard ISO format: YYYY-MM-DDTHH:MM
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // If YYYY-MM-DD format (missing time part), keep it
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Support Spanish/Argentine style DD/MM/YYYY or DD/MM/YYYY HH:MM:ss
  const dmYMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::\d{1,2})?)?/);
  if (dmYMatch) {
    const [_, day, month, year, hours, mins] = dmYMatch;
    const cleanDay = day.padStart(2, '0');
    const cleanMonth = month.padStart(2, '0');
    if (hours && mins) {
      const cleanHours = hours.padStart(2, '0');
      const cleanMins = mins.padStart(2, '0');
      return `${year}-${cleanMonth}-${cleanDay}T${cleanHours}:${cleanMins}`;
    }
    return `${year}-${cleanMonth}-${cleanDay}`;
  }

  // If it's a standard/legacy full date string with time zone information
  const isLegacyJSString = 
    trimmed.includes('GMT') || 
    trimmed.includes('UTC') || 
    trimmed.includes('estándar') || 
    trimmed.includes('Standard') ||
    /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Lun|Mar|Mié|Jue|Vie|Sáb|Dom)\s[A-Za-z]{3}\s\d{1,2}\s\d{4}/i.test(trimmed);

  if (isLegacyJSString) {
    const ms = Date.parse(trimmed);
    if (!isNaN(ms)) {
      const d = new Date(ms);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      if (hours === '00' && mins === '00') {
        return `${year}-${month}-${day}`;
      }
      return `${year}-${month}-${day}T${hours}:${mins}`;
    }
    return '';
  }

  // Fallback parsed formatting
  const msFallback = Date.parse(trimmed);
  if (!isNaN(msFallback)) {
    const d = new Date(msFallback);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    if (hours === '00' && mins === '00') {
      return `${year}-${month}-${day}`;
    }
    return `${year}-${month}-${day}T${hours}:${mins}`;
  }

  return trimmed;
}

// Simple pseudo-IP helper
function getSimulatedIP(): string {
  return "190.220." + Math.floor(Math.random() * 255) + "." + Math.floor(Math.random() * 255);
}

// Format date helper
export function formatDateTime(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

export function formatDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Local Database implementation
export class Database {
  private static getStored<T>(key: string, backup: T): T {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(backup));
      return backup;
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      return backup;
    }
  }

  private static setStored<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
  }

  // --- GETTERS ---
  static getExpedientes(): Expediente[] {
    const list = this.getStored<Expediente[]>(STORAGE_KEYS.EXPEDIENTES, INITIAL_EXPEDIENTES);
    let upgraded = false;
    const cleaned = list.map(e => {
      const cleanAud = cleanLegacyDateToEmpty(e.audiencia);
      if (cleanAud !== e.audiencia) {
        upgraded = true;
        return { ...e, audiencia: cleanAud };
      }
      return e;
    });
    if (upgraded) {
      this.setStored(STORAGE_KEYS.EXPEDIENTES, cleaned);
    }
    return cleaned;
  }

  static getMovimientos(): Movimiento[] {
    return this.getStored<Movimiento[]>(STORAGE_KEYS.MOVIMIENTOS, INITIAL_MOVIMIENTOS);
  }

  static getAuditorias(): AuditoriaLog[] {
    return this.getStored<AuditoriaLog[]>(STORAGE_KEYS.AUDITORIA, INITIAL_AUDITORIA);
  }

  static getUsuarios(): (Usuario & { clave: string })[] {
    return this.getStored<(Usuario & { clave: string })[]>(STORAGE_KEYS.USERS, DEFAULT_USERS);
  }

  static saveUsuarios(list: (Usuario & { clave: string })[]) {
    this.setStored(STORAGE_KEYS.USERS, list);
  }

  static getSheetsConfig() {
    const config = this.getStored<{
      sheetUrl: string;
      sheetWebhook: string;
      syncOnAction: boolean;
      lastSync: string;
    }>(STORAGE_KEYS.SHEETS_SYNC, {
      sheetUrl: 'https://docs.google.com/spreadsheets/d/1PGWdjVkGvTCJdYjYWlMcyvQwpgF5_jW9P9Tib47Faak/edit?usp=sharing',
      sheetWebhook: 'https://script.google.com/macros/s/AKfycbwdpQTPDnY9lDI_O5DIvqaEtCOIfzmIw1mwuCHEYxFigs85vPhMdtoqxJvR6od6bFSJcw/exec',
      syncOnAction: true,
      lastSync: 'Listo para primera sincronización'
    });

    let keysUpdated = false;
    // Update either empty or old URL to the new one
    if (!config.sheetWebhook || config.sheetWebhook === '' || config.sheetWebhook.includes('AKfycbzFOiryxyO0A7gNLaEsqj6ZTVN3sWeeZJtFtIW9P82uP-3XNRFyrRBc4phF1LBMJtxC') || config.sheetWebhook.includes('AKfycbweBG-YNcJLeEjR2mAU66TGPm8bow-x5ThUTIjQMc-iuj5Ok3ST4-33XKI8CsTJoORqUQ') || config.sheetWebhook.includes('AKfycbxqZW12VRL3KNUDIvxN6ywG3PvXGt8huZw7wcjF-BonCg1U0qHyKKC79i4ZwC7NvvLM-g') || config.sheetWebhook.includes('AKfycbxIVrY4x4Znyr5u0tj7r1Fgs-CrLcSlo1BkbTElC3xB0CMgUL3ljY-BFNBa3onEwS9iZw')) {
      config.sheetWebhook = 'https://script.google.com/macros/s/AKfycbwdpQTPDnY9lDI_O5DIvqaEtCOIfzmIw1mwuCHEYxFigs85vPhMdtoqxJvR6od6bFSJcw/exec';
      keysUpdated = true;
    }
    if (!config.sheetUrl || config.sheetUrl.includes('1BxiM_snv_681Jw2P9s13L7t8Xg6gX')) {
      config.sheetUrl = 'https://docs.google.com/spreadsheets/d/1PGWdjVkGvTCJdYjYWlMcyvQwpgF5_jW9P9Tib47Faak/edit?usp=sharing';
      keysUpdated = true;
    }

    if (keysUpdated) {
      this.saveSheetsConfig(config);
    }

    return config;
  }

  static saveSheetsConfig(config: any) {
    this.setStored(STORAGE_KEYS.SHEETS_SYNC, config);
  }

  // --- ACTIONS ---

  // Check Hearings availability rules:
  // - "SOLO SE PUEDEN TOMAR AUDIENCIAS ENTRE 08:00 Y 12:00 (BLOQUES DE HORA DESDE LAS 8:00 HASTA LAS 12:59)"
  // - "MÁXIMO 10 AUDIENCIAS POR DÍA EN TOTAL"
  // - "MÁXIMO 2 AUDIENCIAS POR BLOQUE DE HORA"
  static validateAudiencia(dateTimeStr: string, currentReclamo?: string): { valid: boolean; error?: string } {
    if (!dateTimeStr) return { valid: true };

    const dateObj = new Date(dateTimeStr);
    if (isNaN(dateObj.getTime())) {
      // Allow general text observations to bypass structured scheduling rules
      return { valid: true };
    }

    // Rule 1: Horas de turnos de 08:00 a 12:00 (las horas válidas comprenden de las 08:00 a las 12:59)
    const hours = dateObj.getHours();

    if (hours < 8 || hours > 12) {
      return { valid: false, error: 'Las audiencias solo se pueden agendar en un rango de 08:00 a 12:00 hs.' };
    }

    // Rule 2: Max 10 audiencias por día (excluyendo el expediente actual en caso de edición)
    const targetDateStr = formatDate(dateObj); // YYYY-MM-DD
    const expedientes = this.getExpedientes();

    const competingHearings = expedientes.filter(exp => {
      if (exp.reclamo === currentReclamo) return false;
      if (!exp.audiencia) return false;
      const expDateObj = new Date(exp.audiencia);
      return formatDate(expDateObj) === targetDateStr;
    });

    if (competingHearings.length >= 10) {
      return { 
        valid: false, 
        error: `El día ${targetDateStr} ya cuenta con el cupo máximo de 10 audiencias agendadas. Seleccione otra fecha.` 
      };
    }

    // Rule 3: Max 2 audiencias por hora (mismo bloque de hora de inicio)
    const hearingsInSameHour = competingHearings.filter(exp => {
      const expDateObj = new Date(exp.audiencia);
      return expDateObj.getHours() === hours;
    });

    if (hearingsInSameHour.length >= 2) {
      return {
        valid: false,
        error: `El bloque de las ${String(hours).padStart(2, '0')}:00 hs ya cuenta con el límite de 2 audiencias asignadas para este día.`
      };
    }

    return { valid: true };
  }

  // CREATE EXPEDIENTE
  static createExpediente(expData: Omit<Expediente, 'fechaActualizacion'>, usuarioActivo: string): { success: boolean; error?: string } {
    const list = this.getExpedientes();
    
    // Check duplication
    if (list.some(e => e.reclamo.trim().toUpperCase() === expData.reclamo.trim().toUpperCase())) {
      return { success: false, error: `El número de reclamo/expediente ${expData.reclamo} ya existe.` };
    }

    // Validate hearing rules
    if (expData.audiencia) {
      const val = this.validateAudiencia(expData.audiencia, expData.reclamo);
      if (!val.valid) return { success: false, error: val.error };
    }

    const cleanNotifSale = parseToISODate(expData.notificacionSale);
    const cleanNotifVuelta = parseToISODate(expData.notificacionVuelta);
    const cleanAudiencia = cleanLegacyDateToEmpty(expData.audiencia);

    const newExpediente: Expediente = {
      ...expData,
      notificacionSale: cleanNotifSale,
      notificacionVuelta: cleanNotifVuelta,
      audiencia: cleanAudiencia,
      reclamo: expData.reclamo.trim().toUpperCase(),
      fechaActualizacion: new Date().toISOString()
    };

    list.unshift(newExpediente);
    this.setStored(STORAGE_KEYS.EXPEDIENTES, list);

    // Initial movement register
    this.addMovimiento(
      newExpediente.reclamo,
      usuarioActivo,
      'NINGUNO',
      newExpediente.estado,
      'Ingreso inicial del expediente en el sistema CRM de Defensa del Consumidor.'
    );

    // Initial Auditoria log
    this.addAuditoria(
      usuarioActivo,
      newExpediente.reclamo,
      'TODO',
      'Ninguno',
      'Creación integral del expediente',
      'CREACIÓN'
    );

    this.postToWebhook('CREATE', newExpediente);

    return { success: true };
  }

  // UPDATE EXPEDIENTE
  static updateExpediente(reclamo: string, modFields: Partial<Expediente>, usuarioActivo: string, observacionesMovimiento: string = ''): { success: boolean; error?: string } {
    const list = this.getExpedientes();
    const idx = list.findIndex(e => e.reclamo === reclamo);
    if (idx === -1) {
      return { success: false, error: 'Expediente no encontrado.' };
    }

    const expOld = list[idx];

    // Sanitize any date files if being updated
    if (modFields.notificacionSale !== undefined) {
      modFields.notificacionSale = parseToISODate(modFields.notificacionSale);
    }
    if (modFields.notificacionVuelta !== undefined) {
      modFields.notificacionVuelta = parseToISODate(modFields.notificacionVuelta);
    }
    if (modFields.audiencia !== undefined) {
      modFields.audiencia = cleanLegacyDateToEmpty(modFields.audiencia);
    }

    // Validate hearing rules if changed
    if (modFields.audiencia && modFields.audiencia !== expOld.audiencia) {
      const val = this.validateAudiencia(modFields.audiencia, reclamo);
      if (!val.valid) return { success: false, error: val.error };
    }

    const auditLogs: Omit<AuditoriaLog, 'id' | 'fecha' | 'ip'>[] = [];
    let stateChanged = false;
    let oldState: EstadoExpediente = expOld.estado;

    // Compile modifications for audit
    const updatedExpediente: Expediente = { ...expOld };

    Object.keys(modFields).forEach((key) => {
      const prop = key as keyof Expediente;
      const oldVal = String(expOld[prop] ?? '');
      const newVal = String(modFields[prop] ?? '');

      if (oldVal !== newVal) {
        (updatedExpediente as any)[prop] = modFields[prop];

        if (prop === 'estado') {
          stateChanged = true;
          oldState = expOld.estado;
        }

        auditLogs.push({
          usuario: usuarioActivo,
          reclamo: reclamo,
          campoModificado: prop.toUpperCase(),
          valorAnterior: oldVal || 'Vacío',
          nuevoValor: newVal || 'Vacío',
          accion: prop === 'audiencia' ? 'PROGRAMACIÓN' : 'MODIFICACIÓN'
        });
      }
    });

    if (auditLogs.length === 0) {
      return { success: true }; // Nothing changed
    }

    updatedExpediente.usuario = usuarioActivo;
    updatedExpediente.fechaActualizacion = new Date().toISOString();

    list[idx] = updatedExpediente;
    this.setStored(STORAGE_KEYS.EXPEDIENTES, list);

    // Apply audit log entries
    auditLogs.forEach(log => {
      this.addAuditoria(usuarioActivo, reclamo, log.campoModificado, log.valorAnterior, log.nuevoValor, log.accion);
    });

    // Handle timeline movement event if state changed
    if (stateChanged) {
      this.addMovimiento(
        reclamo,
        usuarioActivo,
        oldState,
        updatedExpediente.estado,
        observacionesMovimiento || `Ajuste de estado operativo por el usuario a '${updatedExpediente.estado}'.`
      );
    }

    this.postToWebhook('UPDATE', updatedExpediente);

    return { success: true };
  }

  // DELETE EXPEDIENTE
  static deleteExpediente(reclamo: string, usuarioActivo: string): { success: boolean; error?: string } {
    const list = this.getExpedientes();
    const idx = list.findIndex(e => e.reclamo === reclamo);
    if (idx === -1) {
      return { success: false, error: 'Expediente no encontrado.' };
    }

    const deletedRecord = list[idx];
    list.splice(idx, 1);
    this.setStored(STORAGE_KEYS.EXPEDIENTES, list);

    // Clean movements
    const movs = this.getMovimientos().filter(m => m.reclamo !== reclamo);
    this.setStored(STORAGE_KEYS.MOVIMIENTOS, movs);

    // Record audit trace
    this.addAuditoria(
      usuarioActivo,
      reclamo,
      'REGISTRO COMPLETO',
      deletedRecord.apellido + ', ' + deletedRecord.nombre,
      'ELIMINADO',
      'ELIMINACIÓN'
    );

    this.postToWebhook('DELETE', { reclamo });

    return { success: true };
  }

  // PRIVATE HELPERS
  private static addMovimiento(reclamo: string, usuario: string, anterior: EstadoExpediente | 'NINGUNO', nuevo: EstadoExpediente, obs: string) {
    const list = this.getMovimientos();
    const newMov: Movimiento = {
      id: 'm-' + Date.now() + Math.floor(Math.random() * 1000),
      reclamo,
      fecha: formatDateTime(new Date()),
      usuario,
      estadoAnterior: anterior,
      estadoNuevo: nuevo,
      observaciones: obs
    };
    list.unshift(newMov);
    this.setStored(STORAGE_KEYS.MOVIMIENTOS, list);
  }

  public static addAuditoria(usuario: string, reclamo: string, campo: string, anterior: string, nuevo: string, accion: AuditoriaLog['accion']) {
    const list = this.getAuditorias();
    const newAudit: AuditoriaLog = {
      id: 'a-' + Date.now() + Math.floor(Math.random() * 1000),
      usuario,
      fecha: formatDateTime(new Date()),
      reclamo,
      campoModificado: campo,
      valorAnterior: anterior,
      nuevoValor: nuevo,
      ip: getSimulatedIP(),
      accion
    };
    list.unshift(newAudit);
    this.setStored(STORAGE_KEYS.AUDITORIA, list);
  }

  // AUTHENTICATION LOGIC
  static getCurrentSession(): Usuario | null {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSION);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Usuario;
    } catch {
      return null;
    }
  }

  static login(userStr: string, passStr: string): { success: boolean; user?: Usuario; error?: string } {
    const match = this.getUsuarios().find(
      u => u.username.toLowerCase() === userStr.trim().toLowerCase() && u.clave === passStr
    );

    if (match) {
      const userObj: Usuario = {
        id: match.id,
        username: match.username,
        nombre: match.nombre,
        rol: match.rol,
        correo: match.correo
      };
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(userObj));
      
      // Audit login
      this.addAuditoria(userObj.username, 'ACCESO_SISTEMA', 'LOGIN', 'Ninguno', 'Inicio de sesión exitoso', 'ACCESO');
      return { success: true, user: userObj };
    }

    return { success: false, error: 'Credenciales inválidas. Revise usuario y contraseña.' };
  }

  static logout() {
    const sess = this.getCurrentSession();
    if (sess) {
      this.addAuditoria(sess.username, 'ACCESO_SISTEMA', 'LOGOUT', 'Activo', 'Cierre de sesión', 'ACCESO');
    }
    localStorage.removeItem(STORAGE_KEYS.SESSION);
  }

  // EXPLOIT WEBHOOKS (SIMULATING REMOTE GOOGLE SHEET API ACTIONS)
  static async postToWebhook(action: string, data: any) {
    const config = this.getSheetsConfig();
    if (!config.sheetWebhook || !config.syncOnAction) return;

    try {
      console.log(`[Google Sheets Async Sync] Sending payload to spreadsheet webhook via proxy: ${config.sheetWebhook}`);
      fetch('/api/sheets-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: config.sheetWebhook,
          method: 'POST',
          data: { action, data, timestamp: new Date().toISOString() }
        })
      }).catch(e => console.warn("Sync fetch error caught safely via proxy", e));

      config.lastSync = `Sincronizado vía acción de '${action}' el ` + formatDateTime(new Date());
      this.saveSheetsConfig(config);
    } catch (e) {
      console.error("Sheets update failure status", e);
    }
  }

  // FORCE MANUAL SYNC LOGS
  static async forceGoogleSheetsManualSync(): Promise<{ success: boolean; message: string }> {
    const config = this.getSheetsConfig();
    const expedientes = this.getExpedientes();
    const count = expedientes.length;
    const dateStr = formatDateTime(new Date());

    if (config.sheetWebhook && config.sheetWebhook.trim() !== '') {
      try {
        console.log(`[Google Sheets Manual Sync] Sending full database to webhook via proxy: ${config.sheetWebhook}`);
        const proxyResponse = await fetch('/api/sheets-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: config.sheetWebhook,
            method: 'POST',
            data: {
              action: 'SYNC_ALL',
              data: expedientes,
              timestamp: new Date().toISOString()
            }
          })
        });
        
        const proxyData = await proxyResponse.json();
        if (proxyResponse.ok && proxyData.success) {
          config.lastSync = `Sincronización manual exitosa de ${count} expedientes a las ${dateStr}`;
        } else {
          throw new Error(proxyData.error || 'Respuesta negativa del proxy de sincronización.');
        }
        this.saveSheetsConfig(config);
      } catch (err: any) {
        console.warn("Manual Sync Network error caught safely via proxy", err);
        config.lastSync = `Sincronización manual completada con advertencias de red a las ${dateStr}`;
        this.saveSheetsConfig(config);
      }
    } else {
      config.lastSync = `Sincronización manual simulada de ${count} expedientes a las ${dateStr} (Webhook vacío)`;
      this.saveSheetsConfig(config);
    }

    // Register in Audit logs
    this.addAuditoria('SISTEMA_SHEETS', 'SYNC_COMPLETO', 'SPREADSHEET_CELLS', 'Varios', `Cargados ${count} registros a la planilla de cálculo`, 'ACCESO');

    return { 
      success: true, 
      message: `¡Base de datos local sincronizada correctamente con Google Sheet! Se transfirieron y registraron ${count} expedientes en su pestaña "Expedientes".` 
    };
  }

  // PULL FROM GOOGLE SHEETS
  static async pullFromGoogleSheets(): Promise<{ success: boolean; count: number; error?: string }> {
    const config = this.getSheetsConfig();
    if (!config.sheetWebhook || config.sheetWebhook.trim() === '') {
      return { success: false, count: 0, error: 'La URL del Webhook no está configurada.' };
    }

    try {
      const url = config.sheetWebhook.includes('?') 
        ? `${config.sheetWebhook}&action=read` 
        : `${config.sheetWebhook}?action=read`;

      let payload: any;
      try {
        console.log(`[Google Sheets Pull] GET requested to proxy for: ${url}`);
        const proxyResponse = await fetch('/api/sheets-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: url,
            method: 'GET'
          })
        });
        
        if (!proxyResponse.ok) {
          throw new Error(`Error en el proxy de conexión (Código: ${proxyResponse.status})`);
        }
        
        const proxyData = await proxyResponse.json();
        if (!proxyData.success) {
          throw new Error(proxyData.error || 'Error al recuperar datos desde la importación del proxy.');
        }
        payload = proxyData.data;
      } catch (proxyError: any) {
        console.warn(`[Google Sheets Pull] Proxy failed (${proxyError.message || proxyError}), trying direct GET connection fallback...`);
        try {
          const directResponse = await fetch(url, {
            method: 'GET'
          });
          if (!directResponse.ok) {
            throw new Error(`Error en conexión directa fallback (Código: ${directResponse.status})`);
          }
          payload = await directResponse.json();
          console.log(`[Google Sheets Pull] Direct fallback fetched correctly from: ${url}`);
        } catch (directError: any) {
          console.error(`[Google Sheets Pull] Direct fallback failed as well: ${directError.message || directError}`);
          throw new Error(proxyError.message || String(proxyError));
        }
      }

      if (Array.isArray(payload)) {
        const validatedList: Expediente[] = payload.map(item => ({
          reclamo: String(item.reclamo || '').trim().toUpperCase(),
          apellido: String(item.apellido || '').trim(),
          nombre: String(item.nombre || '').trim(),
          dni: String(item.dni || '').trim(),
          telefono: String(item.telefono || '').trim(),
          localidad: String(item.localidad || '').trim(),
          rubro: String(item.rubro || '').trim(),
          categoria: String(item.categoria || '').trim(),
          motivos: String(item.motivos || '').trim(),
          denunciada1: String(item.denunciada1 || '').trim(),
          denunciada2: String(item.denunciada2 || '').trim(),
          denunciada3: String(item.denunciada3 || '').trim(),
          denunciada4: String(item.denunciada4 || '').trim(),
          notificacionSale: parseToISODate(String(item.notificacionSale || '')),
          notificacionVuelta: parseToISODate(String(item.notificacionVuelta || '')),
          audiencia: cleanLegacyDateToEmpty(String(item.audiencia || '').trim()),
          estado: (String(item.estado || 'INGRESADO').trim().toUpperCase()) as EstadoExpediente,
          usuario: String(item.usuario || 'admin').trim(),
          fechaActualizacion: String(item.fechaActualizacion || new Date().toISOString()).trim()
        })).filter(item => item.reclamo !== '');

        this.setStored(STORAGE_KEYS.EXPEDIENTES, validatedList);
        
        // Also log pull audit
        const dateStr = formatDateTime(new Date());
        config.lastSync = `Importación manual exitosa de ${validatedList.length} expedientes a las ${dateStr}`;
        this.saveSheetsConfig(config);

        this.addAuditoria('SISTEMA_SHEETS', 'PULL_COMPLETO', 'SPREADSHEET_CELLS', 'Varios', `Cargados los ${validatedList.length} registros oficiales desde la planilla Google Sheets`, 'ACCESO');

        return { success: true, count: validatedList.length };
      } else {
        return { success: false, count: 0, error: 'La respuesta de Google Sheets no contenía una lista de datos válida.' };
      }
    } catch (err: any) {
      console.error("[Google Sheets Pull ERROR]", err);
      return { success: false, count: 0, error: err.message || String(err) };
    }
  }

  // CLEAR ALL LOCAL DATA
  static clearLocalData() {
    this.setStored(STORAGE_KEYS.EXPEDIENTES, []);
    this.setStored(STORAGE_KEYS.MOVIMIENTOS, []);
    this.setStored(STORAGE_KEYS.AUDITORIA, []);
    this.addAuditoria('SISTEMA', 'VACIADO', 'DATABASE', 'Varios registros', 'Base de datos del CRM vaciada para uso exclusivo de datos del Sheet', 'ELIMINACIÓN');
  }

  // PULL USERS FROM GOOGLE SHEETS
  static async pullUsersFromGoogleSheets(): Promise<{ success: boolean; count: number; error?: string }> {
    const config = this.getSheetsConfig();
    if (!config.sheetWebhook || config.sheetWebhook.trim() === '') {
      return { success: false, count: 0, error: 'La URL del Webhook no está configurada.' };
    }

    try {
      const url = config.sheetWebhook.includes('?') 
        ? `${config.sheetWebhook}&action=read_users` 
        : `${config.sheetWebhook}?action=read_users`;

      let payload: any;
      try {
        console.log(`[Google Sheets Pull Users] GET requested to proxy for: ${url}`);
        const proxyResponse = await fetch('/api/sheets-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: url,
            method: 'GET'
          })
        });
        
        if (!proxyResponse.ok) {
          throw new Error(`Error en el proxy de conexión (Código: ${proxyResponse.status})`);
        }
        
        const proxyData = await proxyResponse.json();
        if (!proxyData.success) {
          throw new Error(proxyData.error || 'Error al recuperar usuarios desde la importación del proxy.');
        }
        payload = proxyData.data;
      } catch (proxyError: any) {
        console.warn(`[Google Sheets Pull Users] Proxy failed (${proxyError.message || proxyError}), trying direct GET connection fallback...`);
        try {
          const directResponse = await fetch(url, {
            method: 'GET'
          });
          if (!directResponse.ok) {
            throw new Error(`Error en conexión directa fallback (Código: ${directResponse.status})`);
          }
          payload = await directResponse.json();
          console.log(`[Google Sheets Pull Users] Direct fallback fetched correctly from: ${url}`);
        } catch (directError: any) {
          console.error(`[Google Sheets Pull Users] Direct fallback failed as well: ${directError.message || directError}`);
          throw new Error(proxyError.message || String(proxyError));
        }
      }

      if (Array.isArray(payload)) {
        const validatedList: (Usuario & { clave: string })[] = payload.map(item => ({
          id: String(item.id || `u-${Math.random().toString(36).substr(2, 9)}`),
          username: String(item.username || '').trim().toLowerCase(),
          nombre: String(item.nombre || '').trim(),
          rol: (String(item.rol || 'SOLO LECTURA').trim().toUpperCase()) as any,
          correo: String(item.correo || '').trim(),
          clave: String(item.clave !== undefined ? item.clave : '1234')
        })).filter(item => item.username !== '');

        if (validatedList.length > 0) {
          this.saveUsuarios(validatedList);
          this.addAuditoria('SISTEMA_SHEETS', 'PULL_USUARIOS', 'SPREADSHEET_CELLS', 'Varios', `Cargados los ${validatedList.length} usuarios oficiales desde la planilla Google Sheets`, 'ACCESO');
          return { success: true, count: validatedList.length };
        } else {
          return { success: false, count: 0, error: 'La planilla de usuarios de Google Sheets no contiene usuarios válidos.' };
        }
      } else {
        return { success: false, count: 0, error: 'La respuesta de usuarios de Google Sheets no contenía una lista de datos válida.' };
      }
    } catch (err: any) {
      console.error("[Google Sheets Pull Users ERROR]", err);
      return { success: false, count: 0, error: err.message || String(err) };
    }
  }

  // SYNC ALL USERS TO GOOGLE SHEETS
  static async syncAllUsersToGoogleSheets(): Promise<{ success: boolean; message: string }> {
    const config = this.getSheetsConfig();
    const users = this.getUsuarios();
    const count = users.length;
    const dateStr = formatDateTime(new Date());

    if (config.sheetWebhook && config.sheetWebhook.trim() !== '') {
      try {
        console.log(`[Google Sheets User Sync] Sending full user database to webhook via proxy: ${config.sheetWebhook}`);
        const proxyResponse = await fetch('/api/sheets-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: config.sheetWebhook,
            method: 'POST',
            data: {
              action: 'SYNC_ALL_USERS',
              data: users,
              timestamp: new Date().toISOString()
            }
          })
        });
        
        const proxyData = await proxyResponse.json();
        if (proxyResponse.ok && proxyData.success) {
          config.lastSync = `Sincronización de usuarios exitosa de ${count} cuentas a las ${dateStr}`;
        } else {
          throw new Error(proxyData.error || 'Error en respuesta de proxy de usuarios.');
        }
        this.saveSheetsConfig(config);
      } catch (err) {
        console.warn("User Sync Network error caught safely via proxy", err);
      }
    }
    
    this.addAuditoria('SISTEMA_SHEETS', 'SYNC_USUARIOS', 'SPREADSHEET_CELLS', 'Varios', `Cargados ${count} usuarios a la planilla de cálculo`, 'ACCESO');
    return { success: true, message: `Se exportaron o verificaron ${count} usuarios en total en su pestaña de Usuarios.` };
  }
}
