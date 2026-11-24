import { AuthProvider, useAuth } from './context/AuthContext';
import { TelemetryProvider } from './context/TelemetryContext';
import { WindowManagerProvider } from './context/WindowManagerContext';
import { LoginScreen } from './components/LoginScreen';
import { SetupWizard } from './components/SetupWizard';
import { Desktop } from './components/Desktop';

function RootShell() {
  const { user, publicInfo, loading } = useAuth();

  if (loading) {
    return (
      <div className="w-full h-full wallpaper-qts-wave flex items-center justify-center">
        <div className="bg-white text-slate-800 px-5 py-3.5 rounded shadow-xl border border-slate-200 text-xs font-medium flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
          <span>Starting OpenQTS 5.2...</span>
        </div>
      </div>
    );
  }

  if (publicInfo && publicInfo.setupCompleted === false) {
    return <SetupWizard />;
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <WindowManagerProvider>
      <Desktop />
    </WindowManagerProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <TelemetryProvider>
        <RootShell />
      </TelemetryProvider>
    </AuthProvider>
  );
}
