import Head from 'next/head';
import { Inter } from 'next/font/google';
import styles from '@/styles/Home.module.css';
import ImageCropper from '@/components/ImageCropper';

const inter = Inter({ subsets: ['latin'] });

export default function Home() {
  return (
    <>
      <Head>
        <title>动态区域锚定裁切工具</title>
        <meta name="description" content="图片动态区域锚定裁切工具" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className={`${styles.main} ${inter.className}`}>
        <h1 className={styles.title}>动态区域锚定裁切工具</h1>
        <p className={styles.description}>
          上传图片，框选锚点区域，设置扩展参数，批量生成裁切结果
        </p>
        <ImageCropper />
      </main>
    </>
  );
} 