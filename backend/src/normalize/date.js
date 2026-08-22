// Date normalization: ISO string, or null if blank. Blank is null, never an error.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeDate(dateStr) {
  if (dateStr === null || dateStr === undefined) return null;
  const trimmed = String(dateStr).trim();
  if (trimmed === '') return null;
  if (!ISO_DATE.test(trimmed)) return null;
  return trimmed;
}

export { normalizeDate };
