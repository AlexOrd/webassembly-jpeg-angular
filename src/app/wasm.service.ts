declare var Module: any;

import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { filter, map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class WasmService {
  wasmReady = new BehaviorSubject<boolean>(false);
  setSrcImage: any;
  compress: any;
  // Canvas
  displayZone: any = {
    ctx: undefined, // canvas context
    bmpArray: undefined, // bitmap data
    imageData: undefined, // internal canvas bitmap data
  };
  // The following object maps the C Image structure
  image: any = {
    width: undefined,
    height: undefined,
    compressedSize: undefined,
    data: undefined,
  };

  constructor() {
    // this.initWasm();
  }

  initWasm() {
    console.log('Hello wotld');
    // JS wrap of : Image* setSrcImage(BYTE* jpegData, ULONG size)
    this.setSrcImage = Module.cwrap('setSrcImage', 'number', [
      'number',
      'number',
    ]);
    debugger
    // JS wrap of : Image* compress(ULONG quality)
    this.compress = Module.cwrap('compress', 'number', ['number']);
    // Canvas

    // The following object maps the C Image structure

    // Start point...
    this.loadSrcImage('assets/testimg.jpg');

    // let slider = document.getElementById('quality');
    // slider.oninput = function () {
    //   update(this.value);
    // };
  }

  loadSrcImage(imgUrl) {
    fetch(imgUrl)
      .then((response) => response.arrayBuffer())
      .then(this.initImage)
      // .then(createDisplayZone)
      .then(() => this.update(1));
  }

  initImage(rawJpeg) {
    // the fetch response is an ArrayBuffer (not typed).
    // We create a typed array from it.
    let rawJpegAsTypedArray = new Uint8Array(rawJpeg);
    // We allocate a memory block inside our WebAssembly module using the libc malloc function
    // given by the emscripten glue code.
    let srcBuf = Module._malloc(
      rawJpegAsTypedArray.length * rawJpegAsTypedArray.BYTES_PER_ELEMENT
    );
    // We copy the typed array to the memory block
    // Important : this memory block is a part of the heap.
    // The heap is allocated by JS code in the Emscripten glue and
    // given as the memory to the WebAssembly instance.
    // So, when we do malloc we simply get an index into the heap where
    // we can write. This is done by writeArrayToMemory which will
    // simply call HEAP8.set(array, buffer), which means :
    // "copy array to HEAP8 at offset buffer"
    Module.writeArrayToMemory(rawJpegAsTypedArray, srcBuf);
    // We give setSrcImage the pointer to the raw Jpeg data in the heap.
    // This function will return information about the bitmap :
    // { ULONG width; ULONG height; ULONG compressedSize; BYTE* bmpData; }
    let pImage = this.setSrcImage(srcBuf, rawJpegAsTypedArray.length);
    // https://emscripten.org/docs/api_reference/preamble.js.html#getValue
    // We get width and height from these informations
    this.image.width = Module.getValue(pImage + 0, 'i32');
    this.image.height = Module.getValue(pImage + 4, 'i32');
    // We known our WebAssembly code will not use anymore the allocated memory block.
    Module._free(srcBuf);
    // And we will not need the raw data anymore.
    // delete rawJpegAsTypedArray;
  }

  // createDisplayZone() {
  //   let canvas:any = document.createElement('canvas');
  //   canvas.width = image.width;
  //   canvas.height = image.height;
  //   document.getElementById('image-container').appendChild(canvas);
  //   displayZone.ctx = canvas.getContext('2d');
  //   // The MSDN doc says Uint8ClampedArray but it does not work (colors are melted).
  //   displayZone.bmpArray = new Uint8Array(
  //     image.width * image.height * 4
  //   ).fill(0xff);
  //   displayZone.imageData = displayZone.ctx.createImageData(
  //     image.width,
  //     image.height
  //   );
  // }

  display() {


    // Following is an aborted performance optimization.
    // Problem comes from memory alignment : read RGB to write RGBA
    // implies moving from 3 bytes to 3 bytes. When reading a i32 value with
    // getValue, we are unaligned. As the doc says, results may be
    // unpredictable.
    // To ensure alignment you add -s SAFE_HEAP=1 to your emcc,
    // the getValue will then crash.
    //
    // let buf32 = new Uint32Array(image.width * image.height * 4);
    // let len = image.width * image.height;
    // for (let ptr = image.data, iDst = 0; iDst < len; ptr += 4, iDst += 1) {
    //     let bytes = Module.getValue(ptr, 'i32'); // = RGBR, BRxx, B000
    //     let a = 255;
    //     let r = (bytes & 0xff000000) >> 24;
    //     let g = (bytes & 0x00ff0000) >> 16;
    //     let b = (bytes & 0x0000ff00) >> 8;
    //     // buf32 format : ABGR
    //     buf32[iDst] = (a << 24) | (b << 16) | (g << 8) | r;
    // }
    // displayZone.bmpArray = new Uint8ClampedArray(buf32.buffer);


    // Will be moved !!!!!!!!!!!!!!!!!!!
    // We need these two calls to trigger the canvas update
    // this.displayZone.imageData.data.set(this.displayZone.bmpArray);
    // this.displayZone.ctx.putImageData(this.displayZone.imageData, 0, 0);
  }

  update(quality) {
    // Call the WebAssembly function compress()
    // It will compress the bitmap image to Jpeg with given quality value.
    // Then it will decompress back and return the bitmap structure (width, height, uncompressedSize, data)
    let pImage = this.compress(quality);
    this.image.compressedSize = Module.getValue(pImage + 8, 'i32');
    this.image.data = Module.getValue(pImage + 12, 'i32');
    // document.getElementById('size').innerHTML =
    //   'Quality:' +
    //   quality +
    //   ' / Weight: ' +
    //   (image.compressedSize / 1024).toFixed(2) +
    //   ' Kb';
    // Show it to the world
    // this.display();

    // Unfortunatly, bitmap pixels are RGB and canvas expects RGBA.
    // So we have to convert pixel by pixel, and it is slow !
    // The canvas Alpha is set in createDisplayZone() with fill(0xff)
    // To improve performance, we should make the Web Assembly code
    // do the pixel conversion into an allocated RGBA pixels space.
    let len = this.image.width * this.image.height * 4;
    for (let ptr = this.image.data, iDst = 0; iDst < len; ptr += 3, iDst += 4) {
      this.displayZone.bmpArray[iDst + 0] = Module.getValue(ptr + 0, 'i8');
      this.displayZone.bmpArray[iDst + 1] = Module.getValue(ptr + 1, 'i8');
      this.displayZone.bmpArray[iDst + 2] = Module.getValue(ptr + 2, 'i8');
    }

    // The display function has copied the bitmap data to the canvas through
    // an Uint8Array. Si, we do not need the bitmap structure anymore.
    Module._free(this.image.data);
    Module._free(pImage);

    return {
      displayZone: this.displayZone,
      image: this.image
    }
  }
}



// private async instantiateWasm(url: string) {
//   // fetch the wasm file
//   const wasmFile = await fetch(url);

//   // convert it into a binary array
//   const buffer = await wasmFile.arrayBuffer();
//   const binary = new Uint8Array(buffer);

//   // create module arguments
//   // including the wasm-file
//   const moduleArgs = {
//     wasmBinary: binary,
//     onRuntimeInitialized: () => {
//       this.wasmReady.next(true);
//     },
//   };

//   // instantiate the module
//   this.module = wasmModule(moduleArgs);
//   console.log(this.module._fibonacci(55));
// }

// public fibonacci(input: number): Observable<number> {
//   return this.wasmReady.pipe(filter((value) => value === true)).pipe(
//     map(() => {
//       return this.module._fibonacci(input);
//     })
//   );
// }
// }
