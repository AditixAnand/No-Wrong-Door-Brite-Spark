import { useState } from 'react';
import SearchView from './components/SearchView.jsx';
import ResidentDetail from './components/ResidentDetail.jsx';
import ReviewQueue from './components/ReviewQueue.jsx';
import HealthPanel from './components/HealthPanel.jsx';
import ReliabilityPanel from './components/ReliabilityPanel.jsx';
import AuditLog from './components/AuditLog.jsx';
import Login from './components/Login.jsx';
import ThemeToggle from './components/ThemeToggle.jsx';
import { getSession, logout } from './auth.js';
import './App.css';

function App() {
  const [session, setSession] = useState(getSession());
  const [selectedId, setSelectedId] = useState(null);
  const [view, setView] = useState('search'); // 'search' | 'review' | 'health' | 'reliability' | 'audit'

  if (!session) {
    return (
      <div className="app">
        <header>
          <div className="header-row">
            <h1>No Wrong Door — Calder County Unified Resident View</h1>
            <ThemeToggle />
          </div>
        </header>
        <main>
          <Login onLogin={setSession} />
        </main>
      </div>
    );
  }

  function goTo(nextView) {
    // Switching tabs never changes which resident (if any) is open —
    // clicking "Search" returns to exactly what was last there, whether
    // that's the results list or a specific resident's detail page. The
    // "← Back to search" link inside the detail view is the only way back
    // to the list.
    setView(nextView);
  }

  function handleLogout() {
    logout();
    setSession(null);
  }

  const isSupervisor = session.role === 'supervisor';

  return (
    <div className="app">
      <header>
        <div className="header-row">
          <h1>No Wrong Door — Calder County Unified Resident View</h1>
          <div className="session-info">
            <ThemeToggle />
            <span>
              {session.username} ({session.role}) · <button className="link-button" onClick={handleLogout}>Sign out</button>
            </span>
          </div>
        </div>
        <nav className="tabs">
          <button className={view === 'search' ? 'tab active' : 'tab'} onClick={() => goTo('search')}>
            Search
          </button>
          {/* Review Queue and Audit Log are gated per the F12 permissions
              table — a caseworker's session token wouldn't even be accepted
              by those routes, but hiding the tabs avoids a dead end. */}
          {isSupervisor && (
            <button className={view === 'review' ? 'tab active' : 'tab'} onClick={() => goTo('review')}>
              Review Queue
            </button>
          )}
          <button className={view === 'health' ? 'tab active' : 'tab'} onClick={() => goTo('health')}>
            Source Health
          </button>
          <button className={view === 'reliability' ? 'tab active' : 'tab'} onClick={() => goTo('reliability')}>
            Reliability
          </button>
          {isSupervisor && (
            <button className={view === 'audit' ? 'tab active' : 'tab'} onClick={() => goTo('audit')}>
              Audit Log
            </button>
          )}
        </nav>
      </header>
      {/* Every tab's content stays mounted once visited — switching tabs
          only hides it (display:none), so search results, an open resident,
          etc. are never lost by navigating away and back. */}
      <main>
        <div style={{ display: view === 'search' && !selectedId ? 'block' : 'none' }}>
          <SearchView onSelect={setSelectedId} />
        </div>
        <div style={{ display: view === 'search' && selectedId ? 'block' : 'none' }}>
          {selectedId && <ResidentDetail unifiedId={selectedId} onBack={() => setSelectedId(null)} />}
        </div>
        {isSupervisor && (
          <div style={{ display: view === 'review' ? 'block' : 'none' }}>
            <ReviewQueue />
          </div>
        )}
        <div style={{ display: view === 'health' ? 'block' : 'none' }}>
          <HealthPanel />
        </div>
        <div style={{ display: view === 'reliability' ? 'block' : 'none' }}>
          <ReliabilityPanel />
        </div>
        {isSupervisor && (
          <div style={{ display: view === 'audit' ? 'block' : 'none' }}>
            <AuditLog />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
