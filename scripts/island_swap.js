/* ==================================================================
   Bus Refresh · Which scene name to show the island under this time
   The island takes turns between two scene names, so a redraw can show
   the new one on top before removing the old without a gap or a flash. If
   the refresh is interrupted part-way, the old island is still there.
   Output: busnewscene (show under this), busoldscene (then remove this,
           or 'none' if nothing was showing)
   ================================================================== */
/* @include get */
var showing = get('BusStateIslandShown') === '1' ? (get('BusStateIslandScene') || 'buspill') : '';
var busnewscene = showing === 'buspill' ? 'buspill2' : 'buspill';
var busoldscene = showing || 'none';
setGlobal('BusStateIslandScene', busnewscene);
