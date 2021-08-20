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
    // JS wrap of : Image* setSrcImage(BYTE* jpegData, ULONG size)
    this.setSrcImage = Module.cwrap('setSrcImage', 'number', [
      'number',
      'number',
    ]);
    // JS wrap of : Image* compress(ULONG quality)
    this.compress = Module.cwrap('compress', 'number', ['number']);
  }

  loadAndCompressImgPromise(imgUrl: string, qualityValue: number = 5) {
    return fetch(imgUrl)
      .then((response) => response.arrayBuffer())
      .then((rawJpeg) => this.compressImg(qualityValue, rawJpeg));
  }

  compressImg(quality, rawJpeg) {
    const displayZone: any = {
      ctx: undefined, // canvas context
      bmpArray: new Uint8Array(800 * 600 * 4).fill(0xff), // bitmap data
      imageData: undefined, // internal canvas bitmap data
    };
    // The following object maps the C Image structure
    const image: any = {
      width: undefined,
      height: undefined,
      compressedSize: undefined,
      data: undefined,
      quality,
    };

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
    image.width = Module.getValue(uncompressImageP + 0, 'i32');
    image.height = Module.getValue(uncompressImageP + 4, 'i32');

    // We known our WebAssembly code will not use anymore the allocated memory block.
    Module._free(srcBuf);

    // Call the WebAssembly function compress()
    // It will compress the bitmap image to Jpeg with given quality value.
    // Then it will decompress back and return the bitmap structure (width, height, uncompressedSize, data)
    let pImage = this.compress(quality);
    image.compressedSize = Module.getValue(pImage + 8, 'i32');
    image.data = Module.getValue(pImage + 12, 'i32');

    // Unfortunately, bitmap pixels are RGB and canvas expects RGBA.
    // So we have to convert pixel by pixel, and it is slow !
    // The canvas Alpha is set in createDisplayZone() with fill(0xff)
    // To improve performance, we should make the Web Assembly code
    // do the pixel conversion into an allocated RGBA pixels space.
    let len = image.width * image.height * 4;
    for (let ptr = image.data, iDst = 0; iDst < len; ptr += 3, iDst += 4) {
      displayZone.bmpArray[iDst + 0] = Module.getValue(ptr + 0, 'i8');
      displayZone.bmpArray[iDst + 1] = Module.getValue(ptr + 1, 'i8');
      displayZone.bmpArray[iDst + 2] = Module.getValue(ptr + 2, 'i8');
    }

    // The display function has copied the bitmap data to the canvas through
    // an Uint8Array. Si, we do not need the bitmap structure anymore.
    Module._free(image.data);
    Module._free(pImage);

    return {
      displayZone: displayZone,
      image: image,
    };
  }
}
