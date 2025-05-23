import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { ProcessingOptions } from './imageProcessing';

export interface DatasetItem {
  image: Blob;
  filename: string;
  label?: string;
  metadata?: {
    originalSize: { width: number; height: number };
    processedSize: { width: number; height: number };
    processingOptions: ProcessingOptions;
    timestamp: number;
  };
}

export interface DatasetConfig {
  name: string;
  format: 'classification' | 'detection' | 'segmentation' | 'generic';
  imageFormat: 'jpg' | 'png';
  quality?: number; // For JPEG
  splitRatio?: {
    train: number;
    validation: number;
    test: number;
  };
  includeMetadata: boolean;
  includeOriginals: boolean;
  standardSizes: number[]; // 常见的模型输入尺寸 [224, 256, 512, etc.]
}

export class DatasetExporter {
  
  static async exportDataset(
    items: DatasetItem[],
    config: DatasetConfig
  ): Promise<void> {
    const zip = new JSZip();
    
    // 创建基础文件夹结构
    const datasetFolder = zip.folder(config.name)!;
    
    // 根据格式创建不同的目录结构
    switch (config.format) {
      case 'classification':
        await this.createClassificationStructure(datasetFolder, items, config);
        break;
      case 'detection':
        await this.createDetectionStructure(datasetFolder, items, config);
        break;
      case 'segmentation':
        await this.createSegmentationStructure(datasetFolder, items, config);
        break;
      default:
        await this.createGenericStructure(datasetFolder, items, config);
    }
    
    // 添加数据集信息文件
    await this.addDatasetInfo(datasetFolder, items, config);
    
    // 生成并下载ZIP文件
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `${config.name}_dataset.zip`);
  }
  
  // 分类任务格式 (ImageNet风格)
  private static async createClassificationStructure(
    folder: JSZip,
    items: DatasetItem[],
    config: DatasetConfig
  ): Promise<void> {
    // 创建训练/验证/测试分割
    const splits = this.splitDataset(items, config.splitRatio);
    
    for (const [splitName, splitItems] of Object.entries(splits)) {
      if (splitItems.length === 0) continue;
      
      const splitFolder = folder.folder(splitName)!;
      
      // 按标签分组（如果有的话）
      const labelGroups = this.groupByLabel(splitItems);
      
      for (const [label, labelItems] of Object.entries(labelGroups)) {
        const labelFolder = splitFolder.folder(label || 'unlabeled')!;
        
        for (const item of labelItems) {
          labelFolder.file(item.filename, item.image);
        }
      }
    }
  }
  
  // 目标检测格式 (YOLO/COCO风格)
  private static async createDetectionStructure(
    folder: JSZip,
    items: DatasetItem[],
    config: DatasetConfig
  ): Promise<void> {
    const splits = this.splitDataset(items, config.splitRatio);
    
    // 创建images和labels文件夹
    const imagesFolder = folder.folder('images')!;
    const labelsFolder = folder.folder('labels')!;
    
    for (const [splitName, splitItems] of Object.entries(splits)) {
      if (splitItems.length === 0) continue;
      
      const splitImagesFolder = imagesFolder.folder(splitName)!;
      const splitLabelsFolder = labelsFolder.folder(splitName)!;
      
      for (const item of splitItems) {
        // 保存图像
        splitImagesFolder.file(item.filename, item.image);
        
        // 创建对应的标注文件 (YOLO格式)
        const labelFilename = item.filename.replace(/\.(jpg|jpeg|png)$/i, '.txt');
        const yoloAnnotation = this.generateYOLOAnnotation(item);
        splitLabelsFolder.file(labelFilename, yoloAnnotation);
      }
    }
    
    // 创建数据配置文件
    const dataYaml = this.generateYOLODataYaml(config, Object.keys(splits));
    folder.file('data.yaml', dataYaml);
  }
  
  // 语义分割格式
  private static async createSegmentationStructure(
    folder: JSZip,
    items: DatasetItem[],
    config: DatasetConfig
  ): Promise<void> {
    const splits = this.splitDataset(items, config.splitRatio);
    
    for (const [splitName, splitItems] of Object.entries(splits)) {
      if (splitItems.length === 0) continue;
      
      const imagesFolder = folder.folder(`images/${splitName}`)!;
      const masksFolder = folder.folder(`masks/${splitName}`)!;
      
      for (const item of splitItems) {
        imagesFolder.file(item.filename, item.image);
        
        // 创建对应的掩码文件（这里只是占位符）
        const maskFilename = item.filename.replace(/\.(jpg|jpeg|png)$/i, '_mask.png');
        const emptyMask = await this.generateEmptyMask(item);
        masksFolder.file(maskFilename, emptyMask);
      }
    }
  }
  
  // 通用格式
  private static async createGenericStructure(
    folder: JSZip,
    items: DatasetItem[],
    config: DatasetConfig
  ): Promise<void> {
    const splits = this.splitDataset(items, config.splitRatio);
    
    for (const [splitName, splitItems] of Object.entries(splits)) {
      if (splitItems.length === 0) continue;
      
      const splitFolder = folder.folder(splitName)!;
      
      for (const item of splitItems) {
        splitFolder.file(item.filename, item.image);
      }
    }
    
    // 生成标准尺寸版本
    if (config.standardSizes.length > 0) {
      await this.generateStandardSizes(folder, items, config);
    }
  }
  
  // 生成常见的模型输入尺寸
  private static async generateStandardSizes(
    folder: JSZip,
    items: DatasetItem[],
    config: DatasetConfig
  ): Promise<void> {
    for (const size of config.standardSizes) {
      const sizeFolder = folder.folder(`size_${size}x${size}`)!;
      
      for (const item of items) {
        try {
          const resizedBlob = await this.resizeImage(item.image, size, size);
          sizeFolder.file(item.filename, resizedBlob);
        } catch (error) {
          console.warn(`无法调整图像 ${item.filename} 的尺寸:`, error);
        }
      }
    }
  }
  
  // 调整图像尺寸
  private static async resizeImage(
    imageBlob: Blob,
    width: number,
    height: number
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      img.onload = () => {
        canvas.width = width;
        canvas.height = height;
        
        // 使用双三次插值进行高质量缩放
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('无法生成调整尺寸后的图像'));
          }
        }, 'image/png');
      };
      
      img.onerror = () => reject(new Error('无法加载图像'));
      img.src = URL.createObjectURL(imageBlob);
    });
  }
  
  // 数据集分割
  private static splitDataset(
    items: DatasetItem[],
    splitRatio?: { train: number; validation: number; test: number }
  ): { train: DatasetItem[]; validation: DatasetItem[]; test: DatasetItem[] } {
    if (!splitRatio) {
      return { train: items, validation: [], test: [] };
    }
    
    // 打乱数据
    const shuffled = [...items].sort(() => Math.random() - 0.5);
    const total = shuffled.length;
    
    const trainCount = Math.floor(total * splitRatio.train);
    const validationCount = Math.floor(total * splitRatio.validation);
    
    return {
      train: shuffled.slice(0, trainCount),
      validation: shuffled.slice(trainCount, trainCount + validationCount),
      test: shuffled.slice(trainCount + validationCount),
    };
  }
  
  // 按标签分组
  private static groupByLabel(items: DatasetItem[]): Record<string, DatasetItem[]> {
    return items.reduce((groups, item) => {
      const label = item.label || 'default';
      if (!groups[label]) {
        groups[label] = [];
      }
      groups[label].push(item);
      return groups;
    }, {} as Record<string, DatasetItem[]>);
  }
  
  // 生成YOLO格式的标注
  private static generateYOLOAnnotation(item: DatasetItem): string {
    // 这里返回空的标注文件，实际应用中需要根据具体的标注信息生成
    // 格式: class_id center_x center_y width height (归一化坐标)
    return ''; // 占位符
  }
  
  // 生成YOLO数据配置文件
  private static generateYOLODataYaml(
    config: DatasetConfig,
    splits: string[]
  ): string {
    const yaml = [
      `# ${config.name} Dataset Configuration`,
      `# Generated at ${new Date().toISOString()}`,
      '',
      '# Dataset paths',
      'path: ./',
      ...splits.map(split => `${split}: images/${split}`),
      '',
      '# Classes',
      'nc: 1  # number of classes',
      'names: ["object"]  # class names',
      '',
      '# Additional info',
      `description: "${config.name} dataset for object detection"`,
      `format: "YOLO"`,
    ].join('\n');
    
    return yaml;
  }
  
  // 生成空的掩码图像
  private static async generateEmptyMask(item: DatasetItem): Promise<Blob> {
    // 创建一个黑色掩码作为占位符
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    // 设置尺寸（这里使用默认尺寸，实际应该根据原图尺寸）
    canvas.width = item.metadata?.processedSize.width || 256;
    canvas.height = item.metadata?.processedSize.height || 256;
    
    // 填充黑色
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('无法生成掩码'));
      }, 'image/png');
    });
  }
  
  // 添加数据集信息文件
  private static async addDatasetInfo(
    folder: JSZip,
    items: DatasetItem[],
    config: DatasetConfig
  ): Promise<void> {
    const info = {
      dataset_name: config.name,
      format: config.format,
      created_at: new Date().toISOString(),
      total_images: items.length,
      image_format: config.imageFormat,
      split_ratio: config.splitRatio,
      standard_sizes: config.standardSizes,
      processing_summary: this.generateProcessingSummary(items),
      statistics: this.generateDatasetStatistics(items),
    };
    
    // JSON格式
    folder.file('dataset_info.json', JSON.stringify(info, null, 2));
    
    // README文件
    const readme = this.generateReadme(config, info);
    folder.file('README.md', readme);
    
    // 如果包含元数据，生成详细的元数据文件
    if (config.includeMetadata) {
      const metadata = items.map(item => ({
        filename: item.filename,
        label: item.label,
        metadata: item.metadata,
      }));
      folder.file('metadata.json', JSON.stringify(metadata, null, 2));
    }
  }
  
  // 生成处理摘要
  private static generateProcessingSummary(items: DatasetItem[]): any {
    const processingCounts = items.reduce((counts, item) => {
      if (!item.metadata?.processingOptions) return counts;
      
      const options = item.metadata.processingOptions;
      Object.entries(options).forEach(([key, value]) => {
        if (value !== 0 && value !== false && value !== undefined) {
          counts[key] = (counts[key] || 0) + 1;
        }
      });
      
      return counts;
    }, {} as Record<string, number>);
    
    return {
      total_processed: items.filter(item => item.metadata?.processingOptions).length,
      processing_applied: processingCounts,
    };
  }
  
  // 生成数据集统计信息
  private static generateDatasetStatistics(items: DatasetItem[]): any {
    const sizes = items
      .filter(item => item.metadata?.processedSize)
      .map(item => item.metadata!.processedSize);
    
    const labels = items
      .filter(item => item.label)
      .reduce((counts, item) => {
        counts[item.label!] = (counts[item.label!] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);
    
    return {
      image_count: items.length,
      unique_labels: Object.keys(labels).length,
      label_distribution: labels,
      size_range: sizes.length > 0 ? {
        min_width: Math.min(...sizes.map(s => s.width)),
        max_width: Math.max(...sizes.map(s => s.width)),
        min_height: Math.min(...sizes.map(s => s.height)),
        max_height: Math.max(...sizes.map(s => s.height)),
      } : null,
    };
  }
  
  // 生成README文档
  private static generateReadme(config: DatasetConfig, info: any): string {
    return `# ${config.name} Dataset

## Overview
This dataset was generated using the Image Anchor Cropper tool.

- **Format**: ${config.format}
- **Total Images**: ${info.total_images}
- **Created**: ${info.created_at}
- **Image Format**: ${config.imageFormat}

## Structure
${this.getStructureDescription(config.format)}

## Statistics
- **Total Images**: ${info.statistics.image_count}
- **Unique Labels**: ${info.statistics.unique_labels}
${info.statistics.label_distribution ? 
  `- **Label Distribution**:\n${Object.entries(info.statistics.label_distribution)
    .map(([label, count]) => `  - ${label}: ${count}`)
    .join('\n')}` : ''}

## Standard Sizes
${config.standardSizes.length > 0 ? 
  `The following standard sizes are available:\n${config.standardSizes.map(size => `- ${size}x${size}`).join('\n')}` :
  'No standard sizes generated.'}

## Usage
This dataset is ready for use with popular machine learning frameworks:
- PyTorch
- TensorFlow
- YOLO (if detection format)
- And more

## Processing Applied
${info.processing_summary.total_processed > 0 ?
  `${info.processing_summary.total_processed} images had processing applied:\n${Object.entries(info.processing_summary.processing_applied)
    .map(([process, count]) => `- ${process}: ${count} images`)
    .join('\n')}` :
  'No image processing was applied.'}

Generated with Image Anchor Cropper Tool
`;
  }
  
  private static getStructureDescription(format: string): string {
    switch (format) {
      case 'classification':
        return `\`\`\`
dataset/
├── train/
│   ├── class1/
│   └── class2/
├── validation/
│   ├── class1/
│   └── class2/
└── test/
    ├── class1/
    └── class2/
\`\`\``;
      case 'detection':
        return `\`\`\`
dataset/
├── images/
│   ├── train/
│   ├── validation/
│   └── test/
├── labels/
│   ├── train/
│   ├── validation/
│   └── test/
└── data.yaml
\`\`\``;
      case 'segmentation':
        return `\`\`\`
dataset/
├── images/
│   ├── train/
│   ├── validation/
│   └── test/
└── masks/
    ├── train/
    ├── validation/
    └── test/
\`\`\``;
      default:
        return `\`\`\`
dataset/
├── train/
├── validation/
└── test/
\`\`\``;
    }
  }
} 