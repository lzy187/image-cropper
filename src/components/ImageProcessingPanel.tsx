import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Slider,
  FormControlLabel,
  Switch,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Chip,
  Paper,
  Divider
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { ImageProcessor, ProcessingOptions, ImageStats } from '@/utils/imageProcessing';

interface ImageProcessingPanelProps {
  imageData: ImageData | null;
  onProcessedImage: (processedData: ImageData, options: ProcessingOptions) => void;
  onStatsUpdate: (stats: ImageStats | null) => void;
}

export const ImageProcessingPanel: React.FC<ImageProcessingPanelProps> = ({
  imageData,
  onProcessedImage,
  onStatsUpdate,
}) => {
  const [processingOptions, setProcessingOptions] = useState<ProcessingOptions>({
    blur: 0,
    sharpen: 0,
    brightness: 0,
    contrast: 0,
    saturation: 0,
    noise: 0,
    rotation: 0,
    flipHorizontal: false,
    flipVertical: false,
  });

  const [stats, setStats] = useState<ImageStats | null>(null);

  // 实时预览处理结果
  useEffect(() => {
    if (!imageData) return;

    const processImage = () => {
      try {
        const processed = ImageProcessor.applyProcessing(imageData, processingOptions);
        const imageStats = ImageProcessor.calculateStats(processed);
        
        onProcessedImage(processed, processingOptions);
        setStats(imageStats);
        onStatsUpdate(imageStats);
      } catch (error) {
        console.error('图像处理错误:', error);
      }
    };

    // 使用requestAnimationFrame来优化性能
    const timeoutId = setTimeout(processImage, 100);
    return () => clearTimeout(timeoutId);
  }, [imageData, processingOptions, onProcessedImage, onStatsUpdate]);

  // 处理参数变化
  const handleParameterChange = (param: keyof ProcessingOptions, value: number | boolean) => {
    setProcessingOptions(prev => ({
      ...prev,
      [param]: value,
    }));
  };

  // 重置所有参数
  const resetAllParameters = () => {
    setProcessingOptions({
      blur: 0,
      sharpen: 0,
      brightness: 0,
      contrast: 0,
      saturation: 0,
      noise: 0,
      rotation: 0,
      flipHorizontal: false,
      flipVertical: false,
    });
  };

  // 应用随机变换（数据增强）
  const applyRandomAugmentation = () => {
    setProcessingOptions({
      blur: Math.random() * 2,
      sharpen: Math.random() * 0.5,
      brightness: (Math.random() - 0.5) * 40,
      contrast: (Math.random() - 0.5) * 30,
      saturation: (Math.random() - 0.5) * 40,
      noise: Math.random() * 10,
      rotation: (Math.random() - 0.5) * 30,
      flipHorizontal: Math.random() > 0.5,
      flipVertical: Math.random() > 0.7,
    });
  };

  if (!imageData) {
    return (
      <Paper sx={{ p: 2, textAlign: 'center' }}>
        <Typography color="text.secondary">
          请先上传图片以启用图像处理功能
        </Typography>
      </Paper>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* 控制面板头部 */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          图像处理 & 数据增强
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          <Button variant="outlined" size="small" onClick={resetAllParameters}>
            重置参数
          </Button>
          <Button variant="outlined" size="small" onClick={applyRandomAugmentation}>
            随机增强
          </Button>
        </Box>
      </Box>

      {/* 基础调整 */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>基础调整</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <Typography gutterBottom>亮度: {processingOptions.brightness}</Typography>
              <Slider
                value={processingOptions.brightness || 0}
                onChange={(_, value) => handleParameterChange('brightness', value as number)}
                min={-100}
                max={100}
                marks={[
                  { value: -100, label: '-100' },
                  { value: 0, label: '0' },
                  { value: 100, label: '100' },
                ]}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography gutterBottom>对比度: {processingOptions.contrast}</Typography>
              <Slider
                value={processingOptions.contrast || 0}
                onChange={(_, value) => handleParameterChange('contrast', value as number)}
                min={-100}
                max={100}
                marks={[
                  { value: -100, label: '-100' },
                  { value: 0, label: '0' },
                  { value: 100, label: '100' },
                ]}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography gutterBottom>饱和度: {processingOptions.saturation}</Typography>
              <Slider
                value={processingOptions.saturation || 0}
                onChange={(_, value) => handleParameterChange('saturation', value as number)}
                min={-100}
                max={100}
                marks={[
                  { value: -100, label: '-100' },
                  { value: 0, label: '0' },
                  { value: 100, label: '100' },
                ]}
              />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* 滤镜效果 */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>滤镜效果</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <Typography gutterBottom>高斯模糊: {processingOptions.blur?.toFixed(1)}</Typography>
              <Slider
                value={processingOptions.blur || 0}
                onChange={(_, value) => handleParameterChange('blur', value as number)}
                min={0}
                max={10}
                step={0.1}
                marks={[
                  { value: 0, label: '0' },
                  { value: 5, label: '5' },
                  { value: 10, label: '10' },
                ]}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography gutterBottom>锐化强度: {processingOptions.sharpen?.toFixed(1)}</Typography>
              <Slider
                value={processingOptions.sharpen || 0}
                onChange={(_, value) => handleParameterChange('sharpen', value as number)}
                min={0}
                max={2}
                step={0.1}
                marks={[
                  { value: 0, label: '0' },
                  { value: 1, label: '1' },
                  { value: 2, label: '2' },
                ]}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography gutterBottom>噪声强度: {processingOptions.noise}</Typography>
              <Slider
                value={processingOptions.noise || 0}
                onChange={(_, value) => handleParameterChange('noise', value as number)}
                min={0}
                max={50}
                marks={[
                  { value: 0, label: '0' },
                  { value: 25, label: '25' },
                  { value: 50, label: '50' },
                ]}
              />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* 几何变换 */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>几何变换</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <Typography gutterBottom>旋转角度: {processingOptions.rotation}°</Typography>
              <Slider
                value={processingOptions.rotation || 0}
                onChange={(_, value) => handleParameterChange('rotation', value as number)}
                min={-180}
                max={180}
                marks={[
                  { value: -180, label: '-180°' },
                  { value: 0, label: '0°' },
                  { value: 180, label: '180°' },
                ]}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={processingOptions.flipHorizontal || false}
                      onChange={(e) => handleParameterChange('flipHorizontal', e.target.checked)}
                    />
                  }
                  label="水平翻转"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={processingOptions.flipVertical || false}
                      onChange={(e) => handleParameterChange('flipVertical', e.target.checked)}
                    />
                  }
                  label="垂直翻转"
                />
              </Box>
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* 图像统计信息 */}
      {stats && (
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography>图像统计信息</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" gutterBottom>尺寸信息</Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip label={`宽度: ${stats.width}px`} size="small" />
                  <Chip label={`高度: ${stats.height}px`} size="small" />
                  <Chip 
                    label={`比例: ${(stats.width / stats.height).toFixed(2)}`} 
                    size="small" 
                  />
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" gutterBottom>色彩统计</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Typography variant="body2">
                    RGB均值: ({stats.mean[0].toFixed(1)}, {stats.mean[1].toFixed(1)}, {stats.mean[2].toFixed(1)})
                  </Typography>
                  <Typography variant="body2">
                    RGB标准差: ({stats.std[0].toFixed(1)}, {stats.std[1].toFixed(1)}, {stats.std[2].toFixed(1)})
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>
      )}

      {/* 常用预设 */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>快速预设</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setProcessingOptions({
                blur: 2,
                brightness: 10,
                contrast: 20,
                saturation: 10,
                sharpen: 0,
                noise: 0,
                rotation: 0,
                flipHorizontal: false,
                flipVertical: false,
              })}
            >
              增强对比
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setProcessingOptions({
                blur: 1,
                brightness: -5,
                contrast: -10,
                saturation: -20,
                sharpen: 0,
                noise: 0,
                rotation: 0,
                flipHorizontal: false,
                flipVertical: false,
              })}
            >
              柔和风格
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setProcessingOptions({
                blur: 0,
                brightness: 0,
                contrast: 30,
                saturation: 0,
                sharpen: 1,
                noise: 0,
                rotation: 0,
                flipHorizontal: false,
                flipVertical: false,
              })}
            >
              锐化清晰
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setProcessingOptions({
                blur: 0.5,
                brightness: 5,
                contrast: 0,
                saturation: -30,
                sharpen: 0,
                noise: 2,
                rotation: 0,
                flipHorizontal: false,
                flipVertical: false,
              })}
            >
              复古滤镜
            </Button>
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}; 