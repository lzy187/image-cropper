export interface ImageFilter {
  name: string;
  apply: (imageData: ImageData) => ImageData;
}

export interface ProcessingOptions {
  blur?: number;           // 高斯模糊半径 (0-10)
  sharpen?: number;        // 锐化强度 (0-2)
  brightness?: number;     // 亮度调整 (-100 to 100)
  contrast?: number;       // 对比度调整 (-100 to 100)
  saturation?: number;     // 饱和度调整 (-100 to 100)
  noise?: number;          // 噪声强度 (0-100)
  rotation?: number;       // 旋转角度 (-180 to 180)
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  hue?: number;           // 色相调整 (-180 to 180)
}

export interface ImageStats {
  mean: [number, number, number];    // RGB均值
  std: [number, number, number];     // RGB标准差
  histogram: {
    red: number[];
    green: number[];
    blue: number[];
  };
  width: number;
  height: number;
}

export class ImageProcessor {
  
  // 高斯模糊
  static gaussianBlur(imageData: ImageData, radius: number): ImageData {
    if (radius <= 0) return imageData;
    
    const data = new Uint8ClampedArray(imageData.data);
    const width = imageData.width;
    const height = imageData.height;
    
    // 生成高斯核
    const kernel = this.generateGaussianKernel(radius);
    const kernelSize = kernel.length;
    const half = Math.floor(kernelSize / 2);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0, a = 0;
        
        for (let ky = 0; ky < kernelSize; ky++) {
          for (let kx = 0; kx < kernelSize; kx++) {
            const px = Math.min(width - 1, Math.max(0, x + kx - half));
            const py = Math.min(height - 1, Math.max(0, y + ky - half));
            const idx = (py * width + px) * 4;
            const weight = kernel[ky][kx];
            
            r += imageData.data[idx] * weight;
            g += imageData.data[idx + 1] * weight;
            b += imageData.data[idx + 2] * weight;
            a += imageData.data[idx + 3] * weight;
          }
        }
        
        const idx = (y * width + x) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = a;
      }
    }
    
    return new ImageData(data, width, height);
  }
  
  // 生成高斯核
  private static generateGaussianKernel(radius: number): number[][] {
    const size = Math.ceil(radius * 2) * 2 + 1;
    const kernel: number[][] = [];
    const sigma = radius / 3;
    let sum = 0;
    
    for (let y = 0; y < size; y++) {
      kernel[y] = [];
      for (let x = 0; x < size; x++) {
        const dx = x - Math.floor(size / 2);
        const dy = y - Math.floor(size / 2);
        const value = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
        kernel[y][x] = value;
        sum += value;
      }
    }
    
    // 归一化
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        kernel[y][x] /= sum;
      }
    }
    
    return kernel;
  }
  
  // 锐化滤波
  static sharpen(imageData: ImageData, intensity: number): ImageData {
    if (intensity <= 0) return imageData;
    
    const data = new Uint8ClampedArray(imageData.data);
    const width = imageData.width;
    const height = imageData.height;
    
    // 锐化核
    const kernel = [
      [0, -intensity, 0],
      [-intensity, 1 + 4 * intensity, -intensity],
      [0, -intensity, 0]
    ];
    
    return this.applyConvolution(imageData, kernel);
  }
  
  // 亮度调整
  static adjustBrightness(imageData: ImageData, brightness: number): ImageData {
    const data = new Uint8ClampedArray(imageData.data);
    const adjustment = brightness * 2.55; // 转换为0-255范围
    
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.max(0, Math.min(255, data[i] + adjustment));     // R
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + adjustment)); // G
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + adjustment)); // B
    }
    
    return new ImageData(data, imageData.width, imageData.height);
  }
  
  // 对比度调整
  static adjustContrast(imageData: ImageData, contrast: number): ImageData {
    const data = new Uint8ClampedArray(imageData.data);
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.max(0, Math.min(255, factor * (data[i] - 128) + 128));     // R
      data[i + 1] = Math.max(0, Math.min(255, factor * (data[i + 1] - 128) + 128)); // G
      data[i + 2] = Math.max(0, Math.min(255, factor * (data[i + 2] - 128) + 128)); // B
    }
    
    return new ImageData(data, imageData.width, imageData.height);
  }
  
  // 饱和度调整
  static adjustSaturation(imageData: ImageData, saturation: number): ImageData {
    const data = new Uint8ClampedArray(imageData.data);
    const factor = saturation / 100 + 1;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // 转换为HSL，调整饱和度，再转回RGB
      const [h, s, l] = this.rgbToHsl(r, g, b);
      const [newR, newG, newB] = this.hslToRgb(h, Math.max(0, Math.min(1, s * factor)), l);
      
      data[i] = newR;
      data[i + 1] = newG;
      data[i + 2] = newB;
    }
    
    return new ImageData(data, imageData.width, imageData.height);
  }
  
  // 添加高斯噪声
  static addNoise(imageData: ImageData, intensity: number): ImageData {
    const data = new Uint8ClampedArray(imageData.data);
    const noiseAmount = intensity * 2.55;
    
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * noiseAmount;
      data[i] = Math.max(0, Math.min(255, data[i] + noise));     // R
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise)); // G
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise)); // B
    }
    
    return new ImageData(data, imageData.width, imageData.height);
  }
  
  // 图像旋转
  static rotate(imageData: ImageData, angle: number): ImageData {
    if (angle === 0) return imageData;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    // 计算旋转后的尺寸
    const rad = (angle * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const newWidth = Math.ceil(imageData.width * cos + imageData.height * sin);
    const newHeight = Math.ceil(imageData.width * sin + imageData.height * cos);
    
    canvas.width = newWidth;
    canvas.height = newHeight;
    
    // 将ImageData转换为图像
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;
    tempCtx.putImageData(imageData, 0, 0);
    
    // 旋转绘制
    ctx.translate(newWidth / 2, newHeight / 2);
    ctx.rotate(rad);
    ctx.drawImage(tempCanvas, -imageData.width / 2, -imageData.height / 2);
    
    return ctx.getImageData(0, 0, newWidth, newHeight);
  }
  
  // 水平翻转
  static flipHorizontal(imageData: ImageData): ImageData {
    const data = new Uint8ClampedArray(imageData.data);
    const width = imageData.width;
    const height = imageData.height;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width / 2; x++) {
        const leftIdx = (y * width + x) * 4;
        const rightIdx = (y * width + (width - 1 - x)) * 4;
        
        // 交换像素
        for (let c = 0; c < 4; c++) {
          const temp = data[leftIdx + c];
          data[leftIdx + c] = data[rightIdx + c];
          data[rightIdx + c] = temp;
        }
      }
    }
    
    return new ImageData(data, width, height);
  }
  
  // 垂直翻转
  static flipVertical(imageData: ImageData): ImageData {
    const data = new Uint8ClampedArray(imageData.data);
    const width = imageData.width;
    const height = imageData.height;
    
    for (let y = 0; y < height / 2; y++) {
      for (let x = 0; x < width; x++) {
        const topIdx = (y * width + x) * 4;
        const bottomIdx = ((height - 1 - y) * width + x) * 4;
        
        // 交换像素
        for (let c = 0; c < 4; c++) {
          const temp = data[topIdx + c];
          data[topIdx + c] = data[bottomIdx + c];
          data[bottomIdx + c] = temp;
        }
      }
    }
    
    return new ImageData(data, width, height);
  }
  
  // 应用多个处理选项
  static applyProcessing(imageData: ImageData, options: ProcessingOptions): ImageData {
    let result = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    );
    
    // 按照特定顺序应用处理
    if (options.brightness !== undefined && options.brightness !== 0) {
      result = this.adjustBrightness(result, options.brightness);
    }
    
    if (options.contrast !== undefined && options.contrast !== 0) {
      result = this.adjustContrast(result, options.contrast);
    }
    
    if (options.saturation !== undefined && options.saturation !== 0) {
      result = this.adjustSaturation(result, options.saturation);
    }
    
    if (options.blur !== undefined && options.blur > 0) {
      result = this.gaussianBlur(result, options.blur);
    }
    
    if (options.sharpen !== undefined && options.sharpen > 0) {
      result = this.sharpen(result, options.sharpen);
    }
    
    if (options.noise !== undefined && options.noise > 0) {
      result = this.addNoise(result, options.noise);
    }
    
    if (options.flipHorizontal) {
      result = this.flipHorizontal(result);
    }
    
    if (options.flipVertical) {
      result = this.flipVertical(result);
    }
    
    if (options.rotation !== undefined && options.rotation !== 0) {
      result = this.rotate(result, options.rotation);
    }
    
    return result;
  }
  
  // 计算图像统计信息
  static calculateStats(imageData: ImageData): ImageStats {
    const data = imageData.data;
    const pixelCount = data.length / 4;
    
    let rSum = 0, gSum = 0, bSum = 0;
    const rHist = new Array(256).fill(0);
    const gHist = new Array(256).fill(0);
    const bHist = new Array(256).fill(0);
    
    // 计算均值和直方图
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      rSum += r;
      gSum += g;
      bSum += b;
      
      rHist[r]++;
      gHist[g]++;
      bHist[b]++;
    }
    
    const rMean = rSum / pixelCount;
    const gMean = gSum / pixelCount;
    const bMean = bSum / pixelCount;
    
    // 计算标准差
    let rSumSq = 0, gSumSq = 0, bSumSq = 0;
    for (let i = 0; i < data.length; i += 4) {
      rSumSq += Math.pow(data[i] - rMean, 2);
      gSumSq += Math.pow(data[i + 1] - gMean, 2);
      bSumSq += Math.pow(data[i + 2] - bMean, 2);
    }
    
    const rStd = Math.sqrt(rSumSq / pixelCount);
    const gStd = Math.sqrt(gSumSq / pixelCount);
    const bStd = Math.sqrt(bSumSq / pixelCount);
    
    return {
      mean: [rMean, gMean, bMean],
      std: [rStd, gStd, bStd],
      histogram: {
        red: rHist,
        green: gHist,
        blue: bHist
      },
      width: imageData.width,
      height: imageData.height
    };
  }
  
  // 辅助函数：卷积操作
  private static applyConvolution(imageData: ImageData, kernel: number[][]): ImageData {
    const data = new Uint8ClampedArray(imageData.data);
    const width = imageData.width;
    const height = imageData.height;
    const kernelSize = kernel.length;
    const half = Math.floor(kernelSize / 2);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0;
        
        for (let ky = 0; ky < kernelSize; ky++) {
          for (let kx = 0; kx < kernelSize; kx++) {
            const px = Math.min(width - 1, Math.max(0, x + kx - half));
            const py = Math.min(height - 1, Math.max(0, y + ky - half));
            const idx = (py * width + px) * 4;
            const weight = kernel[ky][kx];
            
            r += imageData.data[idx] * weight;
            g += imageData.data[idx + 1] * weight;
            b += imageData.data[idx + 2] * weight;
          }
        }
        
        const idx = (y * width + x) * 4;
        data[idx] = Math.max(0, Math.min(255, r));
        data[idx + 1] = Math.max(0, Math.min(255, g));
        data[idx + 2] = Math.max(0, Math.min(255, b));
      }
    }
    
    return new ImageData(data, width, height);
  }
  
  // RGB转HSL
  private static rgbToHsl(r: number, g: number, b: number): [number, number, number] {
    r /= 255;
    g /= 255;
    b /= 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    
    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    
    return [h, s, l];
  }
  
  // HSL转RGB
  private static hslToRgb(h: number, s: number, l: number): [number, number, number] {
    let r, g, b;
    
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    
    return [
      Math.round(r * 255),
      Math.round(g * 255),
      Math.round(b * 255)
    ];
  }
} 