import React, { useState, useEffect } from 'react';
import { Database, formatDateTime } from './db';
import { Usuario } from './types';
import { PublicArea } from './components/PublicArea';
import { DashboardView } from './components/DashboardView';
import { ExpedientesCRUD } from './components/ExpedientesCRUD';
import { AudienciasView } from './components/AudienciasView';
import { AuditoriaView } from './components/AuditoriaView';
import { UsuariosView } from './components/UsuariosView';
import { SheetSettings } from './components/SheetSettings';
import { 
  Sun, Moon, Shield, Sparkles, LayoutDashboard, FileSpreadsheet, Calendar, 
  ShieldCheck, Users, Settings, LogOut, Menu, X, ArrowLeft, Key, Lock, AlertCircle, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Toast {
  id: string;
  msg: string;
  type: 'success' | 'error' | 'warning';
}

export default function App() {
  const [activeArea, setActiveArea] = useState<'PUBLIC' | 'ADMIN'>('PUBLIC');
  const [adminActiveTab, setAdminActiveTab] = useState<'DASHBOARD' | 'EXPEDIENTES' | 'AUDIENCIAS' | 'AUDITORIA' | 'USUARIOS' | 'SHEETS'>('DASHBOARD');
  const [session, setSession] = useState<Usuario | null>(() => Database.getCurrentSession());
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('defcons_crm_dark_mode') === 'true';
  });

  // Sidebar collapsed on desktop status
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Hamburger drawer open on mobile status
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Auth form modal variables
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [hasSimulatedAccounts, setHasSimulatedAccounts] = useState(() => 
    Database.getUsuarios().some(u => ['admin', 'operador', 'lector'].includes(u.username.toLowerCase()))
  );

  // Toast stack state
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Auto-sync every 1 minute configuration state
  const [autoSync1m, setAutoSync1m] = useState<boolean>(() => {
    return localStorage.getItem('defcons_crm_auto_sync_1m') === 'true';
  });
  const [syncTrigger, setSyncTrigger] = useState<number>(0);
  const [isSyncingBg, setIsSyncingBg] = useState<boolean>(false);
  const [isBootSyncing, setIsBootSyncing] = useState<boolean>(true);

  useEffect(() => {
    localStorage.setItem('defcons_crm_auto_sync_1m', String(autoSync1m));
  }, [autoSync1m]);

  // Handle background auto-sync 1m interval
  useEffect(() => {
    if (!autoSync1m) return;

    const runAutoSync = async () => {
      setIsSyncingBg(true);
      try {
        const res = await Database.pullFromGoogleSheets();
        if (res.success) {
          setSyncTrigger(prev => prev + 1);
          addToast(`[Sincronización de Fondo] Base de CRM actualizada desde Google Sheets (${res.count} expedientes).`, 'success');
        } else if (res.error && !res.error.includes('no está configurada')) {
          addToast(`[Sincronización de Fondo] Error de red: ${res.error}`, 'warning');
        }

        // Silent background sync of users as well so operators stay continually updated
        const resUsers = await Database.pullUsersFromGoogleSheets();
        if (resUsers.success && resUsers.count > 0) {
          setSyncTrigger(prev => prev + 1);
        }
      } catch (err) {
        console.warn("Auto-sync 1m interval warning:", err);
      } finally {
        setIsSyncingBg(false);
      }
    };

    // Run first sync immediately upon enabling to show quick feedback
    runAutoSync();

    // Set 1-minute interval (60,000 milliseconds)
    const intervalId = setInterval(runAutoSync, 60000);
    return () => clearInterval(intervalId);
  }, [autoSync1m]);

  // Reflect dark mode to root document/container
  useEffect(() => {
    localStorage.setItem('defcons_crm_dark_mode', String(isDarkMode));
  }, [isDarkMode]);

  // Automatic startup pull from Google Sheets to ensure the freshest official data is available
  useEffect(() => {
    const runStartupSync = async () => {
      setIsBootSyncing(true);
      console.log("[Boot] Iniciando descarga transparente de expedientes desde Google Sheets...");
      try {
        const res = await Database.pullFromGoogleSheets();
        if (res.success && res.count > 0) {
          setSyncTrigger(prev => prev + 1);
          console.log(`[Boot] Sincronización automática de expedientes exitosa: ${res.count} cargados.`);
        }
      } catch (err) {
        console.warn("[Boot] Error en sincronización silenciosa inicial de expedientes", err);
      }

      console.log("[Boot] Descargando de forma transparente los usuarios oficiales de la planilla...");
      try {
        const resUsers = await Database.pullUsersFromGoogleSheets();
        if (resUsers.success && resUsers.count > 0) {
          console.log(`[Boot] Sincronización de usuarios exitosa: ${resUsers.count} cargados.`);
          setHasSimulatedAccounts(true);
          setSyncTrigger(prev => prev + 1);
        }
      } catch (err) {
        console.warn("[Boot] No se completó la descarga silenciosa inicial de usuarios", err);
      } finally {
        setIsBootSyncing(false);
      }
    };

    runStartupSync();
  }, []);

  // Toast adder utility
  const addToast = (msg: string, type: 'success' | 'error' | 'warning' = 'success') => {
    const id = Date.now() + '-' + Math.floor(Math.random() * 100);
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Switch session operator on simulation requests
  const handleSimulationChangeOfUser = (targetUser: Usuario) => {
    Database.addAuditoria(session?.username || 'SISTEMA', 'ACCESO_SISTEMA', 'SIMULATION_SWITCH', session?.rol || 'Ninguno', `Cambio de perfil simulado a ${targetUser.nombre}`, 'ACCESO');
    setSession(targetUser);
    localStorage.setItem('defcons_crm_session', JSON.stringify(targetUser));
  };

  // Administrative login trigger
  const handleAdminLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const res = Database.login(usernameInput, passwordInput);
    if (res.success && res.user) {
      setSession(res.user);
      setShowLoginModal(false);
      setUsernameInput('');
      setPasswordInput('');
      setActiveArea('ADMIN');
      addToast(`¡Bienvenido de vuelta, ${res.user.nombre}! Sesión administrativa iniciada.`, 'success');
    } else {
      setLoginError(res.error || 'Credenciales no válidas.');
    }
  };

  // Administrative logout trigger
  const handleLogoutAdmin = () => {
    const yes = window.confirm(`¿Está seguro de querer cerrar sesión administrativa en el CRM de Defensa del Consumidor?`);
    if (!yes) return;

    Database.logout();
    setSession(null);
    setActiveArea('PUBLIC');
    setMobileMenuOpen(false);
    addToast('Sesión administrativa cerrada correctamente. Registros auditados.', 'success');
  };

  const currentRolName = session ? session.rol : 'PUBLIC';

  return (
    <div className={`${isDarkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'} min-h-screen font-sans antialiased transition-colors duration-300`} id="applet-main-container">

      {/* Main Multi-screen toggle */}
      <AnimatePresence mode="wait">
        {activeArea === 'PUBLIC' ? (
          <motion.div
            key="public-area-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full"
          >
            <PublicArea 
              isBootSyncing={isBootSyncing}
              onEnterAdmin={() => {
                Database.logout();
                setSession(null);
                setHasSimulatedAccounts(
                  Database.getUsuarios().some(u => ['admin', 'operador', 'lector'].includes(u.username.toLowerCase()))
                );
                setShowLoginModal(true);
              }}
            />
          </motion.div>
        ) : (
          // PRIVATE CRM WORKSPACE
          <motion.div
            key="admin-area-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex min-h-screen"
            id="admin-workspace-grid"
          >
            {/* ADMIN SIDEBAR: COL 1 (DESKTOP) */}
            <aside 
              className={`${
                sidebarCollapsed ? 'w-20' : 'w-64'
              } bg-slate-900 text-slate-100 flex-col justify-between border-r border-slate-800 transition-all duration-300 hidden md:flex`}
              id="desktop-admin-sidebar"
            >
              {/* Sidebar Header */}
              <div className="p-4 flex flex-col gap-6">
                <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  {!sidebarCollapsed ? (
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-600 text-white font-black p-2 rounded-xl text-xs uppercase tracking-widest shadow-sm">
                        CRM
                      </div>
                      <div>
                        <h2 className="font-extrabold text-sm tracking-tight leading-tight">Consumidor CRM</h2>
                        <span className="text-[10px] text-blue-400 font-mono tracking-wider font-bold">ACCESO PRIVADO</span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-blue-600 text-white font-extrabold p-2 rounded-xl text-xs uppercase tracking-widest mx-auto">
                      C
                    </div>
                  )}
                  
                  {/* Collapser Toggle */}
                  <button 
                    onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                    className="hidden sm:inline-block text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800/40 hover:bg-slate-800"
                    title={sidebarCollapsed ? "Expandir" : "Contraer"}
                  >
                    {sidebarCollapsed ? "→" : "←"}
                  </button>
                </div>

                {/* Session Active Operator Card */}
                {!sidebarCollapsed && session && (
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                    <div className="font-sans font-bold text-xs truncate" title={session.nombre}>{session.nombre}</div>
                    <span className="text-[9px] bg-slate-800 text-blue-400 font-black tracking-wider uppercase px-2 py-0.5 rounded-md mt-1.5 inline-block border border-slate-700">
                      {session.rol}
                    </span>
                  </div>
                )}

                {/* Sidebar Navigation Links Grid */}
                <nav className="flex flex-col gap-1.5" id="sidebar-nav">
                  
                  {/* TAB 1: DASHBOARD */}
                  <button
                    onClick={() => setAdminActiveTab('DASHBOARD')}
                    className={`flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                      adminActiveTab === 'DASHBOARD' 
                        ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/10' 
                        : 'text-slate-400 hover:text-white hover:bg-slate-850'
                    }`}
                    title="Dashboard"
                  >
                    <LayoutDashboard className="w-5 h-5 shrink-0" />
                    {!sidebarCollapsed && <span>Estadísticas / KPI</span>}
                  </button>

                  {/* TAB 2: GESTION EXPEDIENTES */}
                  <button
                    onClick={() => setAdminActiveTab('EXPEDIENTES')}
                    className={`flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                      adminActiveTab === 'EXPEDIENTES' 
                        ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/10' 
                        : 'text-slate-400 hover:text-white hover:bg-slate-850'
                    }`}
                    title="Expedientes"
                  >
                    <FileSpreadsheet className="w-5 h-5 shrink-0" />
                    {!sidebarCollapsed && <span>Gestión Expedientes</span>}
                  </button>

                  {/* TAB 3: CONTROL AUDIENCIAS */}
                  <button
                    onClick={() => setAdminActiveTab('AUDIENCIAS')}
                    className={`flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                      adminActiveTab === 'AUDIENCIAS' 
                        ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/10' 
                        : 'text-slate-400 hover:text-white hover:bg-slate-850'
                    }`}
                    title="Audiencias"
                  >
                    <Calendar className="w-5 h-5 shrink-0" />
                    {!sidebarCollapsed && <span>Control Audiencias</span>}
                  </button>

                  {/* TAB 4: HISTORIAL Y MOVIMIENTOS - AUDITORIA */}
                  <button
                    onClick={() => setAdminActiveTab('AUDITORIA')}
                    className={`flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                      adminActiveTab === 'AUDITORIA' 
                        ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/10' 
                        : 'text-slate-400 hover:text-white hover:bg-slate-850'
                    }`}
                    title="Auditoría"
                  >
                    <ShieldCheck className="w-5 h-5 shrink-0" />
                    {!sidebarCollapsed && <span>Historial Sumarial</span>}
                  </button>

                  {/* TAB 5: USUARIOS Y PERMISOS SIMULADOR */}
                  <button
                    onClick={() => setAdminActiveTab('USUARIOS')}
                    className={`flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                      adminActiveTab === 'USUARIOS' 
                        ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/10' 
                        : 'text-slate-400 hover:text-white hover:bg-slate-850'
                    }`}
                    title="Permisos"
                  >
                    <Users className="w-5 h-5 shrink-0" />
                    {!sidebarCollapsed && <span>Usuarios / Privilegios</span>}
                  </button>

                  {/* TAB 6: GOOGLE SHEETS SETUP */}
                  <button
                    onClick={() => setAdminActiveTab('SHEETS')}
                    className={`flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                      adminActiveTab === 'SHEETS' 
                        ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/10' 
                        : 'text-slate-400 hover:text-white hover:bg-slate-850'
                    }`}
                    title="Sheets"
                  >
                    <Settings className="w-5 h-5 shrink-0" />
                    {!sidebarCollapsed && <span>Conexión Sheet</span>}
                  </button>

                </nav>
              </div>

              {/* Sidebar Footer */}
              <div className="p-4 flex flex-col gap-3 border-t border-slate-800">
                
                {/* Back to Public Search direct link */}
                <button
                  onClick={() => setActiveArea('PUBLIC')}
                  className="flex items-center justify-center gap-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 p-2.5 rounded-xl text-[10px] font-mono hover:text-white transition-colors"
                  title="Buscador Público"
                >
                  <ArrowLeft className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && <span>Buscador Público</span>}
                </button>

                {/* Logout trigger button */}
                <button
                  onClick={handleLogoutAdmin}
                  className="w-full flex items-center justify-center gap-2 bg-rose-950/30 text-rose-400 hover:bg-rose-900 hover:text-white py-2.5 px-3 rounded-xl text-xs font-bold transition-all"
                  title="Cerrar sesion"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && <span>Cerrar Sesión</span>}
                </button>
              </div>

            </aside>

            {/* MAIN SYSTEM CONTAINER: COL 2 */}
            <div className="flex-grow flex flex-col min-w-0" id="admin-workspace-rightpane">
              
              {/* Private Area Header bar */}
              <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10" id="admin-main-header">
                
                {/* Burger and collapsible info */}
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setMobileMenuOpen(true)}
                    className="md:hidden text-slate-800 focus:outline-none p-1 bg-slate-100 hover:bg-slate-200 rounded-lg"
                  >
                    <Menu className="w-5 h-5" />
                  </button>
                  
                  <div>
                    <span className="text-[9px] uppercase font-mono tracking-widest text-slate-400 font-bold block leading-none">Mesa de Solución Integral</span>
                    <h1 className="font-sans font-black text-slate-900 tracking-tight text-lg mt-1 md:inline-block">CRM Defensa del Consumidor</h1>
                  </div>
                </div>

                {/* Right controls: Theme, Switch back indicator, etc */}
                <div className="flex items-center gap-2 sm:gap-4">
                  {/* Auto-Sincronización 1m toggle button */}
                  <button
                    onClick={() => {
                      const afterVal = !autoSync1m;
                      setAutoSync1m(afterVal);
                      addToast(
                        afterVal 
                          ? 'Auto-sincronización de 1 minuto ACTIVA. Se comprobará la planilla de Google Sheets continuamente en segundo plano.' 
                          : 'Auto-sincronización DESACTIVADA.', 
                        afterVal ? 'success' : 'warning'
                      );
                    }}
                    className={`flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      autoSync1m 
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-250 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' 
                        : 'bg-slate-100 text-slate-650 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                    }`}
                    title="Alternar sincronización automática con Google Sheets cada 1 minuto"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${autoSync1m ? 'animate-spin' : ''} ${isSyncingBg ? 'text-amber-500 font-bold' : ''}`} />
                    <span className="hidden leading-none select-none sm:inline">Auto-Sincronizar (1m)</span>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${autoSync1m ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`}></span>
                  </button>

                  {/* Theme toggler */}
                  <button
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className="p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200"
                    title={isDarkMode ? "Cambiar a Modo Claro" : "Cambiar a Modo Oscuro"}
                  >
                    {isDarkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-slate-600" />}
                  </button>

                  {/* Public Back link on Desktop */}
                  <button
                    onClick={() => setActiveArea('PUBLIC')}
                    className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 px-3.5 py-2.5 rounded-xl transition-all"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Volver al Buscador</span>
                  </button>
                </div>

              </header>

              {/* Dynamic private views compiler WITHOUT unmounting (key removed, prop syncTrigger passed downwards) */}
              <main className="flex-grow p-6 overflow-y-auto max-w-7xl mx-auto w-full" id="admin-main-viewports">
                {adminActiveTab === 'DASHBOARD' && (
                  <DashboardView />
                )}
                {adminActiveTab === 'EXPEDIENTES' && (
                  <ExpedientesCRUD 
                    currentUserRol={currentRolName as any} 
                    currentUsername={session?.username || 'SISTEMA'} 
                    addToast={addToast}
                    syncTrigger={syncTrigger}
                  />
                )}
                {adminActiveTab === 'AUDIENCIAS' && (
                  <AudienciasView 
                    currentUserRol={currentRolName as any} 
                    currentUsername={session?.username || 'SISTEMA'} 
                    addToast={addToast}
                    syncTrigger={syncTrigger}
                  />
                )}
                {adminActiveTab === 'AUDITORIA' && (
                  <AuditoríaViewWrapper />
                )}
                {adminActiveTab === 'USUARIOS' && (
                  <UsuariosView 
                    currentUser={session!} 
                    onChangeUserSimulation={handleSimulationChangeOfUser} 
                    addToast={addToast}
                    syncTrigger={syncTrigger}
                  />
                )}
                {adminActiveTab === 'SHEETS' && (
                  <SheetSettings 
                    currentUserRol={currentRolName} 
                    addToast={addToast} 
                    syncTrigger={syncTrigger}
                  />
                )}
              </main>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MOBILE HAMBURGER COLLAPSIBLE OVERLAY DRAWER */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex z-50 md:hidden" id="mobile-menu-overlay">
            
            <motion.div
              initial={{ x: -250, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -250, opacity: 0 }}
              className="bg-slate-900 w-64 p-5 flex flex-col justify-between h-full text-slate-100"
            >
              
              <div className="space-y-6">
                {/* Header info */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-600 font-black px-2 py-1 text-white rounded text-xs select-none">DC</span>
                    <span className="font-bold text-xs tracking-tight">Defensa Consumidor</span>
                  </div>
                  <button onClick={() => setMobileMenuOpen(false)} className="text-slate-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Session profile */}
                {session && (
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <div className="font-sans font-bold text-xs truncate">{session.nombre}</div>
                    <span className="text-[9px] bg-slate-800 text-blue-400 font-extrabold tracking-wider uppercase px-2 py-0.5 rounded mt-1 inline-block border border-slate-700">
                      {session.rol}
                    </span>
                  </div>
                )}

                {/* Main links list */}
                <nav className="flex flex-col gap-1.5 text-xs text-slate-400 font-semibold uppercase font-mono tracking-wider">
                  <button
                    onClick={() => { setAdminActiveTab('DASHBOARD'); setMobileMenuOpen(false); }}
                    className={`text-left p-3 rounded-lg ${adminActiveTab === 'DASHBOARD' ? 'bg-blue-600 text-white font-bold' : ''}`}
                  >
                    Estadísticas
                  </button>
                  <button
                    onClick={() => { setAdminActiveTab('EXPEDIENTES'); setMobileMenuOpen(false); }}
                    className={`text-left p-3 rounded-lg ${adminActiveTab === 'EXPEDIENTES' ? 'bg-blue-600 text-white font-bold' : ''}`}
                  >
                    Expedientes
                  </button>
                  <button
                    onClick={() => { setAdminActiveTab('AUDIENCIAS'); setMobileMenuOpen(false); }}
                    className={`text-left p-3 rounded-lg ${adminActiveTab === 'AUDIENCIAS' ? 'bg-blue-600 text-white font-bold' : ''}`}
                  >
                    Audiencias
                  </button>
                  <button
                    onClick={() => { setAdminActiveTab('AUDITORIA'); setMobileMenuOpen(false); }}
                    className={`text-left p-3 rounded-lg ${adminActiveTab === 'AUDITORIA' ? 'bg-blue-600 text-white font-bold' : ''}`}
                  >
                    Historial
                  </button>
                  <button
                    onClick={() => { setAdminActiveTab('USUARIOS'); setMobileMenuOpen(false); }}
                    className={`text-left p-3 rounded-lg ${adminActiveTab === 'USUARIOS' ? 'bg-blue-600 text-white font-bold' : ''}`}
                  >
                    Permisos
                  </button>
                  <button
                    onClick={() => { setAdminActiveTab('SHEETS'); setMobileMenuOpen(false); }}
                    className={`text-left p-3 rounded-lg ${adminActiveTab === 'SHEETS' ? 'bg-blue-600 text-white font-bold' : ''}`}
                  >
                    Google Sheet
                  </button>
                </nav>
              </div>

              {/* Drawer footer link */}
              <div className="space-y-2 pt-4 border-t border-slate-800">
                <button
                  onClick={() => { setActiveArea('PUBLIC'); setMobileMenuOpen(false); }}
                  className="w-full flex items-center justify-center gap-2 bg-slate-950 p-2.5 rounded-xl text-xs font-bold text-slate-300"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Cerrar Panel</span>
                </button>
                <button
                  onClick={handleLogoutAdmin}
                  className="w-full bg-rose-950 text-rose-300 hover:bg-rose-900 hover:text-white py-2.5 rounded-xl text-xs font-bold text-center block"
                >
                  Cerrar Sesión
                </button>
              </div>

            </motion.div>
            
          </div>
        )}
      </AnimatePresence>

      {/* ADMIN AUTHENTICATION DIALOG (SIGN IN LOCK) */}
      <AnimatePresence>
        {showLoginModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-200 max-w-sm w-full shadow-2xl p-6 text-sm text-slate-800 font-sans"
              id="private-login-card"
            >
              
              {/* Card headers */}
              <div className="text-center space-y-2 mb-6">
                <div className="bg-amber-50 text-amber-800 p-3 rounded-full w-fit mx-auto border border-amber-200">
                  <Lock className="w-6 h-6 text-amber-500" />
                </div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">Acceso Administrativo Privado</h3>
                <p className="text-slate-500 text-xs">Ingrese las credenciales del operador para la gestión de audiencias e imputaciones formales.</p>
              </div>

              {/* Login instructions */}
              {hasSimulatedAccounts && (
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 mb-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-slate-700 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      Cuentas habilitadas (Pruebas):
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const defaultUsernames = ['admin', 'operador', 'lector'];
                        const current = Database.getUsuarios();
                        const filtered = current.filter(u => !defaultUsernames.includes(u.username.toLowerCase()));
                        Database.saveUsuarios(filtered);
                        setHasSimulatedAccounts(false);
                        addToast('Se han eliminado las cuentas simuladas por defecto. Ahora solo puede iniciar sesión con usuarios oficiales.', 'success');
                      }}
                      className="text-[9px] font-extrabold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer"
                      title="Quitar las cuentas simuladas por defecto de la memoria local"
                    >
                      Limpiar simulados
                    </button>
                  </div>
                  <div className="font-mono text-[10px] text-slate-600 space-y-0.5 leading-relaxed border-t border-slate-200/60 pt-1.5">
                    <div>• Admin: <span className="font-bold">admin</span> / clave: <span className="font-bold">1234</span></div>
                    <div>• Operador: <span className="font-bold">operador</span> / clave: <span className="font-bold">1234</span></div>
                    <div>• Lector: <span className="font-bold">lector</span> / clave: <span className="font-bold">1234</span></div>
                  </div>
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleAdminLoginSubmit} className="space-y-4">
                
                <div>
                  <label className="block text-slate-600 font-bold mb-1 text-xs">Usuario Operador</label>
                  <input
                    type="text"
                    required
                    placeholder="ej: admin"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:bg-white text-slate-900 outline-none text-xs transition-colors"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1 text-xs">Contraseña Secreta</label>
                  <input
                    type="password"
                    required
                    placeholder="••••"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:bg-white text-slate-900 outline-none text-xs transition-colors font-mono"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                  />
                </div>

                {/* Login error box */}
                {loginError && (
                  <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-100 font-semibold">
                    {loginError}
                  </div>
                )}

                {/* Confirm actions */}
                <div className="grid grid-cols-2 gap-2 text-xs pt-2">
                  <button
                    type="button"
                    onClick={() => setShowLoginModal(false)}
                    className="bg-slate-100 hover:bg-slate-200 font-bold py-2.5 rounded-xl border border-slate-250 text-slate-700 transition"
                  >
                    Volver Atrás
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 font-bold py-2.5 rounded-xl text-white transition active:scale-[0.98]"
                  >
                    Ingresar
                  </button>
                </div>

              </form>

              {/* Direct access to sync sheet users from the login footer */}
              <div className="mt-4 pt-4 border-t border-slate-150 flex flex-col gap-1 text-center">
                <button
                  type="button"
                  onClick={async () => {
                    setLoginError('');
                    addToast('Sincronizando operadores oficiales desde Google Sheets...', 'warning');
                    try {
                      const res = await Database.pullUsersFromGoogleSheets();
                      if (res.success) {
                        const dbUsers = Database.getUsuarios();
                        const usernamesList = dbUsers.map(u => u.username).join(', ');
                        addToast(`¡Sincronización exitosa! Se cargaron ${res.count} cuentas oficiales habilitadas (${usernamesList}).`, 'success');
                        setHasSimulatedAccounts(true);
                      } else {
                        setLoginError(res.error || 'No se han podido descargar los operadores habilitados de la planilla.');
                      }
                    } catch (err: any) {
                      setLoginError('Error de conexión o proxy: ' + String(err));
                    }
                  }}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer flex items-center justify-center gap-1.5 py-1"
                >
                  <span>🔄 ¿No puede ingresar? Sincronizar usuarios desde Sheet</span>
                </button>
                <p className="text-[10px] text-slate-500">
                  Descarga inmediata de todas las credenciales de administración listadas en la planilla oficial.
                </p>
              </div>

            </motion.div>
            
          </div>
        )}
      </AnimatePresence>

      {/* TOAST SYSTEM ALERTS STACK */}
      <div className="fixed bottom-5 right-5 space-y-2 z-50 pointer-events-none max-w-sm w-full" id="toaster-alerts-stack">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ transform: "translateY(20px)", opacity: 0 }}
              animate={{ transform: "translateY(0px)", opacity: 1 }}
              exit={{ transform: "translateY(10px)", opacity: 0 }}
              className={`p-4 rounded-xl border shadow-lg flex items-start gap-2.5 justify-between pointer-events-auto bg-white font-sans ${
                t.type === 'error' ? 'border-rose-250 border-rose-200/80 text-rose-900' :
                t.type === 'warning' ? 'border-amber-250 border-amber-250 text-amber-900' :
                'border-emerald-250 border-emerald-200 text-emerald-950'
              }`}
            >
              <div className="text-xs font-semibold leading-relaxed">
                {t.type === 'error' && <span className="font-extrabold mr-1 text-rose-600">[!] Error:</span>}
                {t.type === 'warning' && <span className="font-extrabold mr-1 text-amber-600">[!] Alerta:</span>}
                {t.type === 'success' && <span className="font-extrabold mr-1 text-emerald-600">[✓]</span>}
                {t.msg}
              </div>
              <button 
                onClick={() => removeToast(t.id)} 
                className="text-slate-400 hover:text-slate-600 focus:outline-none text-[10px]"
              >
                ✕
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

    </div>
  );
}

// Wrapper to prevent file search dependencies imports issues
function AuditoríaViewWrapper() {
  return <AuditoriaView />;
}
