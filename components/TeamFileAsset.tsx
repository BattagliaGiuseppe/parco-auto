"use client";

import { useEffect, useState, type ImgHTMLAttributes, type ReactNode } from "react";
import { resolveTeamFileUrl } from "@/lib/storage";

type TeamFileImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src?: string | null;
  storagePath?: string | null;
  fallbackSrc?: string;
};

export function TeamFileImage({
  src,
  storagePath,
  fallbackSrc = "/logo.png",
  ...props
}: TeamFileImageProps) {
  const hasSource = Boolean(src || storagePath);
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(hasSource ? null : fallbackSrc);

  useEffect(() => {
    let active = true;
    const hasCurrentSource = Boolean(src || storagePath);
    setResolvedSrc(hasCurrentSource ? null : fallbackSrc);

    if (!hasCurrentSource) {
      return () => {
        active = false;
      };
    }

    void resolveTeamFileUrl(src, storagePath)
      .then((url) => {
        if (active) setResolvedSrc(url || fallbackSrc);
      })
      .catch(() => {
        if (active) setResolvedSrc(fallbackSrc);
      });

    return () => {
      active = false;
    };
  }, [src, storagePath, fallbackSrc]);

  return (
    <img
      {...props}
      src={resolvedSrc || fallbackSrc}
      style={{ ...props.style, visibility: resolvedSrc ? "visible" : "hidden" }}
    />
  );
}

type TeamFileLinkProps = {
  src?: string | null;
  storagePath?: string | null;
  children: ReactNode;
  className?: string;
  target?: string;
  rel?: string;
};

export function TeamFileLink({
  src,
  storagePath,
  children,
  className,
  target = "_blank",
  rel = "noreferrer",
}: TeamFileLinkProps) {
  const [resolvedHref, setResolvedHref] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setResolvedHref(null);

    void resolveTeamFileUrl(src, storagePath)
      .then((url) => {
        if (active) setResolvedHref(url);
      })
      .catch(() => {
        if (active) setResolvedHref(null);
      });

    return () => {
      active = false;
    };
  }, [src, storagePath]);

  if (!src && !storagePath) return null;

  return (
    <a
      href={resolvedHref || undefined}
      target={target}
      rel={rel}
      className={className}
      aria-disabled={!resolvedHref}
      onClick={(event) => {
        if (!resolvedHref) event.preventDefault();
      }}
    >
      {children}
    </a>
  );
}
