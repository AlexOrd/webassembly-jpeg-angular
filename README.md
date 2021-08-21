# WebAssembly. Angular.
## _Alex Ordynski VinJS 2021_
![app](https://user-images.githubusercontent.com/15979348/130318152-9f41f3ef-2cbe-41a4-b73a-5848df5d08b5.png)

## Installation

### Independent JPEG Group
IJG is an informal group that writes and distributes a widely used free library for JPEG image compression. The first version was released on 7-Oct-1991.
The current version is release 9d of 12-Jan-2020. This is a stable and solid foundation for many application's JPEG support.

Install Emscripten from https://kripken.github.io/emscripten-site/index.html

Install dependencies : ```npm install ```
Download the JPEG lib from the Independant Jpeg Group website to project directory :
http://www.ijg.org/files/
Untar & unzip the jpeg lib :

```sh
mkdir libjpeg
tar xvzf jpegsrc.v9b.tar.gz -C ./libjpeg --strip-components=1
```
The first step is to configure the Jpeg lib build environment. 
Usually, you would launch the configure script, but since our target is not the host architecture/operating system but WASM, we use emconfigure to wrap this process :
```sh
cd libjpeg
emconfigure ./configure
```
We can now build the library in WASM format. We use the emmake wrapper :
```sh
emmake make
```
Let's build our app :
```sh
emcc -o webassembly-jpeg.js jpeg-read.c jpeg-write.c webassembly-jpeg.c libjpeg/.libs/libjpeg.a
      -O2
      -s WASM=1
      -s NO_EXIT_RUNTIME=1
      -s 'EXPORTED_RUNTIME_METHODS=["writeArrayToMemory","getValue", "cwrap", "_malloc"]'
```
Start Angular app:
```sh
npm start
```
