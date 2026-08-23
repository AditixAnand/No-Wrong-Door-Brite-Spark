import { useState } from 'react';
import SearchView from './components/SearchView.jsx';
import ResidentDetail from './components/ResidentDetail.jsx';
import './App.css';

function App() {
  const [selectedId, setSelectedId] = useState(null);

  return (
    <div className="app">
      <header>
        <h1>No Wrong Door — Calder County Unified Resident View</h1>
      </header>
      <main>
        {selectedId ? (
          <ResidentDetail unifiedId={selectedId} onBack={() => setSelectedId(null)} />
        ) : (
          <SearchView onSelect={setSelectedId} />
        )}
      </main>
    </div>
  );
}

export default App;
