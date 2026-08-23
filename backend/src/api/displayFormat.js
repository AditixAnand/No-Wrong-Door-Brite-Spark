// Normalized records are stored uppercase for reliable matching; these
// helpers make them presentable without touching the underlying data.

function titleCase(value) {
  if (!value) return value;
  return value
    .toLowerCase()
    .split(' ')
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}

// Collapses the field-level match basis (['firstName','lastName','address'])
// into the display grouping used by the API contract (['name','address']).
function toDisplayBasis(basis) {
  if (!basis) return [];
  const set = new Set(basis);
  const display = [];
  if (set.has('firstName') || set.has('lastName')) display.push('name');
  if (set.has('dateOfBirth')) display.push('dateOfBirth');
  if (set.has('address')) display.push('address');
  if (set.has('town')) display.push('town');
  return display;
}

export { titleCase, toDisplayBasis };
