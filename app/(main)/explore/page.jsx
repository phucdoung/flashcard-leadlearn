'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ExploreRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/community');
  }, [router]);

  return (
    <div className="py-24 text-center text-sm text-[#556551]">
      Đang chuyển tiếp đến Cộng đồng...
    </div>
  );
}
