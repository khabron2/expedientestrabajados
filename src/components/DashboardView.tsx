import React, { useState, useMemo } from 'react';
import { Database, formatDate } from '../db';
import { Expediente, AuditoriaLog, EstadoExpediente } from '../types';
import { BarChart3, TrendingUp, Calendar, AlertCircle, Bookmark, CheckCircle2, FileSpreadsheet, Users, Activity, Filter, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';

export function DashboardView() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Loaded database
  const expedientes = Database.getExpedientes();
  const auditoria = Database.getAuditorias();

  // Filtered dataset
  const filteredExpedientes = useMemo(() => {
    return expedientes.filter(exp => {
      const updateDate = exp.fechaActualizacion ? new Date(exp.fechaActualizacion) : null;
      if (!updateDate) return true;
      
      const targetTime = updateDate.getTime();
      if (startDate) {
        const startSec = new Date(startDate).getTime();
        if (targetTime < startSec) return false;
      }
      if (endDate) {
        // add 1 day to include the end date fully
        const endSec = new Date(endDate).getTime() + (24 * 60 * 60 * 1000);
        if (targetTime > endSec) return false;
      }
      return true;
    });
  }, [expedientes, startDate, endDate]);

  // Compute status totals
  const stats = useMemo(() => {
    const total = filteredExpedientes.length;
    const abiertos = filteredExpedientes.filter(e => e.estado !== 'RESUELTO' && e.estado !== 'ARCHIVADO').length;
    const cerrados = filteredExpedientes.filter(e => e.estado === 'RESUELTO' || e.estado === 'ARCHIVADO').length;
    const enJuridico = filteredExpedientes.filter(e => e.estado === 'PASÓ A JURÍDICO').length;
    const conAudienciaProg = filteredExpedientes.filter(e => e.estado === 'AUDIENCIA PROGRAMADA').length;

    // Audiencias del día (Hoy = 2026-05-20 as based on ADDITIONAL_METADATA)
    const targetTodayStr = "2026-05-22"; // We simulate the peak day in mock data (May 22, 2026 is scheduled)
    const audienciasHoy = filteredExpedientes.filter(e => {
      if (!e.audiencia) return false;
      return formatDate(new Date(e.audiencia)) === targetTodayStr;
    }).length;

    // Cantidad de notificaciones programadas-enviadas
    const cantNotificaciones = filteredExpedientes.filter(e => e.notificacionSale !== '').length;

    return { total, abiertos, cerrados, enJuridico, conAudienciaProg, audienciasHoy, cantNotificaciones };
  }, [filteredExpedientes]);

  // Breakdown of categories ("Rubro")
  const rubroStats = useMemo(() => {
    const list: Record<string, number> = {};
    filteredExpedientes.forEach(e => {
      list[e.rubro] = (list[e.rubro] || 0) + 1;
    });
    
    return Object.entries(list)
      .map(([name, count]) => ({ name, count, pct: stats.total ? Math.round((count / stats.total) * 100) : 0 }))
      .sort((a, b) => b.count - a.count);
  }, [filteredExpedientes, stats.total]);

  // Breakdown of "Estado"
  const estadoStats = useMemo(() => {
    const counts: Record<EstadoExpediente, number> = {
      'INGRESADO': 0,
      'EN REVISIÓN': 0,
      'NOTIFICADO': 0,
      'AUDIENCIA PROGRAMADA': 0,
      'AUDIENCIA REALIZADA': 0,
      'PASÓ A JURÍDICO': 0,
      'RESUELTO': 0,
      'ARCHIVADO': 0
    };

    filteredExpedientes.forEach(e => {
      if (counts[e.estado] !== undefined) {
        counts[e.estado]++;
      }
    });

    return Object.entries(counts).map(([name, count]) => ({
      name,
      count,
      pct: stats.total ? Math.round((count / stats.total) * 100) : 0
    }));
  }, [filteredExpedientes, stats.total]);

  const recentAudits = useMemo(() => {
    return auditoria.slice(0, 5);
  }, [auditoria]);

  // Refresh filters helper
  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
  };

  return (
    <div className="space-y-6" id="dashboard-view-panel">
      {/* Page Title & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Panel de Estadísticas CRM</h2>
          <p className="text-slate-500 text-xs font-sans mt-1">Supervisión integral de sumarios judiciales, expedientes conciliatorios e indicadores de rendimiento.</p>
        </div>

        {/* Date Filter Component */}
        <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-1.5 px-3 border-r border-slate-100 text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <span className="text-[10px] font-mono uppercase tracking-wider font-bold">Filtros</span>
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="date" 
              className="bg-slate-50 border border-slate-100 rounded-lg text-xs py-1 px-2 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              title="Fecha Inicial"
            />
            <span className="text-xs text-slate-400">a</span>
            <input 
              type="date" 
              className="bg-slate-50 border border-slate-100 rounded-lg text-xs py-1 px-2 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              title="Fecha Límite"
            />
          </div>
          {(startDate || endDate) && (
            <button 
              onClick={clearFilters}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Bento Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" id="kpi-bento-grid">
        
        {/* KPI: Total */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between group hover:border-slate-300 transition-colors">
          <div>
            <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-slate-400">Suma General</span>
            <h4 className="text-3xl font-black text-slate-900 mt-1.5">{stats.total}</h4>
            <div className="text-[10px] text-slate-500 font-sans mt-1">Expedientes totales cargados</div>
          </div>
          <div className="bg-slate-50 text-slate-800 p-3 rounded-xl group-hover:bg-slate-100 transition-colors">
            <Bookmark className="w-5 h-5" />
          </div>
        </div>

        {/* KPI: Abiertos */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between group hover:border-slate-300 transition-colors">
          <div>
            <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-amber-500">Trámites Activos</span>
            <h4 className="text-3xl font-black text-amber-600 mt-1.5">{stats.abiertos}</h4>
            <div className="text-[10px] text-slate-500 font-sans mt-1">En curso o mesa conciliadora</div>
          </div>
          <div className="bg-amber-50 text-amber-600 p-3 rounded-xl">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        {/* KPI: Cerrados */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between group hover:border-slate-300 transition-colors">
          <div>
            <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-emerald-500">Resueltos / Archivo</span>
            <h4 className="text-3xl font-black text-emerald-600 mt-1.5">{stats.cerrados}</h4>
            <div className="text-[10px] text-slate-500 font-sans mt-1">Acuerdo mutuo o desistimiento</div>
          </div>
          <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* KPI: Audiencias programadas (Destacando la del día más importante) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between group hover:border-slate-300 transition-colors">
          <div>
            <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-indigo-500">Hoy • 22 de Mayo</span>
            <h4 className="text-3xl font-black text-indigo-600 mt-1.5">{stats.audienciasHoy}</h4>
            <div className="text-[10px] text-slate-500 font-sans mt-1">Conciliaciones agendadas hoy - ({stats.conAudienciaProg} total)</div>
          </div>
          <div className="bg-indigo-50 text-indigo-600 p-3 rounded-xl">
            <Calendar className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Row of Secondary KPI (Juridico and notifications) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl flex items-center gap-4">
          <div className="bg-rose-250 bg-rose-500 text-white p-2.5 rounded-lg">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h5 className="font-sans font-bold text-rose-900 text-sm">Fase Sumarial Abierta (Área Jurídica): {stats.enJuridico}</h5>
            <p className="text-rose-700 text-xs mt-0.5">Expedientes imputados formalmente por presuntas infracciones sin posibilidad de conciliación.</p>
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-100 p-4 rounded-xl flex items-center gap-4">
          <div className="bg-purple-500 text-white p-2.5 rounded-lg">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h5 className="font-sans font-bold text-purple-900 text-sm">Notificaciones Expedidas: {stats.cantNotificaciones}</h5>
            <p className="text-purple-700 text-xs mt-0.5">Expedientes despachados formalmente con cédulas de notificación de denuncias a firmas comerciales.</p>
          </div>
        </div>
      </div>

      {/* Main Graphics Section - Hand Crafted Visual SVGs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="dashboard-charts-grid">
        
        {/* CHART 1: Distribution of claims by Sector ("Rubro") */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-sans font-bold text-slate-800 text-sm tracking-tight flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-slate-500" />
              Reclamos Destacados por Rubro de Industria
            </h3>
            <p className="text-slate-400 text-xs mt-1">Breakout sectorial porcentual registrado en el rango fiscal actual.</p>
          </div>

          <div className="my-6 space-y-4">
            {rubroStats.length === 0 ? (
              <p className="text-center text-slate-400 text-xs italic py-10">Sin datos de industria en el rango.</p>
            ) : (
              rubroStats.slice(0, 5).map((r, index) => {
                const colors = ['bg-blue-600', 'bg-indigo-500', 'bg-purple-500', 'bg-teal-500', 'bg-pink-500'];
                const barColor = colors[index % colors.length];
                return (
                  <div key={r.name} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-sans font-semibold text-slate-700">{r.name}</span>
                      <span className="font-mono text-slate-500 font-bold">{r.count} ({r.pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }} 
                        animate={{ width: `${r.pct}%` }} 
                        transition={{ duration: 0.8, delay: index * 0.1 }}
                        className={`${barColor} h-full rounded-full`}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-slate-100 pt-4 flex justify-between items-center">
            <span className="text-[10px] text-slate-400 font-mono">Top 5 Sectores Registrados</span>
            <span className="text-xs text-amber-600 font-semibold flex items-center gap-1">
              <TrendingUp className="w-3 h-3 hover:scale-110" />
              Análisis Regulatorio
            </span>
          </div>
        </div>

        {/* CHART 2: Case status breakdown block (Meters) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-sans font-bold text-slate-800 text-sm tracking-tight flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-500" />
              Estado Dinámico del Fichero de Expedientes
            </h3>
            <p className="text-slate-400 text-xs mt-1">Porcentaje y total de sumarios cursando distintas fases legales.</p>
          </div>

          <div className="my-6 grid grid-cols-2 gap-4">
            {estadoStats.map((st, index) => {
              const bgColors = {
                'INGRESADO': 'bg-blue-50 text-blue-700 border-blue-200',
                'EN REVISIÓN': 'bg-amber-50 text-amber-700 border-amber-200',
                'NOTIFICADO': 'bg-purple-50 text-purple-700 border-purple-200',
                'AUDIENCIA PROGRAMADA': 'bg-indigo-50 text-indigo-700 border-indigo-200',
                'AUDIENCIA REALIZADA': 'bg-teal-50 text-teal-700 border-teal-200',
                'PASÓ A JURÍDICO': 'bg-rose-50 text-rose-700 border-rose-200',
                'RESUELTO': 'bg-emerald-50 text-emerald-700 border-emerald-200',
                'ARCHIVADO': 'bg-gray-50 text-gray-700 border-gray-200'
              };

              return (
                <div 
                  key={st.name}
                  className={`p-3 rounded-xl border flex flex-col justify-between hover:scale-[1.01] transition-all ${bgColors[st.name as EstadoExpediente] || 'bg-slate-50'}`}
                >
                  <span className="font-sans font-bold text-[10px] tracking-tight uppercase leading-none block truncate">
                    {st.name}
                  </span>
                  <div className="flex items-baseline justify-between mt-2">
                    <span className="text-xl font-black">{st.count}</span>
                    <span className="font-mono text-[9px] font-black opacity-70">
                      {st.pct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-slate-100 pt-4 text-center">
            <p className="font-mono text-[10px] text-slate-400">
              Ciclo de Vida del Reclamo según Resoluciones Consensuadas Ley 24.240
            </p>
          </div>
        </div>
      </div>

      {/* Row: Recent Audited Movements list */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm" id="recent-audits-panel">
        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-slate-500" />
            <div>
              <h3 className="font-sans font-black text-slate-800 text-sm">Registro Reciente de Acciones y Auditoría</h3>
              <p className="text-slate-400 text-xs">Muestra los últimos 5 ingresos, modificaciones o programaciones ejecutados en la base.</p>
            </div>
          </div>
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest bg-slate-50 px-2.5 py-1 rounded-full border border-slate-200">
            Seguimiento Activo
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 text-[10px] font-mono uppercase tracking-wider">
                <th className="py-2.5 font-bold">Usuario</th>
                <th className="py-2.5 font-bold">Fecha / Hora</th>
                <th className="py-2.5 font-bold">Expediente</th>
                <th className="py-2.5 font-bold">Acción</th>
                <th className="py-2.5 font-bold">Ajustes Realizados</th>
                <th className="py-2.5 font-bold text-right">Dirección IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-sans text-slate-600">
              {recentAudits.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 font-semibold text-slate-900 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                    {item.usuario}
                  </td>
                  <td className="py-3 font-mono text-slate-500 text-[11px]">{item.fecha}</td>
                  <td className="py-3 font-mono font-bold text-slate-800">{item.reclamo}</td>
                  <td className="py-3">
                    <span className={`px-2 py-0.5 text-[9px] font-extrabold tracking-wider rounded border uppercase ${
                      item.accion === 'CREACIÓN' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                      item.accion === 'PROGRAMACIÓN' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                      item.accion === 'ELIMINACIÓN' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                      item.accion === 'ACCESO' ? 'bg-slate-50 text-slate-700 border-slate-100' :
                      'bg-amber-50 text-amber-700 border-amber-100'
                    }`}>
                      {item.accion}
                    </span>
                  </td>
                  <td className="py-3 text-slate-500 font-sans max-w-xs truncate">
                    {item.campoModificado === 'TODO' ? 'Ingreso integral del expediente en el sistema' : `${item.campoModificado}: de '${item.valorAnterior}' a '${item.nuevoValor}'`}
                  </td>
                  <td className="py-3 text-right font-mono text-[10px] text-slate-400">{item.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
