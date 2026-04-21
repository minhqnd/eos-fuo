"use client";

import { useEffect, useState } from "react";

const MIN_DESKTOP_WIDTH = 1024;

export default function DesktopOnlyGuard({ children }: { children: React.ReactNode }) {
  const [viewportWidth, setViewportWidth] = useState<number>(MIN_DESKTOP_WIDTH);

  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  if (viewportWidth < MIN_DESKTOP_WIDTH) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4 text-slate-800">
        <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-bold">Thiết bị không được hỗ trợ</h1>
          <p className="mt-3 text-sm text-slate-600">
            Ứng dụng này chỉ dùng trên máy tính. Vui lòng mở lại bằng desktop/laptop để tiếp tục.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Chiều ngang hiện tại: <b>{viewportWidth}px</b> • Tối thiểu yêu cầu: <b>{MIN_DESKTOP_WIDTH}px</b>
          </p>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
