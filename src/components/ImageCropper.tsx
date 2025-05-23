import { useState, useRef, useEffect, useCallback } from 'react';
import styles from '@/styles/ImageCropper.module.css';
import { 
  Slider, 
  Box, 
  Typography, 
  LinearProgress, 
  FormControlLabel, 
  Switch,
  Grid,
  Paper,
  Divider,
  Button,
  Alert,
  Snackbar,
  Tooltip,
  IconButton,
  Card,
  CardContent,
  CardActions,
  Fade,
  Zoom,
  Chip,
  Stack
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Download as DownloadIcon,
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Crop as CropIcon,
  AutoFixHigh as MagicIcon,
  Save as SaveIcon,
  Palette as PaletteIcon,
  Speed as SpeedIcon,
  Timeline as TimelineIcon,
  PhotoCamera as PhotoIcon
} from '@mui/icons-material';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { WorkerManager } from '@/utils/workerManager';
import type { ImageData, CropArea } from '@/utils/workerManager';
import { ImageProcessingPanel } from './ImageProcessingPanel';
import { ProcessingOptions, ImageStats, ImageProcessor } from '@/utils/imageProcessing';

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
  
  // 新增：图像处理相关状态
  const [currentImageData, setCurrentImageData] = useState<ImageData | null>(null);
  const [processedImageData, setProcessedImageData] = useState<ImageData | null>(null);
  const [currentProcessingOptions, setCurrentProcessingOptions] = useState<ProcessingOptions>({});
  const [imageStats, setImageStats] = useState<ImageStats | null>(null);
  const [showProcessingPanel, setShowProcessingPanel] = useState(false);

  // 新增：交互优化状态
  const [isDragOver, setIsDragOver] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'info'>('info');
  const [isProcessing, setIsProcessing] = useState(false);
  const [canvasScale, setCanvasScale] = useState(1);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const workerManagerRef = useRef<WorkerManager | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 显示消息提示
  const showMessage = useCallback((message: string, severity: 'success' | 'error' | 'info' = 'info') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  }, []);

  // Initialize worker manager
  useEffect(() => {
    workerManagerRef.current = new WorkerManager();
    return () => {
      workerManagerRef.current?.terminate();
    };
  }, []);

  // 处理拖拽上传
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileUpload(files[0]);
    }
  }, []);

  // 统一的文件处理函数
  const handleFileUpload = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      showMessage('请选择有效的图片文件', 'error');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB限制
      showMessage('图片文件过大，请选择小于10MB的图片', 'error');
      return;
    }

    setIsProcessing(true);
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
          setCanvasScale(1);
          
          // 获取原始图像数据
          updateImageData(img);
          showMessage('图片上传成功！', 'success');
          setIsProcessing(false);
        };
        img.onerror = () => {
          showMessage('图片加载失败，请尝试其他图片', 'error');
          setIsProcessing(false);
        };
        img.src = event.target.result;
        setImageSrc(event.target.result);
      }
    };
    reader.onerror = () => {
      showMessage('文件读取失败', 'error');
      setIsProcessing(false);
    };
    reader.readAsDataURL(file);
  }, [showMessage]);

  // Handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  // 更新图像数据
  const updateImageData = (img: HTMLImageElement) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, img.width, img.height);
    setCurrentImageData(imageData);
    setProcessedImageData(null);
  };

  // 处理图像处理结果
  const handleProcessedImage = (processedData: ImageData, options: ProcessingOptions) => {
    setProcessedImageData(processedData);
    setCurrentProcessingOptions(options);
    
    // 更新预览画布
    updatePreviewCanvas(processedData);
  };

  // 更新预览画布
  const updatePreviewCanvas = (imageData: ImageData) => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d')!;
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    ctx.putImageData(imageData, 0, 0);
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
      showMessage('请先选择裁切区域', 'error');
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    setError(null);
    setCroppedImages([]);
    const results: Array<{ url: string; aspectRatio: string }> = [];

    try {
      showMessage('开始生成裁切结果...', 'info');
      
      // Get image data - use processed data if available, otherwise use original
      let imageData: ImageData;
      
      if (processedImageData) {
        // 使用处理后的图像数据
        imageData = processedImageData;
      } else {
        // 使用原始图像数据
        const canvas = canvasRef.current;
        if (!canvas) throw new Error('Canvas not found');
        
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas context not found');

        // 清除画布上的框选效果
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // 重新绘制原始图片
        ctx.drawImage(image, 0, 0);

        // 获取图像数据
        imageData = ctx.getImageData(0, 0, canvas.width, canvas.height) as unknown as ImageData;
      }

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
        const progressPercent = (i + 1) / batchCount * 100;
        setProgress(progressPercent);
      }

      setCroppedImages(results);
      showMessage(`成功生成${results.length}张裁切结果！`, 'success');

      // 重新绘制框选效果（只有在使用原始图像数据时才需要）
      if (!processedImageData) {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx && crop) {
            ctx.drawImage(image, 0, 0);
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
            ctx.lineWidth = 2;
            ctx.strokeRect(crop.x, crop.y, crop.width, crop.height);

            // Semi-transparent overlay for better visibility
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fillRect(crop.x, crop.y, crop.width, crop.height);
          }
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '处理图片时发生错误';
      setError(errorMessage);
      showMessage(errorMessage, 'error');
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };

  // Download all generated images as a zip file
  const downloadImages = () => {
    if (croppedImages.length === 0) {
      showMessage('请先生成裁切结果', 'error');
      return;
    }

    try {
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
        showMessage('下载开始！', 'success');
      }).catch(() => {
        showMessage('下载失败，请重试', 'error');
      });
    } catch (err) {
      showMessage('准备下载时出错', 'error');
    }
  };

  return (
    <Box sx={{ maxWidth: 1600, mx: 'auto', p: 3, backgroundColor: '#f8fafc' }}>
      {/* 主横幅 */}
      <Paper 
        elevation={4} 
        sx={{ 
          p: 4, 
          mb: 4, 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          borderRadius: 3
        }}
      >
        <Box sx={{ textAlign: 'center', position: 'relative' }}>
          <Zoom in timeout={1000}>
            <PhotoIcon sx={{ fontSize: 60, mb: 2, opacity: 0.9 }} />
          </Zoom>
          <Fade in timeout={1500}>
            <Typography variant="h3" gutterBottom fontWeight="bold">
              AI 图像锚定裁切工具
            </Typography>
          </Fade>
          <Fade in timeout={2000}>
            <Typography variant="h6" sx={{ opacity: 0.9, maxWidth: 600, mx: 'auto' }}>
              智能图像处理 · 数据增强 · 批量裁切 · 机器学习数据集生成
            </Typography>
          </Fade>
          
          {/* 功能特色标签 */}
          <Box sx={{ mt: 3, display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Chip 
              icon={<MagicIcon />} 
              label="智能处理" 
              variant="outlined" 
              sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.5)' }} 
            />
            <Chip 
              icon={<SpeedIcon />} 
              label="批量生成" 
              variant="outlined" 
              sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.5)' }} 
            />
            <Chip 
              icon={<PaletteIcon />} 
              label="多种滤镜" 
              variant="outlined" 
              sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.5)' }} 
            />
            <Chip 
              icon={<TimelineIcon />} 
              label="数据增强" 
              variant="outlined" 
              sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.5)' }} 
            />
          </Box>
        </Box>
      </Paper>

      {/* 文件上传区域 */}
      <Card 
        elevation={2}
        sx={{ 
          mb: 4, 
          borderRadius: 3,
          border: isDragOver ? '2px dashed #667eea' : '2px dashed transparent',
          transition: 'all 0.3s ease',
          backgroundColor: isDragOver ? 'rgba(102, 126, 234, 0.05)' : 'white'
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <CardContent sx={{ p: 4, textAlign: 'center' }}>
          <UploadIcon 
            sx={{ 
              fontSize: 80, 
              color: isDragOver ? '#667eea' : '#ccc', 
              mb: 2,
              transition: 'color 0.3s ease'
            }} 
          />
          <Typography variant="h5" gutterBottom color={isDragOver ? 'primary' : 'text.secondary'}>
            {isDragOver ? '释放鼠标上传图片' : '拖拽图片到此处或点击上传'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            支持 JPG、PNG、WebP 格式，文件大小不超过 10MB
          </Typography>
          
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            style={{ display: 'none' }}
            id="image-upload"
            ref={fileInputRef}
          />
          <label htmlFor="image-upload">
            <Button 
              variant="contained" 
              component="span" 
              size="large"
              startIcon={<UploadIcon />}
              sx={{ 
                px: 4, 
                py: 1.5,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%)',
                }
              }}
              disabled={isProcessing}
            >
              {isProcessing ? '处理中...' : '选择图片'}
            </Button>
          </label>
        </CardContent>
      </Card>

      {image && (
        <Fade in timeout={800}>
          <Grid container spacing={4}>
            {/* 左侧：图像预览和操作 */}
            <Grid item xs={12} lg={showProcessingPanel ? 8 : 12}>
              <Card elevation={3} sx={{ borderRadius: 3, overflow: 'hidden' }}>
                <Box sx={{ 
                  background: 'linear-gradient(90deg, #f8fafc 0%, #e2e8f0 100%)',
                  p: 2,
                  borderBottom: '1px solid #e2e8f0'
                }}>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <CropIcon color="primary" />
                    <Typography variant="h6" fontWeight="600">
                      图像预览与裁切区域选择
                    </Typography>
                    <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
                      <Tooltip title="缩小">
                        <IconButton 
                          size="small" 
                          onClick={() => setCanvasScale(Math.max(0.1, canvasScale - 0.1))}
                          disabled={canvasScale <= 0.1}
                        >
                          <ZoomOutIcon />
                        </IconButton>
                      </Tooltip>
                      <Chip 
                        label={`${(canvasScale * 100).toFixed(0)}%`} 
                        size="small" 
                        variant="outlined"
                      />
                      <Tooltip title="放大">
                        <IconButton 
                          size="small" 
                          onClick={() => setCanvasScale(Math.min(3, canvasScale + 0.1))}
                          disabled={canvasScale >= 3}
                        >
                          <ZoomInIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Stack>
                </Box>

                <CardContent sx={{ p: 3 }}>
                  {/* 图像处理控制按钮 */}
                  <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Button
                      variant={showProcessingPanel ? "contained" : "outlined"}
                      startIcon={<SettingsIcon />}
                      onClick={() => setShowProcessingPanel(!showProcessingPanel)}
                      sx={{ borderRadius: 2 }}
                    >
                      {showProcessingPanel ? '隐藏' : '显示'}图像处理
                    </Button>
                    {processedImageData && (
                      <Button
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        onClick={() => {
                          setProcessedImageData(null);
                          setCurrentProcessingOptions({});
                          showMessage('已重置图像处理效果', 'info');
                        }}
                        sx={{ borderRadius: 2 }}
                      >
                        重置效果
                      </Button>
                    )}
                  </Box>

                  {/* 画布容器 */}
                  <Paper 
                    elevation={1}
                    sx={{ 
                      p: 2,
                      backgroundColor: '#f8fafc',
                      border: '2px solid #e2e8f0',
                      borderRadius: 2,
                      mb: 3
                    }}
                  >
                    <Grid container spacing={2}>
                      {/* 原始图像画布 */}
                      <Grid item xs={12} md={showProcessingPanel && processedImageData ? 6 : 12}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 500 }}>
                            {crop ? '✅ 已选择锚点区域' : '📍 点击拖动选择锚点区域'}
                          </Typography>
                          <Box sx={{ 
                            display: 'inline-block', 
                            border: '3px solid #e2e8f0', 
                            borderRadius: 2,
                            background: 'white',
                            p: 1
                          }}>
                            <canvas
                              ref={canvasRef}
                              style={{
                                maxWidth: '100%',
                                maxHeight: '500px',
                                cursor: 'crosshair',
                                transform: `scale(${canvasScale})`,
                                transformOrigin: 'center',
                                transition: 'transform 0.2s ease'
                              }}
                              onMouseDown={handleMouseDown}
                              onMouseMove={handleMouseMove}
                              onMouseUp={handleMouseUp}
                              onMouseLeave={handleMouseUp}
                            />
                          </Box>
                        </Box>
                      </Grid>

                      {/* 处理后的图像预览 */}
                      {processedImageData && showProcessingPanel && (
                        <Grid item xs={12} md={6}>
                          <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 500 }}>
                              ✨ 处理后效果预览
                            </Typography>
                            <Box sx={{ 
                              display: 'inline-block', 
                              border: '3px solid #667eea', 
                              borderRadius: 2,
                              background: 'white',
                              p: 1
                            }}>
                              <canvas
                                ref={previewCanvasRef}
                                style={{
                                  maxWidth: '100%',
                                  maxHeight: '500px',
                                  transform: `scale(${canvasScale})`,
                                  transformOrigin: 'center',
                                  transition: 'transform 0.2s ease'
                                }}
                              />
                            </Box>
                          </Box>
                        </Grid>
                      )}
                    </Grid>
                  </Paper>

                  <Divider sx={{ my: 3 }} />

                  {/* 裁切参数控制 */}
                  <Box sx={{ mb: 3 }}>
                    <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                      <SettingsIcon color="primary" />
                      <Typography variant="h6" fontWeight="600">
                        裁切参数设置
                      </Typography>
                    </Stack>
                    
                    <Grid container spacing={3}>
                      <Grid item xs={12} md={6}>
                        <Paper elevation={1} sx={{ p: 3, borderRadius: 2, backgroundColor: '#f8fafc' }}>
                          <Typography variant="subtitle1" gutterBottom fontWeight="500">
                            📏 扩展比例范围：{minExpansion}% - {maxExpansion}%
                          </Typography>
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
                            sx={{ mt: 2 }}
                          />
                        </Paper>
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <Paper elevation={1} sx={{ p: 3, borderRadius: 2, backgroundColor: '#f8fafc' }}>
                          <Typography variant="subtitle1" gutterBottom fontWeight="500">
                            🔢 批量生成数量：{batchCount}张
                          </Typography>
                          <Slider
                            value={batchCount}
                            onChange={(_, value) => setBatchCount(value as number)}
                            min={1}
                            max={50}
                            valueLabelDisplay="auto"
                            marks={[
                              { value: 1, label: '1' },
                              { value: 25, label: '25' },
                              { value: 50, label: '50' },
                            ]}
                            sx={{ mt: 2 }}
                          />
                        </Paper>
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <Paper elevation={1} sx={{ p: 3, borderRadius: 2, backgroundColor: '#f8fafc' }}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={useRandomAspectRatio}
                                onChange={(e) => setUseRandomAspectRatio(e.target.checked)}
                                color="primary"
                              />
                            }
                            label={
                              <Typography fontWeight="500">
                                📐 启用随机高宽比
                              </Typography>
                            }
                          />
                          {useRandomAspectRatio && (
                            <Box sx={{ mt: 2 }}>
                              <Typography variant="body2" gutterBottom>
                                高宽比范围：{aspectRatioRange[0].toFixed(1)} - {aspectRatioRange[1].toFixed(1)}
                              </Typography>
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
                          )}
                        </Paper>
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <Paper elevation={1} sx={{ p: 3, borderRadius: 2, backgroundColor: '#f8fafc' }}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={allowOutOfBounds}
                                onChange={(e) => setAllowOutOfBounds(e.target.checked)}
                                color="primary"
                              />
                            }
                            label={
                              <Typography fontWeight="500">
                                🔒 允许超出原图边界
                              </Typography>
                            }
                          />
                          <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
                            {allowOutOfBounds ? '超出部分将填充黑色' : '裁剪区域将自动调整'}
                          </Typography>
                        </Paper>
                      </Grid>
                    </Grid>
                  </Box>

                  {/* 错误提示 */}
                  {error && (
                    <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>
                      {error}
                    </Alert>
                  )}

                  {/* 生成进度 */}
                  {isGenerating && (
                    <Box sx={{ mt: 3 }}>
                      <Paper elevation={1} sx={{ p: 3, borderRadius: 2, backgroundColor: '#f0f9ff' }}>
                        <LinearProgress 
                          variant="determinate" 
                          value={progress} 
                          sx={{ 
                            height: 8, 
                            borderRadius: 4,
                            backgroundColor: '#e0f2fe',
                            '& .MuiLinearProgress-bar': {
                              backgroundColor: '#0284c7'
                            }
                          }} 
                        />
                        <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 2 }}>
                          🚀 生成进度: {Math.round(progress)}%
                        </Typography>
                      </Paper>
                    </Box>
                  )}

                  {/* 当前状态提示 */}
                  {processedImageData && (
                    <Alert 
                      severity="info" 
                      icon={<MagicIcon />}
                      sx={{ 
                        mt: 3,
                        borderRadius: 2,
                        background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
                        border: '1px solid rgba(102, 126, 234, 0.3)'
                      }}
                    >
                      ✨ 当前将使用图像处理效果进行裁切
                    </Alert>
                  )}

                  {/* 生成按钮 */}
                  <Button
                    variant="contained"
                    size="large"
                    onClick={generateImages}
                    disabled={!crop || isGenerating}
                    startIcon={isGenerating ? <TimelineIcon /> : <MagicIcon />}
                    sx={{ 
                      mt: 3, 
                      width: '100%',
                      py: 2,
                      borderRadius: 3,
                      fontSize: '1.1rem',
                      fontWeight: 600,
                      background: isGenerating 
                        ? 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)'
                        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      '&:hover': {
                        background: isGenerating 
                          ? 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)'
                          : 'linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%)',
                      }
                    }}
                  >
                    {isGenerating ? '生成中...' : '🎯 开始生成裁切结果'}
                  </Button>
                </CardContent>
              </Card>

              {/* 生成结果预览 */}
              {croppedImages.length > 0 && (
                <Fade in timeout={1000}>
                  <Card elevation={3} sx={{ mt: 4, borderRadius: 3 }}>
                    <Box sx={{ 
                      background: 'linear-gradient(90deg, #f0fdf4 0%, #dcfce7 100%)',
                      p: 2,
                      borderBottom: '1px solid #e2e8f0'
                    }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Stack direction="row" alignItems="center" spacing={2}>
                          <SaveIcon color="success" />
                          <Typography variant="h6" fontWeight="600">
                            生成结果预览 ({croppedImages.length}张)
                          </Typography>
                        </Stack>
                        <Button 
                          variant="contained"
                          startIcon={<DownloadIcon />}
                          onClick={downloadImages}
                          sx={{ 
                            borderRadius: 2,
                            background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                            '&:hover': {
                              background: 'linear-gradient(135deg, #047857 0%, #065f46 100%)',
                            }
                          }}
                        >
                          下载所有结果 (ZIP)
                        </Button>
                      </Box>
                    </Box>
                    <CardContent sx={{ p: 3 }}>
                      <Grid container spacing={2}>
                        {croppedImages.map((result, index) => (
                          <Grid item xs={6} sm={4} md={3} lg={2} key={index}>
                            <Card 
                              elevation={2} 
                              sx={{ 
                                borderRadius: 2,
                                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                '&:hover': {
                                  transform: 'translateY(-4px)',
                                  boxShadow: '0 8px 25px rgba(0,0,0,0.15)'
                                }
                              }}
                            >
                              <Box sx={{ p: 1 }}>
                                <img 
                                  src={result.url} 
                                  alt={`Result ${index + 1}`}
                                  style={{ 
                                    width: '100%', 
                                    height: 'auto',
                                    maxHeight: '120px',
                                    objectFit: 'contain',
                                    borderRadius: '4px'
                                  }}
                                />
                              </Box>
                              <Box sx={{ p: 1, pt: 0 }}>
                                <Typography variant="caption" display="block" align="center" color="text.secondary">
                                  #{index + 1} · {result.aspectRatio}
                                </Typography>
                              </Box>
                            </Card>
                          </Grid>
                        ))}
                      </Grid>
                    </CardContent>
                  </Card>
                </Fade>
              )}
            </Grid>

            {/* 右侧：图像处理面板 */}
            {showProcessingPanel && (
              <Grid item xs={12} lg={4}>
                <Fade in timeout={600}>
                  <Card elevation={3} sx={{ borderRadius: 3, maxHeight: 900, overflow: 'auto' }}>
                    <Box sx={{ 
                      background: 'linear-gradient(90deg, #fef3c7 0%, #fde68a 100%)',
                      p: 2,
                      borderBottom: '1px solid #e2e8f0'
                    }}>
                      <Stack direction="row" alignItems="center" spacing={2}>
                        <PaletteIcon color="warning" />
                        <Typography variant="h6" fontWeight="600">
                          图像处理面板
                        </Typography>
                      </Stack>
                    </Box>
                    <CardContent sx={{ p: 2 }}>
                      <ImageProcessingPanel
                        imageData={currentImageData}
                        onProcessedImage={handleProcessedImage}
                        onStatsUpdate={setImageStats}
                      />
                    </CardContent>
                  </Card>
                </Fade>
              </Grid>
            )}
          </Grid>
        </Fade>
      )}

      {/* 消息提示 */}
      <Snackbar 
        open={snackbarOpen} 
        autoHideDuration={4000} 
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setSnackbarOpen(false)} 
          severity={snackbarSeverity}
          sx={{ borderRadius: 2 }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ImageCropper; 