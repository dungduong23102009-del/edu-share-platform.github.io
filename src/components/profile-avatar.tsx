"use client";
import Image from "next/image";
import { useState } from "react";
export function ProfileAvatar({
  url,
  initials,
}: {
  url: string | null;
  initials: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return (
    <span className="avatar">
      {url && failedUrl !== url ? (
        <Image
          src={url}
          alt=""
          width={36}
          height={36}
          unoptimized
          onError={() => setFailedUrl(url)}
        />
      ) : (
        initials
      )}
    </span>
  );
}
