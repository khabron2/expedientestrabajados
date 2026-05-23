import React, { useState, useMemo } from 'react';
import { Database } from '../db';
import { AuditoriaLog } from '../types';
import { Shield, Search, Filter, RefreshCw, FileText, Lock, Globe } from 'lucide-react';

export function AuditoriaView() {
  const [logs, setLogs] = useState<AuditoriaLog[]>(() => Database.getAuditorias());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAccion, setFilterAccion] = useState<string>('TODAS');
  const [filterUsuario, setFilterUsuario] = useState<string>('TODOS');

  const reloadData = () => {
    setLogs(Database.getAuditorias());
  };

  // Compile filter metrics
  const uniqueUsers = useMemo(() => {
    return Array.from(new Set(logs.map(l => l.usuario)));
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // search term match
      const mathcSearch = `${log.reclamo} ${log.campoModificado} ${log.valorAnterior} ${log.nuevoValor} ${log.ip}`.toLowerCase().includes(searchTerm.toLowerCase());

      // Accion
      const matchAccion = filterAccion === 'TODAS' || log.accion === filterAccion;

      // Usuario
      const matchUser = filterUsuario === 'TODOS' || log.usuario === filterUsuario;

      return mathcSearch && matchAccion && matchUser;
    });
  }, [logs, searchTerm, filterAccion, filterUsuario]);

  const getActionBadge = (accion: string) => {
    switch (accion) {
      case 'CREACIÓN': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'MODIFICACIÓN': return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'ELIMINACIÓN': return 'bg-rose-50 text-rose-700 border-rose-100';
      case 'PROGRAMACIÓN': return 'bg-indigo-50 text-indigo-700 border-indigo-100';
      case 'ACCESO': return 'bg-purple-50 text-purple-700 border-purple-100';
      default: return 'bg-slate-50 text-slate-700 border-slate-100';
    }
  };

  return (
    <div className="space-y-6" id="auditoria-logs-panel">
      
      {/* Block Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Shield className="w-6 h-6 text-slate-700" />
            <span>Módulo de Auditoría y Control</span>
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">Bitácora sumarial inmutable. Registra cada acceso de usuario, cambios en sumarios, direcciones IP simuladas de origen y marcas de tiempo fiscales.</p>
        </div>

        <button
          onClick={reloadData}
          className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refrescar Bitácora</span>
        </button>
      </div>

      {/* Filter Options */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4" id="auditoria-filter-controls">
        {/* Finder */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por expediente, ip, cambios..."
            className="w-full bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 font-sans rounded-xl py-2 pl-9 pr-4 focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Accion selection */}
        <div>
          <select
            className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-sans rounded-xl py-2 px-3 focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
            value={filterAccion}
            onChange={(e) => setFilterAccion(e.target.value)}
            title="Acción"
          >
            <option value="TODAS">Acciones: Todas</option>
            <option value="CREACIÓN">CREACIÓN</option>
            <option value="MODIFICACIÓN">MODIFICACIÓN</option>
            <option value="ELIMINACIÓN">ELIMINACIÓN</option>
            <option value="PROGRAMACIÓN">PROGRAMACIÓN</option>
            <option value="ACCESO">ACCESO_SISTEMA</option>
          </select>
        </div>

        {/* User selection */}
        <div>
          <select
            className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-sans rounded-xl py-2 px-3 focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
            value={filterUsuario}
            onChange={(e) => setFilterUsuario(e.target.value)}
            title="Firmado por"
          >
            <option value="TODOS">Usuarios: Todos</option>
            {uniqueUsers.map(usr => (
              <option key={usr} value={usr}>{usr}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid Audit Panel */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-500 text-[10px] font-mono uppercase tracking-wider">
                <th className="py-3 px-5 font-bold">Identificación / Hito</th>
                <th className="py-3 px-4 font-bold">Operador Responsable</th>
                <th className="py-3 px-4 font-bold">Código Causa</th>
                <th className="py-3 px-4 font-bold">Acción Fiscal</th>
                <th className="py-3 px-4 font-bold">Novedades e Infracciones</th>
                <th className="py-3 px-5 font-bold text-right">Origen IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-sans text-slate-600">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400 italic">
                    Sin registros de auditoría que coincidan con la búsqueda fiscal actual.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/20 transition-colors">
                    
                    {/* Timestamp */}
                    <td className="py-3.5 px-5 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                      {item.fecha}
                    </td>

                    {/* Operator */}
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {item.usuario}
                    </td>

                    {/* Case ref */}
                    <td className="py-3.5 px-4 font-bold font-mono text-slate-700">
                      {item.reclamo}
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 text-[9px] font-bold tracking-wider rounded border uppercase ${getActionBadge(item.accion)}`}>
                        {item.accion}
                      </span>
                    </td>

                    {/* Modifications */}
                    <td className="py-3.5 px-4 font-sans text-slate-650 max-w-sm">
                      {item.campoModificado === 'TODO' ? (
                        <span className="text-emerald-700 font-semibold flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5" />
                          Creación e radicación legal de causa.
                        </span>
                      ) : item.campoModificado === 'LOGIN' ? (
                        <span className="text-purple-700 font-semibold flex items-center gap-1">
                          <Lock className="w-3.5 h-3.5" />
                          Acceso al panel administrativo concedido.
                        </span>
                      ) : item.campoModificado === 'REGISTRO COMPLETO' && item.nuevoValor === 'ELIMINADO' ? (
                        <span className="text-rose-700 font-bold">
                          ELIMINACIÓN DEFINITIVA: Causa original desestimada.
                        </span>
                      ) : (
                        <div className="space-y-0.5">
                          <div className="font-semibold text-slate-800 text-[10px] uppercase font-mono tracking-wider">Campo: {item.campoModificado}</div>
                          <div className="text-slate-520 text-slate-500">
                            Previa: <span className="line-through italic">"{item.valorAnterior}"</span> → Nueva: <span className="font-semibold text-slate-800">"{item.nuevoValor}"</span>
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Simulated IP */}
                    <td className="py-3.5 px-5 text-right font-mono text-[10px] text-slate-400">
                      <span className="flex items-center justify-end gap-1">
                        <Globe className="w-3.5 h-3.5 text-slate-300" />
                        {item.ip}
                      </span>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
