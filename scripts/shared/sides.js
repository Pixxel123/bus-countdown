// ---- Which side of the road? (B: by direction) ----------------------------------------------
// Coming from home on a weekday morning, the side heading towards work comes first; coming from
// work (any day), the side heading towards home. Otherwise (weekends, going out, elsewhere) no
// preference. "Coming from" is the last of your home or work Wi-Fi the phone was on
// (BusStateLastPlace); where home and work are is recorded while you're on their Wi-Fi
// (BusHomeAt, BusWorkAt). A side "heads towards" a place if, further along any of its routes, the
// stops get at least 300 m closer to it (from the route stop orders in BusCacheSeq).
function sideTarget() {
  var last = global('BusStateLastPlace') || ''; var d = new Date(); var weekday = d.getDay() >= 1 && d.getDay() <= 5;
  var want = last === 'work' ? 'home' : (last === 'home' && weekday && d.getHours() < 12) ? 'work' : '';
  if (!want) return null;
  var at = null; try { at = JSON.parse(global(want === 'work' ? 'BusWorkAt' : 'BusHomeAt') || 'null'); } catch (e) {}
  return at && at.lat ? { name: want, lat: at.lat, lon: at.lon } : null;
}
function headsTowards(stopId, place) {
  if (!place) return false;
  var row = dirTable()[stopId];
  return !!(row && row[place.name]);
}
// Which way each saved stop's side heads, worked out once and kept in BusCacheDir (a lookup table:
// stop id -> { home: true/false, work: true/false }). Rebuilt only when the route orders or where
// home or work are change (BusCacheDirKey), not on every position.
var dirCache = null;
// A short fingerprint of some text (djb2), so any change to it is noticed
function hash(text) { var h = 5381; for (var i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0; return h.toString(36); }
function dirTable() {
  if (dirCache) return dirCache;
  var seqText = global('BusCacheSeq') || '[]'; var homeAt = global('BusHomeAt') || ''; var workAt = global('BusWorkAt') || '';
  var key = hash(seqText + '|' + homeAt.replace(/"n":\d+/, '') + '|' + workAt.replace(/"n":\d+/, '') + '|' + (global('BusPlaces') || ''));
  if (global('BusCacheDirKey') === key) { try { return (dirCache = JSON.parse(global('BusCacheDir') || '{}')); } catch (e) {} }
  var seqs = []; try { seqs = JSON.parse(seqText); } catch (e) {}
  var places = { home: null, work: null };
  try { places.home = JSON.parse(homeAt || 'null'); places.work = JSON.parse(workAt || 'null'); } catch (e) {}
  var table = {};
  (global('BusPlaces') || '').split('\n').forEach(function (row) {
    var id = row.split('|')[1]; if (!id) return;
    table[id] = {};
    ['home', 'work'].forEach(function (name) {
      var t = places[name]; if (!t || !t.lat) return;
      table[id][name] = seqs.some(function (seq) {
        for (var i = 0; i < seq.length; i++) if (seq[i][0] === id) {
          var here = metres(seq[i][1], seq[i][2], t.lat, t.lon); var best = here;
          for (var k = i + 1; k < seq.length; k++) best = Math.min(best, metres(seq[k][1], seq[k][2], t.lat, t.lon));
          return here - best >= 300;
        }
        return false;
      });
    });
  });
  setGlobal('BusCacheDir', JSON.stringify(table));
  setGlobal('BusCacheDirKey', key);
  return (dirCache = table);
}
