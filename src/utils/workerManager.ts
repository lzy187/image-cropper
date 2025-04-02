export interface ImageData {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
  readonly colorSpace: 'srgb' | 'display-p3';
}

export interface CropArea {
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

interface Task {
  resolve: (value: ImageData) => void;
  reject: (reason?: any) => void;
}

export class WorkerManager {
  private workers: Worker[];
  private taskQueue: Task[] = [];
  private workerIndex: number = 0;

  constructor() {
    // 创建多个 worker
    const numWorkers = navigator.hardwareConcurrency || 4;
    this.workers = Array(numWorkers).fill(null).map(() => {
      const worker = new Worker(new URL('../workers/imageWorker.ts', import.meta.url));
      worker.onmessage = this.handleWorkerMessage.bind(this, worker);
      worker.onerror = this.handleWorkerError.bind(this, worker);
      return worker;
    });
  }

  private handleWorkerMessage(worker: Worker, event: MessageEvent<WorkerResponse>) {
    const task = this.taskQueue.shift();
    if (!task) return;

    if (event.data.type === 'PROCESSED_IMAGE') {
      task.resolve(event.data.payload.imageData);
    } else {
      task.reject(new Error('Invalid response from worker'));
    }
  }

  private handleWorkerError(worker: Worker, event: ErrorEvent) {
    const task = this.taskQueue.shift();
    if (task) {
      task.reject(new Error(event.message));
    }
  }

  public async processImage(
    imageData: ImageData,
    cropArea: CropArea,
    expansionPercent: number
  ): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      this.taskQueue.push({ resolve, reject });

      const worker = this.workers[this.workerIndex];
      this.workerIndex = (this.workerIndex + 1) % this.workers.length;

      const message: WorkerMessage = {
        type: 'PROCESS_IMAGE',
        payload: {
          imageData,
          cropArea,
          expansionPercent
        }
      };

      worker.postMessage(message);
    });
  }

  public terminate() {
    this.workers.forEach(worker => worker.terminate());
    this.taskQueue = [];
  }
} 