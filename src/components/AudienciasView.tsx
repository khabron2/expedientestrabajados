import React, { useState, useMemo, useEffect } from 'react';
import { Database, formatDate } from '../db';
import { Expediente, RolUsuario } from '../types';
import { Calendar as CalendarIcon, Clock, AlertTriangle, Printer, Plus, X, Search, CheckCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface AudienciasViewProps {
  currentUserRol: RolUsuario;
  currentUsername: string;
  addToast: (msg: string, type: 'success' | 'error' | 'warning') => void;
  syncTrigger?: number;
}

export function AudienciasView({ currentUserRol, currentUsername, addToast, syncTrigger }: AudienciasViewProps) {
  const [expedientes, setExpedientes] = useState<Expediente[]>(() => Database.getExpedientes());

  useEffect(() => {
    setExpedientes(Database.getExpedientes());

    // Automatically trigger transparent Google Sheets pull upon entering the section
    let active = true;
    const autoSyncFromSheets = async () => {
      try {
        const res = await Database.pullFromGoogleSheets();
        if (active && res.success && res.count > 0) {
          setExpedientes(Database.getExpedientes());
        }
      } catch (err) {
        console.warn("[AudienciasView] No se pudo autosincronizar con Google Sheets:", err);
      }
    };

    autoSyncFromSheets();

    return () => {
      active = false;
    };
  }, [syncTrigger]);
  const [selectedDate, setSelectedDate] = useState<string>("2026-05-22"); // Default to pre-seeded date in May 2026
  const [showAssignModal, setShowAssignModal] = useState(false);

  // Form scheduling variables
  const [targetExpCode, setTargetExpCode] = useState('');
  const [targetTime, setTargetTime] = useState('09:00'); // HH:MM

  const isReadOnly = currentUserRol === 'SOLO LECTURA';

  const hourBlocks = [8, 9, 10, 11, 12];

  // Real-time reloading
  const reloadData = () => {
    setExpedientes(Database.getExpedientes());
  };

  // Hearings list of the currently selected date
  const selectedDayHearings = useMemo(() => {
    return expedientes.filter(exp => {
      if (!exp.audiencia) return false;
      const d = new Date(exp.audiencia);
      if (isNaN(d.getTime())) return false;
      const dateStr = formatDate(d);
      return dateStr === selectedDate;
    });
  }, [expedientes, selectedDate]);

  const getHearingsForHour = (hourNum: number) => {
    return selectedDayHearings.filter(h => {
      const d = new Date(h.audiencia);
      return !isNaN(d.getTime()) && d.getHours() === hourNum;
    });
  };

  // Calendar dates generator for May 2026 (Argentine layout starting on Sunday or Monday)
  // May 1st 2026 is a Friday.
  const calendarDays = useMemo(() => {
    const days: { dateStr: string; dayNum: number; hearingsCount: number; isMainMonth: boolean }[] = [];
    
    // Previous Month padding (April 2026) - April ends on Thursday 30th
    // So Friday 1st is May 1st. If we start calendar Sunday, we pad Sunday 26th to Thursday 30th of April.
    const aprilPadding = [26, 27, 28, 29, 30];
    aprilPadding.forEach(dNum => {
      days.push({
        dateStr: `2026-04-${String(dNum).padStart(2, '0')}`,
        dayNum: dNum,
        hearingsCount: 0,
        isMainMonth: false
      });
    });

    // May 2026 (31 Days)
    for (let d = 1; d <= 31; d++) {
      const dateStr = `2026-05-${String(d).padStart(2, '0')}`;
      // Count hearings for this day in actual db state
      const count = expedientes.filter(exp => {
        if (!exp.audiencia) return false;
        const dt = new Date(exp.audiencia);
        if (isNaN(dt.getTime())) return false;
        return formatDate(dt) === dateStr;
      }).length;

      days.push({
        dateStr,
        dayNum: d,
        hearingsCount: count,
        isMainMonth: true
      });
    }

    // Next Month padding (June 2026)
    for (let d = 1; d <= 6; d++) {
      days.push({
        dateStr: `2026-06-${String(d).padStart(2, '0')}`,
        dayNum: d,
        hearingsCount: 0,
        isMainMonth: false
      });
    }

    return days;
  }, [expedientes]);

  // List of expedientes without any hearings scheduled yet (for the scheduling selector)
  const availableExpedientesForHearing = useMemo(() => {
    return expedientes.filter(exp => !exp.audiencia && exp.estado !== 'RESUELTO' && exp.estado !== 'ARCHIVADO');
  }, [expedientes]);

  // Submit assign handler
  const handleAssignHearing = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) {
      addToast('Su rol Solo Lectura le impide agendar nuevas audiencias conciliatorias.', 'warning');
      return;
    }
    if (!targetExpCode) {
      addToast('Seleccione un expediente válido de la lista.', 'error');
      return;
    }

    // Compile full datetime-local string (YYYY-MM-DDTHH:MM)
    const fullDateTime = `${selectedDate}T${targetTime}`;

    // Apply exact business rules validation on core level
    const validation = Database.validateAudiencia(fullDateTime, targetExpCode);
    if (!validation.valid) {
      addToast(validation.error || 'Trámite restringido por reglas de negocio.', 'error');
      return;
    }

    // Call update to register the hearing and advance state automatically to "AUDIENCIA PROGRAMADA"
    const updateRes = Database.updateExpediente(
      targetExpCode,
      {
        audiencia: fullDateTime,
        estado: 'AUDIENCIA PROGRAMADA'
      },
      currentUsername,
      `Audiencia programada para la fecha ${selectedDate} a las ${targetTime} hs.`
    );

    if (updateRes.success) {
      addToast('¡Audiencia agendada con éxito en la mesa de conciliaciones!', 'success');
      setShowAssignModal(false);
      setTargetExpCode('');
      reloadData();
    } else {
      addToast(updateRes.error || 'No se pudo reservar el turno.', 'error');
    }
  };

  // PRINT HOY LIST ACTION (Daily list print template)
  const printDailyDocket = () => {
    if (selectedDayHearings.length === 0) {
      addToast('No existen audiencias conciliatorias agendadas para la fecha seleccionada.', 'warning');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      addToast('Hubo un inconveniente para abrir el docket de impresión.', 'error');
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Audiencias Conciliatorias - ${selectedDate}</title>
          <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1e293b; padding: 40px; margin: 0; }
            .header { text-align: center; border-bottom: 3px double #334155; padding-bottom: 15px; margin-bottom: 25px; }
            .gov-lbl { font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 2.5px; border: 1px solid #334155; display: inline-block; padding: 4px 10px; margin-bottom: 10px; }
            .h-title { font-size: 22px; font-weight: 800; margin: 0; }
            .h-date { font-size: 14px; font-weight: bold; margin-top: 5px; color: #b45309; }
            .docket-table { w-width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
            .docket-table th { background: #f8fafc; border: 1px solid #cbd5e1; text-align: left; padding: 12px; font-size: 11px; text-transform: uppercase; tracking-wider: 1px; color: #475569; }
            .docket-table td { border: 1px solid #e2e8f0; padding: 12px; }
            .time-cell { font-family: monospace; font-weight: bold; font-size: 14px; color: #4f46e5; }
            .case-label { font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase; }
            .sign-row { margin-top: 80px; display: flex; justify-content: space-between; page-break-inside: avoid; }
            .sign-pane { border-top: 1px solid #475569; width: 30%; text-align: center; padding-top: 10px; font-size: 11px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="gov-lbl">Secretaría de Apoyo y Conciliaciones Ciudadanas</div>
            <div class="h-title">ORDEN DEL DÍA Y AUDIENCIAS DIGITALES</div>
            <div class="h-date">AGENDA DEL DÍA: ${new Date(selectedDate + "T00:00").toLocaleDateString('es-AR', { dateStyle: 'full' })}</div>
          </div>

          <table class="docket-table" style="width: 100%;">
            <thead>
              <tr>
                <th style="width: 15%;">Hora del Acto</th>
                <th style="width: 25%;">Expediente / Titular</th>
                <th style="width: 30%;">Entidades Denunciadas</th>
                <th style="width: 30%;">Objeto del Reclamo / Firma Conforme</th>
              </tr>
            </thead>
            <tbody>
              ${selectedDayHearings.map(h => {
                const parsedDate = new Date(h.audiencia);
                const hourStr = isNaN(parsedDate.getTime()) 
                  ? h.audiencia 
                  : parsedDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) + " hs";
                return `
                  <tr>
                    <td class="time-cell">${hourStr}</td>
                    <td>
                      <strong>${h.apellido.toUpperCase()}, ${h.nombre}</strong><br>
                      <span class="case-label">EXP:</span> ${h.reclamo}<br>
                      <span class="case-label">DNI:</span> ${h.dni}
                    </td>
                    <td>
                      <strong>${h.denunciada1}</strong>
                      ${h.denunciada2 ? `<br><span class="case-label">Solidaria:</span> ${h.denunciada2}` : ''}
                    </td>
                    <td style="font-size: 12px; color: #475569; vertical-align: top;">
                      <i>"${h.motivos}"</i>
                      <div style="margin-top: 15px; border-bottom: 1px dashed #cbd5e1; height: 1px;"></div>
                      <div style="font-size: 9px; color: #94a3b8; margin-top: 5px;">Mesa: Virtual Digital - Coordinador sumariante: ${h.usuario}</div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="sign-row">
            <div class="sign-pane">Mesa de Entradas General<br>Mesa de Conciliación</div>
            <div class="sign-pane">Funcionario Sumariante<br>Defensa del Consumidor</div>
            <div class="sign-pane">Auxiliar de Actas<br>Control de Cuentas</div>
          </div>

          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();

    // Audit trace
    Database.addAuditoria(currentUsername, 'VARIOS', 'IMPRESIÓN_AUDIENCIAS_DÍA', 'Varios', `Impresión agenda del día ${selectedDate}`, 'ACCESO');
  };

  return (
    <div className="space-y-6" id="audiencias-scheduler-panel">
      
      {/* Title block */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>Control de Audiencias y Turnos Conciliatorios</span>
            <span className="bg-amber-50 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-200">
              Límites Regulatorios Activos
            </span>
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">Calendario integral de audiencias virtuales. Agenda restringida a un máximo de 10 audiencias conciliatorias diarias de 08:00 a 12:00 hs, con un límite de 2 audiencias por hora.</p>
        </div>

        <button
          onClick={printDailyDocket}
          className="flex items-center gap-1.5 bg-slate-950 text-white hover:bg-slate-800 font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-sm"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Imprimir Agenda Seleccionada</span>
        </button>
      </div>

      {/* Constraints Warning Indicator Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="audiencias-constraints-banner">
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3">
          <Clock className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
          <div>
            <h5 className="font-bold text-amber-900 text-xs">Ventana Horaria y Límite Horario</h5>
            <p className="text-[10px] text-amber-700 mt-0.5">La toma de audiencias se realiza entre las **08:00 hs y las 12:00 hs**, con un máximo de **2 audiencias por hora**.</p>
          </div>
        </div>

        <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-indigo-700 mt-0.5 shrink-0" />
          <div>
            <h5 className="font-bold text-indigo-900 text-xs">Cupo Máximo Diario</h5>
            <p className="text-[10px] text-indigo-700 mt-0.5">Límite absoluto de **10 audiencias por día**. Al completarse o saturarse los bloques horarios, el sistema restringe nuevas reservas.</p>
          </div>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-start gap-3">
          <CheckCircle className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" />
          <div>
            <h5 className="font-bold text-emerald-900 text-xs">Audiencias Conciliatorias Virtuales</h5>
            <p className="text-[10px] text-emerald-700 mt-0.5">Las partes comparecen vía teleconferencia oficial. El acta suscripta tiene carácter de título ejecutivo sumarial.</p>
          </div>
        </div>
      </div>

      {/* Main Two-Column workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="audiencia-calendar-workspace">
        
        {/* COL 1 & 2: Monthly Calendar Grid widget */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-sans font-black text-slate-800 text-sm tracking-tight">Calendario Conciliatorio</h3>
              <p className="text-slate-400 text-xs">Mes Fiscal: Mayo de 2026</p>
            </div>

            <div className="flex gap-4 font-mono text-[10px] text-slate-400">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-emerald-100 border border-emerald-300 rounded inline-block"></span> Libre</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-amber-100 border border-amber-300 rounded inline-block"></span> 1-9 Turnos</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-rose-100 border border-rose-300 rounded inline-block"></span> Completo (10)</span>
            </div>
          </div>

          {/* Weekday labels */}
          <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-2 border-b border-slate-100 pb-2">
            <span>Dom</span>
            <span>Lun</span>
            <span>Mar</span>
            <span>Mie</span>
            <span>Jue</span>
            <span>Vie</span>
            <span>Sab</span>
          </div>

          {/* Calendar days grid */}
          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((day, idx) => {
              const capColor = day.hearingsCount === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100/50' :
                               day.hearingsCount < 10 ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100/50' :
                               'bg-rose-50 border-rose-200 text-rose-700 font-bold'; // 10 hearings is blocked

              const blockStyle = day.hearingsCount >= 10 ? 'opacity-85 cursor-not-allowed shadow-inner' : 'cursor-pointer hover:shadow-xs active:scale-[0.98]';
              const selectionStyle = day.dateStr === selectedDate ? 'ring-2 ring-slate-900 border-transparent scale-[1.03]' : '';
              const blurStyle = day.isMainMonth ? '' : 'filter grayscale opacity-30 contrast-75';

              return (
                <div
                  key={`${day.dateStr}-${idx}`}
                  onClick={() => day.isMainMonth && setSelectedDate(day.dateStr)}
                  className={`p-2 rounded-xl border text-center transition-all ${capColor} ${blockStyle} ${selectionStyle} ${blurStyle} min-h-[68px] flex flex-col justify-between`}
                >
                  <span className="font-mono text-xs block font-black text-left">{day.dayNum}</span>
                  
                  {day.isMainMonth && (
                    <div className="mt-2 text-right">
                      {day.hearingsCount === 0 && <span className="text-[8px] uppercase tracking-wide opacity-75">Libre</span>}
                      {day.hearingsCount > 0 && day.hearingsCount < 10 && <span className="text-[8px] font-bold uppercase tracking-wide">{day.hearingsCount} {day.hearingsCount === 1 ? 'Turno' : 'Turnos'}</span>}
                      {day.hearingsCount >= 10 && <span className="text-[8px] font-black uppercase tracking-wide">LLENO</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* COL 3: Selection Sidepanel (Selected Date agenda and assignment launcher) */}
        <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl flex flex-col justify-between h-full">
          <div className="space-y-6">
            
            {/* Header info */}
            <div>
              <span className="text-amber-400 font-mono text-[9px] uppercase tracking-widest font-bold">AGENDA OPERATIVA</span>
              <h3 className="text-lg font-black tracking-tight mt-1">Agenda del día</h3>
              <p className="font-mono text-xs text-slate-300 mt-0.5">{selectedDate}</p>
            </div>

            {/* Hourly block indicator mapping */}
            <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/50 space-y-3">
              <h4 className="text-[10px] uppercase font-mono tracking-wider text-amber-400 flex items-center justify-between">
                <span>BLOQUES DE HORAS (08:00 A 12:00 HS)</span>
                <span className="text-[9px] font-sans text-slate-400 font-normal">Capacidad: 2 por hora</span>
              </h4>
              <div className="grid grid-cols-5 gap-2">
                {hourBlocks.map(hr => {
                  const items = getHearingsForHour(hr);
                  const count = items.length;
                  const isFull = count >= 2;
                  
                  return (
                    <div 
                      key={hr} 
                      className={`p-1.5 rounded-lg border text-center flex flex-col justify-between items-center transition-all ${
                        isFull 
                          ? 'bg-rose-950/25 border-rose-800/60 text-rose-300' 
                          : count === 1 
                            ? 'bg-amber-950/25 border-amber-800/40 text-amber-200' 
                            : 'bg-slate-850 border-slate-705/30 text-slate-400'
                      }`}
                    >
                      <span className="font-mono text-[10px] font-bold block">{String(hr).padStart(2, '0')}:00</span>
                      <div className="flex gap-1 mt-1.5 justify-center">
                        <span className={`w-2 h-2 rounded-full inline-block ${count >= 1 ? (isFull ? 'bg-rose-500' : 'bg-amber-500') : 'bg-slate-700'}`}></span>
                        <span className={`w-2 h-2 rounded-full inline-block ${count >= 2 ? 'bg-rose-500' : 'bg-slate-700'}`}></span>
                      </div>
                      <span className="text-[8px] font-sans mt-1.5 opacity-80 uppercase font-black tracking-tight">
                        {isFull ? 'lleno' : count === 1 ? '1/2' : 'libre'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* List of scheduled acts for that date */}
            <div className="space-y-3">
              <h4 className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Audiencias programadas ({selectedDayHearings.length}/10 de cupo)</h4>
              
              {selectedDayHearings.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-4">No se registran audiencias celebradas o agendadas para este día.</p>
              ) : (
                <div className="space-y-2.5">
                  {selectedDayHearings.map(h => {
                    const parsedDate = new Date(h.audiencia);
                    const timeStr = isNaN(parsedDate.getTime())
                      ? h.audiencia
                      : parsedDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) + " hs";
                    return (
                      <div key={h.reclamo} className="bg-slate-800 p-3 rounded-xl border border-slate-700/60 flex flex-col gap-1.5 hover:bg-slate-750 transition-colors">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-indigo-400 font-mono text-xs font-bold flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {timeStr}
                          </span>
                          <span className="text-[9px] bg-slate-700 px-2 py-0.5 rounded text-white font-mono">{h.reclamo}</span>
                        </div>
                        <div className="text-xs font-semibold text-slate-100">{h.apellido}, {h.nombre}</div>
                        <div className="text-[10px] text-slate-400 truncate">vs. {h.denunciada1}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Direct Booking triggers based on rules */}
            {selectedDayHearings.length < 10 && (
              <div className="border-t border-slate-800 pt-5 space-y-3">
                <button
                  onClick={() => {
                    if (isReadOnly) {
                      addToast('Su rol Solo Lectura no tiene permisos para agendar citas conciliatorias.', 'warning');
                      return;
                    }
                    setShowAssignModal(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 font-bold py-3 px-4 rounded-xl text-xs hover:from-amber-600 hover:to-amber-700 hover:scale-[1.01] active:scale-[0.99] transition-all text-white shadow-lg shadow-amber-500/10"
                >
                  <Plus className="w-4 h-4" />
                  <span>Agendar en este día</span>
                </button>
              </div>
            )}

            {selectedDayHearings.length >= 10 && (
              <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-xl flex items-start gap-2.5 text-xs text-rose-300">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <p>Cupo máximo alcanzado. No es factible agendar más audiencias en la fecha por reglamentación de asueto u operatividad (máximo 10 por día).</p>
              </div>
            )}
          </div>

          <p className="text-[9px] text-slate-500 font-mono text-center mt-6">
            Mesa de Audiencias y Turnos • Defensa Consumidor
          </p>
        </div>

      </div>

      {/* ASSIGN AUDIENCIA DRAWER/MODAL */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl border border-slate-200 max-w-md w-full shadow-2xl overflow-hidden font-sans text-sm"
          >
            <div className="bg-slate-950 px-6 py-4 flex justify-between items-center text-white">
              <span className="font-bold tracking-tight">Fijar Audiencia Conciliatoria</span>
              <button onClick={() => setShowAssignModal(false)} className="hover:opacity-75 transition-opacity">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAssignHearing} className="p-6 space-y-4">
              <div className="bg-blue-50 p-3 rounded-lg text-blue-800 text-xs flex gap-2 border border-blue-100">
                <Clock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p>Agendando para la fecha elegida: <strong>{selectedDate}</strong>. El turno debe comprender de 08:00 a 12:00 hs (máx. 2 por hora).</p>
              </div>

              {/* Expediente selection */}
              <div>
                <label className="block text-slate-705 text-xs font-bold text-slate-600 mb-1">Dossier / Expediente Reclamante *</label>
                <select
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:ring-1 focus:ring-blue-600 text-xs"
                  value={targetExpCode}
                  onChange={(e) => setTargetExpCode(e.target.value)}
                  required
                >
                  <option value="">Seleccione el reclamo a imputar...</option>
                  {availableExpedientesForHearing.map(exp => (
                    <option key={exp.reclamo} value={exp.reclamo}>
                      {exp.reclamo} - {exp.apellido}, {exp.nombre} (vs. {exp.denunciada1})
                    </option>
                  ))}
                </select>
                {availableExpedientesForHearing.length === 0 && (
                  <p className="text-[10px] text-rose-500 font-mono mt-1">✓ No existen expedientes activos desprovistos de audiencias.</p>
                )}
              </div>

              {/* Time selection */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Hora de Citación *</label>
                <input
                  type="time"
                  step="900" // 15 mins step
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-slate-800 focus:ring-1 focus:ring-blue-600 outline-none text-xs"
                  value={targetTime}
                  onChange={(e) => setTargetTime(e.target.value)}
                  required
                />
                <p className="text-[10px] text-slate-400 mt-1">Horario reglamentario válido: entre las 08:00 y las 12:00 hs.</p>
              </div>

              {/* Visual Slot Availability */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Estado de turnos para el {selectedDate}:</span>
                <div className="grid grid-cols-5 gap-1.5">
                  {hourBlocks.map(hr => {
                    const count = getHearingsForHour(hr).length;
                    const isFull = count >= 2;
                    return (
                      <div 
                        key={hr}
                        className={`p-1.5 rounded-lg border text-center transition-all ${
                          isFull 
                            ? 'bg-rose-50 border-rose-200 text-rose-700 font-bold' 
                            : count === 1 
                              ? 'bg-amber-50 border-amber-200 text-amber-700 font-semibold' 
                              : 'bg-white border-slate-200 text-slate-500'
                        }`}
                      >
                        <span className="font-mono text-[9px] block">{String(hr).padStart(2, '0')}:00</span>
                        <div className="flex gap-0.5 justify-center mt-1">
                          <span className={`w-1.5 h-1.5 rounded-full inline-block ${count >= 1 ? (isFull ? 'bg-rose-500' : 'bg-amber-500') : 'bg-slate-300'}`}></span>
                          <span className={`w-1.5 h-1.5 rounded-full inline-block ${count >= 2 ? 'bg-rose-500' : 'bg-slate-300'}`}></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action submits */}
              <div className="border-t border-slate-100 pt-4 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="bg-slate-100 font-bold px-4 py-2 rounded-xl border border-slate-250 text-slate-700"
                >
                  Descartar
                </button>
                <button
                  type="submit"
                  disabled={availableExpedientesForHearing.length === 0}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl transition-all disabled:opacity-40"
                >
                  Asignar Conciliación
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

    </div>
  );
}
