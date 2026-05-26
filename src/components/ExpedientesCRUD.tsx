import React, { useState, useMemo, useEffect } from 'react';
import { Database } from '../db';
import { Expediente, EstadoExpediente, RolUsuario } from '../types';
import { 
  Plus, Edit, Trash2, Search, Filter, ArrowDownToLine, Printer, Eye, X, 
  Sparkles, Calendar, HelpCircle, FileText, Download, ChevronRight, ChevronLeft, Bell
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

function formatDisplayDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  if (!trimmed) return '';

  // If already in YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split('-');
    return `${day}/${month}/${year}`;
  }

  // If it's a long date string (e.g., contains "GMT" or letters)
  const parsed = Date.parse(trimmed);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${day}/${month}/${year}`;
  }

  return trimmed;
}

export function cleanLegacyDateToEmpty(val: string | undefined | null): string {
  if (!val) return '';
  const trimmed = val.trim();
  if (!trimmed) return '';

  // Check if it matches a standard date structure or legacy date string from scheduling
  const isLegacyDate = 
    trimmed.includes('GMT') || 
    trimmed.includes('UTC') || 
    trimmed.includes('estándar') || 
    trimmed.includes('Standard') ||
    /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Lun|Mar|Mié|Jue|Vie|Sáb|Dom)\s[A-Za-z]{3}\s\d{1,2}\s\d{4}/i.test(trimmed) ||
    /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ||
    /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/.test(trimmed) ||
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(trimmed);

  if (isLegacyDate) {
    const ms = Date.parse(trimmed);
    if (!isNaN(ms)) {
      return '';
    }
  }
  return trimmed;
}

interface ExpedientesCRUDProps {
  currentUserRol: RolUsuario;
  currentUsername: string;
  addToast: (msg: string, type: 'success' | 'error' | 'warning') => void;
  syncTrigger?: number;
}

export function ExpedientesCRUD({ currentUserRol, currentUsername, addToast, syncTrigger }: ExpedientesCRUDProps) {
  const [expedientes, setExpedientes] = useState<Expediente[]>(() => Database.getExpedientes());

  useEffect(() => {
    setExpedientes(Database.getExpedientes());
  }, [syncTrigger]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState<string>('TODOS');
  const [filterRubro, setFilterRubro] = useState<string>('TODOS');
  const [filterLocalidad, setFilterLocalidad] = useState<string>('TODOS');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  
  const [selectedExp, setSelectedExp] = useState<Expediente | null>(null);

  // Form states (Shares between Add & Edit)
  const [formData, setFormData] = useState<Omit<Expediente, 'fechaActualizacion' | 'usuario'>>({
    reclamo: '',
    apellido: '',
    nombre: '',
    dni: '',
    telefono: '',
    localidad: '',
    rubro: 'Telecomunicaciones',
    motivos: '',
    denunciada1: '',
    denunciada2: '',
    denunciada3: '',
    denunciada4: '',
    notificacionSale: '',
    notificacionVuelta: '',
    audiencia: '',
    estado: 'INGRESADO'
  });

  const [observacionesEstado, setObservacionesEstado] = useState('');

  // Refresh view from local db
  const reloadData = () => {
    setExpedientes(Database.getExpedientes());
  };

  // Extract unique helper arrays for filters
  const rubrosList = useMemo(() => {
    const list = new Set(expedientes.map(e => e.rubro));
    return Array.from(list);
  }, [expedientes]);

  const localidadesList = useMemo(() => {
    const list = new Set(expedientes.map(e => e.localidad).filter(Boolean));
    return Array.from(list);
  }, [expedientes]);

  // Read-only / Action guard alerts
  const isReadOnly = currentUserRol === 'SOLO LECTURA';
  const isOperator = currentUserRol === 'OPERADOR';

  // Filters logic
  const filteredList = useMemo(() => {
    return expedientes.filter(exp => {
      // search match
      const searchStr = `${exp.reclamo} ${exp.apellido} ${exp.nombre} ${exp.dni} ${exp.denunciada1}`.toLowerCase();
      const matchSearch = searchStr.includes(searchTerm.toLowerCase());

      // status filter
      const matchEstado = filterEstado === 'TODOS' || exp.estado === filterEstado;

      // sector filter
      const matchRubro = filterRubro === 'TODOS' || exp.rubro === filterRubro;

      // town filter
      const matchLocalidad = filterLocalidad === 'TODOS' || exp.localidad === filterLocalidad;

      return matchSearch && matchEstado && matchRubro && matchLocalidad;
    });
  }, [expedientes, searchTerm, filterEstado, filterRubro, filterLocalidad]);

  // Pagination totals
  const totalPages = Math.ceil(filteredList.length / itemsPerPage) || 1;
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredList.slice(start, start + itemsPerPage);
  }, [filteredList, currentPage]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'INGRESADO': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'EN REVISIÓN': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'NOTIFICADO': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'AUDIENCIA PROGRAMADA': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'AUDIENCIA REALIZADA': return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'PASÓ A JURÍDICO': return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'RESUELTO': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'ARCHIVADO': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // CRUD actions triggers
  const handleOpenAdd = () => {
    if (isReadOnly) {
      addToast('Su usuario cuenta con el Rol Solo Lectura. No tiene permisos de escritura.', 'warning');
      return;
    }

    const nextIdNum = Math.floor(Math.random() * 900) + 100;
    setFormData({
      reclamo: `EXP-2026-0${nextIdNum}`,
      apellido: '',
      nombre: '',
      dni: '',
      telefono: '',
      localidad: '',
      rubro: 'Telecomunicaciones',
      motivos: '',
      denunciada1: '',
      denunciada2: '',
      denunciada3: '',
      denunciada4: '',
      notificacionSale: '',
      notificacionVuelta: '',
      audiencia: '',
      estado: 'INGRESADO'
    });
    setObservacionesEstado('');
    setShowAddModal(true);
  };

  const handleOpenEdit = (exp: Expediente) => {
    if (isReadOnly) {
      addToast('Su usuario cuenta con el Rol de Solo Lectura. Cambios de datos restringidos.', 'warning');
      return;
    }
    setSelectedExp(exp);
    setFormData({
      reclamo: exp.reclamo,
      apellido: exp.apellido,
      nombre: exp.nombre,
      dni: exp.dni,
      telefono: exp.telefono,
      localidad: exp.localidad,
      rubro: exp.rubro,
      motivos: exp.motivos,
      denunciada1: exp.denunciada1,
      denunciada2: exp.denunciada2,
      denunciada3: exp.denunciada3,
      denunciada4: exp.denunciada4,
      notificacionSale: exp.notificacionSale,
      notificacionVuelta: exp.notificacionVuelta,
      audiencia: cleanLegacyDateToEmpty(exp.audiencia),
      estado: exp.estado
    });
    setObservacionesEstado('');
    setShowEditModal(true);
  };

  const handleOpenView = (exp: Expediente) => {
    setSelectedExp(exp);
    setShowViewModal(true);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.reclamo || !formData.apellido || !formData.nombre || !formData.dni) {
      addToast('Por favor complete los campos obligatorios del expediente.', 'error');
      return;
    }

    const res = Database.createExpediente(formData, currentUsername);
    if (res.success) {
      addToast(`¡Expediente ${formData.reclamo} creado con éxito! Sincronizado en la planilla.`, 'success');
      setShowAddModal(false);
      reloadData();
    } else {
      addToast(res.error || 'No se pudo crear el expediente.', 'error');
    }
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExp) return;

    const res = Database.updateExpediente(
      selectedExp.reclamo,
      formData,
      currentUsername,
      observacionesEstado
    );

    if (res.success) {
      addToast(`¡Expediente ${selectedExp.reclamo} actualizado correctamente!`, 'success');
      setShowEditModal(false);
      reloadData();
    } else {
      addToast(res.error || 'No se pudo actualizar el expediente.', 'error');
    }
  };

  const handleDelete = (reclamo: string) => {
    if (isReadOnly) {
      addToast('Permiso de borrado denegado: Rol de Solo Lectura.', 'warning');
      return;
    }
    if (isOperator) {
      addToast('Su rol de OPERADOR le permite crear y modificar, pero la ELIMINACIÓN de expedientes requiere nivel ADMINISTRADOR.', 'error');
      return;
    }

    const yes = window.confirm(`ATENCIÓN: ¿Está absolutamente seguro de querer eliminar definitivamente el expediente ${reclamo}? Esta acción eliminará también sus movimientos.`);
    if (!yes) return;

    const res = Database.deleteExpediente(reclamo, currentUsername);
    if (res.success) {
      addToast(`Expediente ${reclamo} removido de la base de datos local y marcado correspondientemente.`, 'success');
      reloadData();
    } else {
      addToast(res.error || 'No se pudo borrar el expediente.', 'error');
    }
  };

  // EXPORTS UTILS
  const exportToExcelCSV = () => {
    // Generate CSV contents
    const headers = [
      'RECLAMO', 'APELLIDO', 'NOMBRE', 'DNI', 'TELEFONO', 'LOCALIDAD', 'RUBRO', 
      'MOTIVOS', 'DENUNCIADA 1', 'DENUNCIADA 2', 'DENUNCIADA 3', 'DENUNCIADA 4',
      'NOTIFICACION SALE', 'NOTIFICACION VUELTA', 'AUDIENCIA', 'ESTADO', 'MODIFICADOR', 'ACTUALIZACION'
    ];

    const rows = filteredList.map(e => [
      e.reclamo, e.apellido, e.nombre, e.dni, e.telefono, e.localidad, e.rubro,
      `"${e.motivos.replace(/"/g, '""')}"`, e.denunciada1, e.denunciada2 || '', e.denunciada3 || '', e.denunciada4 || '',
      e.notificacionSale || '', e.notificacionVuelta || '', e.audiencia || '', e.estado, e.usuario, e.fechaActualizacion
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Expedientes_DefensaConsumidor_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Audit action
    Database.addAuditoria(currentUsername, 'VARIOS', 'EXPORTACIÓN_EXCEL', 'Varios', `Descargado archivo CSV con ${filteredList.length} registros`, 'ACCESO');
    addToast('¡Archivo de hoja de cálculo generado y descargado con éxito!', 'success');
  };

  const printCaseSummary = (exp: Expediente) => {
    // Audit action
    Database.addAuditoria(currentUsername, exp.reclamo, 'IMPRESIÓN_EXPEDIENTE', 'Ninguno', `Impresión del expediente individual`, 'ACCESO');

    const movements = Database.getMovimientos()
      .filter(m => m.reclamo === exp.reclamo)
      .sort((a,b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

    // Open print window
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      addToast('Error al abrir la ventana de impresión. Verifique bloqueador de popups.', 'error');
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Expediente ${exp.reclamo}</title>
          <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1e293b; padding: 40px; line-height: 1.5; }
            .header { border-bottom: 3px double #0f172a; padding-bottom: 20px; margin-bottom: 30px; text-align: center; }
            .gov-title { font-size: 14px; font-weight: bold; border: 1px solid #1e293b; padding: 5px 12px; display: inline-block; text-transform: uppercase; letter-spacing: 2px; }
            .main-title { font-size: 26px; font-weight: 900; margin: 15px 0 5px 0; letter-spacing: -0.5px; }
            .sub-title { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
            .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; border-bottom: 1px solid #e2e8f0; padding-bottom: 25px; }
            .section-lbl { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; }
            .section-val { font-size: 14px; font-weight: 600; margin-top: 3px; }
            .long-text-block { background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 30px; }
            .long-text-val { font-size: 13px; font-style: italic; white-space: pre-wrap; }
            .timeline-box { margin-top: 40px; }
            .timeline-title { font-size: 15px; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #0f172a; padding-bottom: 8px; margin-bottom: 15px; }
            .timeline-item { border-left: 2px solid #cbd5e1; padding-left: 15px; padding-bottom: 20px; position: relative; }
            .timeline-item::before { content: ''; position: absolute; left: -6px; top: 5px; width: 10px; height: 10px; border-radius: 50%; background: #0f172a; }
            .timeline-meta { font-size: 11px; color: #64748b; font-family: monospace; }
            .timeline-hdr { font-weight: bold; font-size: 13px; margin: 3px 0; }
            .timeline-desc { font-size: 12px; color: #475569; }
            .signature-zone { margin-top: 60px; display: flex; justify-content: space-between; page-break-inside: avoid; }
            .sig-block { border-top: 1px solid #94a3b8; width: 40%; text-align: center; padding-top: 10px; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="gov-title">DIRECCIÓN GENERAL DE DEFENSA DEL CONSUMIDOR</div>
            <div class="main-title">EVALUACIÓN SUMARIAL DEL EXPEDIENTE</div>
            <div class="sub-title">Causa N° ${exp.reclamo} | Ley 24.240 y Ley Prov. de Procedimiento</div>
          </div>

          <div class="details-grid">
            <div>
              <div class="section-lbl">Deniunciante (Consumidor)</div>
              <div class="section-val">${exp.apellido.toUpperCase()}, ${exp.nombre}</div>
            </div>
            <div>
              <div class="section-lbl">Documento Único (DNI)</div>
              <div class="section-val">${exp.dni}</div>
            </div>
            <div>
              <div class="section-lbl">Número de contacto</div>
              <div class="section-val">${exp.telefono || 'No consignado'}</div>
            </div>
            <div>
              <div class="section-lbl">Localidad Fiscal</div>
              <div class="section-val">${exp.localidad || 'Mesa de entradas general'}</div>
            </div>
            <div>
              <div class="section-lbl">Rubro Registrado de Reclamo</div>
              <div class="section-val">${exp.rubro}</div>
            </div>
            <div>
              <div class="section-lbl">Estado Legal en Curso</div>
              <div class="section-val" style="color: #b45309;">${exp.estado}</div>
            </div>
          </div>

          <div class="long-text-block">
            <div class="section-lbl">Pretensiones y motivos de la denuncia</div>
            <div class="long-text-val" style="margin-top: 8px;">"${exp.motivos}"</div>
          </div>

          <div class="details-grid" style="border-bottom: none; margin-bottom: 0px; padding-bottom: 0px;">
            <div>
              <div class="section-lbl">Firmas Comerciales Imputadas</div>
              <div class="section-val" style="font-size: 13px;">
                1. ${exp.denunciada1}<br>
                ${exp.denunciada2 ? `2. ${exp.denunciada2}<br>` : ''}
                ${exp.denunciada3 ? `3. ${exp.denunciada3}<br>` : ''}
                ${exp.denunciada4 ? `4. ${exp.denunciada4}` : ''}
              </div>
            </div>
            <div>
              <div class="section-lbl">Estatus de Notificación Cédula</div>
              <div class="section-val" style="font-size: 13px;">
                Fcha Salida: ${formatDisplayDate(exp.notificacionSale) || 'No despachada'}<br>
                Estado Cédula: ${formatDisplayDate(exp.notificacionVuelta) || 'Sin retorno formal'}
              </div>
            </div>
          </div>

          <div class="timeline-box">
            <div class="timeline-title">Movimientos y Proveídos Administrativos</div>
            ${movements.map(m => `
              <div class="timeline-item">
                <div class="timeline-meta">${m.fecha} - Operador Responsable: ${m.usuario}</div>
                <div class="timeline-hdr">${m.estadoAnterior} → ${m.estadoNuevo}</div>
                <div class="timeline-desc">${m.observaciones}</div>
              </div>
            `).join('')}
          </div>

          <div class="signature-zone">
            <div class="sig-block">
              Firma y Aclaración<br>Denunciante / Apoderado
            </div>
            <div class="sig-block">
              Dictamen de Asesoría Legal<br>Defensa del Consumidor
            </div>
          </div>

          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6" id="expedientes-crud-panel">
      
      {/* View Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>Gestión Digital de Expedientes</span>
            {isReadOnly && (
              <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200">
                Solo Lectura
              </span>
            )}
          </h2>
          <p className="text-slate-500 text-xs font-sans mt-0.5">Gestione y audite el ciclo operativo de sumarios y actas. Cada cambio audita el usuario, IP e hito temporal.</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={exportToExcelCSV}
            className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Excel (CSV)</span>
          </button>
          
          <button
            onClick={handleOpenAdd}
            disabled={isReadOnly}
            className={`flex items-center gap-1.5 font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-md ${
              isReadOnly 
                ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none' 
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20 shadow-sm active:scale-[0.98]'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Expediente</span>
          </button>
        </div>
      </div>

      {/* Advanced Filter Box */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4" id="advanced-filter-controls">
        {/* Finder box */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por N° Reclamo, DNI, Apellido..."
            className="w-full bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 font-sans rounded-xl py-2 pl-9 pr-4 focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs transition-all"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        {/* State selector */}
        <div>
          <select
            className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-sans rounded-xl py-2 px-3 focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
            value={filterEstado}
            onChange={(e) => {
              setFilterEstado(e.target.value);
              setCurrentPage(1);
            }}
            title="Filtrar por Estado"
          >
            <option value="TODOS">Estado: Todos los hitos</option>
            <option value="INGRESADO">INGRESADO</option>
            <option value="EN REVISIÓN">EN REVISIÓN</option>
            <option value="NOTIFICADO">NOTIFICADO</option>
            <option value="AUDIENCIA PROGRAMADA">AUDIENCIA PROGRAMADA</option>
            <option value="AUDIENCIA REALIZADA">AUDIENCIA REALIZADA</option>
            <option value="PASÓ A JURÍDICO">PASÓ A JURÍDICO</option>
            <option value="RESUELTO">RESUELTO</option>
            <option value="ARCHIVADO">ARCHIVADO</option>
          </select>
        </div>

        {/* Sector selector */}
        <div>
          <select
            className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-sans rounded-xl py-2 px-3 focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
            value={filterRubro}
            onChange={(e) => {
              setFilterRubro(e.target.value);
              setCurrentPage(1);
            }}
            title="Filtrar por Rubro de Industria"
          >
            <option value="TODOS">Rubro: Todas las Industrias</option>
            {rubrosList.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {/* Town selector */}
        <div>
          <select
            className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-sans rounded-xl py-2 px-3 focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
            value={filterLocalidad}
            onChange={(e) => {
              setFilterLocalidad(e.target.value);
              setCurrentPage(1);
            }}
            title="Filtrar por Localidad"
          >
            <option value="TODOS">Hometown: Todas las localidades</option>
            {localidadesList.map(loc => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Grid Table representation */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" id="cases-grid-wrapper">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/55 text-slate-500 text-[10px] font-mono uppercase tracking-wider">
                <th className="py-3 px-5 font-bold">Identificación / Titular</th>
                <th className="py-3 px-4 font-bold">Rubro / Conflictos</th>
                <th className="py-3 px-4 font-bold">Organismo Denunciado</th>
                <th className="py-3 px-4 font-bold">Fase / Proveído Principal</th>
                <th className="py-3 px-4 font-bold">Cédula Notificación</th>
                <th className="py-3 px-5 font-bold text-right text-slate-900">Acciones administrativas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-sans text-slate-600">
              {paginatedList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400 italic">
                    No se encontraron expedientes con los criterios de búsqueda activos.
                  </td>
                </tr>
              ) : (
                paginatedList.map((exp) => (
                  <tr key={exp.reclamo} className="hover:bg-slate-50/50 transition-colors">
                    
                    {/* ID / Name */}
                    <td className="py-3.5 px-5">
                      <div className="font-mono font-bold text-slate-900 text-xs tracking-tight">{exp.reclamo}</div>
                      <div className="font-sans font-semibold text-slate-750 text-sm mt-0.5">{exp.apellido}, {exp.nombre}</div>
                      <div className="font-mono text-[9px] text-slate-400 mt-0.5">DNI: {exp.dni}</div>
                    </td>

                    {/* Sector / motiviations */}
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="font-mono text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600 inline-block font-bold mb-1">
                        {exp.rubro}
                      </div>
                      <p className="text-slate-500 text-xs font-sans line-clamp-1 italic">
                        "{exp.motivos}"
                      </p>
                    </td>

                    {/* Denunciado */}
                    <td className="py-3.5 px-4 font-semibold text-slate-800">
                      <div className="truncate max-w-[150px]" title={exp.denunciada1}>
                        {exp.denunciada1}
                      </div>
                      {exp.denunciada2 && (
                        <div className="text-[10px] text-slate-400 truncate max-w-[150px]" title={exp.denunciada2}>
                          + {exp.denunciada2}
                        </div>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-1 text-[9px] font-extrabold tracking-wider rounded-lg border uppercase inline-block ${getStatusBadge(exp.estado)}`}>
                        {exp.estado}
                      </span>
                      {cleanLegacyDateToEmpty(exp.audiencia) && (
                        <div className="text-[9px] text-slate-500 font-semibold mt-1 flex items-center gap-1 bg-slate-50 px-1 py-0.5 rounded border border-slate-150 max-w-[130px] truncate" title={exp.audiencia}>
                          <span className="font-extrabold text-blue-600">Obs:</span> {exp.audiencia}
                        </div>
                      )}
                    </td>

                    {/* Notification info */}
                    <td className="py-3.5 px-4">
                      {exp.notificacionSale ? (
                        <div>
                          <div className="text-slate-700 font-bold text-[10px] flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                            Sale: {formatDisplayDate(exp.notificacionSale)}
                          </div>
                          <div className="text-slate-400 text-[9px] font-sans truncate max-w-[130px]" title={exp.notificacionVuelta}>
                            {formatDisplayDate(exp.notificacionVuelta) || 'Sin retorno'}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[10px] italic">No despachado</span>
                      )}
                    </td>

                    {/* Actions tools */}
                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => handleOpenView(exp)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-xl transition-all"
                          title="Audiencia & Timeline completa"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        
                        <button
                          onClick={() => handleOpenEdit(exp)}
                          disabled={isReadOnly}
                          className={`p-2 rounded-xl transition-all ${
                            isReadOnly 
                              ? 'bg-slate-50 text-slate-300 cursor-not-allowed' 
                              : 'bg-amber-100 hover:bg-amber-200 text-amber-800'
                          }`}
                          title="Modificar expediente / Proveído"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => printCaseSummary(exp)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-xl transition-all"
                          title="Imprimir cédula o acta sumaria"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDelete(exp.reclamo)}
                          disabled={isReadOnly || isOperator}
                          className={`p-2 rounded-xl transition-all ${
                            isReadOnly || isOperator
                              ? 'bg-slate-50 text-slate-300 cursor-not-allowed' 
                              : 'bg-rose-100 hover:bg-rose-200 text-rose-800'
                          }`}
                          title="Borrar providencia definitiva"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        <div className="bg-slate-50 px-5 py-4 border-t border-slate-100 flex items-center justify-between text-xs font-mono text-slate-500">
          <span>Mostrando {paginatedList.length} de {filteredList.length} registros</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 px-2.5 bg-white border border-slate-200 rounded-lg disabled:opacity-40"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span>Pág {currentPage} de {totalPages}</span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 px-2.5 bg-white border border-slate-200 rounded-lg disabled:opacity-40"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* MODAL 1: ADD EXPEDIENTE */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-200 max-w-2xl w-full shadow-2xl overflow-hidden text-sm"
            >
              <div className="bg-slate-950 px-6 py-4 flex justify-between items-center text-white">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
                  <span className="font-bold tracking-tight">Radicación de Expediente Inicial</span>
                </div>
                <button onClick={() => setShowAddModal(false)} className="hover:opacity-75 transition-opacity">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto font-sans">
                {/* Identification block */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">N° Reclamo / Código *</label>
                    <input
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:ring-1 focus:ring-amber-500 focus:bg-white outline-none font-mono"
                      value={formData.reclamo}
                      onChange={(e) => setFormData({ ...formData, reclamo: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">DNI del Denunciante *</label>
                    <input
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:ring-1 focus:ring-amber-500 focus:bg-white outline-none"
                      placeholder="DNI o CUIT (ej: 34.567.890)"
                      value={formData.dni}
                      onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Apellido Titular *</label>
                    <input
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:ring-1 focus:ring-amber-500 focus:bg-white outline-none"
                      value={formData.apellido}
                      onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Nombres Titular *</label>
                    <input
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:ring-1 focus:ring-amber-500 focus:bg-white outline-none"
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Teléfono de contacto</label>
                    <input
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:ring-1 focus:ring-amber-500 focus:bg-white outline-none"
                      value={formData.telefono}
                      onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Localidad del Consumidor</label>
                    <input
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:ring-1 focus:ring-amber-500 focus:bg-white outline-none"
                      placeholder="ej: Lomas de Zamora"
                      value={formData.localidad}
                      onChange={(e) => setFormData({ ...formData, localidad: e.target.value })}
                    />
                  </div>
                </div>

                {/* Conflict specs */}
                <div className="border-t border-slate-100 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Rubro de la denuncia</label>
                    <select
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:ring-1 focus:ring-amber-500 outline-none"
                      value={formData.rubro}
                      onChange={(e) => setFormData({ ...formData, rubro: e.target.value })}
                    >
                      <option value="Telecomunicaciones">Telecomunicaciones</option>
                      <option value="Servicios Públicos">Servicios Públicos</option>
                      <option value="Comercio Electrónico">Comercio Electrónico</option>
                      <option value="Bancos y Financieras">Bancos y Financieras</option>
                      <option value="Turismo y Pasajes">Turismo y Pasajes</option>
                      <option value="Fintech">Fintech</option>
                      <option value="Salud y Medicina">Salud y Medicina</option>
                      <option value="Electrodomésticos">Electrodomésticos</option>
                      <option value="Otros">Otros</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-705 text-xs text-slate-600 mb-1 font-bold">Estado del Expediente (Hormiga)*</label>
                    <input
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:ring-1 focus:ring-amber-500 focus:bg-white outline-none"
                      placeholder="ej: INGRESADO, EN REVISIÓN, etc."
                      value={formData.estado}
                      onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                      required
                    />
                  </div>

                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-slate-700 font-bold mb-1">Motivos detallados / Objeciones del Reclamante</label>
                    <textarea
                      rows={3}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:ring-1 focus:ring-amber-500 focus:bg-white outline-none"
                      placeholder="Describa el conflicto contractual..."
                      value={formData.motivos}
                      onChange={(e) => setFormData({ ...formData, motivos: e.target.value })}
                    />
                  </div>
                </div>

                {/* Denunciadas names */}
                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Entidades Comerciales Imputadas / Denunciadas</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-600 text-xs mb-1">Denunciada Principal *</label>
                      <input
                        type="text"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus:bg-white outline-none text-xs"
                        placeholder="ej: Telefonica de Argentina S.A."
                        value={formData.denunciada1}
                        onChange={(e) => setFormData({ ...formData, denunciada1: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 text-xs mb-1">Denunciada Solidaria 2</label>
                      <input
                        type="text"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus:bg-white outline-none text-xs"
                        value={formData.denunciada2}
                        onChange={(e) => setFormData({ ...formData, denunciada2: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 text-xs mb-1">Denunciada de Tercer Grado 3</label>
                      <input
                        type="text"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus:bg-white outline-none text-xs"
                        value={formData.denunciada3}
                        onChange={(e) => setFormData({ ...formData, denunciada3: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 text-xs mb-1">Denunciada Intermediaria 4</label>
                      <input
                        type="text"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus:bg-white outline-none text-xs"
                        value={formData.denunciada4}
                        onChange={(e) => setFormData({ ...formData, denunciada4: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="border-t border-slate-100 pt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="bg-slate-100 font-bold px-4 py-2 rounded-xl border border-slate-200 text-slate-700"
                  >
                    Descartar
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded-xl transition-all"
                  >
                    Guardar e Imputar en Sheet
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: EDIT EXPEDIENTE */}
      <AnimatePresence>
        {showEditModal && selectedExp && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-200 max-w-2xl w-full shadow-2xl overflow-hidden text-sm"
            >
              <div className="bg-slate-950 px-6 py-4 flex justify-between items-center text-white">
                <div className="flex flex-col">
                  <span className="font-bold tracking-tight">Proveído y Modificación del Expediente</span>
                  <span className="text-[10px] text-amber-500 font-mono">ID: {selectedExp.reclamo}</span>
                </div>
                <button onClick={() => setShowEditModal(false)} className="hover:opacity-75 transition-opacity">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleUpdate} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto font-sans">
                {/* STATE TRANSITION AND OBSERVATIONS (MOST IMPORTANT AS DIRECTED) */}
                <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-200/60 space-y-3">
                  <h4 className="font-sans font-black text-amber-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5" />
                    Providencia: Ajuste de Estado Operativo
                  </h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-705 text-xs text-slate-600 mb-1">Estado del Expediente (Hormiga)*</label>
                      <input
                        type="text"
                        className="w-full bg-white border border-amber-300 rounded-lg px-3 py-1.5 text-slate-800 focus:ring-1 focus:ring-amber-500 outline-none font-bold text-xs"
                        placeholder="ej: PASÓ A JURÍDICO, RESUELTO..."
                        value={formData.estado}
                        onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Ficha de Observaciones del Cambio (Auditable)</label>
                      <input
                        type="text"
                        className="w-full bg-white border border-amber-300 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-amber-500 outline-none text-xs inline-block"
                        placeholder="Ej: Se despachó cedula notificadora."
                        value={observacionesEstado}
                        onChange={(e) => setObservacionesEstado(e.target.value)}
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-amber-700 italic">Cada transición de estado registrará la fecha, hora, usuario e IP de forma indeleble.</p>
                </div>

                {/* Simple form details edit of client data */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 border-t border-slate-100 pt-4">
                  <div>
                    <label className="block text-slate-700 text-xs mb-1">Apellido Titular</label>
                    <input
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:bg-white text-xs"
                      value={formData.apellido}
                      onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 text-xs mb-1">Nombres Titular</label>
                    <input
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:bg-white text-xs"
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 text-xs mb-1">DNI Consumidor</label>
                    <input
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:bg-white text-xs"
                      value={formData.dni}
                      onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 text-xs mb-1">Teléfono</label>
                    <input
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:bg-white text-xs"
                      value={formData.telefono}
                      onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    />
                  </div>
                </div>

                {/* Notifications & Audencias Details */}
                <div className="border-t border-slate-100 pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-slate-700 text-xs mb-1">Cédula Sale (Fecha)</label>
                    <input
                      type="date"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none text-xs focus:bg-white"
                      value={formData.notificacionSale}
                      onChange={(e) => setFormData({ ...formData, notificacionSale: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 text-xs mb-1">Cédula Vuelta (Fecha)</label>
                    <input
                      type="date"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none text-xs focus:bg-white font-mono"
                      value={formData.notificacionVuelta}
                      onChange={(e) => setFormData({ ...formData, notificacionVuelta: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 text-xs mb-1">Observaciones</label>
                    <input
                      type="text"
                      placeholder="Sin observaciones"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 outline-none text-xs focus:bg-white"
                      value={formData.audiencia}
                      onChange={(e) => setFormData({ ...formData, audiencia: e.target.value })}
                    />
                  </div>
                </div>

                {/* Denunciadas names Edit */}
                <div className="border-t border-slate-100 pt-4">
                  <label className="block text-slate-700 text-xs mb-2 font-bold">Empresas denunciadas</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Principal *"
                      className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 outline-none text-xs"
                      value={formData.denunciada1}
                      onChange={(e) => setFormData({ ...formData, denunciada1: e.target.value })}
                      required
                    />
                    <input
                      type="text"
                      placeholder="Solidaria 2"
                      className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 outline-none text-xs"
                      value={formData.denunciada2}
                      onChange={(e) => setFormData({ ...formData, denunciada2: e.target.value })}
                    />
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="border-t border-slate-100 pt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="bg-slate-100 font-bold px-4 py-2 rounded-xl border border-slate-200 text-slate-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded-xl transition-all"
                  >
                    Aplicar Proveído
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: VIEW TIMELINE & MORE DETAILS */}
      <AnimatePresence>
        {showViewModal && selectedExp && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-200 max-w-xl w-full shadow-2xl overflow-hidden text-sm"
            >
              <div className="bg-slate-950 px-6 py-4 flex justify-between items-center text-white">
                <div>
                  <span className="font-bold tracking-tight">Historial y Proceso de Causa</span>
                  <p className="text-[10px] text-slate-400">Reclamo: {selectedExp.reclamo}</p>
                </div>
                <button onClick={() => setShowViewModal(false)} className="hover:opacity-75 transition-opacity">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto font-sans">
                {/* Simple stats bullet */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col gap-2">
                  <div className="font-sans font-bold text-slate-800">{selectedExp.apellido}, {selectedExp.nombre}</div>
                  <div className="grid grid-cols-2 gap-4 text-xs mt-1 text-slate-600">
                    <div><strong>DNI:</strong> {selectedExp.dni}</div>
                    <div><strong>Teléfono:</strong> {selectedExp.telefono || 'Sin datos'}</div>
                    <div><strong>Hometown:</strong> {selectedExp.localidad || 'S/D'}</div>
                    <div><strong>Última firma:</strong> {selectedExp.usuario}</div>
                  </div>
                </div>

                {/* Chronology List of states */}
                <div>
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-3">Movimientos sumarios registrados en la causa</h4>
                  <div className="relative border-l-2 border-slate-200 pl-4 space-y-4">
                    {Database.getMovimientos()
                      .filter(m => m.reclamo === selectedExp.reclamo)
                      .sort((a,b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
                      .map((mov) => (
                        <div key={mov.id} className="relative text-xs">
                          <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 bg-indigo-600 rounded-full"></span>
                          <div className="flex items-center gap-2 flex-wrap text-[10px] text-slate-400">
                            <strong>{mov.fecha}</strong>
                            <span>•</span>
                            <span>Usuario: {mov.usuario}</span>
                          </div>
                          <div className="font-bold text-slate-800 mt-1">
                            {mov.estadoAnterior === 'NINGUNO' ? 'INGRESADO' : `${mov.estadoAnterior} → ${mov.estadoNuevo}`}
                          </div>
                          <p className="text-slate-500 mt-0.5 italic">
                            "{mov.observaciones}"
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
