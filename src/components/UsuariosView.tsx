import React, { useState, useEffect } from 'react';
import { Database } from '../db';
import { Usuario, RolUsuario } from '../types';
import { 
  Users, 
  Shield, 
  CheckCircle, 
  XCircle, 
  Key, 
  AlertCircle, 
  UserPlus, 
  Trash, 
  RefreshCw, 
  FileSpreadsheet,
  Mail,
  UserCheck,
  Pencil,
  X
} from 'lucide-react';

interface UsuariosViewProps {
  currentUser: Usuario;
  onChangeUserSimulation: (user: Usuario) => void;
  addToast: (msg: string, type: 'success' | 'error' | 'warning') => void;
  syncTrigger?: number;
}

export function UsuariosView({ currentUser, onChangeUserSimulation, addToast, syncTrigger }: UsuariosViewProps) {
  const [activeTab, setActiveTab] = useState<'ROLES' | 'CUENTAS' | 'CONEXION_SHEET'>('CUENTAS');
  
  // Dynamic list state queried from our database layer
  const [usuarios, setUsuarios] = useState<(Usuario & { clave: string })[]>(() => Database.getUsuarios());

  useEffect(() => {
    setUsuarios(Database.getUsuarios());
  }, [syncTrigger]);
  
  // Form states for creating a new account
  const [newUsername, setNewUsername] = useState('');
  const [newNombre, setNewNombre] = useState('');
  const [newRol, setNewRol] = useState<RolUsuario>('SOLO LECTURA');
  const [newCorreo, setNewCorreo] = useState('');
  const [newClave, setNewClave] = useState('');
  const [isPulling, setIsPulling] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  
  // Track currently edited user account
  const [editingUser, setEditingUser] = useState<(Usuario & { clave: string }) | null>(null);

  const handleClearSimulatedUsers = () => {
    const defaultUsernames = ['admin', 'operador', 'lector'];
    const filtered = usuarios.filter(u => !defaultUsernames.includes(u.username.toLowerCase()));
    Database.saveUsuarios(filtered);
    setUsuarios(filtered);
    addToast('Se han eliminado los usuarios simulados de prueba. Ahora solo restan las cuentas auténticas.', 'success');
  };

  const startEditingUser = (usr: typeof usuarios[0]) => {
    setEditingUser(usr);
    setNewUsername(usr.username);
    setNewNombre(usr.nombre);
    setNewRol(usr.rol);
    setNewCorreo(usr.correo);
    setNewClave(usr.clave);
    addToast(`Cargados datos de ${usr.nombre} para editar`, 'warning');
  };

  const cancelEditingUser = () => {
    setEditingUser(null);
    setNewUsername('');
    setNewNombre('');
    setNewRol('SOLO LECTURA');
    setNewCorreo('');
    setNewClave('');
  };

  const getRoleColor = (rol: RolUsuario) => {
    switch (rol) {
      case 'ADMINISTRADOR': return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'OPERADOR': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'SOLO LECTURA': return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const handleChangeSimulation = (user: typeof usuarios[0]) => {
    const usrSim: Usuario = {
      id: user.id,
      username: user.username,
      nombre: user.nombre,
      rol: user.rol,
      correo: user.correo
    };
    onChangeUserSimulation(usrSim);
    addToast(`¡Simulación activa cambiada a: ${user.nombre} (${user.rol})!`, 'success');
  };

  const handleSubmitUserForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) {
      addToast('El nombre de usuario es requerido.', 'error');
      return;
    }
    if (!newNombre.trim()) {
      addToast('El nombre completo es requerido.', 'error');
      return;
    }
    if (!newClave.trim()) {
      addToast('La clave de acceso es requerida.', 'error');
      return;
    }

    const cleanedUsername = newUsername.trim().toLowerCase();

    if (editingUser) {
      // Validate duplicate usernames except this one
      if (usuarios.some(u => u.username.toLowerCase() === cleanedUsername && u.id !== editingUser.id)) {
        addToast(`El nombre de usuario "${cleanedUsername}" ya existe en el CRM.`, 'error');
        return;
      }

      const updatedUserObj = {
        id: editingUser.id,
        username: cleanedUsername,
        nombre: newNombre.trim(),
        rol: newRol,
        correo: newCorreo.trim() || `${cleanedUsername}@defensa.gob.ar`,
        clave: newClave.trim()
      };

      const updatedList = usuarios.map(u => u.id === editingUser.id ? updatedUserObj : u);
      Database.saveUsuarios(updatedList);
      setUsuarios(updatedList);

      // Async live update to sheets and trigger full sync
      Database.postToWebhook('UPDATE_USER', updatedUserObj);
      Database.syncAllUsersToGoogleSheets().catch(err => console.warn("Background users sync warning", err));

      Database.addAuditoria(
        currentUser.username,
        'EDICIÓN_USUARIOS',
        'USUARIOS_CRM',
        updatedUserObj.username,
        `Modificados datos de operador: ${updatedUserObj.nombre} (${updatedUserObj.rol})`,
        'MODIFICACIÓN'
      );

      addToast(`Datos del operador "${updatedUserObj.username}" modificados correctamente.`, 'success');
      setEditingUser(null);
    } else {
      // Create new user
      if (usuarios.some(u => u.username.toLowerCase() === cleanedUsername)) {
        addToast(`El nombre de usuario "${cleanedUsername}" ya existe en el CRM.`, 'error');
        return;
      }

      const newUserObj = {
        id: 'u-' + Math.random().toString(36).substring(2, 9),
        username: cleanedUsername,
        nombre: newNombre.trim(),
        rol: newRol,
        correo: newCorreo.trim() || `${cleanedUsername}@defensa.gob.ar`,
        clave: newClave.trim()
      };

      const updatedList = [...usuarios, newUserObj];
      Database.saveUsuarios(updatedList);
      setUsuarios(updatedList);

      // Async live update to sheets and trigger full sync
      Database.postToWebhook('CREATE_USER', newUserObj);
      Database.syncAllUsersToGoogleSheets().catch(err => console.warn("Background users sync warning", err));

      Database.addAuditoria(
        currentUser.username,
        'CREACIÓN_USUARIOS',
        'USUARIOS_CRM',
        newUserObj.username,
        `Creado nuevo usuario de rol ${newRol}: ${newUserObj.nombre}`,
        'CREACIÓN'
      );

      addToast(`Usuario "${newUserObj.username}" agregado correctamente.`, 'success');
    }
    
    // Clear form
    setNewUsername('');
    setNewNombre('');
    setNewRol('SOLO LECTURA');
    setNewCorreo('');
    setNewClave('');
  };

  const handleDeleteUser = (id: string, username: string) => {
    if (id === 'u1' || username === 'admin') {
      addToast('No está permitido eliminar la cuenta administrador de seguridad predeterminada.', 'error');
      return;
    }
    if (username === currentUser.username) {
      addToast('No puede eliminar su propio usuario activo.', 'error');
      return;
    }

    const confirmDelete = window.confirm(`¿Está seguro de querer eliminar por completo el usuario "${username}"?`);
    if (!confirmDelete) return;

    const filtered = usuarios.filter(u => u.id !== id);
    Database.saveUsuarios(filtered);
    setUsuarios(filtered);

    // Async live update to sheets and trigger full sync
    Database.postToWebhook('DELETE_USER', { id });
    Database.syncAllUsersToGoogleSheets().catch(err => console.warn("Background users sync error", err));

    // Cancel edit if deleting the editing account
    if (editingUser && editingUser.id === id) {
      cancelEditingUser();
    }

    // Audit deletion
    Database.addAuditoria(
      currentUser.username,
      'ELIMINACIÓN_USUARIOS',
      'USUARIOS_CRM',
      username,
      `Eliminado el usuario "${username}" de la base del sistema`,
      'ELIMINACIÓN'
    );

    addToast(`Usuario "${username}" eliminado con éxito.`, 'success');
  };

  // Pull users from Google Sheets
  const handleImportUsersFromSheets = async () => {
    const config = Database.getSheetsConfig();
    if (!config.sheetWebhook || config.sheetWebhook.trim() === '') {
      addToast('Configure la URL del Webhook de Google Apps Script en la solapa Configuración.', 'error');
      return;
    }

    const confirmImport = window.confirm('¿Desea importar el listado de usuarios de Google Sheets? Esto anexará u omitirá según sea el caso reemplazando su listado local actual.');
    if (!confirmImport) return;

    setIsPulling(true);
    try {
      const res = await Database.pullUsersFromGoogleSheets();
      if (res.success) {
        const loaded = Database.getUsuarios();
        setUsuarios(loaded);
        addToast(`Se cargaron con éxito ${res.count} usuarios desde Google Sheets.`, 'success');
      } else {
        addToast(res.error || 'No se pudieron descargar los datos de usuarios.', 'error');
      }
    } catch (err) {
      addToast('Error de red al importar: ' + String(err), 'error');
    } finally {
      setIsPulling(false);
    }
  };

  // Push users to Google Sheets
  const handleExportUsersToSheets = async () => {
    const config = Database.getSheetsConfig();
    if (!config.sheetWebhook || config.sheetWebhook.trim() === '') {
      addToast('Configure la URL del Webhook de Google Apps Script en la solapa Configuración.', 'error');
      return;
    }

    setIsPushing(true);
    try {
      const res = await Database.syncAllUsersToGoogleSheets();
      if (res.success) {
        addToast(res.message, 'success');
      } else {
        addToast('No se pudieron exportar los usuarios.', 'error');
      }
    } catch (err) {
      addToast('Error de red al exportar: ' + String(err), 'error');
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <div className="space-y-6" id="usuarios-permisos-panel">
      
      {/* Title block */}
      <div className="border-b border-slate-100 pb-5">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <Users className="w-6 h-6 text-slate-700" />
          <span>Usuarios, Roles y Sincronización</span>
        </h2>
        <p className="text-slate-500 text-xs mt-0.5">Asigne responsabilidades, regule accesos y sincronice la base de datos de usuarios autorizados directamente con su Google Sheet.</p>
      </div>

      {/* Workspace Menu Tabs */}
      <div className="flex border-b border-slate-200 gap-4" id="usuarios-tabs-row">
        <button
          onClick={() => setActiveTab('CUENTAS')}
          className={`pb-2.5 text-xs uppercase font-mono tracking-wider font-extrabold transition-colors ${activeTab === 'CUENTAS' ? 'border-b-2 border-slate-950 text-slate-900' : 'text-slate-400 hover:text-slate-650'}`}
        >
          Base de Datos Operadores
        </button>
        <button
          onClick={() => setActiveTab('CONEXION_SHEET')}
          className={`pb-2.5 text-xs uppercase font-mono tracking-wider font-extrabold transition-colors ${activeTab === 'CONEXION_SHEET' ? 'border-b-2 border-slate-950 text-slate-900' : 'text-slate-400 hover:text-slate-650'}`}
        >
          Enlace con Google Sheets
        </button>
        <button
          onClick={() => setActiveTab('ROLES')}
          className={`pb-2.5 text-xs uppercase font-mono tracking-wider font-extrabold transition-colors ${activeTab === 'ROLES' ? 'border-b-2 border-slate-950 text-slate-900' : 'text-slate-400 hover:text-slate-650'}`}
        >
          Esquema de Permisos
        </button>
      </div>

      {/* TAB I: ROLES DETAILS */}
      {activeTab === 'ROLES' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="roles-privileges-grid">
          
          {/* ROLE: ADMIN */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 hover:border-rose-200 transition-colors">
            <div className="flex justify-between items-start">
              <div>
                <span className="px-2.5 py-1 text-[9px] font-black tracking-wider rounded border uppercase bg-rose-50 text-rose-800 border-rose-200">
                  ADMINISTRADOR
                </span>
                <h4 className="font-bold text-slate-900 text-sm mt-2">Nivel de Control Total</h4>
              </div>
              <Shield className="w-6 h-6 text-rose-500" />
            </div>
            
            <p className="text-slate-500 text-xs leading-relaxed">
              Titulares de área, Jueces instructores de sumarios del Consumidor, Directores generales de Legal comercial.
            </p>

            <ul className="space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-700">
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" /> Radicación y Carga de Causa</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" /> Edición y traslado de expedientes</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" /> Eliminación de datos directos</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" /> Gestión completa de Usuarios (Sheet)</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" /> Auditoría forense e integral</li>
            </ul>
          </div>

          {/* ROLE: OPERATOR */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 hover:border-amber-200 transition-colors">
            <div className="flex justify-between items-start">
              <div>
                <span className="px-2.5 py-1 text-[9px] font-black tracking-wider rounded border uppercase bg-amber-50 text-amber-800 border-amber-200">
                  OPERADOR
                </span>
                <h4 className="font-bold text-slate-900 text-sm mt-2">Instructores Sumariantes</h4>
              </div>
              <Shield className="w-6 h-6 text-amber-500" />
            </div>

            <p className="text-slate-500 text-xs leading-relaxed">
              Mesa de entradas general, secretarios asignados, coordinadores de audiencias y conciliadores.
            </p>

            <ul className="space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-700">
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" /> Radicación y Carga de Causa</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" /> Edición y traslado de expedientes</li>
              <li className="flex items-center gap-2 text-slate-400 line-through"><XCircle className="w-4 h-4 text-rose-450 shrink-0" /> Eliminación física de expedientes</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" /> Asignación de Turnos y Calendario</li>
              <li className="flex items-center gap-2 text-slate-400 line-through"><XCircle className="w-4 h-4 text-rose-450 shrink-0" /> Control Integral de Configuraciones</li>
            </ul>
          </div>

          {/* ROLE: READ ONLY */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 hover:border-slate-300 transition-colors">
            <div className="flex justify-between items-start">
              <div>
                <span className="px-2.5 py-1 text-[9px] font-black tracking-wider rounded border uppercase bg-slate-100 text-slate-800 border-slate-200">
                  SOLO LECTURA
                </span>
                <h4 className="font-bold text-slate-900 text-sm mt-2">Auditores e Inspectores</h4>
              </div>
              <Shield className="w-6 h-6 text-slate-400" />
            </div>

            <p className="text-slate-500 text-xs leading-relaxed">
              Sindicatos comerciales, letrados patrocinantes de empresas denunciadas, agentes de control fiscal externo.
            </p>

            <ul className="space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-400">
              <li className="flex items-center gap-2 text-slate-400 line-through"><XCircle className="w-4 h-4 text-rose-450 shrink-0" /> Radicación y Carga de Causa</li>
              <li className="flex items-center gap-2 text-slate-400 line-through"><XCircle className="w-4 h-4 text-rose-450 shrink-0" /> Traslados o Edición</li>
              <li className="flex items-center gap-2 text-slate-400 line-through"><XCircle className="w-4 h-4 text-rose-450 shrink-0" /> Eliminación de datos</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500/80 shrink-0" /> Búsqueda y Lectura de Expediente</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500/80 shrink-0" /> Visualización de Estadísticas</li>
            </ul>
          </div>

        </div>
      )}

      {/* TAB II: ACTIVE ACCOUNTS DIRECTORY AND REGISTER FORM */}
      {activeTab === 'CUENTAS' && (
        <div className="space-y-6" id="usuarios-cuentas-seccion">
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* List Table (2/3 columns on large screens) */}
            <div className="lg:col-span-2 space-y-3">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center text-slate-600 font-sans text-xs gap-2">
                <div className="flex flex-col sm:flex-row items-gray-200 sm:items-center gap-2">
                  <span className="font-semibold text-slate-800">Cuentas Locales en Memoria: ({usuarios.length})</span>
                  {usuarios.some(u => ['admin', 'operador', 'lector'].includes(u.username.toLowerCase())) && (
                    <button
                      onClick={handleClearSimulatedUsers}
                      className="bg-rose-100 hover:bg-rose-250 text-rose-800 font-extrabold px-2 py-0.5 rounded-md text-[10px] transition-colors border border-rose-200 cursor-pointer"
                      title="Eliminar usuarios predefinidos de prueba del almacenamiento"
                    >
                      Limpiar Cuentas Simuladas
                    </button>
                  )}
                </div>
                <span className="text-[10px] text-slate-400">Haga clic en "Simular" para probar las restricciones del CRM</span>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse font-sans text-xs text-slate-600">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-mono text-slate-400 uppercase tracking-widest">
                        <th className="py-2.5 px-4">Operador</th>
                        <th className="py-2.5 px-3">Usuario</th>
                        <th className="py-2.5 px-3">Clave</th>
                        <th className="py-2.5 px-3">Rol</th>
                        <th className="py-2.5 px-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {usuarios.map((usr) => {
                        const isActive = currentUser.username === usr.username;
                        return (
                          <tr key={usr.id} className={`hover:bg-slate-50/30 transition-colors ${isActive ? 'bg-indigo-50/70 hover:bg-indigo-50' : ''}`}>
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-800">{usr.nombre}</div>
                              <div className="text-[10px] text-slate-500 font-sans">{usr.correo}</div>
                            </td>
                            <td className="py-3 px-3 font-mono font-bold text-indigo-600">{usr.username}</td>
                            <td className="py-3 px-3 font-mono text-slate-450">
                              <span className="flex items-center gap-1">
                                <Key className="w-3 h-3 text-slate-400" />
                                {usr.clave}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <span className={`px-2 py-0.5 text-[8px] font-bold tracking-wider rounded border uppercase ${getRoleColor(usr.rol)}`}>
                                {usr.rol}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-2 text-xs">
                                {isActive ? (
                                  <span className="inline-flex items-center gap-1 text-[9px] bg-slate-900 text-blue-400 font-mono font-bold uppercase tracking-wider px-2 py-1 rounded-lg">
                                    <UserCheck className="w-3 h-3" />
                                    Mí Perfil
                                  </span>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => handleChangeSimulation(usr)}
                                      className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-2 py-1 rounded-md text-[10px] transition-all border border-slate-200"
                                      title="Simular ingreso al sistema CRM con este usuario"
                                    >
                                      Simular
                                    </button>
                                    
                                    {currentUser.rol === 'ADMINISTRADOR' && (
                                      <>
                                        <button
                                          onClick={() => startEditingUser(usr)}
                                          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-2 py-1 rounded-md text-[10px] transition-all border border-indigo-200 inline-flex items-center gap-1"
                                          title="Editar datos de este operador"
                                        >
                                          <Pencil className="w-2.5 h-2.5" />
                                          Editar
                                        </button>
                                        
                                        <button
                                          onClick={() => handleDeleteUser(usr.id, usr.username)}
                                          className="text-rose-600 hover:bg-rose-50 p-1 rounded transition-colors inline-block"
                                          title="Eliminar usuario definitivamente"
                                        >
                                          <Trash className="w-3.5 h-3.5" />
                                        </button>
                                      </>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Creation Form block (1/3 columns) */}
            <div className={`bg-slate-900 border p-5 rounded-2xl text-slate-200 shadow-lg space-y-4 h-fit transition-all duration-300 ${editingUser ? 'border-amber-500/50 shadow-amber-950/20 shadow-xl' : 'border-slate-850'}`}>
              <div className="border-b border-slate-800 pb-3 flex justify-between items-start">
                <div>
                  <h4 className="font-extrabold text-slate-100 text-sm flex items-center gap-2 uppercase font-mono tracking-wider">
                    {editingUser ? <Pencil className="w-5 h-5 text-amber-450" /> : <UserPlus className="w-5 h-5 text-indigo-400" />}
                    <span>{editingUser ? 'Modificar Operador' : 'Nuevo Operador'}</span>
                  </h4>
                  <p className="text-[10px] text-slate-400 leading-snug mt-0.5">
                    {editingUser ? `Corrigiendo perfil de ${editingUser.nombre}` : 'Agregue un nuevo agente local del CRM autorizado para cursar notificaciones legales.'}
                  </p>
                </div>
                {editingUser && (
                  <button
                    onClick={cancelEditingUser}
                    className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition-colors"
                    title="Cancelar edición"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {currentUser.rol !== 'ADMINISTRADOR' ? (
                <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-400 space-y-2">
                  <p className="font-bold text-slate-300">⚙️ Se requieren permisos de Director</p>
                  <p className="text-[10px] leading-relaxed">Su perfil de simulación actual ({currentUser.rol}) no le autoriza a crear o modificar cuentas en el CRM. Para realizar la prueba, conmute arriba al usuario administrador.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmitUserForm} className="space-y-3.5 text-slate-300">
                  <div>
                    <label className="block text-[10px] uppercase font-mono font-bold text-slate-300 mb-1.5">Usuario de Ingreso (Username)</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: lmartinez"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-550 placeholder-slate-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-mono font-bold text-slate-300 mb-1.5">Nombre y Apellido</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Lic. Laura Martínez"
                      value={newNombre}
                      onChange={(e) => setNewNombre(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-550 placeholder-slate-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-mono font-bold text-slate-300 mb-1.5">Contraseña</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: 1234"
                      value={newClave}
                      onChange={(e) => setNewClave(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-indigo-550 placeholder-slate-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-mono font-bold text-slate-300 mb-1.5">Rol Legal Operativo</label>
                    <select
                      value={newRol}
                      onChange={(e) => setNewRol(e.target.value as RolUsuario)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-550"
                    >
                      <option value="SOLO LECTURA">SOLO LECTURA</option>
                      <option value="OPERADOR">OPERADOR (Instructor Sumariante)</option>
                      <option value="ADMINISTRADOR">ADMINISTRADOR (Director General)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-mono font-bold text-slate-300 mb-1.5 flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-slate-450" />
                      <span>Correo Electrónico (Opcional)</span>
                    </label>
                    <input
                      type="email"
                      placeholder="Ej: laura.martinez@defensa.gob.ar"
                      value={newCorreo}
                      onChange={(e) => setNewCorreo(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-550 placeholder-slate-600"
                    />
                  </div>

                  <div className="flex gap-2">
                    {editingUser && (
                      <button
                        type="button"
                        onClick={cancelEditingUser}
                        className="w-1/3 mt-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2 px-3 rounded-xl text-xs transition duration-150"
                      >
                        Cancelar
                      </button>
                    )}
                    <button
                      type="submit"
                      className={`mt-2 font-extrabold py-2 px-3 rounded-xl text-xs transition-colors duration-150 ${editingUser ? 'w-2/3 bg-amber-500 hover:bg-amber-600 text-slate-950' : 'w-full bg-indigo-600 hover:bg-indigo-700 text-white'}`}
                    >
                      {editingUser ? 'Actualizar' : 'Guardar Operador'}
                    </button>
                  </div>
                </form>
              )}
            </div>

          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3 text-xs text-amber-900" id="sandbox-roles-alerter">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold">Soporte de Autenticación de Operadores</h4>
              <p className="leading-relaxed mt-1 text-amber-800 font-sans">
                La base de datos de usuarios almacena las credenciales de todo el personal que puede firmar actas e interactuar con el CRM. Estos datos pueden fluir bidireccionalmente con Google Sheets mediante la pestaña **"Enlace con Google Sheets"**, permitiendo rellenar el personal autorizado directamente controlando el cuaderno administrativo de Defensa del Consumidor de manera remota.
              </p>
            </div>
          </div>

        </div>
      )}

      {/* TAB III: GOOGLE SPREADSHEETS USER INTEGRATION CONTROLS */}
      {activeTab === 'CONEXION_SHEET' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6" id="google-sheets-users-sync-pane">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              <span>Sincronización remota del Personal Sumariante</span>
            </h3>
            <p className="text-slate-550 text-xs mt-0.5 font-sans">
              Administre la plantilla de trabajadores habilitados del CRM conectando automáticamente la pestaña <code className="font-bold text-slate-700">"Usuarios"</code> de Google Sheets.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Action Card 1: PULL (Download) */}
            <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="font-extrabold text-slate-800 text-sm">Descargar Personal de Google Sheet</h4>
                <RefreshCw className={`w-5 h-5 text-emerald-600 ${isPulling ? 'animate-spin' : ''}`} />
              </div>
              
              <p className="text-slate-500 text-xs leading-relaxed font-sans">
                Reemplaza, descarga y actualiza los usuarios del CRM local trayendo las filas cargadas en la hoja <code className="font-bold text-slate-700">"Usuarios"</code> de su Google Spreadsheet. Esto es perfecto para dar de alta usuarios de forma masiva desde la PC o planilla principal.
              </p>

              <button
                disabled={isPulling || isPushing}
                onClick={handleImportUsersFromSheets}
                className="w-full mt-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded-xl transition duration-150 text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isPulling ? 'animate-spin' : ''}`} />
                {isPulling ? 'Actualizando personal...' : 'Importar Usuarios desde Sheet'}
              </button>
            </div>

            {/* Action Card 2: PUSH (Upload) */}
            <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="font-extrabold text-slate-800 text-sm">Exportar / Resguardar Usuarios en Sheet</h4>
                <FileSpreadsheet className="w-5 h-5 text-blue-600" />
              </div>

              <p className="text-slate-500 text-xs leading-relaxed font-sans">
                Sobreescribe la pestaña <code className="font-bold text-slate-700">"Usuarios"</code> de su Google Sheet enviando los agentes locales cargados en este CRM. Esto generará la pestaña en la planilla si aún no existe, resguardando de forma remota sus cuentas.
              </p>

              <button
                disabled={isPulling || isPushing}
                onClick={handleExportUsersToSheets}
                className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-3 rounded-xl transition duration-150 text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                {isPushing ? 'Exportando personal...' : 'Exportar Usuarios a Google Sheet'}
              </button>
            </div>

          </div>

          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-xs text-indigo-900 leading-relaxed font-sans">
            <h5 className="font-bold text-indigo-950 mb-1">💡 ¿Cómo funciona esta integración?</h5>
            <ol className="list-decimal pl-5 space-y-1">
              <li>El Apps Script actual leerá o creará la hoja llamada <strong className="font-mono text-[11px] bg-indigo-100 text-indigo-800 px-1 py-0.5 rounded">Usuarios</strong>.</li>
              <li>Asegúrese de rellenar las columnas principales: <strong>ID</strong>, <strong>USUARIO</strong>, <strong>NOMBRE</strong>, <strong>ROL</strong> (ADMINISTRADOR, OPERADOR, SOLO LECTURA), <strong>CORREO</strong>, y <strong>CLAVE</strong>.</li>
              <li>Al importar, cualquier personal listado allí podrá iniciar sesión en el formulario principal del CRM de Defensa del Consumidor instantáneamente.</li>
            </ol>
          </div>

        </div>
      )}

    </div>
  );
}
