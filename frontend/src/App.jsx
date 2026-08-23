import { useState } from 'react';
import SearchView from './components/SearchView.jsx';
import ResidentDetail from './components/ResidentDetail.jsx';
import ReviewQueue from './components/ReviewQueue.jsx';
import HealthPanel from './components/HealthPanel.jsx';
import Login from './components/Login.jsx';
import { getSession, logout } from './auth.js';
import './App.css';

function App() {
  const [session, setSession] = useState(getSession());
  const [selectedId, setSelectedId] = useState(null);
  const [view, setView] = useState('search'); // 'search' | 'review' | 'health'

  if (!session) {
    return (
      <div className="app">
        <header>
          <h1>No Wrong Door — Calder County Unified Resident View</h1>
        </header>
        <main>
          <Login onLogin={setSession} />
        </main>
      </div>
    );
  }

  function goTo(nextView) {
    setSelectedId(null);
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
            {session.username} ({session.role}) · <button className="link-button" onClick={handleLogout}>Sign out</button>
          </div>
        </div>
        <nav className="tabs">
          <button className={view === 'search' ? 'tab active' : 'tab'} onClick={() => goTo('search')}>
            Search
          </button>
          {/* Review Queue and Source Health are gated per the F12 permissions
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
        </nav>
      </header>
      <main>
        {view === 'review' && isSupervisor && <ReviewQueue />}
        {view === 'health' && <HealthPanel />}
        {view === 'search' &&
          (selectedId ? (
            <ResidentDetail unifiedId={selectedId} onBack={() => setSelectedId(null)} />
          ) : (
            <SearchView onSelect={setSelectedId} />
          ))}
      </main>
    </div>
  );
}

export default App;
