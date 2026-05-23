import React, { useState, useEffect } from 'react';
import { Database, formatDateTime } from '../db';
import { FileSpreadsheet, Play, Link, Copy, CheckCircle, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';

interface SheetSettingsProps {
  addToast: (msg: string, type: 'success' | 'error' | 'warning') => void;
  currentUserRol: string;
  syncTrigger?: number;
}

export function SheetSettings({ addToast, currentUserRol, syncTrigger }: SheetSettingsProps) {
  const [config, setConfig] = useState(() => Database.getSheetsConfig());

  useEffect(() => {
    setConfig(Database.getSheetsConfig());
  }, [syncTrigger]);
  const [copied, setCopied] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const isReadOnly = currentUserRol === 'SOLO LECTURA';

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) {
      addToast('Su usuario cuenta con el Rol Solo Lectura. No tiene permisos de reconfiguración.', 'warning');
      return;
    }
    Database.saveSheetsConfig(config);
    addToast('¡Configuración de Google Sheets de Defensa del Consumidor guardada con éxito!', 'success');
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const res = await Database.forceGoogleSheetsManualSync();
      setConfig(Database.getSheetsConfig()); // Refresh state
      addToast(res.message, 'success');
    } catch (err) {
      addToast('Error de conexión de red: ' + String(err), 'error');
    } finally {
      setSyncing(false);
    }
  };

  const [pulling, setPulling] = useState(false);

  const handleImportFromSheets = async () => {
    if (!config.sheetWebhook || config.sheetWebhook.trim() === '') {
      addToast('Defina primero la URL del Webhook de Google Apps Script.', 'error');
      return;
    }
    const confirmImport = window.confirm('¿Está seguro de querer importar datos de Google Sheets? Esto reemplazará los expedientes locales con las filas actuales de la planilla.');
    if (!confirmImport) return;

    setPulling(true);
    try {
      const res = await Database.pullFromGoogleSheets();
      if (res.success) {
        setConfig(Database.getSheetsConfig()); // Refresh state
        addToast(`Se importaron con éxito ${res.count} expedientes desde Google Sheets.`, 'success');
        setTimeout(() => window.location.reload(), 800);
      } else {
        addToast(res.error || 'No se pudieron descargar los datos.', 'error');
      }
    } catch (err) {
      addToast('Error de red al importar: ' + String(err), 'error');
    } finally {
      setPulling(false);
    }
  };

  const handleClearLocalCRM = () => {
    const confirmClear = window.confirm('Aviso Crítico: ¿Confirma vaciar por completo la base de datos local del CRM? Esto eliminará todos los expedientes, movimientos e historiales de auditoría locales.');
    if (!confirmClear) return;

    try {
      Database.clearLocalData();
      addToast('Base de datos local limpia y vaciada con éxito. Listo para inicializar desde Google Sheet.', 'success');
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      addToast('Error al vaciar datos: ' + String(err), 'error');
    }
  };

  // Automated Google Apps Script template generator
  const appsScriptCode = `/**
 * Google Apps Script - Servidor de Sincronización para Defensa del Consumidor
 * Permite la inserción, actualización, eliminación y sincronización manual completa (BULK SYNC).
 */

// Permite comprobar que el Web App esté online ingresando desde el navegador o bien devuelve la base de datos completa en JSON si se solicita ?action=read o ?action=read_users
function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  if (e && e.parameter && e.parameter.action === "read_users") {
    var sheet = ss.getSheetByName("Usuarios");
    var list = [];
    if (sheet) {
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        var values = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
        for (var i = 0; i < values.length; i++) {
          var row = values[i];
          list.push({
            id: String(row[0] || ""),
            username: String(row[1] || ""),
            nombre: String(row[2] || ""),
            rol: String(row[3] || ""),
            correo: String(row[4] || ""),
            clave: String(row[5] || "")
          });
        }
      }
    }
    return ContentService.createTextOutput(JSON.stringify(list))
                         .setMimeType(ContentService.MimeType.JSON);
  }

  if (e && e.parameter && e.parameter.action === "read") {
    var sheet = ss.getSheetByName("Expedientes");
    var list = [];
    if (sheet) {
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        var headers = [
          "RECLAMO", "APELLIDO", "NOMBRE", "DNI", "TELEFONO", "LOCALIDAD", "RUBRO", 
          "MOTIVOS", "DENUNCIADA 1", "DENUNCIADA 2", "DENUNCIADA 3", "DENUNCIADA 4", 
          "NOTIFICACION SALE", "NOTIFICACIÓN VUELTA", "AUDIENCIA", "ESTADO DEL EXPEDIENTE", 
          "USUARIO", "FECHA ACTUALIZACION"
        ];
        var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
        for (var i = 0; i < values.length; i++) {
          var row = values[i];
          list.push({
            reclamo: String(row[0] || ""),
            apellido: String(row[1] || ""),
            nombre: String(row[2] || ""),
            dni: String(row[3] || ""),
            telefono: String(row[4] || ""),
            localidad: String(row[5] || ""),
            rubro: String(row[6] || ""),
            motivos: String(row[7] || ""),
            denunciada1: String(row[8] || ""),
            denunciada2: String(row[9] || ""),
            denunciada3: String(row[10] || ""),
            denunciada4: String(row[11] || ""),
            notificacionSale: String(row[12] || ""),
            notificacionVuelta: String(row[13] || ""),
            audiencia: String(row[14] || ""),
            estado: String(row[15] || ""),
            usuario: String(row[16] || ""),
            fechaActualizacion: String(row[17] || "")
          });
        }
      }
    }
    return ContentService.createTextOutput(JSON.stringify(list))
                         .setMimeType(ContentService.MimeType.JSON);
  }

  var html = "<html><head><title>Sincronizador Defensa del Consumidor</title>";
  html += "<style>body { font-family: sans-serif; padding: 40px; background: #f8fafc; color: #0f172a; text-align: center; }";
  html += ".card { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; }";
  html += "h1 { color: #2563eb; font-size: 24px; margin-bottom: 10px; }";
  html += "p { color: #475569; font-size: 14px; line-height: 1.6; }";
  html += ".badge { display: inline-block; padding: 6px 12px; background: #dcfce7; color: #15803d; border-radius: 9999px; font-weight: bold; font-size: 12px; margin: 15px 0; }";
  html += ".footer { font-size: 11px; margin-top: 30px; color: #94a3b8; }</style></head><body>";
  html += "<div class='card'>";
  html += "<h1>📊 Sincronizador de Google Sheets Operativo</h1>";
  html += "<div class='badge'>● ONLINE & LISTO</div>";
  html += "<p>El script de Google Apps Script ha sido configurado y desplegado con éxito. Está escuchando las peticiones del CRM de expedientes en tiempo real.</p>";
  html += "<p style='font-size: 11px; background: #f1f5f9; padding: 10px; border-radius: 8px; font-family: monospace;'>ID del Sheet: " + SpreadsheetApp.getActiveSpreadsheet().getId() + "</p>";
  html += "<p class='footer'>Manejo Virtual de Expedientes - Dirección General de Defensa del Consumidor</p>";
  html += "</div></body></html>";
  return HtmlService.createHtmlOutput(html);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    // Intentar adquirir el bloqueo para evitar colisiones de escrituras concurrentes de múltiples terminales
    lock.waitLock(15000);
    
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;
    var data = payload.data;
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // Sincronización de Usuarios
    if (action === "SYNC_ALL_USERS" && Array.isArray(data)) {
      var userSheet = ss.getSheetByName("Usuarios");
      if (!userSheet) {
        userSheet = ss.insertSheet("Usuarios");
      }
      var userHeaders = ["ID", "USUARIO", "NOMBRE", "ROL", "CORREO", "CLAVE"];
      userSheet.clearContents();
      userSheet.appendRow(userHeaders);
      
      var uHeaderRange = userSheet.getRange(1, 1, 1, userHeaders.length);
      uHeaderRange.setBackground("#334155")
                  .setFontColor("#ffffff")
                  .setFontWeight("bold")
                  .setHorizontalAlignment("center");
      userSheet.setFrozenRows(1);

      if (data.length > 0) {
        var userRows = data.map(function(usr) {
          return [
            usr.id || "",
            usr.username || "",
            usr.nombre || "",
            usr.rol || "",
            usr.correo || "",
            usr.clave || ""
          ];
        });
        userSheet.getRange(2, 1, userRows.length, userHeaders.length).setValues(userRows);
      }
      try {
        userSheet.autoResizeColumns(1, userHeaders.length);
      } catch(e) {}

      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Sincronización de usuarios completada." }))
                           .setMimeType(ContentService.MimeType.JSON);
    }

    // Crear un único usuario de forma individual
    if (action === "CREATE_USER") {
      var userSheet = ss.getSheetByName("Usuarios");
      if (!userSheet) {
        userSheet = ss.insertSheet("Usuarios");
        var userHeaders = ["ID", "USUARIO", "NOMBRE", "ROL", "CORREO", "CLAVE"];
        userSheet.appendRow(userHeaders);
        userSheet.getRange(1, 1, 1, userHeaders.length)
                 .setBackground("#334155")
                 .setFontColor("#ffffff")
                 .setFontWeight("bold")
                 .setHorizontalAlignment("center");
        userSheet.setFrozenRows(1);
      }
      userSheet.appendRow([
        data.id || "",
        data.username || "",
        data.nombre || "",
        data.rol || "",
        data.correo || "",
        data.clave || ""
      ]);
      try { userSheet.autoResizeColumns(1, 6); } catch(e) {}
      return ContentService.createTextOutput(JSON.stringify({ status: "success", action: "create_user" }))
                           .setMimeType(ContentService.MimeType.JSON);
    }

    // Actualizar/Editar un usuario de forma individual
    if (action === "UPDATE_USER") {
      var userSheet = ss.getSheetByName("Usuarios");
      if (!userSheet) {
        userSheet = ss.insertSheet("Usuarios");
        var userHeaders = ["ID", "USUARIO", "NOMBRE", "ROL", "CORREO", "CLAVE"];
        userSheet.appendRow(userHeaders);
        userSheet.getRange(1, 1, 1, userHeaders.length)
                 .setBackground("#334155")
                 .setFontColor("#ffffff")
                 .setFontWeight("bold")
                 .setHorizontalAlignment("center");
        userSheet.setFrozenRows(1);
      }
      var lastRow = userSheet.getLastRow();
      var targetRow = -1;
      if (lastRow > 1) {
        var idValues = userSheet.getRange(2, 1, lastRow - 1, 1).getValues();
        for (var i = 0; i < idValues.length; i++) {
          if (String(idValues[i][0]) === String(data.id)) {
            targetRow = i + 2;
            break;
          }
        }
      }
      var rowUser = [
        data.id || "",
        data.username || "",
        data.nombre || "",
        data.rol || "",
        data.correo || "",
        data.clave || ""
      ];
      if (targetRow !== -1) {
        userSheet.getRange(targetRow, 1, 1, 6).setValues([rowUser]);
      } else {
        userSheet.appendRow(rowUser);
      }
      try { userSheet.autoResizeColumns(1, 6); } catch(e) {}
      return ContentService.createTextOutput(JSON.stringify({ status: "success", action: "update_user" }))
                           .setMimeType(ContentService.MimeType.JSON);
    }

    // Eliminar un usuario de forma individual
    if (action === "DELETE_USER") {
      var userSheet = ss.getSheetByName("Usuarios");
      if (userSheet) {
        var lastRow = userSheet.getLastRow();
        if (lastRow > 1) {
          var idValues = userSheet.getRange(2, 1, lastRow - 1, 1).getValues();
          for (var i = 0; i < idValues.length; i++) {
            if (String(idValues[i][0]) === String(data.id)) {
              userSheet.deleteRow(i + 2);
              break;
            }
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success", action: "delete_user" }))
                           .setMimeType(ContentService.MimeType.JSON);
    }
    
    var sheet = ss.getSheetByName("Expedientes");
    
    // Si no existe la pestaña "Expedientes", crearla
    if (!sheet) {
      sheet = ss.insertSheet("Expedientes");
      // Remover pestañas en blanco sobrantes si eran de la primera creación
      var defaultSheet = ss.getSheetByName("Hoja 1") || ss.getSheetByName("Sheet1");
      if (defaultSheet && ss.getSheets().length > 1) {
        try { ss.deleteSheet(defaultSheet); } catch(err) {}
      }
    }
    
    var headers = [
      "RECLAMO", "APELLIDO", "NOMBRE", "DNI", "TELEFONO", "LOCALIDAD", "RUBRO", 
      "MOTIVOS", "DENUNCIADA 1", "DENUNCIADA 2", "DENUNCIADA 3", "DENUNCIADA 4", 
      "NOTIFICACION SALE", "NOTIFICACIÓN VUELTA", "AUDIENCIA", "ESTADO DEL EXPEDIENTE", 
      "USUARIO", "FECHA ACTUALIZACION"
    ];
    
    // Si la cabecera no está creada o la planilla está vacía, crear cabeceras
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      // Aplicar un diseño profesional a la cabecera
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground("#1e293b") // Slate 800
                 .setFontColor("#ffffff")
                 .setFontWeight("bold")
                 .setHorizontalAlignment("center");
      sheet.setFrozenRows(1);
    }
    
    function mapExpedienteToRow(exp) {
      return [
        exp.reclamo || "",
        exp.apellido || "",
        exp.nombre || "",
        exp.dni || "",
        exp.telefono || "",
        exp.localidad || "",
        exp.rubro || "",
        exp.motivos || "",
        exp.denunciada1 || "",
        exp.denunciada2 || "",
        exp.denunciada3 || "",
        exp.denunciada4 || "",
        exp.notificacionSale || "",
        exp.notificacionVuelta || "",
        exp.audiencia || "",
        exp.estado || "",
        exp.usuario || "",
        exp.fechaActualizacion || ""
      ];
    }
    
    if (action === "SYNC_ALL" && Array.isArray(data)) {
      // Sincronización completa (Reemplaza todo el contenido local en Google Sheets)
      // Limpiar datos anteriores (preservando cabecera de la fila 1)
      if (sheet.getLastRow() > 1) {
        sheet.deleteRows(2, sheet.getLastRow() - 1);
      }
      
      if (data.length > 0) {
        var rowsToWrite = data.map(function(item) {
          return mapExpedienteToRow(item);
        });
        sheet.getRange(2, 1, rowsToWrite.length, headers.length).setValues(rowsToWrite);
      }
      
      // Auto-ajustar columnas para legibilidad
      try {
        sheet.autoResizeColumns(1, headers.length);
      } catch(e) {}
      
      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Sincronización masiva de " + data.length + " completada." }))
                           .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === "CREATE") {
      var newRow = mapExpedienteToRow(data);
      sheet.appendRow(newRow);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", action: "create" }))
                           .setMimeType(ContentService.MimeType.JSON);
    } 
    
    if (action === "UPDATE") {
      var lastRow = sheet.getLastRow();
      var targetRow = -1;
      
      if (lastRow > 1) {
        var reclamosValues = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
        for (var i = 0; i < reclamosValues.length; i++) {
          if (reclamosValues[i][0] === data.reclamo) {
            targetRow = i + 2; // +2 por índice 0 + fila cabecera
            break;
          }
        }
      }
      
      var updatedRow = mapExpedienteToRow(data);
      if (targetRow !== -1) {
        sheet.getRange(targetRow, 1, 1, headers.length).setValues([updatedRow]);
      } else {
        sheet.appendRow(updatedRow);
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success", action: "update" }))
                           .setMimeType(ContentService.MimeType.JSON);
    } 
    
    if (action === "DELETE") {
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        var reclamosValues = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
        for (var i = 0; i < reclamosValues.length; i++) {
          if (reclamosValues[i][0] === data.reclamo) {
            sheet.deleteRow(i + 2);
            break;
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success", action: "delete" }))
                           .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Acción no reconocida." }))
                          .setMimeType(ContentService.MimeType.JSON);
                          
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
                          .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(appsScriptCode);
    setCopied(true);
    addToast('Código de Apps Script copiado al portapapeles.', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6" id="google-sheets-panel">
      
      {/* Page Title */}
      <div className="border-b border-slate-100 pb-5">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <FileSpreadsheet className="w-6 h-6 text-emerald-600 animate-pulse" />
          <span>Sincronización con Google Sheets</span>
        </h2>
        <p className="text-slate-500 text-xs mt-0.5 font-sans">Vincule y mapee sus planillas de cálculo de Google. Utilice Google Sheets como su base de datos corporativa y muelle persistente primario.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="sheets-two-column-workspace">
        
        {/* COL 1 & 2: SETUP & INSTRUCTION PLANILLAS */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Config form */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-sans font-black text-slate-800 text-sm mb-4">Ajustes y Direccionamiento de la Planilla</h3>
            
            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Enlace HTML de su Google Sheet</label>
                <div className="relative">
                  <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="url"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 pl-9 text-slate-850 font-sans text-xs focus:ring-1 focus:ring-amber-500 outline-none"
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    value={config.sheetUrl}
                    onChange={(e) => setConfig({ ...config, sheetUrl: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Apps Script Web App URL (Recibidor Webhook)</label>
                <div className="relative">
                  <Play className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="url"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 pl-9 text-slate-850 font-mono text-xs focus:ring-1 focus:ring-amber-500 outline-none"
                    placeholder="https://script.google.com/macros/s/.../exec"
                    value={config.sheetWebhook}
                    onChange={(e) => setConfig({ ...config, sheetWebhook: e.target.value })}
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Sino cuenta con este webhook, puede dejarlo vacío. El sistema guardará cambios locales y simulará la sincronización de manera local.</p>
              </div>

              {/* Automatic Trigger toggler */}
              <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <input
                  type="checkbox"
                  id="syncOnAction"
                  className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                  checked={config.syncOnAction}
                  onChange={(e) => setConfig({ ...config, syncOnAction: e.target.checked })}
                />
                <label htmlFor="syncOnAction" className="text-xs text-slate-700 cursor-pointer">
                  <strong>Sincronizar automáticamente:</strong> Tras cada acción sumarial (creación, cambio de estado, audición), enviar webhook de actualización de manera online.
                </label>
              </div>

              <div className="flex justify-end gap-2 text-xs">
                <button
                  type="submit"
                  disabled={isReadOnly}
                  className="bg-slate-900 text-white font-bold px-4 py-2 rounded-xl border border-slate-850 transition-colors disabled:opacity-40"
                >
                  Guardar Parámetros
                </button>
              </div>
            </form>
          </div>

          {/* MAPPING DIRECTIVES AND SCHEMA SPECIFICATION (From request block) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-sans font-black text-slate-800 text-sm">Directiva Sumarial del Mapeo de Columnas</h3>
            <p className="text-slate-500 text-xs">Para garantizar la integridad y evitar errores en la importación/exportación de Defensa del Consumidor, la planilla **debe** comprender exactamente este orden y tipo de celdas (columnas primarias):</p>

            {/* Visual table column mapping */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 font-mono text-[10px] tracking-tight flex flex-wrap gap-2 text-slate-600 justify-center">
              <span className="bg-white px-2 py-1 rounded border shadow-xs">[A] RECLAMO</span>
              <span className="bg-white px-2 py-1 rounded border shadow-xs">[B] APELLIDO</span>
              <span className="bg-white px-2 py-1 rounded border shadow-xs">[C] NOMBRE</span>
              <span className="bg-white px-2 py-1 rounded border shadow-xs">[D] DNI</span>
              <span className="bg-white px-2 py-1 rounded border shadow-xs">[E] TELEFONO</span>
              <span className="bg-white px-2 py-1 rounded border shadow-xs">[F] LOCALIDAD</span>
              <span className="bg-white px-2 py-1 rounded border shadow-xs">[G] RUBRO</span>
              <span className="bg-white px-2 py-1 rounded border shadow-xs">[H] MOTIVOS</span>
              <span className="bg-white px-2 py-1 rounded border shadow-xs">[I] DENUNCIADA 1</span>
              <span className="bg-white px-2 py-1 rounded border shadow-xs">[J] DENUNCIADA 2</span>
              <span className="bg-white px-2 py-1 rounded border shadow-xs">[K] DENUNCIADA 3</span>
              <span className="bg-white px-2 py-1 rounded border shadow-xs">[L] DENUNCIADA 4</span>
              <span className="bg-white px-2 py-1 rounded border shadow-xs">[M] NOTIFICACION SALE</span>
              <span className="bg-white px-2 py-1 rounded border shadow-xs">[N] NOTIFICACIÓN VUELTA</span>
              <span className="bg-white px-2 py-1 rounded border shadow-xs">[O] AUDIENCIA</span>
              <span className="bg-white px-2 py-1 rounded border shadow-xs">[P] ESTADO DEL EXPEDIENTE</span>
              <span className="bg-white px-2 py-1 rounded border shadow-xs">[Q] USUARIO</span>
            </div>

            <div className="p-3.5 bg-indigo-50 border border-indigo-150 rounded-xl flex gap-3 text-xs text-indigo-800">
              <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Consistencia del Estado del Expediente</strong>
                <p className="mt-0.5 leading-relaxed text-[11px]">
                  El backend sincroniza y valida cada cambio de estado, generando la línea de tiempo del buscador público dinámicamente y computando asuetos y límites del calendario conciliatorio.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* COL 3: GOOGLE APPS SCRIPT CODE & COMPILER */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white flex flex-col justify-between" id="google-apps-script-generator">
          <div className="space-y-4">
            <h3 className="font-sans font-black text-sm tracking-tight flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              Asistente Script del Servidor
            </h3>
            
            <p className="text-slate-400 text-xs">Módulo generador automatizado. Copie y pegue este código dentro de la opción: <strong>Extensiones → Apps Script</strong> en su Google Sheet.</p>
            
            {/* Embedded compiler code panel */}
            <div className="relative">
              <pre className="bg-[#0f172a] border border-slate-800 rounded-2xl p-4 font-mono text-[10px] text-slate-300 max-h-56 overflow-y-auto leading-relaxed select-all">
                <code>{appsScriptCode}</code>
              </pre>
              <button
                onClick={copyToClipboard}
                title="Copiar código del Script"
                className="absolute right-3 top-3 bg-slate-800 hover:bg-slate-700 text-white p-2 rounded-lg transition-colors border border-slate-700"
              >
                {copied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-450 text-emerald-450" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Sync control block */}
            <div className="border-t border-slate-800 pt-5 space-y-4">
              <h4 className="text-[10px] uppercase font-mono tracking-widest text-slate-400">Canal de Sincronización General</h4>
              
              <div className="bg-slate-800/50 rounded-xl p-3.5 border border-slate-850 justify-between items-center text-xs flex gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-100">Puente de conexión:</div>
                  <div className="text-[10px] text-slate-400 mt-0.5 break-words" title={config.lastSync}>
                    {config.lastSync}
                  </div>
                </div>
              </div>

              {/* Action Buttons Stack */}
              <div className="space-y-2">
                {/* 1. BUTTON IMPORT DATA FROM GOOGLE SHEETS */}
                <button
                  onClick={handleImportFromSheets}
                  disabled={pulling || syncing}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-3 rounded-xl transition duration-205 flex items-center justify-center gap-2 text-xs"
                >
                  <RefreshCw className={`w-4 h-4 ${pulling ? 'animate-spin' : ''}`} />
                  {pulling ? 'Importando...' : 'Importar desde Google Sheets'}
                </button>

                {/* 2. BUTTON EXPORT/PUSH TO GOOGLE SHEETS */}
                <button
                  onClick={handleManualSync}
                  disabled={syncing || pulling}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-3 rounded-xl transition duration-205 flex items-center justify-center gap-2 text-xs"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  {syncing ? 'Exportando...' : 'Exportar base local a Sheet'}
                </button>

                {/* 3. HARD RESET / CLEAR LOCAL DATA */}
                <button
                  onClick={handleClearLocalCRM}
                  className="w-full bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 font-bold py-2 px-3 rounded-xl transition duration-205 flex items-center justify-center gap-1.5 text-[10px] border border-rose-900/40"
                >
                  <span>⚠️ Vaciar Base de Datos Local</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-2 text-[10px] text-slate-500 font-mono mt-6 items-start">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <p>Asegúrese de "Desplegar como Aplicación Web" en Google Apps Script, configurando acceso para "Cualquier Persona" (Anyone).</p>
          </div>
        </div>

      </div>

    </div>
  );
}
