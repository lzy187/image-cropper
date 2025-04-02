import { useState, useRef, useEffect } from 'react';
import styles from '@/styles/ImageCropper.module.css';
import { Slider, Box, Typography, LinearProgress, FormControlLabel, Switch } from '@mui/material';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { WorkerManager } from '@/utils/workerManager';
import type { ImageData, CropArea } from '@/utils/workerManager';

const ImageCropper = () => {
  // States
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageSrc, setImageSrc] = useState<string>('');
  const [crop, setCrop] = useState<CropArea | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
  const [minExpansion, setMinExpansion] = useState(0);
  const [maxExpansion, setMaxExpansion] = useState(30);
  const [batchCount, setBatchCount] = useState(5);
  const [croppedImages, setCroppedImages] = useState<Array<{ url: string; aspectRatio: string }>>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [useRandomAspectRatio, setUseRandomAspectRatio] = useState(false);
  const [aspectRatioRange, setAspectRatioRange] = useState([0.5, 2]);
  const [allowOutOfBounds, setAllowOutOfBounds] = useState(true);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const workerManagerRef = useRef<WorkerManager | null>(null);

  // Initialize worker manager
  useEffect(() => {
    workerManagerRef.current = new WorkerManager();
    return () => {
      workerManagerRef.current?.terminate();
    };
  }, []);

  // Handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target && typeof event.target.result === 'string') {
          const img = new Image();
          img.onload = () => {
            setImage(img);
            setCrop(null);
            setIsDragging(false);
            setCroppedImages([]);
            setError(null);
          };
          img.src = event.target.result;
          setImageSrc(event.target.result);
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  // Draw image and crop area on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions
    canvas.width = image.width;
    canvas.height = image.height;

    // Draw image
    ctx.drawImage(image, 0, 0);

    // Draw crop area if it exists
    if (crop) {
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect(crop.x, crop.y, crop.width, crop.height);

      // Semi-transparent overlay for better visibility
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(crop.x, crop.y, crop.width, crop.height);
    }
  }, [image, crop]);

  // Mouse handlers for crop area selection
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!image) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Get mouse position relative to canvas
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // 如果点击位置不在已选择的区域内，则取消选择
    if (crop && !isPointInCropArea(x, y, crop)) {
      setCrop(null);
      return;
    }

    setStartPoint({ x, y });
    setIsDragging(true);
    setCrop({ x, y, width: 0, height: 0 });
  };

  // 添加辅助函数检查点是否在裁剪区域内
  const isPointInCropArea = (x: number, y: number, cropArea: CropArea): boolean => {
    return (
      x >= cropArea.x &&
      x <= cropArea.x + cropArea.width &&
      y >= cropArea.y &&
      y <= cropArea.y + cropArea.height
    );
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !image) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Get mouse position relative to canvas
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    setCrop({
      x: Math.min(startPoint.x, x),
      y: Math.min(startPoint.y, y),
      width: Math.abs(x - startPoint.x),
      height: Math.abs(y - startPoint.y),
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Generate cropped images with random expansion values
  const generateImages = async () => {
    if (!image || !crop || crop.width === 0 || crop.height === 0) {
      setError('请先选择裁切区域');
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    setError(null);
    setCroppedImages([]);
    const results: Array<{ url: string; aspectRatio: string }> = [];

    try {
      // Get image data from canvas
      const canvas = canvasRef.current;
      if (!canvas) throw new Error('Canvas not found');
      
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not found');

      // 清除画布上的框选效果
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // 重新绘制原始图片
      ctx.drawImage(image, 0, 0);

      // 获取图像数据
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height) as unknown as ImageData;

      // Process each image
      for (let i = 0; i < batchCount; i++) {
        // Calculate random expansion percentage between min and max
        const expansionPercent = minExpansion + Math.random() * (maxExpansion - minExpansion);

        // 计算随机高宽比
        let finalCrop = { ...crop };
        if (useRandomAspectRatio) {
          const aspectRatio = aspectRatioRange[0] + Math.random() * (aspectRatioRange[1] - aspectRatioRange[0]);
          const centerX = crop.x + crop.width / 2;
          const centerY = crop.y + crop.height / 2;
          
          // 保持面积不变，调整宽高比
          const area = crop.width * crop.height;
          const newWidth = Math.sqrt(area * aspectRatio);
          const newHeight = area / newWidth;
          
          finalCrop = {
            x: centerX - newWidth / 2,
            y: centerY - newHeight / 2,
            width: newWidth,
            height: newHeight
          };
        }

        // 如果不允许超出边界，调整裁剪区域
        if (!allowOutOfBounds) {
          const maxWidth = image.width;
          const maxHeight = image.height;
          
          // 计算扩展后的尺寸
          const expandedWidth = finalCrop.width * (1 + expansionPercent / 100);
          const expandedHeight = finalCrop.height * (1 + expansionPercent / 100);
          
          // 计算中心点
          const centerX = finalCrop.x + finalCrop.width / 2;
          const centerY = finalCrop.y + finalCrop.height / 2;
          
          // 调整尺寸以确保不超出边界
          const adjustedWidth = Math.min(expandedWidth, maxWidth);
          const adjustedHeight = Math.min(expandedHeight, maxHeight);
          
          // 计算新的坐标，确保裁剪区域完全在原图范围内
          let newX = centerX - adjustedWidth / 2;
          let newY = centerY - adjustedHeight / 2;
          
          // 确保 x 和 y 不会小于 0
          newX = Math.max(0, newX);
          newY = Math.max(0, newY);
          
          // 确保右边界和下边界不会超出原图
          if (newX + adjustedWidth > maxWidth) {
            newX = maxWidth - adjustedWidth;
          }
          if (newY + adjustedHeight > maxHeight) {
            newY = maxHeight - adjustedHeight;
          }
          
          // 更新裁剪区域
          finalCrop = {
            x: newX,
            y: newY,
            width: adjustedWidth,
            height: adjustedHeight
          };
        }

        // Process image using Web Worker
        const processedImageData = await workerManagerRef.current?.processImage(
          imageData,
          finalCrop,
          allowOutOfBounds ? expansionPercent : 0 // 如果不允许超出边界，则不进行扩展
        );

        if (!processedImageData) throw new Error('Failed to process image');

        // 计算实际的高宽比
        const aspectRatio = processedImageData.width / processedImageData.height;
        const aspectRatioText = `宽高比: ${aspectRatio.toFixed(2)}`;

        // Create a temporary canvas for the result
        const resultCanvas = document.createElement('canvas');
        resultCanvas.width = processedImageData.width;
        resultCanvas.height = processedImageData.height;
        const resultCtx = resultCanvas.getContext('2d');
        if (!resultCtx) throw new Error('Failed to get result canvas context');

        // Draw the processed image
        resultCtx.putImageData(processedImageData as unknown as ImageData, 0, 0);
        const dataURL = resultCanvas.toDataURL('image/png');
        results.push({ url: dataURL, aspectRatio: aspectRatioText });

        // Update progress
        setProgress((i + 1) / batchCount * 100);
      }

      setCroppedImages(results);

      // 重新绘制框选效果
      ctx.drawImage(image, 0, 0);
      if (crop) {
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
        ctx.lineWidth = 2;
        ctx.strokeRect(crop.x, crop.y, crop.width, crop.height);

        // Semi-transparent overlay for better visibility
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(crop.x, crop.y, crop.width, crop.height);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '处理图片时发生错误');
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };

  // Download all generated images as a zip file
  const downloadImages = () => {
    if (croppedImages.length === 0) {
      setError('请先生成裁切结果');
      return;
    }

    const zip = new JSZip();
    const imgFolder = zip.folder("cropped_images");

    croppedImages.forEach((result, index) => {
      // Convert data URL to blob
      const byteString = atob(result.url.split(',')[1]);
      const mimeString = result.url.split(',')[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      
      const blob = new Blob([ab], { type: mimeString });
      imgFolder?.file(`cropped_${index + 1}.png`, blob);
    });

    zip.generateAsync({ type: "blob" }).then((content) => {
      saveAs(content, "cropped_images.zip");
    });
  };

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.uploadSection}>
        <input
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className={styles.fileInput}
          id="image-upload"
        />
        <label htmlFor="image-upload" className={styles.uploadButton}>
          上传图片
        </label>
      </div>
      
      {image && (
        <>
          <div className={styles.canvasContainer}>
            <canvas
              ref={canvasRef}
              className={styles.canvas}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
            <div className={styles.instructions}>
              {!crop ? '点击并拖动鼠标选择锚点区域' : '锚点区域已选择'}
            </div>
          </div>

          <div className={styles.controls}>
            <div className={styles.sliderContainer}>
              <Typography variant="subtitle1" gutterBottom>
                扩展比例范围：{minExpansion}% - {maxExpansion}%
              </Typography>
              <Box sx={{ width: '100%', padding: '0 10px' }}>
                <Slider
                  value={[minExpansion, maxExpansion]}
                  onChange={(_, newValue) => {
                    if (Array.isArray(newValue)) {
                      setMinExpansion(newValue[0]);
                      setMaxExpansion(newValue[1]);
                    }
                  }}
                  min={-99}
                  max={200}
                  valueLabelDisplay="auto"
                  disableSwap
                />
              </Box>
            </div>

            <div className={styles.aspectRatioControl}>
              <FormControlLabel
                control={
                  <Switch
                    checked={useRandomAspectRatio}
                    onChange={(e) => setUseRandomAspectRatio(e.target.checked)}
                    color="primary"
                  />
                }
                label="启用随机高宽比"
              />
              {useRandomAspectRatio && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    高宽比范围：{aspectRatioRange[0].toFixed(1)} - {aspectRatioRange[1].toFixed(1)}
                  </Typography>
                  <Box sx={{ width: '100%', padding: '0 10px' }}>
                    <Slider
                      value={aspectRatioRange}
                      onChange={(_, newValue) => {
                        if (Array.isArray(newValue)) {
                          setAspectRatioRange(newValue);
                        }
                      }}
                      min={0.1}
                      max={5}
                      step={0.1}
                      valueLabelDisplay="auto"
                      disableSwap
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary" align="center">
                    提示：1.0 表示正方形，小于 1 表示更宽，大于 1 表示更高
                  </Typography>
                </Box>
              )}
            </div>

            <div className={styles.boundaryControl}>
              <FormControlLabel
                control={
                  <Switch
                    checked={allowOutOfBounds}
                    onChange={(e) => setAllowOutOfBounds(e.target.checked)}
                    color="primary"
                  />
                }
                label="允许超出原图边界"
              />
              <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
                {allowOutOfBounds ? '超出部分将填充黑色' : '裁剪区域将自动调整以保持在原图范围内'}
              </Typography>
            </div>

            <div className={styles.batchControl}>
              <Typography variant="subtitle1" gutterBottom>
                批量生成数量：{batchCount}张
              </Typography>
              <input
                type="range"
                min="1"
                max="50"
                value={batchCount}
                onChange={(e) => setBatchCount(parseInt(e.target.value))}
                className={styles.batchSlider}
              />
            </div>

            {error && (
              <Typography color="error" sx={{ mt: 1 }}>
                {error}
              </Typography>
            )}

            {isGenerating && (
              <Box sx={{ width: '100%', mt: 2 }}>
                <LinearProgress variant="determinate" value={progress} />
                <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
                  {Math.round(progress)}%
                </Typography>
              </Box>
            )}

            <button 
              className={styles.generateButton}
              onClick={generateImages}
              disabled={!crop || isGenerating}
            >
              {isGenerating ? '生成中...' : '生成裁切结果'}
            </button>
          </div>

          {croppedImages.length > 0 && (
            <div className={styles.resultsContainer}>
              <h3>生成结果预览</h3>
              <div className={styles.imageGrid}>
                {croppedImages.map((result, index) => (
                  <div key={index} className={styles.resultItem} data-aspect-ratio={result.aspectRatio}>
                    <img src={result.url} alt={`Result ${index + 1}`} className={styles.resultImage} />
                  </div>
                ))}
              </div>
              <button className={styles.downloadButton} onClick={downloadImages}>
                下载所有结果 (ZIP)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ImageCropper; 