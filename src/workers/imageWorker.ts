interface ImageData {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface WorkerMessage {
  type: 'PROCESS_IMAGE';
  payload: {
    imageData: ImageData;
    cropArea: CropArea;
    expansionPercent: number;
  };
}

interface WorkerResponse {
  type: 'PROCESSED_IMAGE';
  payload: {
    imageData: ImageData;
    width: number;
    height: number;
  };
}

interface WorkerError {
  type: 'ERROR';
  error: string;
}

// 处理图片
self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  if (e.data.type !== 'PROCESS_IMAGE') return;
  
  const { imageData, cropArea, expansionPercent } = e.data.payload;

  try {
    // 创建 OffscreenCanvas
    const canvas = new OffscreenCanvas(imageData.width, imageData.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');

    // 创建 ImageData 对象
    const imgData = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    );

    // 将图像数据绘制到画布
    ctx.putImageData(imgData, 0, 0);

    // 计算新的尺寸
    const newWidth = cropArea.width * (1 + expansionPercent / 100);
    const newHeight = cropArea.height * (1 + expansionPercent / 100);

    // 计算中心点
    const centerX = cropArea.x + cropArea.width / 2;
    const centerY = cropArea.y + cropArea.height / 2;

    // 计算新的坐标
    const newX = centerX - newWidth / 2;
    const newY = centerY - newHeight / 2;

    // 创建新的画布用于裁剪
    const cropCanvas = new OffscreenCanvas(newWidth, newHeight);
    const cropCtx = cropCanvas.getContext('2d');
    if (!cropCtx) throw new Error('Failed to get crop canvas context');

    // 设置黑色背景
    cropCtx.fillStyle = 'black';
    cropCtx.fillRect(0, 0, newWidth, newHeight);

    // 绘制裁剪区域
    cropCtx.drawImage(
      canvas,
      newX,
      newY,
      newWidth,
      newHeight,
      0,
      0,
      newWidth,
      newHeight
    );

    // 获取裁剪后的图像数据
    const croppedImageData = cropCtx.getImageData(0, 0, newWidth, newHeight);

    // 发送处理后的图像数据
    const response: WorkerResponse = {
      type: 'PROCESSED_IMAGE',
      payload: {
        imageData: croppedImageData as unknown as ImageData,
        width: newWidth,
        height: newHeight
      }
    };
    self.postMessage(response);
  } catch (error) {
    const errorResponse: WorkerError = {
      type: 'ERROR',
      error: error instanceof Error ? error.message : '处理图片时发生错误'
    };
    self.postMessage(errorResponse);
  }
}; 