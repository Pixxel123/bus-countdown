/* ==================================================================
   Bus Wake · Heads-up at work?
   Between BusGlanceFrom and BusGlanceTo (17:00 to 18:00 by default;
   BusGlanceFrom = off turns it off), on work Wi-Fi, with no countdown
   running: turning the screen on shows your office stop's next buses
   for about a minute (Bus Start "glance", then Bus Glance End).
   Output: busglance = yes / no
   ================================================================== */
/* @include get */
function minutes(hhmm) { var m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || ''); return m ? +m[1] * 60 + +m[2] : -1; }

// The Wi-Fi network you're on, as Bus Wake or Bus Moved last saw it
var wifiNow = get('BusStateWifi');

var from = get('BusGlanceFrom') || '17:00'; var to = get('BusGlanceTo') || '18:00';
var d = new Date(); var now = d.getHours() * 60 + d.getMinutes();
var inWindow = from !== 'off' && now >= minutes(from) && now < minutes(to);
var running = get('BusStateRunning') === '1' && /(^|,)Bus Loop(,|$)/.test(get('TRUN'));
var busglance = (inWindow && !running && wifiNow !== '' && wifiNow === get('BusWorkWifi') && get('BusPlaces') !== '') ? 'yes' : 'no';
