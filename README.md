# Angular Wasm vinJS

emcc hello.c -Os -s WASM=1 -s EXTRA_EXPORTED_RUNTIME_METHODS=["cwrap", "_malloc", "writeArrayToMemory". "getValue", "_free"] -s MODULARIZE=1 -o hello.js -s ENVIRONMENT='web
emcc -o webassembly-jpeg.js jpeg-read.c jpeg-write.c webassembly-jpeg.c libjpeg/.libs/libjpeg.a -O2 -s WASM=1 -s NO_EXIT_RUNTIME=1 -s 'EXPORTED_RUNTIME_METHODS=["writeArrayToMemory","getValue", "cwrap", "_malloc"]' 
