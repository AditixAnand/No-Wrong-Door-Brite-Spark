// Address normalization: expand street suffixes, collapse whitespace, uppercase.

const SUFFIX_EXPANSIONS = [
  [/\bst\.?\b/gi, 'Street'],
  [/\bdr\.?\b/gi, 'Drive'],
  [/\bln\.?\b/gi, 'Lane'],
  [/\bave\.?\b/gi, 'Avenue'],
  [/\brd\.?\b/gi, 'Road'],
];

function normalizeAddress(addr) {
  if (!addr) return '';
  let result = addr.trim();
  for (const [pattern, expansion] of SUFFIX_EXPANSIONS) {
    result = result.replace(pattern, expansion);
  }
  result = result.replace(/\s+/g, ' ').trim();
  return result.toUpperCase();
}

export { normalizeAddress };
