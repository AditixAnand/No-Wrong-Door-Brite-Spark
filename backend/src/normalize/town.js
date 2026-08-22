// Town normalization: trimmed, uppercase.

function normalizeTown(town) {
  if (!town) return '';
  return town.trim().replace(/\s+/g, ' ').toUpperCase();
}

export { normalizeTown };
