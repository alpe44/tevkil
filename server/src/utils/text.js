/**
 * "Ayşe Nur Yılmaz" -> "Ay** Nu* Yı****" — bir başvuru onaylanana kadar
 * kimliği tam gizler; her kelimenin yalnızca ilk 2 harfi görünür, gerisi yıldızlanır.
 */
function partialName(fullName) {
  return (fullName || '')
    .trim()
    .split(/\s+/)
    .map((word) => (word.length <= 2 ? word : word.slice(0, 2) + '*'.repeat(word.length - 2)))
    .join(' ');
}

module.exports = { partialName };
