import { useState } from 'react';
import { searchResidents } from '../api.js';

function stateLabel(state) {
  switch (state) {
    case 'linked':
      return 'Linked';
    case 'ambiguous':
      return 'Ambiguous';
    case 'unmatched_rest_only':
      return 'Resident Index only';
    case 'unmatched_xml_only':
      return 'Benefits Register only';
    default:
      return state;
  }
}

function SearchView({ onSelect }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function runSearch(query) {
    setLoading(true);
    setError(null);
    try {
      const data = await searchResidents(query, 1);
      setResults(data.results);
      setTotal(data.total);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    runSearch(q);
  }

  return (
    <div className="search-view">
      <form onSubmit={handleSubmit} className="search-form">
        <input
          type="text"
          placeholder="Search by name, town, or source id (e.g. Kessler, Weybridge, R-10001)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="submit">Search</button>
      </form>

      {loading && <p>Searching…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && total !== null && <p className="result-count">{total} result{total === 1 ? '' : 's'}</p>}

      <ul className="result-list">
        {results.map((r) => (
          <li key={r.unifiedId} onClick={() => onSelect(r.unifiedId)} className="result-item">
            <span className="result-name">{r.name || '(ambiguous — pending review)'}</span>
            <span className="result-town">{r.town || ''}</span>
            <span className={`badge badge-${r.state}`}>{stateLabel(r.state)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default SearchView;
