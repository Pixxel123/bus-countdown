/* ==================================================================
   Bus Wake and Bus Moved · Remember which Wi-Fi network you're on
   These two tasks read it from Android (the Java steps just before
   this). Everything else uses this saved copy, BusStateWifi, instead
   of asking again.
   ================================================================== */
/* @include wifiName */
setGlobal('BusStateWifi', wifiName());
