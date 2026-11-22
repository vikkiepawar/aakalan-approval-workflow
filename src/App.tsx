import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PrototypeDisclaimer } from './components/common/PrototypeDisclaimer';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { ApplicationDetailModal } from './components/common/ApplicationDetailModal';
import { InstitutionDashboard } from './components/institution/InstitutionDashboard';
import { ScrutinyDashboard } from './components/scrutiny/ScrutinyDashboard';
import { RegionalDashboard } from './components/regional/RegionalDashboard';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { ApplicationReviewModal } from './components/scrutiny/ApplicationReviewModal';
import { CorrectionModal } from './components/institution/CorrectionModal';
import { ScheduleEvcModal } from './components/regional/ScheduleEvcModal';
import { DecisionModal } from './components/admin/DecisionModal';
import { SacHearingModal } from './components/regional/SacHearingModal';
import { AssignOfficerModal } from './components/admin/AssignOfficerModal';
import { VoiceAssistantModal } from './components/voice/VoiceAssistantModal';
import { LoginView } from './components/auth/LoginView';
import { Application } from './types';
import { Sparkles } from 'lucide-react';

const MainApp: React.FC = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);

  // Sub-action modals triggered from detail view or buttons
  const [scrutinyApp, setScrutinyApp] = useState<Application | null>(null);
  const [correctionApp, setCorrectionApp] = useState<Application | null>(null);
  const [scheduleApp, setScheduleApp] = useState<Application | null>(null);
  const [decisionApp, setDecisionApp] = useState<Application | null>(null);
  const [sacApp, setSacApp] = useState<Application | null>(null);
  const [assignApp, setAssignApp] = useState<Application | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showVoiceAssistant, setShowVoiceAssistant] = useState(false);

  // When role changes, reset tab to 'overview'
  React.useEffect(() => {
    setActiveTab('overview');
  }, [user?.role]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-base font-bold">aakalan Verification Engine</h2>
        <p className="text-xs text-slate-400 mt-1 font-mono">Initializing relational SQLite database & workflow state...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900">
      {/* 1. Official Prototype Notice Banner */}
      <PrototypeDisclaimer />

      {/* 2. Top Navigation Bar (Strict 3-zone contract) */}
      <Header
        onSelectApplication={id => setSelectedApplicationId(id)}
        onOpenLoginModal={() => setShowLoginModal(true)}
        onOpenVoiceAssistant={() => setShowVoiceAssistant(true)}
      />

      {/* 3. Main Body Split: 250px Sidebar + Viewport Content */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar activeTab={activeTab} onTabChange={tab => setActiveTab(tab)} />

        <main className="flex-1 overflow-y-auto bg-slate-100/90 min-h-[calc(100vh-85px)]">
          {!user ? (
            <div className="p-12 text-center max-w-lg mx-auto mt-16 bg-white rounded-xl border border-slate-200 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">Session Required</h2>
              <p className="text-xs text-slate-500 mt-1">Please sign in or select a demo persona to continue.</p>
              <button
                onClick={() => setShowLoginModal(true)}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold"
              >
                Open Sign In Window
              </button>
            </div>
          ) : user.role === 'INSTITUTION' ? (
            <InstitutionDashboard
              activeTab={activeTab}
              onSelectApplication={id => setSelectedApplicationId(id)}
            />
          ) : user.role === 'SCRUTINY_OFFICER' ? (
            <ScrutinyDashboard
              activeTab={activeTab}
              onSelectApplication={id => setSelectedApplicationId(id)}
            />
          ) : user.role === 'REGIONAL_OFFICER' ? (
            <RegionalDashboard
              activeTab={activeTab}
              onSelectApplication={id => setSelectedApplicationId(id)}
            />
          ) : user.role === 'ADMIN' ? (
            <AdminDashboard
              activeTab={activeTab}
              onSelectApplication={id => setSelectedApplicationId(id)}
            />
          ) : null}
        </main>
      </div>

      {/* Detail Dossier Modal */}
      {selectedApplicationId && (
        <ApplicationDetailModal
          applicationId={selectedApplicationId}
          onClose={() => setSelectedApplicationId(null)}
          onTriggerScrutinyAction={app => setScrutinyApp(app)}
          onTriggerCorrection={app => setCorrectionApp(app)}
          onTriggerEvcSchedule={app => setScheduleApp(app)}
          onTriggerAdminDecision={app => setDecisionApp(app)}
          onTriggerSacHearing={app => setSacApp(app)}
          onTriggerAssign={app => setAssignApp(app)}
        />
      )}

      {/* Action Modals */}
      {scrutinyApp && (
        <ApplicationReviewModal
          application={scrutinyApp}
          onClose={() => setScrutinyApp(null)}
          onSuccess={() => {
            setScrutinyApp(null);
            setSelectedApplicationId(null);
          }}
        />
      )}

      {correctionApp && (
        <CorrectionModal
          application={correctionApp}
          onClose={() => setCorrectionApp(null)}
          onSuccess={() => {
            setCorrectionApp(null);
            setSelectedApplicationId(null);
          }}
        />
      )}

      {scheduleApp && (
        <ScheduleEvcModal
          application={scheduleApp}
          onClose={() => setScheduleApp(null)}
          onSuccess={() => {
            setScheduleApp(null);
            setSelectedApplicationId(null);
          }}
        />
      )}

      {decisionApp && (
        <DecisionModal
          application={decisionApp}
          onClose={() => setDecisionApp(null)}
          onSuccess={() => {
            setDecisionApp(null);
            setSelectedApplicationId(null);
          }}
        />
      )}

      {sacApp && (
        <SacHearingModal
          application={sacApp}
          onClose={() => setSacApp(null)}
          onSuccess={() => {
            setSacApp(null);
            setSelectedApplicationId(null);
          }}
        />
      )}

      {assignApp && (
        <AssignOfficerModal
          application={assignApp}
          onClose={() => setAssignApp(null)}
          onSuccess={() => {
            setAssignApp(null);
            setSelectedApplicationId(null);
          }}
        />
      )}

      {showLoginModal && (
        <LoginView
          onSuccess={() => setShowLoginModal(false)}
          onCancel={() => setShowLoginModal(false)}
        />
      )}

      {/* Floating Voice Assistant Action Button */}
      <button
        onClick={() => setShowVoiceAssistant(true)}
        className="fixed bottom-6 right-6 z-40 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white p-3.5 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center gap-2 cursor-pointer group"
        title="AICTE Live Voice Assistant (English, Hindi, Marathi)"
      >
        <Sparkles className="w-5 h-5 animate-pulse" />
        <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs transition-all duration-300 text-xs font-bold pr-1">
          Voice Assistant
        </span>
      </button>

      {/* Voice Assistant Live Modal */}
      <VoiceAssistantModal
        isOpen={showVoiceAssistant}
        onClose={() => setShowVoiceAssistant(false)}
        onSelectApplication={id => {
          setShowVoiceAssistant(false);
          setSelectedApplicationId(id);
        }}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
