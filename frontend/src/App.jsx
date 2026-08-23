import { useState } from 'react';
import SearchView from './components/SearchView.jsx';
import ResidentDetail from './components/ResidentDetail.jsx';
import ReviewQueue from './components/ReviewQueue.jsx';
import HealthPanel from './components/HealthPanel.jsx';
import './App.css';

function App() {
  const [selectedId, setSelectedId] = useState(null);
  const [view, setView] = useState('search'); // 'search' | 'review' | 'health'

  function goTo(nextView) {
    setSelectedId(null);
    setView(nextView);
  }

  return (
    <div className="app">
      <header>
        <h1>No Wrong Door — Calder County Unified Resident View</h1>
        <nav className="tabs">
          <button className={view === 'search' ? 'tab active' : 'tab'} onClick={() => goTo('search')}>
            Search
          </button>
          <button className={view === 'review' ? 'tab active' : 'tab'} onClick={() => goTo('review')}>
            Review Queue
          </button>
          <button className={view === 'health' ? 'tab active' : 'tab'} onClick={() => goTo('health')}>
            Source Health
          </button>
        </nav>
      </header>
      <main>
        {view === 'review' && <ReviewQueue />}
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
