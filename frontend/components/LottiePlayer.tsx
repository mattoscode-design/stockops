"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

const LottieReact = dynamic(() => import("lottie-react"), { ssr: false });

interface Props {
  animationData: object;
  width?: number | string;
  height?: number | string;
  loop?: boolean;
  style?: React.CSSProperties;
}

export default function LottiePlayer({ animationData, width = "100%", height = 300, loop = true, style }: Props) {
  return (
    <Suspense fallback={<div style={{ width, height }} />}>
      <LottieReact
        animationData={animationData}
        loop={loop}
        style={{ width, height, ...style }}
      />
    </Suspense>
  );
}
