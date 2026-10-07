/* ==================================================================
   Bus Wake · Remember this build's profiles are on
   Imported event profiles (Bus Moved especially) don't start listening
   until they're switched off and on, so Bus Wake does that once after
   each import (busbuild changes with every build): when the screen
   comes on, or when the Bus menu, Bus Settings or Bus Start ask it to.
   ================================================================== */
setGlobal('BusStateVersion', busbuild);
/* @include debugLog */
debugLog('Profiles switched off and on (Bus Moved, Bus Screen On, Bus Hide When Sideways) for build ' + busbuild);
