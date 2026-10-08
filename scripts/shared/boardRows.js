// How many lines the stop board has: your routes, then the stop's other routes unless Settings says
// yours only (mineOnly), at least 1 and at most 8. Shared by island_show.js, which draws it that tall,
// and refresh.js, which draws it again when that changes (4.43).
function boardRows(mine, others, mineOnly) {
  return Math.max(1, Math.min(8, mine + (mineOnly ? 0 : others)));
}
