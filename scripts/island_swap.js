/* ==================================================================
   Bus Refresh · Which scene name to show the island under this time
   The island takes turns between two scene names, so a redraw can show
   the new one on top before removing the old without a gap or a flash. If
   the refresh is interrupted part-way, the old island is still there.
   Output: busnewscene (show under this), busoldscene (then remove this,
           or 'none' if nothing was showing)
   ================================================================== */
/* @include get */
// 1: showing; 2: showing, to be drawn again at a new size (a new stop, or the stop board opening or
// closing, 4.42), so the old one must go too. (Until 4.42 a redraw set 0, so the old one wasn't removed.)
var showing = /^[12]$/.test(get('BusStateIslandShown')) ? (get('BusStateIslandScene') || 'buspill') : '';
var busnewscene = showing === 'buspill' ? 'buspill2' : 'buspill';
var busoldscene = showing || 'none';
setGlobal('BusStateIslandScene', busnewscene);
