import Head from 'next/head';
import { Inter } from 'next/font/google';
import styles from '@/styles/Home.module.css';
import ImageCropper from '@/components/ImageCropper';

const inter = Inter({ subsets: ['latin'] });

export default function Home() {
  return (
    <>
      <Head>
        <title>AI 图像锚定裁切工具</title>
        <meta name="description" content="智能图像处理、数据增强、批量裁切、机器学习数据集生成工具" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className={`${styles.main} ${inter.className}`}>
        <ImageCropper />
      </main>
    </>
  );
} 