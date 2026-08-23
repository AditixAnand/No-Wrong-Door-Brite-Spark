import { useState } from 'react';
import SearchView from './components/SearchView.jsx';
import ResidentDetail from './components/ResidentDetail.jsx';
import ReviewQueue from './components/ReviewQueue.jsx';
import './App.css';

function App() {
  const [selectedId, setSelectedId] = useState(null);
  const [view, setView] = useState('search'); // 'search' | 'review'

  function goToSearch() {
    setSelectedId(null);
    setView('search');
  }

  return (
    <div className="app">
      <header>
        <h1>No Wrong Door — Calder County Unified Resident View</h1>
        <nav className="tabs">
          <button className={view === 'search' ? 'tab active' : 'tab'} onClick={goToSearch}>
            Search
          </button>
          <button
            className={view === 'review' ? 'tab active' : 'tab'}
            onClick={() => {
              setSelectedId(null);
              setView('review');
            }}
          >
            Review Queue
          </button>
        </nav>
      </header>
      <main>
        {view === 'review' && <ReviewQueue />}
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
