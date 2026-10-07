/* ==================================================================
   Bus Status · Everything in one message
   Output: busstatus
   ================================================================== */
/* @include get */
var now = Date.now(); var lines = [];

var running = get('BusStateRunning') === '1' && /(^|,)Bus Loop(,|$)/.test(get('TRUN'));
lines.push(running
  ? 'Countdown running at ' + (get('BusStateStopName') || '?') + ' (' + (get('BusStyle') === 'chip' ? 'status bar' : 'island') + ')'
  : 'No countdown running');
var snoozeNow = null; try { snoozeNow = JSON.parse(get('BusStateSnooze') || 'null'); } catch (e) {}
if (snoozeNow && Date.now() - snoozeNow.at < 30 * 60000)
  lines.push('Snoozed until you\u2019ve been to that stop and left it, or ' + new Date(snoozeNow.at + 30 * 60000).toTimeString().slice(0, 5) + ' at the latest (you swiped it away)');

// Which side of the road comes first (by direction): see sideTarget in watch.js
var lastPlace = get('BusStateLastPlace'); var dd = new Date(); var wk = dd.getDay() >= 1 && dd.getDay() <= 5;
var sideNow = lastPlace === 'work' ? 'the side towards home (you came from work)'
            : (lastPlace === 'home' && wk && dd.getHours() < 12) ? 'the side towards work (weekday morning, from home)'
            : 'the nearer side (no preference right now)';
lines.push('Side of the road first: ' + sideNow + '. Home ' + (get('BusHomeAt') ? 'known' : 'not known yet') +
  ', work ' + (get('BusWorkAt') ? 'known' : 'not known yet') + (get('BusCacheSeq') ? '' : ', route orders not fetched yet'));
lines.push('Recording trips: ' + (get('BusRecord') === 'on' ? 'on (Download/bus-trip-' + ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()] + '.jsonl today)' : 'off'));
lines.push('Heading to a stop: ' + ({ off: 'off', walk: 'walking', both: 'walking and by bus' }[get('BusApproach') || 'both']) +
  ', ' + (get('BusApproachMin') || '3') + ' min ahead');
lines.push('On leaving Wi-Fi, show the nearest stop: ' + ({ off: 'never', work: 'work only', home: 'home only', both: 'home and work' }[get('BusLeaveShow') || 'work']));
lines.push('Heads-up at work: ' + (get('BusGlanceFrom') === 'off' ? 'off' : (get('BusGlanceFrom') || '17:00') + ' to ' + (get('BusGlanceTo') || '18:00') + ', when you turn the screen on'));
var ssidNow = get('BusStateWifi');
lines.push('Wi-Fi now: ' + (ssidNow && !/^<unknown ssid>$/i.test(ssidNow) ? ssidNow + (ssidNow === get('BusWorkWifi') ? ' (work)' : ssidNow === get('BusHomeWifi') ? ' (home)' : '') : 'not connected'));
var lastPush = parseInt(get('BusStateLastPush'), 10) || 0;
if (get('BusStateRunning') === '1') lines.push('Position updates: ' + (get('BusStatePush') || 'not requested') +
  (lastPush ? ', last ' + Math.round((Date.now() - lastPush) / 1000) + ' s ago' : ''));
var trip = {}; try { trip = JSON.parse(get('BusStateTrip') || '{}'); } catch (e) {}
var stopNames = {}; get('BusPlaces').split('\n').forEach(function (r) { var p = r.split('|'); if (p[1]) stopNames[p[1]] = p[2]; });
lines.push('Trip: ' + ({ idle: 'idle', heading: 'heading to a stop', atstop: 'at the stop', onbus: 'on a bus', left: 'just left a stop' }[trip.s] || 'idle') +
  (trip.stop && stopNames[trip.stop] ? ' (' + stopNames[trip.stop] + ')' : '') + (trip.since ? ', since ' + new Date(trip.since).toTimeString().slice(0, 5) : ''));
var matchNow = {}; try { matchNow = JSON.parse(get('BusStateMatch') || '{}'); } catch (e) {}
if (matchNow.note) lines.push('Your bus: ' + matchNow.note);
var boardedNow = null; try { boardedNow = JSON.parse(get('BusStateBoarded') || 'null'); } catch (e) {}
if (boardedNow && Date.now() - boardedNow.at < 90 * 60000)
  lines.push('Last got on: the ' + boardedNow.k + ' (' + boardedNow.v + ') at ' + (stopNames[boardedNow.stop] || boardedNow.stop) + ', ' + new Date(boardedNow.at).toTimeString().slice(0, 5));
lines.push('Bus Watch last run: ' + (get('BusStateWatchInfo') || 'not yet'));

var places = get('BusPlaces').split('\n').filter(function (r) { return r.split('|').length >= 5; });
lines.push(places.length + (places.length === 1 ? ' saved stop' : ' saved stops') + '; routes ' + (get('BusRoutes') || 'not set'));

var stops = Object.keys(JSON.parse(get('BusCacheStops') || '{}')).length;
lines.push('Route stops: ' + stops + ' stops, ' + (get('BusCacheStopsDate') === new Date().toDateString() ? 'fetched today' : 'refreshes next start'));
var tt = JSON.parse(get('BusCacheTimetable') || '{}');
var today = Object.keys(tt).filter(function (k) { return tt[k].date === new Date().toDateString(); }).length;
lines.push('Timetables: ' + today + (today === 1 ? ' stop' : ' stops') + ' today');

lines.push('Wi-Fi off-switch: home ' + (get('BusHomeWifi') || 'not set') + ', work ' + (get('BusWorkWifi') || 'not set'));
lines.push('Island: screen ' + (get('BusStateScreenW') || '?') + ' dp wide' + (get('BusScreenW') ? ' (from Bus Find Camera)' : ' (measured)') +
  ', camera ' + (get('BusCameraX') ? 'at ' + get('BusCameraX') + ' dp' : 'not found (assumed centre)') + ', gap ' + (get('BusIslandGap') || 42) + ' dp');
lines.push('Sideways check: ' + (get('BusStateFullscreenInfo') || 'not run yet'));
lines.push('Display: ' + (get('BusStyle') || 'pill') + ', refresh ' + (get('BusRefresh') || 45) + ' s, timeout ' + (get('BusTimeout') || 30) + ' min');
var busstatus = lines.join('\n');
