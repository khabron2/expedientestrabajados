import React, { useState } from 'react';
import { Database } from '../db';
import { Expediente, Movimiento } from '../types';
import { Search, ChevronRight, FileText, Calendar, Bell, CheckCircle, ShieldAlert, Clock, ArrowRight, UserCheck, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';

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

function cleanLegacyDateToEmpty(val: string | undefined | null): string {
  if (!val) return '';
  const trimmed = val.trim();
  if (!trimmed) return '';

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

interface PublicAreaProps {
  onEnterAdmin: () => void;
  isBootSyncing?: boolean;
}

export function PublicArea({ onEnterAdmin, isBootSyncing = false }: PublicAreaProps) {
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<Expediente[]>([]);
  const [selectedExp, setSelectedExp] = useState<Expediente | null>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQuery = query.trim().toUpperCase();
    if (!cleanQuery) return;

    const allExp = Database.getExpedientes();
    const filtered = allExp.filter(exp => {
      return (
        exp.reclamo.toUpperCase().includes(cleanQuery) ||
        exp.dni.replace(/\./g, '').includes(cleanQuery.replace(/\./g, '')) ||
        exp.apellido.toUpperCase().includes(cleanQuery)
      );
    });

    setResults(filtered);
    setSearched(true);
    if (filtered.length === 1) {
      setSelectedExp(filtered[0]);
    } else {
      setSelectedExp(null);
    }
  };

  // Get movements for the active dossier
  const getMovementsFor = (reclamo: string): Movimiento[] => {
    return Database.getMovimientos()
      .filter(m => m.reclamo === reclamo)
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'INGRESADO': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'EN REVISIÓN': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'NOTIFICADO': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'AUDIENCIA PROGRAMADA': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'AUDIENCIA REALIZADA': return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'PASÓ A JURÍDICO': return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'RESUELTO': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'ARCHIVADO': return 'bg-gray-50 text-gray-700 border-gray-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getStatusBadgeDot = (status: string) => {
    switch (status) {
      case 'INGRESADO': return 'bg-blue-500';
      case 'EN REVISIÓN': return 'bg-amber-500';
      case 'NOTIFICADO': return 'bg-purple-500';
      case 'AUDIENCIA PROGRAMADA': return 'bg-indigo-500';
      case 'AUDIENCIA REALIZADA': return 'bg-teal-500';
      case 'PASÓ A JURÍDICO': return 'bg-rose-500';
      case 'RESUELTO': return 'bg-emerald-500';
      default: return 'bg-gray-400';
    }
  };

  const getTimelineIcon = (status: string) => {
    switch (status) {
      case 'INGRESADO': return <FileText className="w-5 h-5 text-blue-600" />;
      case 'EN REVISIÓN': return <Clock className="w-5 h-5 text-amber-600" />;
      case 'NOTIFICADO': return <Bell className="w-5 h-5 text-purple-600" />;
      case 'AUDIENCIA PROGRAMADA': return <Calendar className="w-5 h-5 text-indigo-600" />;
      case 'AUDIENCIA REALIZADA': return <UserCheck className="w-5 h-5 text-teal-600" />;
      case 'PASÓ A JURÍDICO': return <ShieldAlert className="w-5 h-5 text-rose-600" />;
      case 'RESUELTO': return <CheckCircle className="w-5 h-5 text-emerald-600" />;
      default: return <FileText className="w-5 h-5 text-gray-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between" id="public-area-wrapper">
      {/* Header Bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between" id="public-header">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white p-2.5 rounded-xl shadow-sm flex items-center justify-center">
            <span className="font-extrabold text-sm tracking-widest uppercase">DC</span>
          </div>
          <div>
            <h1 className="font-sans font-bold text-slate-900 tracking-tight text-lg">Defensa del Consumidor</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="font-mono text-[10px] text-slate-500 tracking-widest uppercase">Consulta de expedientes pública</p>
              {isBootSyncing ? (
                <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-600 text-[9px] font-bold px-1.5 py-0.5 rounded border border-amber-200 animate-pulse font-sans">
                  <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Conectando...
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 text-[9px] font-bold px-1.5 py-0.5 rounded border border-emerald-200 font-sans">
                  <span className="w-1 h-1 rounded-full bg-emerald-500 animate-ping"></span>
                  <span className="w-1 h-1 rounded-full bg-emerald-500 absolute"></span>
                  Online
                </span>
              )}
            </div>
          </div>
        </div>
        
        <button
          onClick={onEnterAdmin}
          className="group flex items-center gap-2 bg-slate-950 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all hover:bg-slate-800 shadow-sm"
          id="btn-admin-access"
        >
          <span>Ingreso Administrativo</span>
          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-grow flex flex-col items-center justify-center px-4 py-12 max-w-4xl mx-auto w-full">
        
        {/* Welcome Section */}
        <div className="text-center w-full max-w-xl mb-8">
          <span className="px-3 py-1 bg-blue-50 border border-blue-200 text-blue-800 text-[10px] uppercase font-bold tracking-widest rounded-full">
            Plataforma Ciudadana
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 mt-3 sm:text-4xl">
            Siga el estado de su reclamo
          </h2>
          <p className="text-slate-600 font-sans text-sm mt-3">
            Ingrese sus datos personales o el número identificador asignado durante su presentación en mesa de entradas para visualizar la línea de tiempo oficial.
          </p>
        </div>

        {/* Searching Bar Grid */}
        <div className="w-full bg-white rounded-3xl border border-slate-200 shadow-lg p-6 sm:p-8" id="search-container-box">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-grow">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="DNI (ej: 20345678), N° Reclamo (EXP-2026-XXXX) o Apellido"
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 font-sans rounded-2xl py-3.5 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm transition-all"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                id="search-input-field"
              />
            </div>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-2xl px-6 py-3.5 text-sm transition-all shadow-md shadow-blue-500/20 active:scale-[0.98]"
              id="submit-search-btn"
            >
              Consultar Trámite
            </button>
          </form>

          {/* Quick instructions indicator */}
          <div className="mt-4 flex items-center justify-center gap-6 font-mono text-[10px] text-slate-400 text-center flex-wrap">
            <span>✓ Búsqueda por DNI</span>
            <span>✓ Búsqueda por N° Reclamo</span>
            <span>✓ Búsqueda por Apellido</span>
          </div>
        </div>

        {/* Search Results / Details Display Grid */}
        {searched && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full mt-8"
            id="search-results-section"
          >
            {results.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
                <ShieldAlert className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="font-sans font-bold text-slate-800 text-lg">No encontramos resultados</h3>
                <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">
                  Por favor, verifique el número de documento o el formato del identificador de expediente ingresado.
                </p>
              </div>
            ) : results.length > 1 && !selectedExp ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h3 className="font-sans font-bold text-slate-800 text-base mb-3">Múltiples trámites encontrados ({results.length})</h3>
                <p className="text-slate-500 text-xs mb-4">Seleccione el expediente que desea auditar:</p>
                <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                  {results.map((exp) => (
                    <button
                      key={exp.reclamo}
                      onClick={() => setSelectedExp(exp)}
                      className="w-full flex items-center justify-between py-3 px-2 text-left hover:bg-slate-50 rounded-xl transition-all group"
                    >
                      <div>
                        <div className="font-sans font-semibold text-slate-900 text-sm">
                          {exp.apellido}, {exp.nombre}
                        </div>
                        <div className="font-mono text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                          <span>{exp.reclamo}</span>
                          <span>•</span>
                          <span>DNI: {exp.dni}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-1 text-[10px] font-bold tracking-wider rounded-lg border uppercase ${getStatusColor(exp.estado)}`}>
                          {exp.estado}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-400 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              // Case details selected or unique match
              <div className="flex flex-col gap-6" id="selected-case-details">
                {results.length > 1 && (
                  <button
                    onClick={() => setSelectedExp(null)}
                    className="self-start text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1.5"
                  >
                    ← Volver a la lista de resultados
                  </button>
                )}

                {/* Main Case Header Info Card */}
                {selectedExp && (
                  <>
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="bg-slate-900 px-6 py-5 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                          <div className="font-mono text-[10px] uppercase text-blue-400 tracking-wider font-bold">EXPEDIENTE CERTIFICADO</div>
                          <h3 className="text-lg md:text-xl font-bold tracking-tight mt-1">{selectedExp.apellido}, {selectedExp.nombre}</h3>
                          <p className="text-xs text-slate-400 mt-0.5">Identificación Oficial: <span className="font-mono text-white">{selectedExp.reclamo}</span> | DNI: {selectedExp.dni}</p>
                        </div>
                        <div className="flex flex-col md:items-end">
                          <span className={`px-3 py-1.5 text-xs font-black tracking-wider rounded-xl border uppercase shadow-sm ${getStatusColor(selectedExp.estado)}`}>
                            {selectedExp.estado}
                          </span>
                          <span className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Actualizado: {new Date(selectedExp.fechaActualizacion).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {/* Summary limited data */}
                      <div className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 bg-slate-50/50 border-b border-slate-100">
                        <div>
                          <p className="font-mono text-[10px] text-slate-400 uppercase tracking-wider">ENTIDAD DENUNCIADA</p>
                          <p className="font-sans font-semibold text-slate-800 text-sm mt-1">
                            {selectedExp.denunciada1}
                            {selectedExp.denunciada2 && <span className="text-slate-500 font-normal"> / {selectedExp.denunciada2}</span>}
                          </p>
                        </div>
                        <div>
                          <p className="font-mono text-[10px] text-slate-400 uppercase tracking-wider">NOTIFICACIÓN SUMARIA</p>
                          <p className="font-sans font-semibold text-slate-800 text-sm mt-1 flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${selectedExp.notificacionSale ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                            {selectedExp.notificacionSale ? 'Enviada' : 'No Procesada'} 
                            {selectedExp.notificacionSale && <span className="text-slate-400 font-normal text-xs">({formatDisplayDate(selectedExp.notificacionSale)})</span>}
                          </p>
                        </div>
                        <div>
                          <p className="font-mono text-[10px] text-slate-400 uppercase tracking-wider">ÁREA JURÍDICA</p>
                          <p className="font-sans font-semibold text-slate-800 text-sm mt-1 flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${selectedExp.estado === 'PASÓ A JURÍDICO' ? 'bg-rose-500' : 'bg-slate-300'}`}></span>
                            {selectedExp.estado === 'PASÓ A JURÍDICO' ? 'Fase de Dictamen' : 'Mesa Conciliadora'}
                          </p>
                        </div>
                        <div>
                          <p className="font-mono text-[10px] text-slate-400 uppercase tracking-wider">OBSERVACIONES DE LA CAUSA</p>
                          <p className="font-sans font-semibold text-slate-800 text-sm mt-1">
                            {cleanLegacyDateToEmpty(selectedExp.audiencia) || 'Sin observaciones'}
                          </p>
                        </div>
                        <div className="col-span-1 sm:col-span-2">
                          <p className="font-mono text-[10px] text-slate-400 uppercase tracking-wider">MOTIVOS DEL PRESENTADO</p>
                          <p className="font-sans text-slate-600 text-xs mt-1 italic line-clamp-2">
                            "{selectedExp.motivos}"
                          </p>
                        </div>
                      </div>

                      {/* Visual Timeline details */}
                      <div className="p-6">
                        <h4 className="font-sans font-black text-slate-900 text-sm mb-6 flex items-center gap-2">
                          <span>Historial de Hitos y Resoluciones</span>
                          <span className="w-2 h-2 bg-slate-300 rounded-full"></span>
                        </h4>

                        <div className="relative border-l border-slate-200 pl-6 ml-3 space-y-6">
                          {getMovementsFor(selectedExp.reclamo).map((mov, mIdx) => (
                            <div key={mov.id} className="relative">
                              {/* Position timeline icon */}
                              <span className="absolute -left-[37px] top-0.5 bg-white border-2 border-slate-200 p-1.5 rounded-full shadow-sm flex items-center justify-center">
                                {getTimelineIcon(mov.estadoNuevo)}
                              </span>

                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-sans font-bold text-slate-800 text-sm">
                                    {mov.estadoNuevo}
                                  </span>
                                  <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                    {mov.fecha}
                                  </span>
                                  {mIdx === 0 && (
                                    <span className="bg-amber-100 text-amber-800 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                                      Último Hito
                                    </span>
                                  )}
                                </div>
                                <p className="text-slate-600 font-sans text-xs mt-1.5 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                                  {mov.observaciones}
                                </p>
                              </div>
                            </div>
                          ))}

                          {/* Base circle indicating expediente insertion */}
                          <div className="relative">
                            <span className="absolute -left-[31px] top-1 w-2.5 h-2.5 bg-emerald-500 rounded-full"></span>
                            <div className="text-[10px] font-mono text-slate-400 pl-1 uppercase tracking-wider">
                              Iniciación de sumario legal
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </motion.div>
        )}
      </main>

      {/* Public Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 px-6 text-center text-xs text-slate-400" id="public-footer">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Defensa del Consumidor. Organismo de Control Estatal de Comercio Ley 24.240. Todos los derechos reservados.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-slate-600 transition-colors">Normativas</a>
            <a href="#" className="hover:text-slate-600 transition-colors">Terminos y Privacidad</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
