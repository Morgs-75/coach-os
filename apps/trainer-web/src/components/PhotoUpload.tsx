"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { clsx } from "clsx";

interface PhotoUploadProps {
  bucket: "avatars" | "progress-photos";
  path: string;
  currentUrl?: string | null;
  onUpload: (path: string) => void;
  className?: string;
  shape?: "circle" | "square";
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "w-16 h-16",
  md: "w-24 h-24",
  lg: "w-32 h-32",
};

export function PhotoUpload({
  bucket,
  path,
  currentUrl,
  onUpload,
  className,
  shape = "circle",
  size = "md",
}: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl || null);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      alert("File size must be less than 5MB");
      return;
    }

    setUploading(true);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Generate unique filename
    const fileExt = file.name.split(".").pop();
    const fileName = `${path}/${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (error) {
      console.error("Upload error:", error);
      alert("Failed to upload image");
      setPreview(currentUrl || null);
    } else {
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      onUpload(fileName);
    }

    setUploading(false);
  }

  return (
    <div className={clsx("relative", className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleUpload}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={clsx(
          sizeClasses[size],
          shape === "circle" ? "rounded-full" : "rounded-lg",
          "flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-brand-500 transition-colors bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700",
          uploading && "opacity-50 cursor-wait"
        )}
      >
        {preview ? (
          <img
            src={preview}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-center">
            <svg
              className="mx-auto h-8 w-8 text-gray-400 dark:text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">
              {uploading ? "Uploading..." : "Upload"}
            </p>
          </div>
        )}
      </button>
      {preview && (
        <button
          type="button"
          onClick={() => {
            setPreview(null);
            onUpload("");
          }}
          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600"
        >
          ×
        </button>
      )}
    </div>
  );
}

interface MultiPhotoUploadProps {
  bucket: "progress-photos";
  path: string;
  maxPhotos?: number;
  onUpload: (paths: string[]) => void;
  currentPaths?: string[];
}

export function MultiPhotoUpload({
  bucket,
  path,
  maxPhotos = 4,
  onUpload,
  currentPaths = [],
}: MultiPhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [photos, setPhotos] = useState<string[]>(currentPaths);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remaining = maxPhotos - photos.length;
    if (remaining <= 0) {
      alert(`Maximum ${maxPhotos} photos allowed`);
      return;
    }

    setUploading(true);
    const newPaths: string[] = [];

    for (let i = 0; i < Math.min(files.length, remaining); i++) {
      const file = files[i];

      if (!file.type.startsWith("image/")) continue;
      if (file.size > 5 * 1024 * 1024) continue;

      const fileExt = file.name.split(".").pop();
      const fileName = `${path}/${Date.now()}-${i}.${fileExt}`;

      const { error } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (!error) {
        newPaths.push(fileName);
      }
    }

    const updatedPhotos = [...photos, ...newPaths];
    setPhotos(updatedPhotos);
    onUpload(updatedPhotos);
    setUploading(false);

    // Reset input
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function removePhoto(index: number) {
    const updatedPhotos = photos.filter((_, i) => i !== index);
    setPhotos(updatedPhotos);
    onUpload(updatedPhotos);
  }

  function getPublicUrl(storagePath: string) {
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(storagePath);
    return publicUrl;
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleUpload}
        className="hidden"
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {photos.map((photoPath, index) => (
          <div key={index} className="relative aspect-square">
            <img
              src={getPublicUrl(photoPath)}
              alt={`Photo ${index + 1}`}
              className="w-full h-full object-cover rounded-lg"
            />
            <button
              type="button"
              onClick={() => removePhoto(index)}
              className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600"
            >
              ×
            </button>
          </div>
        ))}

        {photos.length < maxPhotos && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-brand-500 hover:bg-gray-50 dark:bg-gray-800 transition-colors"
          >
            {uploading ? (
              <span className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Uploading...</span>
            ) : (
              <>
                <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">Add Photo</span>
              </>
            )}
          </button>
        )}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-2">
        {photos.length}/{maxPhotos} photos • Max 5MB each
      </p>
    </div>
  );
}
