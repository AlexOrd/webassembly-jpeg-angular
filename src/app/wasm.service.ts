declare var Module: any;

import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { filter, map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class WasmService {
  setSrcImage: any;
  compress: any;
  constructor() {
    this.initWasm();
  }

  initWasm() {
    // 1. Connection between C and JS.

    // JS wrap of : Image* setSrcImage(BYTE* jpegData, ULONG size)
    this.setSrcImage = Module.cwrap('setSrcImage', 'number', [
      'number',
      'number',
    ]);

    // JS wrap of : Image* compress(ULONG quality)
    this.compress = Module.cwrap('compress', 'number', ['number']);
  }

  loadAndCompressImgPromise(imgUrl: string, qualityValue: number) {
    return fetch(imgUrl)
      .then((response) => response.arrayBuffer())
      .then((rawJpeg) => this.compressAndReturnImg(qualityValue, rawJpeg));
  }

  compressAndReturnImg(quality, rawJpeg) {
    // The following object maps the C Image structure
    const image: any = {
      width: undefined,
      height: undefined,
      compressedSize: undefined,
      bmpArray: new Uint8Array(700 * 525 * 4).fill(0xff), // bitmap data
      data: undefined,
      quality,
    };

    // 2. Load jpeg data to the WASM memory
    const uncompressedImgData = this.shareJpegData(rawJpeg);
    debugger
    image.width = uncompressedImgData.width;
    image.height = uncompressedImgData.height;

    // 3. Compress jpeg by C lib
    // It will compress the bitmap image to Jpeg with given quality value.
    // Then it will decompress back and return the bitmap structure (width, height, uncompressedSize, data)
    let pImage = this.compress(quality);
    image.compressedSize = Module.getValue(pImage + 8, 'i32');
    image.data = Module.getValue(pImage + 12, 'i32');


    // 4. Move jpeg bitmap from WASM to JS Array Buffer
    // Unfortunately, bitmap pixels are RGB and canvas expects RGBA.
    // So we have to convert pixel by pixel, and it is slow !
    // The canvas Alpha is set in createDisplayZone() with fill(0xff)
    let len = image.width * image.height * 4;
    for (let ptr = image.data, iDst = 0; iDst < len; ptr += 3, iDst += 4) {
      image.bmpArray[iDst + 0] = Module.getValue(ptr + 0, 'i8');
      image.bmpArray[iDst + 1] = Module.getValue(ptr + 1, 'i8');
      image.bmpArray[iDst + 2] = Module.getValue(ptr + 2, 'i8');
    }

    // The display function has copied the bitmap data to the canvas through
    // an Uint8Array. Si, we do not need the bitmap structure anymore.
    Module._free(image.data);
    Module._free(pImage);

    return { image: image };
  }

  shareJpegData(rawJpeg): any {
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

    let uncompressImageP = this.setSrcImage(srcBuf, rawJpegAsTypedArray.length);

    // https://emscripten.org/docs/api_reference/preamble.js.html#getValue
    // We get width and height from these information
    const result = {
      width: Module.getValue(uncompressImageP + 0, 'i32'),
      height: Module.getValue(uncompressImageP + 4, 'i32'),
    };

    // We known our WebAssembly code will not use anymore the allocated memory block.
    Module._free(srcBuf);

    return result;
  }
}

