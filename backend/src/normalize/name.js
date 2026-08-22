// Name normalization: uppercase, trimmed, punctuation stripped, first/last separated.

function normalizeNamePart(part) {
  if (!part) return '';
  return part
    .replace(/[^A-Za-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

// REST already gives first/last separately.
function normalizeSeparateName(firstName, lastName) {
  return {
    first: normalizeNamePart(firstName),
    last: normalizeNamePart(lastName),
  };
}

// XML gives "SURNAME, Firstname" — split on the first comma.
function parseCombinedName(nameStr) {
  if (!nameStr) return { first: '', last: '' };
  const commaIndex = nameStr.indexOf(',');
  if (commaIndex === -1) {
    // No comma: can't split reliably, treat whole string as last name.
    return { first: '', last: normalizeNamePart(nameStr) };
  }
  const last = nameStr.slice(0, commaIndex);
  const first = nameStr.slice(commaIndex + 1);
  return normalizeSeparateName(first, last);
}

export { normalizeNamePart, normalizeSeparateName, parseCombinedName };
