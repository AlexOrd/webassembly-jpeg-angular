import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { WasmService } from './wasm.service';
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  imgUrl = 'assets/testimg2.jpg';

  @ViewChild('firstImg', { static: true })
  firstImg!: ElementRef<HTMLCanvasElement>;

  @ViewChild('secondImg', { static: true })
  secondImg!: ElementRef<HTMLCanvasElement>;

  @ViewChild('thirdImg', { static: true })
  thirdImg!: ElementRef<HTMLCanvasElement>;

  @ViewChild('fourthImg', { static: true })
  fourthImg!: ElementRef<HTMLCanvasElement>;

  constructor(private wasmService: WasmService) {}

  ngOnInit() {
    this.wasmService.initWasm();
    this.showCompressedImagePromise(this.firstImg, '/assets/testimg2.jpg', 100)
      .then((): any =>
        this.showCompressedImagePromise(
          this.secondImg,
          '/assets/testimg2.jpg',
          5
        )
      )
      .then((): any =>
        this.showCompressedImagePromise(
          this.thirdImg,
          '/assets/testimg2.jpg',
          20
        )
      )
      .then((): any =>
        this.showCompressedImagePromise(
          this.fourthImg,
          '/assets/testimg2.jpg',
          50
        )
      );
  }

  showCompressedImagePromise(
    canvasContainer: ElementRef<HTMLCanvasElement>,
    imgUrl: string,
    qualityValue: number
  ) {
    const imgCtx = canvasContainer.nativeElement.getContext('2d');

    return !imgCtx
      ? Promise.resolve(true)
      : this.wasmService
          .loadAndCompressImgPromise(imgUrl, qualityValue)
          .then((data: any) => {
            const canvasImg = imgCtx.createImageData(
              data.image.width,
              data.image.height
            );
            // 5. Show bmpArray in the Canvas
            // We need these two calls to trigger the canvas update
            canvasImg.data.set(data.image.bmpArray);
            imgCtx.putImageData(canvasImg, 0, 0);

            // we can save as we need or send

            imgCtx.font = 'bold 10pt Courier New';
            imgCtx.fillStyle = 'white';
            imgCtx.fillText(
              `Quality: ${data.image.quality} / Weight: ${(
                data.image.compressedSize / 1024
              ).toFixed(2)} Kb`,
              20,
              40
            );
          });
  }
}
